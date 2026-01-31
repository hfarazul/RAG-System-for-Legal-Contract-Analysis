# Legal Contract Analysis - RAG System

A RAG system for analyzing legal contracts with citations and automatic risk flagging. Supports both CLI and Web UI.

## Problem Overview

This system allows users to ask natural language questions about legal contracts and receive:
- **Grounded answers** with precise citations
- **Automatic risk flags** when issues are detected
- **Cross-document analysis** to identify conflicts across agreements

The system analyzes NDAs, Vendor Agreements, Service Level Agreements, and Data Processing Agreements.

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLI / Web Interface                         │
│                    (Multi-turn Conversation)                     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Analyzer Agent                             │
│                                                                  │
│  • Answers questions with citations                              │
│  • Proactively flags risks                                       │
│  • Cross-references documents                                    │
│                                                                  │
│  Tool: retrieveChunks(query, docType?, topK?)                   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Retrieval Layer                             │
│  Query Embed (OpenAI) → Vector Search → Rerank (Cohere)         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              In-Memory Vector Store + JSON Persistence           │
└─────────────────────────────────────────────────────────────────┘
```

**Key**: Agent can call retrieval tool **multiple times** until it has all information (agentic loop with `maxSteps: 5`)

### RAG Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Load      │───▶│   Chunk     │───▶│   Embed     │───▶│   Store     │
│   (.txt)    │    │ (by section)│    │  (OpenAI)   │    │   (JSON)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

Ingestion: Documents → Section-based chunks → 1536-dim vectors → vectors.json
```

### Single Agent with Tools (vs Multi-Agent)

We chose a **single agent with tools** architecture instead of separate specialized agents:

```
Multi-Agent (Considered):
   ┌─────────────┐     ┌─────────────┐
   │  Analyzer   │     │    Risk     │
   │   Agent     │     │  Assessor   │
   └─────────────┘     └─────────────┘
   Adds coordination overhead

Single Agent (Implemented):
   ┌─────────────────────────────────┐
   │         Analyzer Agent          │
   │  • Q&A with citations           │
   │  • Proactive risk flagging      │
   │  • Cross-document analysis      │
   └─────────────────────────────────┘
   Unified context, no handoff losses
```

**Why Single Agent?**
| Reason | Explanation |
|--------|-------------|
| **No parallelizable subtasks** | All operations use same retrieved context |
| **Avoids context fragmentation** | Multi-agent loses context at handoffs |
| **Token efficiency** | Multi-agent uses 3-10x more tokens (Anthropic) |
| **Simpler debugging** | One prompt surface vs. multiple agents |

---

## Design Choices & Trade-offs

### 1. Chunking Strategy: Section-Based

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **Section-based** | Fixed-size (512 tokens) | Legal documents have natural semantic boundaries. Section-based chunking preserves complete clauses and enables precise citations like `[NDA, Section 3]`. Fixed-size would split mid-sentence and lose context. |

### 2. Embedding Model: OpenAI `text-embedding-3-small`

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **text-embedding-3-small** | text-embedding-3-large, Cohere, Voyage | At 21 chunks, all models perform equivalently — quality differences are negligible at this scale. Cheapest option (5-6x cheaper) with simplest integration (native Vercel AI SDK support). |

### 3. LLM: Claude Sonnet (Anthropic)

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **Claude Sonnet** | GPT-4, Llama via Ollama | Strong legal reasoning capability, excellent instruction following. Temperature set to 0.1 for deterministic, consistent responses. Vercel AI SDK enables easy provider switching. |

### 4. Vector Store: In-Memory + JSON

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **In-Memory + JSON** | ChromaDB, Pinecone | Zero external dependencies, instant startup, trivial debugging. Perfect for 21 chunks. Demonstrates core RAG mechanics without infrastructure overhead. Not production-scale. |

### 5. Architecture: Single Agent with Tools

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **Single agent** | Separate Analyzer + Risk Assessor | Avoids over-agentification. Risk flagging integrated into main agent enables proactive detection without requiring explicit user requests. Simpler conversation flow. |

### 6. Retrieval: Semantic Search + Reranking

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **Cosine similarity + Cohere rerank** | Hybrid (BM25 + semantic) | Two-stage retrieval: vector search (top 20) → cross-encoder reranking (top 5). Trade-off: may miss exact keyword matches like "72 hours". Hybrid search would be a production enhancement. |

---

## Known Limitations

### 1. Scale Limitations
- **Vector Store**: In-memory store works for ~100K vectors max. Production would need Pinecone/Qdrant.
- **Chunking**: Section-based assumes numbered sections (`1. Title`). Won't work for unstructured documents.

### 2. Retrieval Limitations
- **No Hybrid Search**: Pure semantic search may miss exact terms like "72 hours" or "99.5%". BM25 + semantic would improve precision.

### 3. Agent Limitations
- **No Confidence Scores**: Agent doesn't indicate certainty level of answers.
- **Context Window**: Very long conversations may hit token limits (mitigated by `/clear` command).
- **Hallucination Risk**: Despite grounding, LLM may occasionally infer beyond retrieved context.

### 4. Evaluation Limitations
- **LLM-as-Judge Bias**: GPT-4o judging Claude may have blind spots.
- **No Latency Metrics**: Response time not measured.
- **Single-shot eval**: Evaluation uses single retrieval call, but production uses agentic loop (may underestimate capability).

### 5. Document Limitations
- **English Only**: No multi-language support.
- **Text Files Only**: No PDF/DOCX parsing.
- **Static Corpus**: No real-time document updates.

---

## Setup

### Requirements
- Node.js 18+
- npm 9+
- OpenAI API Key (embeddings)
- Anthropic API Key (Claude LLM)
- Cohere API Key (reranking)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY=sk-...
#   ANTHROPIC_API_KEY=sk-ant-...
#   COHERE_API_KEY=...

# 3. Run ingestion (one-time)
npm run ingest

# 4. Start the CLI or Web UI
npm run start    # CLI
npm run dev      # Web UI (React)
```

---

## Usage

### Interactive CLI

```
> What is the notice period for terminating the NDA?

The NDA can be terminated with **30 days written notice** [NDA, Section 3: Term and Termination].
Confidentiality obligations survive for 5 years after termination.

> Is liability capped?

The NDA does not specify an explicit liability cap [NDA, Section 4: Liability].

⚠️ RISK: LIABILITY (HIGH)
   No liability cap exposes parties to unlimited financial risk.
   Citation: [NDA, Section 4: Liability]

Note: The VSA caps liability at 12 months' fees [VSA, Section 4].
```

### Commands

| Command | Description |
|---------|-------------|
| `/clear` | Clear conversation history |
| `/help` | Show help message |
| `exit` | Exit the application |

---

## Project Structure

```
Legal_Contract_Analysis/
├── config/
│   ├── default.yaml              # Configuration
│   └── prompts/
│       └── analyzer.txt          # Agent system prompt
├── src/
│   ├── index.ts                  # CLI entry point
│   ├── ingest.ts                 # Ingestion pipeline
│   ├── config.ts                 # Config loader
│   ├── types.ts                  # TypeScript types
│   ├── ingestion/
│   │   ├── loader.ts             # Document loader
│   │   ├── chunker.ts            # Section-based chunking
│   │   └── embedder.ts           # OpenAI embeddings
│   ├── retrieval/
│   │   └── retriever.ts          # Vector search + reranking tool
│   ├── agents/
│   │   └── analyzer.ts           # Main agent
│   └── vectorStore/
│       └── index.ts              # In-memory vector store
├── frontend/                     # React Web UI
│   └── ...
├── eval/
│   ├── testCases.json            # 43 evaluation test cases
│   └── evaluate.ts               # Evaluation script
└── data/
    ├── *.txt                     # Legal documents
    └── vectors.json              # Generated embeddings
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start interactive CLI |
| `npm run dev` | Start Web UI (React) |
| `npm run ingest` | Run document ingestion |
| `npm run eval` | Run evaluation suite (43 test cases) |

---

## Evaluation Results

| Metric | Result |
|--------|--------|
| **Overall Score** | **98.0%** (eval) / **100%** (prod) |
| Retrieval Tests | 35/35 (100%) |
| Answer Tests | 40/41 (97.6%) |
| Out-of-Scope Accuracy | 100% |
| Adversarial Handling | 100% |

### LLM Judge Scores (GPT-4o)

| Dimension | Average |
|-----------|---------|
| Faithfulness | 4.74/5 |
| Relevance | 4.89/5 |
| Completeness | 4.77/5 |
| Citation Accuracy | 4.71/5 |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js / TypeScript |
| Frontend | React |
| Agent Framework | Vercel AI SDK v4 |
| LLM | Claude Sonnet (Anthropic) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Reranking | Cohere `rerank-v3.5` |
| Vector Store | In-Memory + JSON |
| Validation | Zod |
| Config | YAML |

---

## Available Documents

| Document | Type | Sections | Governing Law |
|----------|------|----------|---------------|
| Non-Disclosure Agreement | NDA | 5 | California, USA |
| Vendor Services Agreement | VSA | 6 | England & Wales |
| Service Level Agreement | SLA | 4 | (inherits from VSA) |
| Data Processing Agreement | DPA | 6 | EU (GDPR) |
