import { streamText, stepCountIs, convertToModelMessages } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createRetrievalTool, retrieveChunks } from '@/lib/retriever';
import { getAnalyzerPrompt, loadConfig } from '@/lib/config';
import { shouldEvaluate, queueEvaluation } from '@/lib/evaluation';

export const maxDuration = 60;

// Input validation schema - lenient to accept all message part types (text, tool-invocation, tool-result, etc.)
const MessagePartSchema = z.object({
  type: z.string(),
  text: z.string().max(10000, 'Message too long').optional(),
}).passthrough();

const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(MessagePartSchema),
}).passthrough();

const RequestBodySchema = z.object({
  messages: z.array(MessageSchema).max(100, 'Too many messages'),
});

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

// Cleanup expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             'anonymous';

  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // CSRF protection - check origin
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && !origin.includes(host)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const validationResult = RequestBodySchema.safeParse(body);
  if (!validationResult.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: validationResult.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messages } = validationResult.data;

  const config = await loadConfig();
  const systemPrompt = await getAnalyzerPrompt();
  const retrievalTool = await createRetrievalTool();

  // Extract the latest user query for evaluation
  const latestUserMessage = messages
    .filter(m => m.role === 'user')
    .pop();
  const userQuery = latestUserMessage?.parts
    ?.find(p => p.type === 'text')?.text || '';

  // Convert UIMessages (with parts) to ModelMessages (with content)
  // Type assertion needed due to Zod's passthrough() creating index signatures
  const modelMessages = await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]);

  const result = streamText({
    model: anthropic(config.llm.model),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      retrieveChunks: retrievalTool,
    },
    stopWhen: stepCountIs(5),
    temperature: config.llm.temperature,
    maxOutputTokens: config.llm.max_tokens,

    // Async evaluation hook - runs after response completes
    onFinish: async ({ text }) => {
      if (userQuery && await shouldEvaluate()) {
        try {
          // Get the context that was retrieved for this query
          const retrieved = await retrieveChunks(userQuery, { topK: 5 });
          const context = retrieved
            .map(r => `${r.citation}\n${r.content}`)
            .join('\n\n---\n\n');

          // Queue for async evaluation (non-blocking)
          queueEvaluation({ query: userQuery, response: text, context });
        } catch (error) {
          console.error('[Eval] Failed to queue evaluation:', error);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
