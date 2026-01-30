import type { UIMessage } from '@ai-sdk/react';

export interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'legal-analysis-conversations';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Failed to save conversations:', error);
  }
}

export function getConversation(id: string): Conversation | null {
  const conversations = getConversations();
  return conversations.find(c => c.id === id) || null;
}

export function createConversation(): Conversation {
  const conversation: Conversation = {
    id: generateId(),
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const conversations = getConversations();
  conversations.unshift(conversation);
  saveConversations(conversations);

  return conversation;
}

export function updateConversation(id: string, updates: Partial<Conversation>): void {
  const conversations = getConversations();
  const index = conversations.findIndex(c => c.id === id);

  if (index !== -1) {
    conversations[index] = {
      ...conversations[index],
      ...updates,
      updatedAt: Date.now(),
    };
    saveConversations(conversations);
  }
}

export function deleteConversation(id: string): void {
  const conversations = getConversations();
  const filtered = conversations.filter(c => c.id !== id);
  saveConversations(filtered);
}

export function generateTitle(firstMessage: string): string {
  // Take first 50 characters of first message as title
  const title = firstMessage.trim().slice(0, 50);
  return title.length < firstMessage.trim().length ? title + '...' : title;
}
