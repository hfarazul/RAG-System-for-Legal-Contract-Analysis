import 'dotenv/config';
import { AnalyzerAgent } from '../src/agents/analyzer.js';

const testQueries = [
  {
    query: "Is liability capped in the NDA?",
    shouldCrossRef: ["VSA", "Vendor Services Agreement"],
    shouldFlag: true,
  },
  {
    query: "Is there any unlimited liability in these agreements?",
    shouldCrossRef: ["NDA"],
    shouldFlag: true,
  },
  {
    query: "What is the uptime commitment in the SLA?",
    shouldCrossRef: [],  // Simple query, but should flag sole remedy risk
    shouldFlag: true,
  },
  {
    query: "Can Vendor XYZ share Acme's confidential data with subcontractors?",
    shouldCrossRef: ["DPA", "NDA"],
    shouldFlag: false,
  },
];

async function main() {
  const agent = new AnalyzerAgent();
  await agent.initialize();

  for (const test of testQueries) {
    agent.clearHistory();

    console.log('\n' + '='.repeat(70));
    console.log(`Query: "${test.query}"`);
    console.log('='.repeat(70));

    const response = await agent.chatSync(test.query);
    console.log(response);

    // Check cross-references
    if (test.shouldCrossRef.length > 0) {
      const hasCrossRef = test.shouldCrossRef.some(doc =>
        response.includes(doc)
      );
      console.log('\n' + '-'.repeat(40));
      console.log(`Cross-reference check: ${hasCrossRef ? '✓ Found' : '✗ Missing'} (expected: ${test.shouldCrossRef.join(', ')})`);
    }

    // Check risk flag
    const hasRisk = response.includes('⚠️') || response.toLowerCase().includes('risk');
    if (test.shouldFlag) {
      console.log(`Risk flag check: ${hasRisk ? '✓ Flagged' : '✗ Not flagged'}`);
    }
  }
}

main();
