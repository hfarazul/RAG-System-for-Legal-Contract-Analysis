import 'dotenv/config';
import { AnalyzerAgent } from '../src/agents/analyzer.js';

async function main() {
  const agent = new AnalyzerAgent();
  await agent.initialize();

  console.log('Query: "Which law governs the Vendor Services Agreement?"\n');
  console.log('Response:');
  console.log('-'.repeat(60));

  const response = await agent.chatSync('Which law governs the Vendor Services Agreement?');
  console.log(response);

  console.log('-'.repeat(60));

  // Check if it proactively flagged the conflict
  if (response.includes('CONFLICT') || response.includes('conflict')) {
    console.log('\n✓ Proactively flagged governing law conflict!');
  } else {
    console.log('\n✗ Did NOT proactively flag the conflict');
  }
}

main();
