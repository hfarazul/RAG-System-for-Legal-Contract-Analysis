/**
 * Evaluation Store
 *
 * JSON file-based storage for evaluation results and configuration.
 * Includes fixes for: race conditions, path traversal, cache consistency.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  EvaluationResult,
  EvaluationConfig,
  EvaluationStats,
} from './evalTypes';
import { DEFAULT_EVAL_CONFIG } from './evalTypes';

// Storage paths - use absolute path resolution for safety
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const EVAL_FILE_PATH = path.join(DATA_DIR, 'evaluations.json');
const CONFIG_FILE_PATH = path.join(DATA_DIR, 'eval-config.json');

// Validate paths don't escape project directory
if (!DATA_DIR.startsWith(PROJECT_ROOT)) {
  throw new Error('Invalid data directory configuration');
}

// In-memory cache for performance
let evaluationsCache: EvaluationResult[] | null = null;
let configCache: EvaluationConfig | null = null;

// Write lock to prevent race conditions
let writeLock: Promise<void> = Promise.resolve();

/**
 * Acquire write lock for atomic file operations
 */
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const previousLock = writeLock;
  let releaseLock: () => void;

  writeLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  return previousLock.then(async () => {
    try {
      return await fn();
    } finally {
      releaseLock!();
    }
  });
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error: unknown) {
    // EEXIST is fine, other errors should be logged
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      console.error('[EvalStore] Failed to create data directory:', error);
      throw error;
    }
  }
}

/**
 * Get evaluation configuration
 */
export async function getConfig(): Promise<EvaluationConfig> {
  if (configCache) return configCache;

  try {
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    const parsed = { ...DEFAULT_EVAL_CONFIG, ...JSON.parse(data) };
    configCache = parsed;
    return parsed;
  } catch {
    return DEFAULT_EVAL_CONFIG;
  }
}

/**
 * Save evaluation configuration with validation
 */
export async function saveConfig(config: Partial<EvaluationConfig>): Promise<void> {
  return withWriteLock(async () => {
    await ensureDataDir();
    const current = await getConfig();
    const updated = { ...current, ...config };
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2));
    configCache = updated;
  });
}

/**
 * Get all evaluations (fresh read, bypasses cache)
 */
async function readEvaluationsFromDisk(): Promise<EvaluationResult[]> {
  try {
    const data = await fs.readFile(EVAL_FILE_PATH, 'utf-8');
    return JSON.parse(data) || [];
  } catch {
    return [];
  }
}

/**
 * Get all evaluations
 */
export async function getEvaluations(): Promise<EvaluationResult[]> {
  if (evaluationsCache) return [...evaluationsCache]; // Return copy to prevent mutation

  const evaluations = await readEvaluationsFromDisk();
  evaluationsCache = evaluations;
  return [...evaluations];
}

/**
 * Save a new evaluation (prepends to list, trims to max size)
 * Uses write lock to prevent race conditions
 */
export async function saveEvaluation(evaluation: EvaluationResult): Promise<void> {
  return withWriteLock(async () => {
    await ensureDataDir();
    const config = await getConfig();

    // Always read fresh from disk inside the lock to prevent race conditions
    const currentEvaluations = await readEvaluationsFromDisk();

    // Create new array (don't mutate)
    let newEvaluations = [evaluation, ...currentEvaluations];

    // Trim to max size
    if (newEvaluations.length > config.maxStored) {
      newEvaluations = newEvaluations.slice(0, config.maxStored);
    }

    // Write to disk first
    await fs.writeFile(EVAL_FILE_PATH, JSON.stringify(newEvaluations, null, 2));

    // Only update cache after successful write
    evaluationsCache = newEvaluations;
  });
}

/**
 * Calculate aggregate statistics
 */
export async function getStats(): Promise<EvaluationStats> {
  const evaluations = await getEvaluations();

  if (evaluations.length === 0) {
    return {
      totalEvaluations: 0,
      totalFlagged: 0,
      avgFaithfulness: 0,
      avgRelevance: 0,
      avgCompleteness: 0,
      avgCitationAccuracy: 0,
      overallAverage: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  const sum = evaluations.reduce(
    (acc, e) => ({
      faithfulness: acc.faithfulness + e.scores.faithfulness,
      relevance: acc.relevance + e.scores.relevance,
      completeness: acc.completeness + e.scores.completeness,
      citationAccuracy: acc.citationAccuracy + e.scores.citationAccuracy,
    }),
    { faithfulness: 0, relevance: 0, completeness: 0, citationAccuracy: 0 }
  );

  const count = evaluations.length;
  const avgFaithfulness = sum.faithfulness / count;
  const avgRelevance = sum.relevance / count;
  const avgCompleteness = sum.completeness / count;
  const avgCitationAccuracy = sum.citationAccuracy / count;
  const overallAverage = (avgFaithfulness + avgRelevance + avgCompleteness + avgCitationAccuracy) / 4;

  return {
    totalEvaluations: count,
    totalFlagged: evaluations.filter(e => e.isFlagged).length,
    avgFaithfulness,
    avgRelevance,
    avgCompleteness,
    avgCitationAccuracy,
    overallAverage,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get flagged evaluations (any score below threshold)
 */
export async function getFlaggedEvaluations(limit = 50): Promise<EvaluationResult[]> {
  // Validate and constrain limit
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const evaluations = await getEvaluations();
  return evaluations.filter(e => e.isFlagged).slice(0, safeLimit);
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  evaluationsCache = null;
  configCache = null;
}
