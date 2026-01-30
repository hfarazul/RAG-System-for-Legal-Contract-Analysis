'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import MessageContent from '@/components/MessageContent';
import Sidebar from '@/components/Sidebar';
import {
  Conversation,
  getConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  generateTitle,
} from '@/lib/storage';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const initialized = useRef(false);

  const { messages, sendMessage, status, error, setMessages } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  // Load conversations on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const loaded = getConversations();
    setConversations(loaded);

    // If there are conversations, load the most recent one
    if (loaded.length > 0) {
      setActiveConversationId(loaded[0].id);
      setMessages(loaded[0].messages);
    }
  }, [setMessages]);

  // Save messages when they change
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      // Generate title from first user message if not set
      const conv = conversations.find(c => c.id === activeConversationId);
      const firstUserMessage = messages.find(m => m.role === 'user');

      const updates: Partial<Conversation> = { messages };

      if (conv?.title === 'New Conversation' && firstUserMessage) {
        const textPart = firstUserMessage.parts.find(p => p.type === 'text');
        if (textPart && 'text' in textPart) {
          updates.title = generateTitle(textPart.text);
        }
      }

      updateConversation(activeConversationId, updates);

      // Update local state
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConversationId
            ? { ...c, ...updates, updatedAt: Date.now() }
            : c
        )
      );
    }
  }, [messages, activeConversationId, conversations]);

  const handleNewConversation = useCallback(() => {
    const newConv = createConversation();
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setMessages([]);
    setInput('');
  }, [setMessages]);

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversationId(id);
      setMessages(conv.messages);
    }
  }, [conversations, setMessages]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));

    if (activeConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
        setMessages(remaining[0].messages);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    }
  }, [activeConversationId, conversations, setMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Create new conversation if none active
    if (!activeConversationId) {
      const newConv = createConversation();
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
    }

    const message = input;
    setInput('');
    await sendMessage({ text: message });
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Legal Contract Analysis
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Ask questions about NDAs, SLAs, DPAs, and Vendor Agreements
            </p>
          </div>
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
    </div>
  );
}
