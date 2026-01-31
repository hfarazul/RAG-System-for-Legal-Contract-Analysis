/**
 * Evaluation Alerts API
 *
 * GET /api/evaluations/alerts - Get flagged evaluations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFlaggedEvaluations, getConfig } from '@/lib/evaluation';

// Constants for parameter validation
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/**
 * Validate and constrain limit parameter
 */
function parseLimit(searchParams: URLSearchParams): number {
  const rawLimit = searchParams.get('limit');
  if (!rawLimit) return DEFAULT_LIMIT;

  const parsed = parseInt(rawLimit, 10);
  if (isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseLimit(searchParams);

  try {
    const config = await getConfig();
    const flagged = await getFlaggedEvaluations(limit);

    return NextResponse.json({
      alerts: flagged,
      count: flagged.length,
      threshold: config.flagThreshold,
    });
  } catch (error) {
    console.error('[API] Failed to get alerts:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve alerts' },
      { status: 500 }
    );
  }
}
