import type { UIMessage } from '@ai-sdk/react';
import { z } from 'zod';

export interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'legal-analysis-conversations';

// Validation schema for stored conversations
const StoredMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
}).passthrough();

const StoredMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(StoredMessagePartSchema),
}).passthrough();

const StoredConversationSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  messages: z.array(StoredMessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/**
 * Generate a cryptographically secure unique ID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

/**
 * Get all conversations from localStorage with validation
 */
export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid conversations data in localStorage, resetting');
      return [];
    }

    // Validate each conversation and filter out invalid ones
    const validConversations: Conversation[] = [];
    for (const item of parsed) {
      const result = StoredConversationSchema.safeParse(item);
      if (result.success) {
        validConversations.push(result.data as Conversation);
      } else {
        console.warn('Skipping invalid conversation:', result.error.flatten());
      }
    }

    return validConversations;
  } catch (error) {
    console.warn('Failed to parse conversations from localStorage:', error);
    return [];
  }
}

/**
 * Save conversations to localStorage
 */
export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Limit total stored conversations to prevent localStorage bloat
    const limitedConversations = conversations.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedConversations));
  } catch (error) {
    console.error('Failed to save conversations:', error);
  }
}

/**
 * Get a single conversation by ID
 */
export function getConversation(id: string): Conversation | null {
  const conversations = getConversations();
  return conversations.find(c => c.id === id) || null;
}

/**
 * Create a new conversation
 */
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

/**
 * Update an existing conversation
 */
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

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): void {
  const conversations = getConversations();
  const filtered = conversations.filter(c => c.id !== id);
  saveConversations(filtered);
}

/**
 * Generate a title from the first message
 */
export function generateTitle(firstMessage: string): string {
  // Sanitize and take first 50 characters
  const sanitized = firstMessage.trim().replace(/[<>]/g, '');
  const title = sanitized.slice(0, 50);
  return title.length < sanitized.length ? title + '...' : title;
}
