'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import MessageContent from '@/components/MessageContent';
import Sidebar from '@/components/Sidebar';
import ThemeToggle from '@/components/ThemeToggle';
import LoadingSpinner from '@/components/LoadingSpinner';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  const { messages, sendMessage, status, error, setMessages } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    setSidebarOpen(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

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

  // Keep ref in sync with conversations state
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Save messages when they change
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      // Generate title from first user message if not set
      const conv = conversationsRef.current.find(c => c.id === activeConversationId);
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
  }, [messages, activeConversationId]);

  const handleNewConversation = useCallback(() => {
    const newConv = createConversation();
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setMessages([]);
    setInput('');
    // Close sidebar on mobile after creating new chat
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [setMessages]);

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversationId(id);
      setMessages(conv.messages);
      // Close sidebar on mobile after selecting
      if (window.innerWidth < 768) setSidebarOpen(false);
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

  const handleClearConversation = useCallback(() => {
    if (activeConversationId) {
      setMessages([]);
      updateConversation(activeConversationId, { messages: [], title: 'New Conversation' });
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConversationId
            ? { ...c, messages: [], title: 'New Conversation', updatedAt: Date.now() }
            : c
        )
      );
    }
  }, [activeConversationId, setMessages]);

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
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative inset-y-0 left-0 z-30 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:hidden'
        }`}
      >
        {sidebarOpen && (
          <Sidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              Legal Contract Analysis
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
              Ask questions about NDAs, SLAs, DPAs, and Vendor Agreements
            </p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearConversation}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                title="Clear conversation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-2">Welcome to Legal Contract Analysis</p>
                <p className="text-sm mb-4">I can help you understand your legal contracts. Try asking:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'What is the confidentiality period?',
                    'What are the termination conditions?',
                    'Compare liability clauses',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 shadow-sm'
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
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
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 shadow-sm">
                  <LoadingSpinner />
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 max-w-md">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{error.message}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the contracts..."
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span className="hidden sm:inline">Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
