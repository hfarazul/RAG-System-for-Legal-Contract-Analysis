/**
 * Evaluation Status API
 *
 * GET /api/evaluations/status - Get queue status and health
 */

import { NextResponse } from 'next/server';
import { getQueueStatus, getStats } from '@/lib/evaluation';

export async function GET() {
  try {
    const queueStatus = getQueueStatus();
    const stats = await getStats();

    // Determine health based on average scores
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (stats.totalEvaluations > 0) {
      if (stats.overallAverage < 2.5) {
        health = 'unhealthy';
      } else if (stats.overallAverage < 3.5) {
        health = 'degraded';
      }
    }

    return NextResponse.json({
      queue: queueStatus,
      stats,
      health,
    });
  } catch (error) {
    console.error('[API] Failed to get status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve status' },
      { status: 500 }
    );
  }
}
