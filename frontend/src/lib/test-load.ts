import { loadConfig } from './config';
import { getVectorStore } from './vectorStore';

async function test() {
  console.log('Testing config and vector store loading...\n');

  try {
    // Test config loading
    const config = await loadConfig();
    console.log('Config loaded successfully:');
    console.log('  LLM model:', config.llm.model);
    console.log('  Embedding model:', config.embedding.model);
    console.log('  Vector store path:', config.vector_store.persist_path);

    // Test vector store loading
    const store = await getVectorStore();
    console.log('\nVector store loaded successfully:');
    console.log('  Entries:', store.size);

    // Sample query test
    if (store.size > 0) {
      const entries = store.getAll();
      const sampleVector = entries[0].vector;
      const results = await store.query(sampleVector, 3);
      console.log('\nSample query results:');
      results.forEach(r => {
        console.log(`  [${r.metadata.docType}, Section ${r.metadata.sectionNumber}] score=${r.score.toFixed(4)}`);
      });
    }

    console.log('\n✓ All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();
