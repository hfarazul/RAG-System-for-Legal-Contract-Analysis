import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { retrieveChunks } from '../src/retrieval/retriever.js';
import { getAnalyzerAgent } from '../src/agents/analyzer.js';

interface TestCase {
  id: string;
  query: string;
  expectedChunks?: string[];
  shouldContain?: string[];
  shouldRefuse?: boolean;
  expectRiskFlag?: boolean;
  category: string;
}

interface RetrievalResult {
  testId: string;
  query: string;
  expectedChunks: string[];
  retrievedChunks: string[];
  precision: number;
  recall: number;
  passed: boolean;
}

interface AnswerResult {
  testId: string;
  query: string;
  response: string;
  containsExpected: boolean;
  hasRiskFlag: boolean;
  expectRiskFlag: boolean;
  refusedCorrectly: boolean;
  shouldRefuse: boolean;
  passed: boolean;
}

interface EvaluationReport {
  timestamp: string;
  retrievalResults: RetrievalResult[];
  answerResults: AnswerResult[];
  summary: {
    totalTests: number;
    retrievalTests: number;
    retrievalPassed: number;
    avgPrecision: number;
    avgRecall: number;
    answerTests: number;
    answerPassed: number;
    riskFlagAccuracy: number;
    outOfScopeAccuracy: number;
  };
}

/**
 * Evaluate retrieval quality
 */
async function evaluateRetrieval(testCases: TestCase[]): Promise<RetrievalResult[]> {
  const results: RetrievalResult[] = [];

  const retrievalTests = testCases.filter(tc => tc.expectedChunks && tc.expectedChunks.length > 0);

  console.log(`\nEvaluating retrieval (${retrievalTests.length} tests)...`);

  for (const tc of retrievalTests) {
    process.stdout.write(`  ${tc.id}: `);

    const retrieved = await retrieveChunks(tc.query, { topK: 5 });
    const retrievedIds = retrieved.map(r => {
      // Extract chunk ID from citation, e.g., "[Non-Disclosure Agreement, Section 3: Term and Termination]" -> "nda-s3"
      const match = r.citation.match(/\[(.+?), Section (\d+)/);
      if (match) {
        const docMap: Record<string, string> = {
          'Non-Disclosure Agreement': 'nda',
          'Vendor Services Agreement': 'vsa',
          'Service Level Agreement': 'sla',
          'Data Processing Agreement': 'dpa',
        };
        const docType = docMap[match[1]] || match[1].toLowerCase();
        return `${docType}-s${match[2]}`;
      }
      return '';
    }).filter(Boolean);

    const expectedSet = new Set(tc.expectedChunks!);
    const retrievedSet = new Set(retrievedIds);

    // Calculate precision and recall
    const intersection = [...expectedSet].filter(x => retrievedSet.has(x));
    const precision = retrievedIds.length > 0 ? intersection.length / retrievedIds.length : 0;
    const recall = tc.expectedChunks!.length > 0 ? intersection.length / tc.expectedChunks!.length : 0;

    const passed = recall >= 0.5; // At least 50% of expected chunks retrieved

    results.push({
      testId: tc.id,
      query: tc.query,
      expectedChunks: tc.expectedChunks!,
      retrievedChunks: retrievedIds,
      precision,
      recall,
      passed,
    });

    console.log(passed ? '✓' : '✗', `(recall: ${(recall * 100).toFixed(0)}%)`);
  }

  return results;
}

/**
 * Evaluate answer quality
 */
async function evaluateAnswers(testCases: TestCase[]): Promise<AnswerResult[]> {
  const results: AnswerResult[] = [];

  console.log(`\nEvaluating answers (${testCases.length} tests)...`);

  const agent = await getAnalyzerAgent();

  for (const tc of testCases) {
    process.stdout.write(`  ${tc.id}: `);

    // Clear history for each test
    agent.clearHistory();

    const response = await agent.chatSync(tc.query);
    const responseLower = response.toLowerCase();

    // Check if response contains expected keywords
    let containsExpected = true;
    if (tc.shouldContain) {
      containsExpected = tc.shouldContain.some(keyword =>
        responseLower.includes(keyword.toLowerCase())
      );
    }

    // Check for risk flag
    const hasRiskFlag = response.includes('⚠️') || response.toLowerCase().includes('risk:');
    const expectRiskFlag = tc.expectRiskFlag || false;

    // Check if correctly refused out-of-scope
    const shouldRefuse = tc.shouldRefuse || false;
    let refusedCorrectly = true;
    if (shouldRefuse) {
      refusedCorrectly = responseLower.includes('cannot') ||
                         responseLower.includes('unable') ||
                         responseLower.includes('only analyze') ||
                         responseLower.includes('not able') ||
                         responseLower.includes("can't");
    }

    const passed = containsExpected &&
                   (!shouldRefuse || refusedCorrectly) &&
                   (!expectRiskFlag || hasRiskFlag);

    results.push({
      testId: tc.id,
      query: tc.query,
      response: response.slice(0, 500) + (response.length > 500 ? '...' : ''),
      containsExpected,
      hasRiskFlag,
      expectRiskFlag,
      refusedCorrectly,
      shouldRefuse,
      passed,
    });

    console.log(passed ? '✓' : '✗');
  }

  return results;
}

/**
 * Generate evaluation report
 */
function generateReport(
  retrievalResults: RetrievalResult[],
  answerResults: AnswerResult[]
): EvaluationReport {
  const avgPrecision = retrievalResults.length > 0
    ? retrievalResults.reduce((sum, r) => sum + r.precision, 0) / retrievalResults.length
    : 0;

  const avgRecall = retrievalResults.length > 0
    ? retrievalResults.reduce((sum, r) => sum + r.recall, 0) / retrievalResults.length
    : 0;

  const riskTests = answerResults.filter(r => r.expectRiskFlag);
  const riskFlagAccuracy = riskTests.length > 0
    ? riskTests.filter(r => r.hasRiskFlag).length / riskTests.length
    : 1;

  const outOfScopeTests = answerResults.filter(r => r.shouldRefuse);
  const outOfScopeAccuracy = outOfScopeTests.length > 0
    ? outOfScopeTests.filter(r => r.refusedCorrectly).length / outOfScopeTests.length
    : 1;

  return {
    timestamp: new Date().toISOString(),
    retrievalResults,
    answerResults,
    summary: {
      totalTests: answerResults.length,
      retrievalTests: retrievalResults.length,
      retrievalPassed: retrievalResults.filter(r => r.passed).length,
      avgPrecision,
      avgRecall,
      answerTests: answerResults.length,
      answerPassed: answerResults.filter(r => r.passed).length,
      riskFlagAccuracy,
      outOfScopeAccuracy,
    },
  };
}

/**
 * Print summary
 */
function printSummary(report: EvaluationReport): void {
  const { summary } = report;

  console.log('\n' + '='.repeat(60));
  console.log('                    EVALUATION SUMMARY');
  console.log('='.repeat(60));

  console.log('\nRetrieval Metrics:');
  console.log(`  Tests Passed: ${summary.retrievalPassed}/${summary.retrievalTests}`);
  console.log(`  Avg Precision: ${(summary.avgPrecision * 100).toFixed(1)}%`);
  console.log(`  Avg Recall: ${(summary.avgRecall * 100).toFixed(1)}%`);

  console.log('\nAnswer Metrics:');
  console.log(`  Tests Passed: ${summary.answerPassed}/${summary.answerTests}`);
  console.log(`  Risk Flag Accuracy: ${(summary.riskFlagAccuracy * 100).toFixed(1)}%`);
  console.log(`  Out-of-Scope Accuracy: ${(summary.outOfScopeAccuracy * 100).toFixed(1)}%`);

  console.log('\nOverall:');
  const overallScore = (
    (summary.retrievalPassed / summary.retrievalTests) * 0.3 +
    (summary.answerPassed / summary.answerTests) * 0.5 +
    summary.riskFlagAccuracy * 0.1 +
    summary.outOfScopeAccuracy * 0.1
  ) * 100;
  console.log(`  Score: ${overallScore.toFixed(1)}%`);

  console.log('='.repeat(60));
}

/**
 * Main evaluation function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('     Legal Contract Analysis - Evaluation Suite');
  console.log('='.repeat(60));

  // Load test cases
  const testCasesPath = path.join(process.cwd(), 'eval', 'testCases.json');
  const testCases: TestCase[] = JSON.parse(await fs.readFile(testCasesPath, 'utf-8'));

  console.log(`\nLoaded ${testCases.length} test cases`);

  // Run evaluations
  const retrievalResults = await evaluateRetrieval(testCases);
  const answerResults = await evaluateAnswers(testCases);

  // Generate and print report
  const report = generateReport(retrievalResults, answerResults);
  printSummary(report);

  // Save full report
  const reportPath = path.join(process.cwd(), 'eval', 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);
}

main().catch(error => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
