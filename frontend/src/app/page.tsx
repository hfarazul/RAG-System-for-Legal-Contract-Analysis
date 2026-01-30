'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import MessageContent from '@/components/MessageContent';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput('');
    await sendMessage({ text: message });
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Legal Contract Analysis
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ask questions about NDAs, SLAs, DPAs, and Vendor Agreements
        </p>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <p className="text-lg mb-2">Welcome to Legal Contract Analysis</p>
              <p className="text-sm">Try asking:</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>&quot;What is the confidentiality period in the NDA?&quot;</li>
                <li>&quot;What are the termination conditions?&quot;</li>
                <li>&quot;Compare the liability clauses across documents&quot;</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <div className="text-xs font-medium mb-1 opacity-70">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap">
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return message.role === 'assistant' ? (
                        <MessageContent key={index} content={part.text} />
                      ) : (
                        <span key={index}>{part.text}</span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-red-600 dark:text-red-400">
                Error: {error.message}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the contracts..."
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
