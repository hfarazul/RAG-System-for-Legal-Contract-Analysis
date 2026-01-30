import 'dotenv/config';
import { embed, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getVectorStore } from '../vectorStore/index.js';
import { loadConfig } from '../config.js';
import type { RetrievalResult } from '../types.js';

/**
 * Format retrieval results with citations for LLM context
 */
function formatResults(results: RetrievalResult[]): Array<{
  citation: string;
  content: string;
  score: number;
}> {
  return results.map(r => ({
    citation: `[${r.metadata.docName}, Section ${r.metadata.sectionNumber}: ${r.metadata.sectionTitle}]`,
    content: r.text,
    score: r.score,
  }));
}

/**
 * Create the retrieval tool for use by agents
 */
export async function createRetrievalTool() {
  const config = await loadConfig();
  const vectorStore = await getVectorStore();

  return tool({
    description: 'Search legal documents for relevant clauses and sections based on a query. Use this tool to find specific contract terms, obligations, liabilities, and other legal provisions.',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant document sections'),
      docType: z.string().optional().describe('Filter by document type: NDA, SLA, DPA, VSA'),
      topK: z.number().optional().default(5).describe('Number of results to return'),
    }),
    execute: async ({ query, docType, topK }) => {
      // Embed the query
      const { embedding } = await embed({
        model: openai.embedding(config.embedding.model),
        value: query,
      });

      // Search vector store
      const results = await vectorStore.query(
        embedding,
        topK || config.retrieval.top_k,
        docType ? { docType } : undefined
      );

      // Format for LLM context
      return formatResults(results);
    },
  });
}

/**
 * Direct retrieval function (for testing and evaluation)
 */
export async function retrieveChunks(
  query: string,
  options?: { docType?: string; topK?: number }
): Promise<Array<{ citation: string; content: string; score: number }>> {
  const config = await loadConfig();
  const vectorStore = await getVectorStore();

  // Embed the query
  const { embedding } = await embed({
    model: openai.embedding(config.embedding.model),
    value: query,
  });

  // Search vector store
  const results = await vectorStore.query(
    embedding,
    options?.topK || config.retrieval.top_k,
    options?.docType ? { docType: options.docType } : undefined
  );

  return formatResults(results);
}

// Test the retriever when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing retriever...\n');

  try {
    const results = await retrieveChunks('What is the notice period for termination?', { topK: 3 });

    console.log('Query: "What is the notice period for termination?"\n');
    console.log('Results:');
    for (const result of results) {
      console.log(`\n${result.citation} (score: ${result.score.toFixed(4)})`);
      console.log(`  ${result.content.slice(0, 150)}...`);
    }

    console.log('\n✓ Retriever test passed!');
  } catch (error) {
    console.error('Retriever test failed:', error);
    process.exit(1);
  }
}
