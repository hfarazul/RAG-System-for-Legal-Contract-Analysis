/**
 * Evaluation Module
 *
 * Re-exports evaluation functions for clean imports in API routes.
 */

// Types
export type {
  EvaluationResult,
  EvaluationConfig,
  EvaluationStats,
  EvaluationScores,
  QueueStatus,
  EvaluationHealth,
} from './evalTypes';

export { DEFAULT_EVAL_CONFIG } from './evalTypes';

// Store functions
export {
  getConfig,
  saveConfig,
  getEvaluations,
  saveEvaluation,
  getStats,
  getFlaggedEvaluations,
  clearCache,
} from './evalStore';

// Service functions
export {
  shouldEvaluate,
  queueEvaluation,
  getQueueStatus,
} from './evalService';
