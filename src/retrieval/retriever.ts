import 'dotenv/config';
import { embed, rerank, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { cohere } from '@ai-sdk/cohere';
import { z } from 'zod';
import { getVectorStore } from '../vectorStore/index.js';
import { loadConfig } from '../config.js';
import type { RetrievalResult } from '../types.js';

/**
 * Format retrieval results with citations for LLM context
 */
function formatResults(results: Array<{ text: string; metadata: RetrievalResult['metadata']; score: number }>): Array<{
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
 * Rerank results using Cohere's cross-encoder model
 */
async function rerankResults(
  query: string,
  results: RetrievalResult[],
  topK: number,
  model: string
): Promise<Array<{ text: string; metadata: RetrievalResult['metadata']; score: number }>> {
  if (results.length === 0) {
    return [];
  }

  // Prepare documents for reranking
  const documents = results.map(r => ({
    text: r.text,
    id: r.id,
    metadata: r.metadata,
  }));

  // Rerank using Cohere
  const { ranking } = await rerank({
    model: cohere.reranking(model),
    query,
    documents: documents.map(d => d.text),
    topN: topK,
  });

  // Map back to original documents with new scores
  return ranking.map(ranked => {
    const original = documents[ranked.originalIndex];
    return {
      text: original.text,
      metadata: original.metadata,
      score: ranked.score,
    };
  });
}

/**
 * Create the retrieval tool for use by agents
 */
export async function createRetrievalTool() {
  const config = await loadConfig();
  const vectorStore = await getVectorStore();

  return tool({
    description: 'Search legal documents for relevant clauses and sections based on a query. Use this tool to find specific contract terms, obligations, liabilities, and other legal provisions.',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant document sections'),
      docType: z.string().optional().describe('Filter by document type: NDA, SLA, DPA, VSA'),
      topK: z.number().optional().default(5).describe('Number of results to return'),
    }),
    execute: async ({ query, docType, topK }: { query: string; docType?: string; topK?: number }) => {
      const finalTopK = topK || config.retrieval.top_k;
      const rerankConfig = config.retrieval.rerank;

      // Embed the query
      const { embedding } = await embed({
        model: openai.embedding(config.embedding.model),
        value: query,
      });

      // Determine how many candidates to fetch
      const fetchK = rerankConfig.enabled
        ? finalTopK * rerankConfig.over_fetch_multiplier
        : finalTopK;

      // Search vector store
      const results = await vectorStore.query(
        embedding,
        fetchK,
        docType ? { docType } : undefined
      );

      // Apply reranking if enabled
      if (rerankConfig.enabled && results.length > 0) {
        const reranked = await rerankResults(
          query,
          results,
          finalTopK,
          rerankConfig.model
        );
        return formatResults(reranked);
      }

      // Format for LLM context (no reranking)
      return formatResults(results.slice(0, finalTopK).map(r => ({
        text: r.text,
        metadata: r.metadata,
        score: r.score,
      })));
    },
  });
}

/**
 * Direct retrieval function (for testing and evaluation)
 */
export async function retrieveChunks(
  query: string,
  options?: { docType?: string; topK?: number; skipRerank?: boolean }
): Promise<Array<{ citation: string; content: string; score: number }>> {
  const config = await loadConfig();
  const vectorStore = await getVectorStore();
  const finalTopK = options?.topK || config.retrieval.top_k;
  const rerankConfig = config.retrieval.rerank;
  const shouldRerank = rerankConfig.enabled && !options?.skipRerank;

  // Embed the query
  const { embedding } = await embed({
    model: openai.embedding(config.embedding.model),
    value: query,
  });

  // Determine how many candidates to fetch
  const fetchK = shouldRerank
    ? finalTopK * rerankConfig.over_fetch_multiplier
    : finalTopK;

  // Search vector store
  const results = await vectorStore.query(
    embedding,
    fetchK,
    options?.docType ? { docType: options.docType } : undefined
  );

  // Apply reranking if enabled
  if (shouldRerank && results.length > 0) {
    const reranked = await rerankResults(
      query,
      results,
      finalTopK,
      rerankConfig.model
    );
    return formatResults(reranked);
  }

  return formatResults(results.slice(0, finalTopK).map(r => ({
    text: r.text,
    metadata: r.metadata,
    score: r.score,
  })));
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
