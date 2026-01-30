import 'dotenv/config';
import { streamText, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getAnalyzerPrompt, loadConfig } from '../config.js';
import { createRetrievalTool } from '../retrieval/retriever.js';
import type { Message } from '../types.js';

/**
 * Analyzer Agent
 *
 * Handles Q&A about legal contracts with:
 * - Semantic retrieval from vector store
 * - Inline citations
 * - Automatic risk flagging
 * - Multi-turn conversation support
 */
export class AnalyzerAgent {
  private systemPrompt: string = '';
  private model: string = '';
  private temperature: number = 0.1;
  private maxTokens: number = 2048;
  private retrievalTool: Awaited<ReturnType<typeof createRetrievalTool>> | null = null;
  private conversationHistory: Message[] = [];

  /**
   * Initialize the agent (must be called before use)
   */
  async initialize(): Promise<void> {
    const config = await loadConfig();
    this.systemPrompt = await getAnalyzerPrompt();
    this.model = config.llm.model;
    this.temperature = config.llm.temperature;
    this.maxTokens = config.llm.max_tokens;
    this.retrievalTool = await createRetrievalTool();
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Chat with streaming response
   */
  async chat(userMessage: string): Promise<AsyncIterable<string>> {
    if (!this.retrievalTool) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: userMessage });

    // Create the streaming response
    const result = streamText({
      model: anthropic(this.model),
      system: this.systemPrompt,
      messages: this.conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      tools: {
        retrieveChunks: this.retrievalTool,
      },
      maxSteps: 5,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    // Return async generator that also saves to history
    const self = this;
    return (async function* () {
      let fullResponse = '';

      for await (const chunk of (await result).textStream) {
        fullResponse += chunk;
        yield chunk;
      }

      // Save assistant response to history
      self.conversationHistory.push({ role: 'assistant', content: fullResponse });
    })();
  }

  /**
   * Chat without streaming (for testing/evaluation)
   */
  async chatSync(userMessage: string): Promise<string> {
    if (!this.retrievalTool) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: userMessage });

    const result = await generateText({
      model: anthropic(this.model),
      system: this.systemPrompt,
      messages: this.conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      tools: {
        retrieveChunks: this.retrievalTool,
      },
      maxSteps: 5,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    // Save assistant response to history
    this.conversationHistory.push({ role: 'assistant', content: result.text });

    return result.text;
  }
}

// Singleton instance
let analyzerInstance: AnalyzerAgent | null = null;

/**
 * Get the analyzer agent instance
 */
export async function getAnalyzerAgent(): Promise<AnalyzerAgent> {
  if (!analyzerInstance) {
    analyzerInstance = new AnalyzerAgent();
    await analyzerInstance.initialize();
  }
  return analyzerInstance;
}

// Test the analyzer when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing Analyzer Agent...\n');

  try {
    const agent = await getAnalyzerAgent();

    const testQuery = 'What is the notice period for terminating the NDA?';
    console.log(`Query: "${testQuery}"\n`);
    console.log('Response:');
    console.log('-'.repeat(50));

    // Use sync version for testing
    const response = await agent.chatSync(testQuery);
    console.log(response);

    console.log('-'.repeat(50));
    console.log('\n✓ Analyzer Agent test passed!');
  } catch (error) {
    console.error('Analyzer Agent test failed:', error);
    process.exit(1);
  }
}
