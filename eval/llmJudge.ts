/**
 * LLM-as-Judge Module
 *
 * Uses GPT-4o to independently evaluate Claude's responses on:
 * - Faithfulness: No hallucinations, matches retrieved context
 * - Relevance: Directly addresses the question
 * - Completeness: All parts of question answered
 * - Citation Accuracy: Citations match the content they reference
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface JudgeScores {
  faithfulness: number;
  relevance: number;
  completeness: number;
  citationAccuracy: number;
  reasoning: string;
}

const JUDGE_PROMPT = `You are evaluating a legal contract analysis system's response. Your job is to score the quality of the response objectively.

QUESTION:
{query}

RETRIEVED CONTEXT (what the system had access to):
{context}

SYSTEM RESPONSE:
{response}

Score each metric from 1-5 (1=poor, 5=excellent):

1. FAITHFULNESS: Does the response accurately reflect the retrieved context without hallucination or making up facts?
2. RELEVANCE: Does the response directly address the question asked?
3. COMPLETENESS: Does the response fully answer all parts of the question?
4. CITATION_ACCURACY: Do the citations [Document Name, Section N: Title] correctly match the content being referenced?

Respond ONLY with valid JSON in this exact format:
{
  "faithfulness": <1-5>,
  "relevance": <1-5>,
  "completeness": <1-5>,
  "citationAccuracy": <1-5>,
  "reasoning": "<brief 1-2 sentence explanation>"
}`;

/**
 * Use GPT-4o to judge a response
 */
export async function judgeResponse(
  query: string,
  response: string,
  context: string
): Promise<JudgeScores> {
  const prompt = JUDGE_PROMPT
    .replace('{query}', query)
    .replace('{context}', context || 'No context provided')
    .replace('{response}', response);

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      prompt,
      temperature: 0,
      maxOutputTokens: 256,
    });

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Judge returned invalid JSON, using defaults');
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
    console.warn('Judge error:', error);
    return getDefaultScores(`Error: ${error}`);
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
 * Calculate average scores from multiple judgments
 */
export function calculateAverageScores(scores: JudgeScores[]): Omit<JudgeScores, 'reasoning'> {
  if (scores.length === 0) {
    return { faithfulness: 0, relevance: 0, completeness: 0, citationAccuracy: 0 };
  }

  return {
    faithfulness: scores.reduce((sum, s) => sum + s.faithfulness, 0) / scores.length,
    relevance: scores.reduce((sum, s) => sum + s.relevance, 0) / scores.length,
    completeness: scores.reduce((sum, s) => sum + s.completeness, 0) / scores.length,
    citationAccuracy: scores.reduce((sum, s) => sum + s.citationAccuracy, 0) / scores.length,
  };
}
