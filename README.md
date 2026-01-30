# Legal Contract Analysis - Multi-Agent RAG System

A CLI-based multi-agent RAG system for analyzing legal contracts with citations and risk flags.

## Requirements

### System Requirements
- Node.js 18+
- npm 9+

### API Keys Required
- **OpenAI API Key** - For text embeddings (`text-embedding-3-small`)
- **Anthropic API Key** - For Claude LLM (contract analysis)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

### 3. Run Ingestion Pipeline (One-time)
```bash
npm run ingest
```
This creates embeddings for all legal documents and saves them to `data/vectors.json`.

### 4. Start the CLI
```bash
npm run start
```

## Usage

Once started, you can ask questions about the legal contracts:

```
> What is the notice period for terminating the NDA?
> What is the uptime commitment in the SLA?
> Are there conflicting governing laws across agreements?
> Is liability capped in the NDA?
```

### Special Commands
- `exit` or `quit` - Exit the application
- `/clear` - Clear conversation history
- `/risk` - Run risk assessment on all contracts

## Project Structure

```
Legal_Contract_Analysis/
├── config/
│   ├── default.yaml          # Configuration settings
│   └── prompts/
│       ├── analyzer.txt      # Analyzer agent prompt
│       └── risk-assessor.txt # Risk assessor prompt
├── src/
│   ├── index.ts              # CLI entry point
│   ├── ingest.ts             # Ingestion pipeline
│   ├── config.ts             # Config loader
│   ├── types.ts              # TypeScript types
│   ├── ingestion/
│   │   ├── loader.ts         # Document loader
│   │   ├── chunker.ts        # Section-based chunking
│   │   └── embedder.ts       # OpenAI embeddings
│   ├── retrieval/
│   │   └── retriever.ts      # Vector search tool
│   ├── agents/
│   │   ├── analyzer.ts       # Q&A agent
│   │   └── riskAssessor.ts   # Risk analysis agent
│   └── vectorStore/
│       └── index.ts          # In-memory vector store
├── data/
│   ├── *.txt                 # Legal contract documents
│   └── vectors.json          # Generated embeddings
├── eval/
│   ├── testCases.json        # Evaluation test cases
│   └── evaluate.ts           # Evaluation script
└── docs/
    └── analysis.md           # Technical analysis
```

## Available Documents

| Document | Type | Sections |
|----------|------|----------|
| Non-Disclosure Agreement | NDA | 5 |
| Vendor Services Agreement | VSA | 6 |
| Service Level Agreement | SLA | 4 |
| Data Processing Agreement | DPA | 6 |

## Tech Stack

- **Runtime**: Node.js / TypeScript
- **Agent Framework**: Vercel AI SDK v4
- **LLM**: Claude (Anthropic)
- **Embeddings**: OpenAI `text-embedding-3-small`
- **Vector Store**: In-Memory + JSON persistence

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start the CLI application |
| `npm run ingest` | Run document ingestion pipeline |
| `npm run eval` | Run evaluation suite |
| `npm run test:config` | Test configuration loading |
