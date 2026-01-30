import 'dotenv/config';
import { retrieveChunks } from './retriever';

async function test() {
  console.log('Testing retrieval tool...\n');

  try {
    const query = 'What is the confidentiality period?';
    console.log(`Query: "${query}"\n`);

    const results = await retrieveChunks(query, { topK: 3 });

    console.log('Results:');
    for (const result of results) {
      console.log(`\n${result.citation} (score: ${result.score.toFixed(4)})`);
      console.log(`  ${result.content.slice(0, 150)}...`);
    }

    console.log('\n✓ Retrieval test passed!');
  } catch (error) {
    console.error('Retrieval test failed:', error);
    process.exit(1);
  }
}

test();
