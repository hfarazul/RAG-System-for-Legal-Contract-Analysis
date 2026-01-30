import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Chunk, VectorEntry } from '../types.js';
import { loadConfig } from '../config.js';

/**
 * Embed all chunks using OpenAI embeddings
 */
export async function embedChunks(chunks: Chunk[]): Promise<VectorEntry[]> {
  const config = await loadConfig();

  console.log(`Embedding ${chunks.length} chunks using ${config.embedding.model}...`);

  // Extract text from chunks for batch embedding
  const texts = chunks.map(chunk => chunk.text);

  // Use embedMany for batch processing
  const { embeddings } = await embedMany({
    model: openai.embedding(config.embedding.model),
    values: texts,
  });

  // Combine chunks with their embeddings
  const vectorEntries: VectorEntry[] = chunks.map((chunk, index) => ({
    id: chunk.id,
    vector: embeddings[index],
    text: chunk.text,
    metadata: chunk.metadata,
  }));

  console.log(`✓ Embedded ${vectorEntries.length} chunks`);

  return vectorEntries;
}

// Test the embedder when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadDocuments } = await import('./loader.js');
  const { chunkDocuments } = await import('./chunker.js');

  console.log('Testing embedder...\n');

  const documents = await loadDocuments();
  const chunks = await chunkDocuments(documents);

  // Only embed first 2 chunks for testing (to save API calls)
  const testChunks = chunks.slice(0, 2);
  console.log(`Testing with ${testChunks.length} chunks...\n`);

  const entries = await embedChunks(testChunks);

  for (const entry of entries) {
    console.log(`--- ${entry.id} ---`);
    console.log(`  Vector dimensions: ${entry.vector.length}`);
    console.log(`  Vector sample: [${entry.vector.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
    console.log();
  }

  console.log('✓ Embedder test passed!');
}
