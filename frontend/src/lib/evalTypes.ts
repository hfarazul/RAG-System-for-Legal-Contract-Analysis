/**
 * Real-Time Evaluation Types
 *
 * Types for async quality monitoring of chatbot responses.
 * Uses GPT-4o as judge to score faithfulness, relevance, completeness, and citation accuracy.
 */

export interface EvaluationScores {
  faithfulness: number;      // 1-5: Does response match retrieved context?
  relevance: number;         // 1-5: Does response address the question?
  completeness: number;      // 1-5: Are all parts of question answered?
  citationAccuracy: number;  // 1-5: Do citations match referenced content?
}

export interface EvaluationResult {
  id: string;
  timestamp: string;

  // Input data
  query: string;
  response: string;
  context: string;

  // Scores from LLM judge
  scores: EvaluationScores;
  reasoning: string;

  // Computed metrics
  averageScore: number;
  isFlagged: boolean;  // true if any score < flagThreshold
}

export interface EvaluationConfig {
  enabled: boolean;
  sampleRate: number;        // 0.0 - 1.0 (e.g., 0.1 = 10% of requests)
  flagThreshold: number;     // Score below which to flag (default: 3)
  maxStored: number;         // Maximum evaluations to store (default: 1000)
}

export interface EvaluationStats {
  totalEvaluations: number;
  totalFlagged: number;
  avgFaithfulness: number;
  avgRelevance: number;
  avgCompleteness: number;
  avgCitationAccuracy: number;
  overallAverage: number;
  lastUpdated: string;
}

export interface QueueStatus {
  pending: number;
  processing: boolean;
}

export interface EvaluationHealth {
  queue: QueueStatus;
  stats: EvaluationStats;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

// Default configuration
export const DEFAULT_EVAL_CONFIG: EvaluationConfig = {
  enabled: true,
  sampleRate: 0.1,
  flagThreshold: 3,
  maxStored: 1000,
};
