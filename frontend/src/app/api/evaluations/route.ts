/**
 * Evaluations API
 *
 * GET /api/evaluations              - List recent evaluations
 * GET /api/evaluations?type=stats   - Get aggregate statistics
 * GET /api/evaluations?type=config  - Get current configuration
 * PATCH /api/evaluations            - Update configuration (with validation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEvaluations, getStats, getConfig, saveConfig } from '@/lib/evaluation';

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

/**
 * Zod schema for config updates with strict validation
 */
const ConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  sampleRate: z.number().min(0).max(1).optional(),
  flagThreshold: z.number().int().min(1).max(5).optional(),
  maxStored: z.number().int().min(1).max(10000).optional(),
}).strict();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type') || 'list';
  const limit = parseLimit(searchParams);

  try {
    if (type === 'stats') {
      const stats = await getStats();
      return NextResponse.json(stats);
    }

    if (type === 'config') {
      const config = await getConfig();
      return NextResponse.json(config);
    }

    // Default: list evaluations
    const evaluations = await getEvaluations();
    return NextResponse.json({
      evaluations: evaluations.slice(0, limit),
      total: evaluations.length,
    });
  } catch (error) {
    console.error('[API] Failed to get evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve evaluations' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate with Zod schema
    const validationResult = ConfigUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid configuration values',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    await saveConfig(updates);
    const newConfig = await getConfig();

    return NextResponse.json({
      success: true,
      config: newConfig,
    });
  } catch (error) {
    console.error('[API] Failed to update config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
