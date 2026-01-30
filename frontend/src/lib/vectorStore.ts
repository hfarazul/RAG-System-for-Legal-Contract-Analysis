import * as fs from 'fs/promises';
import * as path from 'path';
import type { VectorEntry, RetrievalResult } from './types';
import { loadConfig } from './config';

// Path to parent directory
const PROJECT_ROOT = path.join(process.cwd(), '..');

/**
 * In-memory vector store with JSON persistence
 */
export class InMemoryVectorStore {
  private store: Map<string, VectorEntry> = new Map();
  private persistPath: string;

  constructor(persistPath?: string) {
    this.persistPath = persistPath || './data/vectors.json';
  }

  /**
   * Load vectors from JSON file
   */
  async load(): Promise<void> {
    try {
      const fullPath = path.join(PROJECT_ROOT, this.persistPath);
      const data = await fs.readFile(fullPath, 'utf-8');
      const entries: VectorEntry[] = JSON.parse(data);
      entries.forEach(entry => this.store.set(entry.id, entry));
      console.log(`Loaded ${entries.length} vectors from ${this.persistPath}`);
    } catch (error) {
      // No existing data, start fresh
      console.log('No existing vectors found, starting fresh');
    }
  }

  /**
   * Persist vectors to JSON file
   */
  async persist(): Promise<void> {
    const fullPath = path.join(PROJECT_ROOT, this.persistPath);
    const entries = [...this.store.values()];
    await fs.writeFile(fullPath, JSON.stringify(entries, null, 2));
    console.log(`Persisted ${entries.length} vectors to ${this.persistPath}`);
  }

  /**
   * Add or update vector entries
   */
  async upsert(entries: VectorEntry[]): Promise<void> {
    entries.forEach(entry => this.store.set(entry.id, entry));
    await this.persist();
  }

  /**
   * Query vectors by similarity
   */
  async query(
    queryVector: number[],
    topK: number = 5,
    filter?: { docType?: string }
  ): Promise<RetrievalResult[]> {
    let candidates = [...this.store.values()];

    // Apply metadata filter
    if (filter?.docType) {
      candidates = candidates.filter(e => e.metadata.docType === filter.docType);
    }

    // Calculate similarity scores
    const scored: RetrievalResult[] = candidates.map(entry => ({
      ...entry,
      score: this.cosineSimilarity(queryVector, entry.vector),
    }));

    // Sort by score descending, return top K
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Get all entries (for debugging/testing)
   */
  getAll(): VectorEntry[] {
    return [...this.store.values()];
  }

  /**
   * Get entry count
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Singleton instance
let vectorStoreInstance: InMemoryVectorStore | null = null;

/**
 * Get the vector store instance
 */
export async function getVectorStore(): Promise<InMemoryVectorStore> {
  if (!vectorStoreInstance) {
    const config = await loadConfig();
    vectorStoreInstance = new InMemoryVectorStore(config.vector_store.persist_path);
    await vectorStoreInstance.load();
  }
  return vectorStoreInstance;
}
