# Legal Contract Analysis - Multi-Agent RAG System

A CLI-based RAG system for analyzing legal contracts with citations and automatic risk flagging.

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
│                         CLI Interface                            │
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
│  • Maintains conversation context                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Tools Available                        │    │
│  │                                                          │    │
│  │  retrieveChunks(query, docType?, topK?)                 │    │
│  │    → Semantic search over contract sections              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Retrieval Layer                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Query Embed  │───▶│ Vector Store │───▶│   Top-K      │       │
│  │  (OpenAI)    │    │  (In-Memory) │    │   Results    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Document Corpus                               │
│                                                                  │
│   NDA (5 sections)  │  VSA (6 sections)  │  SLA (4 sections)    │
│   DPA (6 sections)  │  Total: 21 chunks                         │
└─────────────────────────────────────────────────────────────────┘
```

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
❌ Original Plan (Rejected):
   ┌─────────────┐     ┌─────────────┐
   │  Analyzer   │     │    Risk     │
   │   Agent     │     │  Assessor   │
   └─────────────┘     └─────────────┘
   (User must explicitly ask for risks)

✅ Final Design (Implemented):
   ┌─────────────────────────────────┐
   │         Analyzer Agent          │
   │  • Q&A with citations           │
   │  • Proactive risk flagging      │
   │  • Cross-document analysis      │
   └─────────────────────────────────┘
   (Risks flagged automatically when relevant)
```

**Why?** The requirement states "risk indicators **where applicable**" - risks should appear automatically, not require explicit user requests.

---

## Design Choices & Trade-offs

### 1. Chunking Strategy: Section-Based

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **Section-based** | Fixed-size (512 tokens) | Legal documents have natural semantic boundaries. Section-based chunking preserves complete clauses and enables precise citations like `[NDA, Section 3]`. Fixed-size would split mid-sentence and lose context. |

### 2. Embedding Model: OpenAI `text-embedding-3-small`

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **text-embedding-3-small** | text-embedding-3-large | 5x cheaper with only 2% quality difference. 1536 dimensions provide good precision. For 21 chunks, we optimized for simplicity over marginal quality gains. |

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

### 6. Retrieval: Pure Semantic Search

| Choice | Alternative | Rationale |
|--------|-------------|-----------|
| **Cosine similarity** | Hybrid (BM25 + semantic) | Simpler implementation, sufficient for small corpus. Trade-off: may miss exact keyword matches like "72 hours". Hybrid search would be a production enhancement. |

---

## Known Limitations

### 1. Scale Limitations
- **Vector Store**: In-memory store works for ~100K vectors max. Production would need Pinecone/Qdrant.
- **Chunking**: Section-based assumes numbered sections (`1. Title`). Won't work for unstructured documents.

### 2. Retrieval Limitations
- **No Hybrid Search**: Pure semantic search may miss exact terms like "72 hours" or "99.5%". BM25 + semantic would improve precision.
- **No Reranking**: Results ordered by cosine similarity only. Cohere reranker could improve relevance.

### 3. Agent Limitations
- **No Confidence Scores**: Agent doesn't indicate certainty level of answers.
- **Context Window**: Very long conversations may hit token limits (mitigated by `/clear` command).
- **Hallucination Risk**: Despite grounding, LLM may occasionally infer beyond retrieved context.

### 4. Evaluation Limitations
- **Small Test Set**: 15 test cases can't cover all edge cases.
- **LLM-as-Judge Bias**: Claude evaluating Claude may be lenient.
- **No Adversarial Testing**: Not tested against prompt injection or jailbreaks.
- **No Latency Metrics**: Response time not measured.

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

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY=sk-...
#   ANTHROPIC_API_KEY=sk-ant-...

# 3. Run ingestion (one-time)
npm run ingest

# 4. Start the CLI
npm run start
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
│   │   └── retriever.ts          # Vector search tool
│   ├── agents/
│   │   └── analyzer.ts           # Main agent
│   └── vectorStore/
│       └── index.ts              # In-memory vector store
├── eval/
│   ├── testCases.json            # 15 evaluation test cases
│   └── evaluate.ts               # Evaluation script
├── tests/
│   ├── test-proactive.ts         # Proactive risk flagging tests
│   └── test-crossref.ts          # Cross-document reference tests
└── data/
    ├── *.txt                     # Legal documents
    └── vectors.json              # Generated embeddings
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start interactive CLI |
| `npm run ingest` | Run document ingestion |
| `npm run eval` | Run evaluation suite (15 test cases) |
| `npm run test:proactive` | Test proactive risk flagging |
| `npm run test:crossref` | Test cross-document referencing |

---

## Evaluation Results

```
Retrieval Metrics:
  Tests Passed: 13/13
  Avg Recall: 100.0%

Answer Metrics:
  Tests Passed: 15/15
  Risk Flag Accuracy: 100.0%
  Out-of-Scope Accuracy: 100.0%

Overall Score: 100.0%
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js / TypeScript |
| Agent Framework | Vercel AI SDK v4 |
| LLM | Claude Sonnet (Anthropic) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector Store | In-Memory + JSON |
| Config | YAML |

---

## Available Documents

| Document | Type | Sections | Governing Law |
|----------|------|----------|---------------|
| Non-Disclosure Agreement | NDA | 5 | California, USA |
| Vendor Services Agreement | VSA | 6 | England & Wales |
| Service Level Agreement | SLA | 4 | (inherits from VSA) |
| Data Processing Agreement | DPA | 6 | EU (GDPR) |
