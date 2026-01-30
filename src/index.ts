import 'dotenv/config';
import * as readline from 'readline';
import { getAnalyzerAgent } from './agents/analyzer.js';

const WELCOME_MESSAGE = `
╔════════════════════════════════════════════════════════════════╗
║       Legal Contract Analysis - RAG System                     ║
╠════════════════════════════════════════════════════════════════╣
║  Ask questions about your legal contracts:                     ║
║  • NDAs, Vendor Agreements, SLAs, Data Processing Agreements   ║
║  • Get cited answers with automatic risk flagging              ║
║                                                                ║
║  Commands:                                                     ║
║    /clear  - Clear conversation history                        ║
║    /help   - Show this help message                            ║
║    exit    - Exit the application                              ║
╚════════════════════════════════════════════════════════════════╝
`;

const HELP_MESSAGE = `
Available Commands:
  /clear  - Clear conversation history and start fresh
  /help   - Show this help message
  exit    - Exit the application (also: quit, /exit, /quit)

Example Questions:
  • What is the notice period for terminating the NDA?
  • Is liability capped in any of the agreements?
  • What is the uptime commitment in the SLA?
  • Are there conflicting governing laws across agreements?
  • What are the data breach notification requirements?
`;

class CLI {
  private rl: readline.Interface;
  private agent: Awaited<ReturnType<typeof getAnalyzerAgent>> | null = null;
  private isProcessing = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle Ctrl+C gracefully
    this.rl.on('close', () => {
      console.log('\n\nGoodbye!');
      process.exit(0);
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      if (this.isProcessing) {
        console.log('\n\n[Interrupted]');
        this.isProcessing = false;
        this.prompt();
      } else {
        console.log('\n\nGoodbye!');
        process.exit(0);
      }
    });
  }

  async initialize(): Promise<void> {
    console.log('Initializing...');
    this.agent = await getAnalyzerAgent();
    console.log('Ready!\n');
  }

  private prompt(): void {
    this.rl.question('\n> ', async (input) => {
      await this.handleInput(input.trim());
    });
  }

  private async handleInput(input: string): Promise<void> {
    // Empty input
    if (!input) {
      this.prompt();
      return;
    }

    // Handle commands
    const lowerInput = input.toLowerCase();

    if (['exit', 'quit', '/exit', '/quit'].includes(lowerInput)) {
      console.log('\nGoodbye!');
      process.exit(0);
    }

    if (lowerInput === '/clear') {
      this.agent?.clearHistory();
      console.log('\n[Conversation history cleared]');
      this.prompt();
      return;
    }

    if (lowerInput === '/help') {
      console.log(HELP_MESSAGE);
      this.prompt();
      return;
    }

    // Process query
    await this.processQuery(input);
  }

  private async processQuery(query: string): Promise<void> {
    if (!this.agent) {
      console.error('Agent not initialized');
      this.prompt();
      return;
    }

    this.isProcessing = true;
    console.log(); // Empty line before response

    try {
      // Stream the response
      const stream = await this.agent.chat(query);

      for await (const chunk of stream) {
        process.stdout.write(chunk);
      }

      console.log(); // New line after response
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\nError: ${error.message}`);
      } else {
        console.error('\nAn unexpected error occurred');
      }
    } finally {
      this.isProcessing = false;
      this.prompt();
    }
  }

  async run(): Promise<void> {
    console.log(WELCOME_MESSAGE);
    await this.initialize();
    this.prompt();
  }
}

// Main entry point
const cli = new CLI();
cli.run().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
