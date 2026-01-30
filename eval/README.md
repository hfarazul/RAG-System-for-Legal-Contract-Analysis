# Evaluation Framework

## What We Evaluate

### 1. Retrieval Quality
- **Metric**: Recall (% of expected chunks retrieved)
- **Test**: For each query, verify that expected document sections are in top-5 results
- **Threshold**: 50% recall minimum to pass

### 2. Answer Quality
- **Metric**: Keyword presence
- **Test**: Verify response contains expected keywords/phrases
- **Example**: Query about "termination notice" should contain "30 days"

### 3. Risk Flag Accuracy
- **Metric**: Detection rate
- **Test**: Queries about risky clauses should trigger ⚠️ risk flags
- **Example**: "Is liability capped in NDA?" should flag HIGH liability risk

### 4. Out-of-Scope Handling
- **Metric**: Rejection accuracy
- **Test**: Requests to draft contracts or provide legal advice should be refused
- **Example**: "Can you draft a better NDA?" should be declined

### 5. Edge Case Robustness
- **Metric**: Retrieval success despite malformed input
- **Test**: Typos, minimal queries, ambiguous references should still retrieve correct chunks
- **Example**: "liabiity cap?" (typo) should still find liability sections

### 6. Multi-Turn Conversations
- **Metric**: Context retention accuracy
- **Test**: Follow-up questions should reference previous answers correctly
- **Example**: "What is the liability cap?" → "How does that compare to the NDA?"

---

## Why It Matters

| Metric | Why It Matters |
|--------|----------------|
| **Retrieval Recall** | If wrong chunks are retrieved, the LLM cannot produce accurate answers. Retrieval is the foundation of RAG. |
| **Answer Quality** | Users need factually correct answers with proper citations. Incorrect information could have legal consequences. |
| **Risk Flagging** | The system's value proposition is proactive risk detection. Missing a liability gap defeats the purpose. |
| **Out-of-Scope Rejection** | The system must not hallucinate legal advice or draft documents, which could expose users to liability. |

---

## Test Cases

Total: **37 test cases**

| Category | Count | Examples |
|----------|-------|----------|
| Simple Retrieval | 11 | "What is the uptime commitment?" |
| Risk Detection | 8 | "Is liability capped in the NDA?", "Is Acme exposed to unlimited liability?" |
| Cross-Document | 6 | "Are there conflicting governing laws?", "Compare termination notice periods" |
| Out-of-Scope | 4 | "Can you draft a better NDA?", "Should Acme sign this contract?" |
| Edge Cases | 6 | "liabiity cap?" (typo), "Liability?" (minimal query) |
| Multi-Turn | 2 | Initial: "What is the liability cap in VSA?" → Follow-up: "How does that compare to the NDA?" |

---

## Running Evaluation

```bash
npm run eval
```

Output:
```
Retrieval Metrics:
  Tests Passed: 17/17
  Avg Recall: 100.0%

Answer Metrics:
  Tests Passed: 19/19
  Risk Flag Accuracy: 100.0%
  Out-of-Scope Accuracy: 100.0%

Overall Score: 100.0%
```

---

## Limitations

### 1. Small Test Set
- Only 19 test cases cannot cover all edge cases
- No long-tail query testing
- Limited adversarial examples

### 2. LLM-as-Judge Bias
- Claude evaluating Claude may be lenient
- No human baseline comparison
- Keyword matching is simplistic

### 3. No Adversarial Testing
- Not tested against prompt injection
- No jailbreak attempts
- No malformed input testing

### 4. Limited Multi-Turn Coverage
- Only 2 multi-turn test cases
- No extended conversation chains (3+ turns)
- No user satisfaction measurement

### 5. Missing Metrics
- **Latency**: Response time not measured
- **Cost**: Token usage not tracked

### Note on LLM Judge
We now use GPT-4o as an independent judge to score:
- **Faithfulness**: Does response match retrieved context?
- **Relevance**: Does response address the question?
- **Completeness**: Are all parts answered?
- **Citation Accuracy**: Do citations match content?

This provides unbiased evaluation (different model family than Claude).

---

## Future Improvements

1. **LLM-as-Judge**: Use Claude to score faithfulness and relevance (1-5)
2. **Human Evaluation**: Manual review of sample responses
3. **Adversarial Testing**: Prompt injection, jailbreak attempts
4. **Multi-turn Evaluation**: Test conversation coherence
5. **Latency Benchmarks**: Measure p50/p95 response times
