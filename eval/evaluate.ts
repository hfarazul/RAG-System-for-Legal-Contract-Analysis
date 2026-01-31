import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { retrieveChunks } from '../src/retrieval/retriever.js';
import { getAnalyzerAgent } from '../src/agents/analyzer.js';
import { judgeResponse, calculateAverageScores, type JudgeScores } from './llmJudge.js';

interface TestCase {
  id: string;
  query?: string;
  expectedChunks?: string[];
  shouldContain?: string[];
  shouldRefuse?: boolean;
  expectRiskFlag?: boolean;
  category: string;
  // Multi-turn fields
  initialQuery?: string;
  followUp?: string;
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
  fullResponse: string;  // Full untruncated response
  context: string;       // Retrieved context
  refusedCorrectly: boolean;
  shouldRefuse: boolean;
  passed: boolean;
  llmScores?: JudgeScores;
}

interface MultiTurnResult {
  testId: string;
  initialQuery: string;
  followUp: string;
  initialResponse: string;
  fullInitialResponse: string;  // Full untruncated
  followUpResponse: string;
  fullFollowUpResponse: string; // Full untruncated
  context: string;              // Retrieved context
  passed: boolean;
  llmScores?: JudgeScores;
}

interface EvaluationReport {
  timestamp: string;
  retrievalResults: RetrievalResult[];
  answerResults: AnswerResult[];
  multiTurnResults: MultiTurnResult[];
  summary: {
    totalTests: number;
    retrievalTests: number;
    retrievalPassed: number;
    avgPrecision: number;
    avgRecall: number;
    answerTests: number;
    answerPassed: number;
    outOfScopeAccuracy: number;
    multiTurnTests: number;
    multiTurnPassed: number;
    llmJudge?: {
      avgFaithfulness: number;
      avgRelevance: number;
      avgCompleteness: number;
      avgCitationAccuracy: number;
    };
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

    const retrieved = await retrieveChunks(tc.query, { topK: 5, skipRerank: true });
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
async function evaluateAnswers(testCases: TestCase[], useLlmJudge: boolean = true): Promise<AnswerResult[]> {
  const results: AnswerResult[] = [];

  console.log(`\nEvaluating answers (${testCases.length} tests)...`);
  if (useLlmJudge) {
    console.log('  (Using GPT-4o as judge)');
  }

  const agent = await getAnalyzerAgent();

  for (const tc of testCases) {
    process.stdout.write(`  ${tc.id}: `);

    // Clear history for each test
    agent.clearHistory();

    // Get retrieved context for the judge
    // Note: This retrieves the same top-5 chunks the agent would use
    const retrieved = await retrieveChunks(tc.query!, { topK: 5 });
    const context = retrieved.map(r => `${r.citation}\n${r.content}`).join('\n\n---\n\n');

    const response = await agent.chatSync(tc.query!);
    const responseLower = response.toLowerCase();

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

    // LLM Judge evaluation (skip for out-of-scope tests)
    let llmScores: JudgeScores | undefined;
    if (useLlmJudge && !shouldRefuse) {
      llmScores = await judgeResponse(tc.query!, response, context);
      process.stdout.write(` [Judge: F${llmScores.faithfulness}/R${llmScores.relevance}/C${llmScores.completeness}/A${llmScores.citationAccuracy}]`);
    }

    // Pass criteria: refusal tests use keyword detection, others use LLM judge faithfulness >= 3
    const passed = shouldRefuse
      ? refusedCorrectly
      : (llmScores ? llmScores.faithfulness >= 3 : true);

    results.push({
      testId: tc.id,
      query: tc.query,
      response: response.slice(0, 500) + (response.length > 500 ? '...' : ''),
      fullResponse: response,
      context,
      refusedCorrectly,
      shouldRefuse,
      passed,
      llmScores,
    });

    console.log(passed ? ' ✓' : ' ✗');
  }

  return results;
}

/**
 * Evaluate multi-turn conversations
 */
async function evaluateMultiTurn(testCases: TestCase[]): Promise<MultiTurnResult[]> {
  const results: MultiTurnResult[] = [];

  const multiTurnTests = testCases.filter(tc => tc.category === 'multi-turn');

  if (multiTurnTests.length === 0) {
    return results;
  }

  console.log(`\nEvaluating multi-turn conversations (${multiTurnTests.length} tests)...`);

  const { getAnalyzerAgent } = await import('../src/agents/analyzer.js');

  for (const tc of multiTurnTests) {
    process.stdout.write(`  ${tc.id}: `);

    const agent = await getAnalyzerAgent();
    agent.clearHistory();  // Clear history from previous tests

    // Send initial query
    const initialResponse = await agent.chatSync(tc.initialQuery!);

    // Send follow-up (same agent maintains history)
    const followUpResponse = await agent.chatSync(tc.followUp!);

    // Get context for LLM judge
    const retrieved = await retrieveChunks(tc.followUp!, { topK: 5 });
    const context = retrieved.map(r => `${r.citation}\n${r.content}`).join('\n\n---\n\n');

    // Use LLM judge for multi-turn evaluation
    const llmScores = await judgeResponse(tc.followUp!, followUpResponse, context);
    process.stdout.write(` [Judge: F${llmScores.faithfulness}/R${llmScores.relevance}/C${llmScores.completeness}/A${llmScores.citationAccuracy}]`);

    // Pass if faithfulness >= 3
    const passed = llmScores.faithfulness >= 3;

    results.push({
      testId: tc.id,
      initialQuery: tc.initialQuery!,
      followUp: tc.followUp!,
      initialResponse: initialResponse.slice(0, 300) + (initialResponse.length > 300 ? '...' : ''),
      fullInitialResponse: initialResponse,
      followUpResponse: followUpResponse.slice(0, 300) + (followUpResponse.length > 300 ? '...' : ''),
      fullFollowUpResponse: followUpResponse,
      context,
      passed,
      llmScores,
    });

    console.log(passed ? ' ✓' : ' ✗');
  }

  return results;
}

/**
 * Generate evaluation report
 */
function generateReport(
  retrievalResults: RetrievalResult[],
  answerResults: AnswerResult[],
  multiTurnResults: MultiTurnResult[]
): EvaluationReport {
  const avgPrecision = retrievalResults.length > 0
    ? retrievalResults.reduce((sum, r) => sum + r.precision, 0) / retrievalResults.length
    : 0;

  const avgRecall = retrievalResults.length > 0
    ? retrievalResults.reduce((sum, r) => sum + r.recall, 0) / retrievalResults.length
    : 0;

  const outOfScopeTests = answerResults.filter(r => r.shouldRefuse);
  const outOfScopeAccuracy = outOfScopeTests.length > 0
    ? outOfScopeTests.filter(r => r.refusedCorrectly).length / outOfScopeTests.length
    : 1;

  // Calculate LLM judge averages
  const resultsWithScores = answerResults.filter(r => r.llmScores);
  let llmJudge: EvaluationReport['summary']['llmJudge'];

  if (resultsWithScores.length > 0) {
    const avgScores = calculateAverageScores(resultsWithScores.map(r => r.llmScores!));
    llmJudge = {
      avgFaithfulness: avgScores.faithfulness,
      avgRelevance: avgScores.relevance,
      avgCompleteness: avgScores.completeness,
      avgCitationAccuracy: avgScores.citationAccuracy,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    retrievalResults,
    answerResults,
    multiTurnResults,
    summary: {
      totalTests: answerResults.length + multiTurnResults.length,
      retrievalTests: retrievalResults.length,
      retrievalPassed: retrievalResults.filter(r => r.passed).length,
      avgPrecision,
      avgRecall,
      answerTests: answerResults.length,
      answerPassed: answerResults.filter(r => r.passed).length,
      outOfScopeAccuracy,
      multiTurnTests: multiTurnResults.length,
      multiTurnPassed: multiTurnResults.filter(r => r.passed).length,
      llmJudge,
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
  console.log(`  Out-of-Scope Accuracy: ${(summary.outOfScopeAccuracy * 100).toFixed(1)}%`);

  if (summary.multiTurnTests > 0) {
    console.log('\nMulti-Turn Metrics:');
    console.log(`  Tests Passed: ${summary.multiTurnPassed}/${summary.multiTurnTests}`);
  }

  if (summary.llmJudge) {
    console.log('\nLLM Judge Scores (GPT-4o):');
    console.log(`  Avg Faithfulness:      ${summary.llmJudge.avgFaithfulness.toFixed(2)}/5`);
    console.log(`  Avg Relevance:         ${summary.llmJudge.avgRelevance.toFixed(2)}/5`);
    console.log(`  Avg Completeness:      ${summary.llmJudge.avgCompleteness.toFixed(2)}/5`);
    console.log(`  Avg Citation Accuracy: ${summary.llmJudge.avgCitationAccuracy.toFixed(2)}/5`);
  }

  console.log('\nOverall:');
  const multiTurnScore = summary.multiTurnTests > 0
    ? (summary.multiTurnPassed / summary.multiTurnTests)
    : 1;
  const llmJudgeScore = summary.llmJudge
    ? (summary.llmJudge.avgFaithfulness + summary.llmJudge.avgRelevance +
       summary.llmJudge.avgCompleteness + summary.llmJudge.avgCitationAccuracy) / 20
    : 1;
  const overallScore = (
    (summary.retrievalPassed / summary.retrievalTests) * 0.25 +
    (summary.answerPassed / summary.answerTests) * 0.35 +
    summary.outOfScopeAccuracy * 0.10 +
    multiTurnScore * 0.05 +
    llmJudgeScore * 0.25
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

  // Separate single-turn and multi-turn tests
  const singleTurnTests = testCases.filter(tc => tc.category !== 'multi-turn');
  const multiTurnTests = testCases.filter(tc => tc.category === 'multi-turn');

  console.log(`\nLoaded ${testCases.length} test cases (${singleTurnTests.length} single-turn, ${multiTurnTests.length} multi-turn)`);

  // Run evaluations
  const retrievalResults = await evaluateRetrieval(singleTurnTests);
  const answerResults = await evaluateAnswers(singleTurnTests);
  const multiTurnResults = await evaluateMultiTurn(multiTurnTests);

  // Generate and print report
  const report = generateReport(retrievalResults, answerResults, multiTurnResults);
  printSummary(report);

  // Save full report
  const reportPath = path.join(process.cwd(), 'eval', 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);

  // Save detailed output with full prompts and responses
  const detailedOutput: string[] = [];
  detailedOutput.push('# Detailed Evaluation Output');
  detailedOutput.push(`Generated: ${new Date().toISOString()}`);
  detailedOutput.push('');

  // Answer results with full details
  detailedOutput.push('## Answer Tests\n');
  for (const result of report.answerResults) {
    detailedOutput.push(`### ${result.testId} ${result.passed ? '✓' : '✗'}`);
    detailedOutput.push(`**Category:** ${testCases.find(tc => tc.id === result.testId)?.category || 'unknown'}`);
    detailedOutput.push(`**Query:** ${result.query}`);
    if (result.llmScores) {
      detailedOutput.push(`**LLM Judge:** F${result.llmScores.faithfulness}/R${result.llmScores.relevance}/C${result.llmScores.completeness}/A${result.llmScores.citationAccuracy}`);
    }
    detailedOutput.push('');
    detailedOutput.push('**Retrieved Context:**');
    detailedOutput.push('```');
    detailedOutput.push(result.context || '(no context)');
    detailedOutput.push('```');
    detailedOutput.push('');
    detailedOutput.push('**Response:**');
    detailedOutput.push('```');
    detailedOutput.push(result.fullResponse || result.response);
    detailedOutput.push('```');
    detailedOutput.push('');
    detailedOutput.push('---\n');
  }

  // Multi-turn results with full details
  if (report.multiTurnResults.length > 0) {
    detailedOutput.push('## Multi-Turn Tests\n');
    for (const result of report.multiTurnResults) {
      detailedOutput.push(`### ${result.testId} ${result.passed ? '✓' : '✗'}`);
      if (result.llmScores) {
        detailedOutput.push(`**LLM Judge:** F${result.llmScores.faithfulness}/R${result.llmScores.relevance}/C${result.llmScores.completeness}/A${result.llmScores.citationAccuracy}`);
      }
      detailedOutput.push('');
      detailedOutput.push('**Initial Query:**');
      detailedOutput.push(`> ${result.initialQuery}`);
      detailedOutput.push('');
      detailedOutput.push('**Initial Response:**');
      detailedOutput.push('```');
      detailedOutput.push(result.fullInitialResponse || result.initialResponse);
      detailedOutput.push('```');
      detailedOutput.push('');
      detailedOutput.push('**Follow-Up Query:**');
      detailedOutput.push(`> ${result.followUp}`);
      detailedOutput.push('');
      detailedOutput.push('**Follow-Up Response:**');
      detailedOutput.push('```');
      detailedOutput.push(result.fullFollowUpResponse || result.followUpResponse);
      detailedOutput.push('```');
      detailedOutput.push('');
      detailedOutput.push('---\n');
    }
  }

  const detailedPath = path.join(process.cwd(), 'eval', 'detailed_output.md');
  await fs.writeFile(detailedPath, detailedOutput.join('\n'));
  console.log(`Detailed output saved to: ${detailedPath}`);
}

main().catch(error => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
