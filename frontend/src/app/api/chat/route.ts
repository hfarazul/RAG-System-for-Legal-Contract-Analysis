import { streamText, stepCountIs, convertToModelMessages } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createRetrievalTool } from '@/lib/retriever';
import { getAnalyzerPrompt, loadConfig } from '@/lib/config';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const config = await loadConfig();
  const systemPrompt = await getAnalyzerPrompt();
  const retrievalTool = await createRetrievalTool();

  // Convert UIMessages (with parts) to ModelMessages (with content)
  const modelMessages = await convertToModelMessages(messages);

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
  });

  return result.toUIMessageStreamResponse();
}
