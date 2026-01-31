/**
 * Evaluation Service
 *
 * Async evaluation queue that processes responses in the background.
 * Uses GPT-4o judge to score response quality.
 *
 * Fixes: bounded queue, retry logic, better error handling.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';
import { getConfig, saveEvaluation } from './evalStore';
import type { EvaluationResult, QueueStatus } from './evalTypes';

// Queue configuration
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// Queue item structure with retry tracking
interface QueueItem {
  query: string;
  response: string;
  context: string;
  retryCount: number;
  lastError?: string;
}

// In-memory queue for pending evaluations
const evaluationQueue: QueueItem[] = [];
let isProcessing = false;
let droppedCount = 0;

/**
 * Generate a unique ID using crypto
 */
function generateId(): string {
  return `eval_${randomUUID()}`;
}

/**
 * Check if this request should be evaluated based on sampling rate
 */
export async function shouldEvaluate(forceEval = false): Promise<boolean> {
  if (forceEval) return true;

  const config = await getConfig();
  if (!config.enabled) return false;

  return Math.random() < config.sampleRate;
}

/**
 * Queue an evaluation for background processing (non-blocking)
 * Returns false if queue is full
 */
export function queueEvaluation(data: Omit<QueueItem, 'retryCount'>): boolean {
  // Check queue size limit
  if (evaluationQueue.length >= MAX_QUEUE_SIZE) {
    droppedCount++;
    console.warn(`[Eval] Queue full (${MAX_QUEUE_SIZE}), dropping evaluation. Total dropped: ${droppedCount}`);
    return false;
  }

  evaluationQueue.push({
    ...data,
    retryCount: 0,
  });

  // Start processing if not already running
  if (!isProcessing) {
    processQueue().catch(err => {
      console.error('[Eval] Queue processing error:', err);
    });
  }

  return true;
}

/**
 * Process queued evaluations asynchronously with retry logic
 */
async function processQueue(): Promise<void> {
  if (isProcessing || evaluationQueue.length === 0) return;

  isProcessing = true;

  while (evaluationQueue.length > 0) {
    const item = evaluationQueue.shift();
    if (!item) break;

    try {
      await runEvaluation(item);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Eval] Failed to process evaluation:', errorMessage);

      // Retry logic
      if (item.retryCount < MAX_RETRIES) {
        item.retryCount++;
        item.lastError = errorMessage;
        evaluationQueue.push(item); // Add to end of queue
        console.log(`[Eval] Requeued for retry ${item.retryCount}/${MAX_RETRIES}`);
      } else {
        console.error(`[Eval] Max retries (${MAX_RETRIES}) exceeded, dropping evaluation`);
      }
    }

    // Exponential backoff based on queue pressure and retries
    const delay = BASE_DELAY_MS * Math.pow(1.5, Math.min(evaluationQueue.length / 10, 3));
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  isProcessing = false;
}

/**
 * LLM Judge system prompt
 */
const JUDGE_SYSTEM_PROMPT = `You are evaluating a legal contract analysis system's response. Your job is to score the quality of the response objectively.

Score each metric from 1-5 (1=poor, 5=excellent):

1. FAITHFULNESS: Does the response accurately reflect the retrieved context without hallucination or making up facts?
2. RELEVANCE: Does the response directly address the question asked?
3. COMPLETENESS: Does the response fully answer all parts of the question?
4. CITATION_ACCURACY: Do the citations [Document Name, Section N: Title] correctly match the content being referenced?

Respond ONLY with valid JSON in this exact format:
{"faithfulness": <1-5>, "relevance": <1-5>, "completeness": <1-5>, "citationAccuracy": <1-5>, "reasoning": "<brief 1-2 sentence explanation>"}`;

interface JudgeScores {
  faithfulness: number;
  relevance: number;
  completeness: number;
  citationAccuracy: number;
  reasoning: string;
}

/**
 * Sanitize text for safe inclusion in prompts (basic XML-style escaping)
 */
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Call GPT-4o to judge a response
 */
async function judgeResponse(
  query: string,
  response: string,
  context: string
): Promise<JudgeScores> {
  // Use structured format with XML-style tags to reduce prompt injection risk
  const userPrompt = `<question>${sanitizeForPrompt(query)}</question>

<retrieved_context>${sanitizeForPrompt(context || 'No context provided')}</retrieved_context>

<system_response>${sanitizeForPrompt(response)}</system_response>

Evaluate the system_response based on the question and retrieved_context.`;

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      system: JUDGE_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0,
      maxOutputTokens: 256,
    });

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Eval] Judge returned invalid JSON, using defaults');
      return getDefaultScores('Invalid JSON response');
    }

    const scores = JSON.parse(jsonMatch[0]) as JudgeScores;

    // Validate scores are in range
    const validateScore = (s: number) => Math.min(5, Math.max(1, Math.round(s)));

    return {
      faithfulness: validateScore(scores.faithfulness),
      relevance: validateScore(scores.relevance),
      completeness: validateScore(scores.completeness),
      citationAccuracy: validateScore(scores.citationAccuracy),
      reasoning: scores.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.warn('[Eval] Judge error:', error);
    throw error; // Re-throw to trigger retry logic
  }
}

function getDefaultScores(reason: string): JudgeScores {
  return {
    faithfulness: 3,
    relevance: 3,
    completeness: 3,
    citationAccuracy: 3,
    reasoning: reason,
  };
}

/**
 * Run a single evaluation
 */
async function runEvaluation(data: QueueItem): Promise<EvaluationResult> {
  const config = await getConfig();

  // Call the LLM judge
  const scores = await judgeResponse(data.query, data.response, data.context);

  const averageScore = (
    scores.faithfulness +
    scores.relevance +
    scores.completeness +
    scores.citationAccuracy
  ) / 4;

  const evaluation: EvaluationResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    query: data.query,
    response: data.response.slice(0, 2000), // Truncate for storage
    context: data.context.slice(0, 3000),   // Truncate for storage
    scores: {
      faithfulness: scores.faithfulness,
      relevance: scores.relevance,
      completeness: scores.completeness,
      citationAccuracy: scores.citationAccuracy,
    },
    reasoning: scores.reasoning,
    averageScore,
    isFlagged:
      scores.faithfulness < config.flagThreshold ||
      scores.relevance < config.flagThreshold ||
      scores.completeness < config.flagThreshold ||
      scores.citationAccuracy < config.flagThreshold,
  };

  await saveEvaluation(evaluation);

  // Log flagged evaluations
  if (evaluation.isFlagged) {
    console.warn(`[Eval] FLAGGED response:`, {
      id: evaluation.id,
      scores: evaluation.scores,
      query: evaluation.query.slice(0, 100),
    });
  } else {
    console.log(`[Eval] Evaluated:`, {
      id: evaluation.id,
      avgScore: averageScore.toFixed(2),
    });
  }

  return evaluation;
}

/**
 * Get current queue status
 */
export function getQueueStatus(): QueueStatus & { dropped: number; maxSize: number } {
  return {
    pending: evaluationQueue.length,
    processing: isProcessing,
    dropped: droppedCount,
    maxSize: MAX_QUEUE_SIZE,
  };
}
