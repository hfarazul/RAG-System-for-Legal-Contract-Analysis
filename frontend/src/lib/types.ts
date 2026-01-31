import { z } from 'zod';

// Document types
export type DocType = 'NDA' | 'VSA' | 'SLA' | 'DPA';

// Document metadata extracted from files
export interface DocMetadata {
  docType: DocType;
  docName: string;
  parties: string[];
  governingLaw: string;
  filename: string;
}

// Raw document after loading
export interface RawDocument {
  filename: string;
  content: string;
  metadata: DocMetadata;
}

// Chunk after section-based splitting
export interface Chunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  docType: DocType;
  docName: string;
  parties: string[];
  governingLaw: string;
  sectionNumber: number;
  sectionTitle: string;
}

// Vector store entry (chunk with embedding)
export interface VectorEntry {
  id: string;
  vector: number[];
  text: string;
  metadata: ChunkMetadata;
}

// Retrieval result with similarity score
export interface RetrievalResult extends VectorEntry {
  score: number;
}

// Risk assessment types
export const RiskTypeSchema = z.enum(['LIABILITY', 'COMPLIANCE', 'FINANCIAL', 'OPERATIONAL']);
export const SeveritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export type RiskType = z.infer<typeof RiskTypeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;

export const RiskSchema = z.object({
  type: RiskTypeSchema,
  severity: SeveritySchema,
  description: z.string(),
  citation: z.string(),
  recommendation: z.string().optional(),
});

export const ConflictSchema = z.object({
  documents: z.array(z.string()),
  issue: z.string(),
  severity: SeveritySchema,
});

export const RiskAnalysisSchema = z.object({
  risks: z.array(RiskSchema),
  conflicts: z.array(ConflictSchema),
  summary: z.string(),
});

export type Risk = z.infer<typeof RiskSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;
export type RiskAnalysis = z.infer<typeof RiskAnalysisSchema>;

// Configuration types
export interface Config {
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
  };
  llm: {
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
  };
  retrieval: {
    top_k: number;
    rerank: {
      enabled: boolean;
      provider: string;
      model: string;
      over_fetch_multiplier: number;
    };
  };
  chunking: {
    strategy: string;
    include_doc_prefix: boolean;
  };
  vector_store: {
    type: string;
    persist_path: string;
  };
  prompts: {
    analyzer: string;
  };
}

// Conversation message types
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
