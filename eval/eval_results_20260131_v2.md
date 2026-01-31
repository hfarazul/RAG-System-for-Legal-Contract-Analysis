# Evaluation Results - January 31, 2026 (v2)

**Changes:** Fixed multi-turn conversations (frontend + backend)
**Overall Score:** 97.6%

---

## Summary

| Metric | Result |
|--------|--------|
| **Overall Score** | 97.6% |
| **Retrieval Tests** | 34/35 passed (97.1%) |
| **Answer Tests** | 40/41 passed (97.6%) |
| **Multi-Turn Tests** | 2/2 passed (100%) |
| **Out-of-Scope Accuracy** | 100% |

---

## LLM Judge Scores (GPT-4o)

| Metric | Score | Analysis |
|--------|-------|----------|
| **Faithfulness** | 4.83/5 | Excellent - responses grounded in context |
| **Relevance** | 4.91/5 | Excellent - responses address questions |
| **Completeness** | 4.77/5 | Excellent - comprehensive answers |
| **Citation Accuracy** | 4.80/5 | Excellent - citations match content |

---

## Fixes Applied

### 1. Frontend API Schema (multi-turn fix)
**File:** `frontend/src/app/api/chat/route.ts`

Relaxed validation to accept all message part types (text, tool-invocation, tool-result):
```typescript
const MessagePartSchema = z.object({
  type: z.string(),  // Was: z.literal('text')
  text: z.string().max(10000).optional(),  // Was: required
}).passthrough();
```

### 2. Eval Multi-Turn (clearHistory)
**File:** `eval/evaluate.ts`

Added `agent.clearHistory()` before each multi-turn test to prevent history contamination.

### 3. Agent Tool Execution (stopWhen)
**File:** `src/agents/analyzer.ts`

Changed from `maxSteps: 5` to `stopWhen: stepCountIs(5)` to ensure tool results are processed and model continues generating text.

---

## Comparison with Previous Run

| Metric | v1 | v2 | Change |
|--------|-----|-----|--------|
| Overall Score | 86.6% | 97.6% | +11% |
| Answer Tests | 39/41 | 40/41 | +1 |
| Multi-Turn | 0/2 | 2/2 | +2 |
| Faithfulness | 4.17/5 | 4.83/5 | +0.66 |
| Completeness | 3.17/5 | 4.77/5 | +1.60 |

---

## Remaining Issues

### tc-019: "Summarize all risks for Acme Corp"
- **Retrieval:** 25% recall (1/4 expected chunks)
- **Answer:** F2/R3/C2/A2 (low faithfulness)
- **Root cause:** Abstract query doesn't match specific section embeddings

---

## Raw Output

```
Retrieval:
  tc-001: ✓ (recall: 100%)
  tc-002: ✓ (recall: 100%)
  tc-003: ✓ (recall: 100%)
  tc-004: ✓ (recall: 100%)
  tc-005: ✓ (recall: 100%)
  tc-006: ✓ (recall: 100%)
  tc-007: ✓ (recall: 100%)
  tc-008: ✓ (recall: 100%)
  tc-009: ✓ (recall: 100%)
  tc-010: ✓ (recall: 100%)
  tc-011: ✓ (recall: 100%)
  tc-012: ✓ (recall: 100%)
  tc-015: ✓ (recall: 100%)
  tc-016: ✓ (recall: 100%)
  tc-017: ✓ (recall: 100%)
  tc-018: ✓ (recall: 100%)
  tc-019: ✗ (recall: 25%)
  tc-020: ✓ (recall: 100%)
  tc-021: ✓ (recall: 100%)
  tc-022: ✓ (recall: 100%)
  tc-023: ✓ (recall: 100%)
  tc-024: ✓ (recall: 100%)
  tc-025: ✓ (recall: 100%)
  tc-026: ✓ (recall: 100%)
  tc-027: ✓ (recall: 67%)
  tc-028: ✓ (recall: 100%)
  tc-029: ✓ (recall: 100%)
  tc-030: ✓ (recall: 100%)
  tc-031: ✓ (recall: 100%)
  tc-032: ✓ (recall: 100%)
  tc-033: ✓ (recall: 100%)
  tc-040: ✓ (recall: 100%)
  tc-041: ✓ (recall: 100%)
  tc-042: ✓ (recall: 67%)
  tc-043: ✓ (recall: 100%)

Answers:
  tc-001: ✓ [Judge: F5/R5/C5/A5]
  tc-002: ✓ [Judge: F5/R5/C5/A5]
  tc-003: ✓ [Judge: F5/R5/C5/A5]
  tc-004: ✓ [Judge: F5/R5/C5/A5]
  tc-005: ✓ [Judge: F5/R5/C5/A5]
  tc-006: ✓ [Judge: F5/R5/C5/A5]
  tc-007: ✓ [Judge: F5/R5/C5/A5]
  tc-008: ✓ [Judge: F5/R5/C5/A5]
  tc-009: ✓ [Judge: F5/R5/C5/A5]
  tc-010: ✓ [Judge: F5/R5/C5/A5]
  tc-011: ✓ [Judge: F5/R5/C5/A5]
  tc-012: ✓ [Judge: F5/R5/C4/A5]
  tc-013: ✓ (out-of-scope refusal)
  tc-014: ✓ (out-of-scope refusal)
  tc-015: ✓ [Judge: F5/R5/C5/A5]
  tc-016: ✓ [Judge: F5/R5/C5/A5]
  tc-017: ✓ [Judge: F5/R5/C5/A5]
  tc-018: ✓ [Judge: F5/R5/C5/A5]
  tc-019: ✗ [Judge: F2/R3/C2/A2]
  tc-020: ✓ [Judge: F5/R5/C5/A5]
  tc-021: ✓ [Judge: F5/R5/C5/A5]
  tc-022: ✓ [Judge: F5/R5/C5/A5]
  tc-023: ✓ [Judge: F5/R5/C5/A5]
  tc-024: ✓ [Judge: F5/R5/C5/A5]
  tc-025: ✓ [Judge: F5/R5/C5/A5]
  tc-026: ✓ [Judge: F5/R5/C5/A5]
  tc-027: ✓ [Judge: F3/R4/C3/A2]
  tc-028: ✓ [Judge: F5/R5/C5/A5]
  tc-029: ✓ [Judge: F5/R5/C5/A5]
  tc-030: ✓ [Judge: F5/R5/C4/A5]
  tc-031: ✓ [Judge: F5/R5/C5/A5]
  tc-032: ✓ [Judge: F5/R5/C5/A5]
  tc-033: ✓ [Judge: F5/R5/C5/A5]
  tc-034: ✓ (out-of-scope refusal)
  tc-035: ✓ (out-of-scope refusal)
  tc-038: ✓ (adversarial refusal)
  tc-039: ✓ (adversarial refusal)
  tc-040: ✓ [Judge: F5/R5/C5/A5]
  tc-041: ✓ [Judge: F5/R5/C5/A5]
  tc-042: ✓ [Judge: F4/R5/C4/A4]
  tc-043: ✓ [Judge: F5/R5/C5/A5]

Multi-Turn:
  tc-036: ✓ [Judge: F5/R5/C5/A5]
  tc-037: ✓ [Judge: F5/R5/C5/A5]
```
