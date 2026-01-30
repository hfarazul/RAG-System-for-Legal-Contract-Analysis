/**
 * Ingestion Pipeline
 *
 * Orchestrates: load documents → chunk → embed → persist to vector store
 *
 * Run with: npm run ingest
 */

import 'dotenv/config';
import { loadDocuments } from './ingestion/loader.js';
import { chunkDocuments } from './ingestion/chunker.js';
import { embedChunks } from './ingestion/embedder.js';
import { getVectorStore } from './vectorStore/index.js';

async function main() {
  console.log('=== Legal Contract Ingestion Pipeline ===\n');

  // Step 1: Load documents
  console.log('Step 1: Loading documents...');
  const documents = await loadDocuments();
  console.log(`  ✓ Loaded ${documents.length} documents\n`);

  for (const doc of documents) {
    console.log(`    - ${doc.metadata.docName} (${doc.metadata.docType})`);
  }
  console.log();

  // Step 2: Chunk documents
  console.log('Step 2: Chunking documents...');
  const chunks = await chunkDocuments(documents);
  console.log(`  ✓ Created ${chunks.length} chunks\n`);

  // Show chunk distribution
  const chunksByDoc: Record<string, number> = {};
  for (const chunk of chunks) {
    const key = chunk.metadata.docType;
    chunksByDoc[key] = (chunksByDoc[key] || 0) + 1;
  }
  for (const [docType, count] of Object.entries(chunksByDoc)) {
    console.log(`    - ${docType}: ${count} chunks`);
  }
  console.log();

  // Step 3: Embed chunks
  console.log('Step 3: Embedding chunks...');
  const vectorEntries = await embedChunks(chunks);
  console.log(`  ✓ Embedded ${vectorEntries.length} chunks\n`);

  // Step 4: Persist to vector store
  console.log('Step 4: Persisting to vector store...');
  const store = await getVectorStore();
  await store.upsert(vectorEntries);
  console.log(`  ✓ Persisted ${store.size} vectors\n`);

  console.log('=== Ingestion Complete ===');
  console.log(`Total chunks: ${store.size}`);
  console.log('Vectors saved to: ./data/vectors.json');
}

main().catch(error => {
  console.error('Ingestion failed:', error);
  process.exit(1);
});
