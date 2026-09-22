# 🧠 Jev: TypeSafe Structured Decision Model on OpenRouter
### Comprehensive Technical Specification & Architectural Guide

---

## 📌 Executive Summary

**Jev** is a purpose-built, high-speed **System One structured decision model** developed by **TypeSafe** and hosted on **OpenRouter**. Unlike traditional Generative Large Language Models (LLMs) that produce free-form conversational prose, reasoning tokens, or unpredictable markdown blocks, Jev is engineered specifically to make **deterministic, typed, and probability-weighted decisions** for software workflows.

Instead of prompting an LLM and hoping it returns valid JSON (the fragile "prompt-and-parse" antipattern), you send Jev an application `state` along with one or more typed `questions`. Jev computes mathematical probabilities across predefined criteria and returns strictly typed answers with calibrated confidence metrics.

```
┌─────────────────────────────────────────────────────────────┐
│                      Application State                      │
│   (Customer Ticket, Agent Tool Call, Document Draft, etc.)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Jev Decision Engine                      │
│             (POST /api/alpha/decisions)                     │
│                                                             │
│   - Choice: Pick discrete alternative with confidence       │
│   - Noul:   Evaluate boolean truth probability (0 to 1)     │
│   - Score:  Place on ordered discrete scale (weighted float)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Typed Probabilistic Output                  │
│       (Zero free-form text. Direct code branching!)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Key Specifications & Facts

| Property | Details | Description / Notes |
| :--- | :--- | :--- |
| **Model Name** | `typesafe/jev-1.13` | Pinned stable release version (recommended for production). |
| **Model Alias** | `~typesafe/jev-latest` | Automatically resolves to the newest dated snapshot. |
| **Response Snapshot** | `typesafe/jev-1.13-YYYYMMDD` | The actual dated snapshot returned in `response.model`. |
| **Model Creator** | **TypeSafe** | Routing and billing managed seamlessly through OpenRouter. |
| **Architecture** | **System One Decision Model** | Non-generative, fast heuristic judgment. No reasoning tokens. |
| **Context Window** | **32,000 tokens** | Combined total of `state` payload and all `questions`. |
| **Pricing Model** | **Input Tokens Only** | **Output tokens are 100% FREE**. Billed per input token. |
| **Response Cost** | `usage.cost` (USD) | Precise cost in USD returned directly in every API response. |
| **Authentication** | Standard OpenRouter API Key | Uses Bearer Token (`Bearer sk-or-...`). No TypeSafe account needed. |
| **Primary Endpoint** | `POST https://openrouter.ai/api/alpha/decisions` | OpenRouter native Decisions API endpoint. |
| **SDK Endpoint** | `POST https://openrouter.ai/api/v1/systemone` | Endpoint for upstream `@typesafe-ai/sdk`. |

---

## 🏛️ Philosophy: System One vs. Generative Models (System Two)

Modern AI application development often abuses generative LLMs for tasks they were never designed to solve. When developers need to classify an email, verify if an action is safe, or route a support ticket, using a generative LLM introduces major flaws:

### 1. The Shortcomings of Generative LLMs for Decisions
- **Fragile "Prompt-and-Parse":** LLMs frequently add preamble ("Sure! Here is the JSON:"), wrap responses in markdown fences, or hallucinate keys, causing JSON parse errors in production.
- **Latency Overhead:** Generating 50–200 reasoning tokens or prose takes seconds, creating unacceptable bottlenecks in automated pipelines.
- **High Cost:** Generative pricing heavily taxes output tokens.
- **Illusion of Confidence:** When an LLM produces a label, it is impossible to know mathematically whether it was 99% confident or 51% confident without complex logit analysis.

### 2. The Jev "System One" Paradigm
Rooted in cognitive science (Daniel Kahneman's *Thinking, Fast and Slow*):
- **System One:** Fast, intuitive, automatic pattern-matching and judgment.
- **System Two:** Slow, deliberative, sequential step-by-step reasoning.

Jev operates as software's **System One**. It does **not** explain its answers, output conversational text, or output reasoning chains. It takes structured input, evaluates it against explicit criteria, and returns clean typed objects with full probability distributions. If your workflow requires human-like prose, use a generative chat model. If your workflow needs a programmatic decision to branch code, use Jev.

---

## 🎯 The Three Core Question Primitives

Jev categorizes all software decision-making into three fundamental mathematical primitives:

```
                  ┌──────────────────────┐
                  │    Jev Primitives    │
                  └──────────┬───────────┘
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │  Choice  │        │   Noul   │        │  Score   │
    │ (Discrete│        │ (Boolean │        │ (Ordered │
    │ Options) │        │  Truth)  │        │  Scale)  │
    └──────────┘        └──────────┘        └──────────┘
```

---

### 1. `choice` — Picking One Option from Alternatives

#### Concept
Selects the single best option from a discrete set of alternatives defined in a dictionary.

#### Request Definition
- `type`: `"choice"`
- `instructions`: Question prompt (`string | object | any[]`).
- `criteria`: An object mapping `optionKey: string` to its description (`string | object | any[] | null`).

```json
{
  "team": {
    "type": "choice",
    "instructions": "Which team should own this ticket?",
    "criteria": {
      "payments": "Checkout, billing, or payment processing issues.",
      "frontend": "Rendering, layout, or browser compatibility issues.",
      "account": "Login, permissions, or profile issues."
    }
  }
}
```

#### Response Structure
- `type`: `"choice"`
- `choice`: `string` — The selected option key with the highest probability.
- `confidence`: `number` (float `0.0` to `1.0`) — A statistical measure of how concentrated the probability distribution is. High confidence means one option dominates; low confidence means the options are tightly contested.
- `probabilities`: `Record<string, number>` — The exact probability assigned to each option (sums to `1.0`).

```json
{
  "type": "choice",
  "choice": "payments",
  "confidence": 0.75,
  "probabilities": {
    "payments": 0.84,
    "frontend": 0.16,
    "account": 0.00
  }
}
```

---

### 2. `noul` — Boolean Truth Evaluation (Yes/No)

#### Concept
Evaluates whether a specific condition holds true. The name **Noul** derives from boolean truth evaluation (null/one hypothesis).

#### Request Definition
- `type`: `"noul"`
- `instructions`: Question prompt (`string | object | any[]`).
- `criteria`: An object defining criteria for `true` and `false`:
  - `true`: Description of what constitutes a positive condition.
  - `false`: Description of what constitutes a negative condition.

```json
{
  "is_bug": {
    "type": "noul",
    "instructions": "Is the customer reporting a software defect?",
    "criteria": {
      "true": "The customer describes broken or unexpected product behavior.",
      "false": "The customer is asking a question or requesting a feature."
    }
  }
}
```

#### Response Structure
- `type`: `"noul"`
- `noul`: `number` (float `0.0` to `1.0`) — The probability that the condition is **true**.

> [!IMPORTANT]
> **Understanding Noul Probability:**
> - `1.0` = Definite YES (e.g. `0.96` means 96% probability it is a bug).
> - `0.0` = Definite NO (e.g. `0.02` means 2% probability it is a bug).
> - `0.5` = **Maximum Ambiguity / Uncertainty** (equal chance of yes or no). A score of `0.5` does **NOT** mean "medium severity bug"; it means the model cannot distinguish between true and false based on the provided context!

```json
{
  "type": "noul",
  "noul": 0.96
}
```

---

### 3. `score` — Ordered Discrete Scale Ranking

#### Concept
Places the state onto an ordered scale of severity, urgency, quality, or sentiment.

#### Request Definition
- `type`: `"score"`
- `instructions`: Question prompt (`string | object | any[]`).
- `criteria`: An ordered array of descriptions (`(string | object | any[])[]`), indexed from `0` to `N-1`. Minimum 1 item.

```json
{
  "urgency": {
    "type": "score",
    "instructions": "How urgent is this ticket?",
    "criteria": [
      "Can wait for the next release",
      "Should be fixed this week",
      "Blocking revenue right now"
    ]
  }
}
```

#### Response Structure
- `type`: `"score"`
- `score`: `number` (continuous float from `0.0` to `N-1`) — The probability-weighted continuous position on the scale. For example, if criterion 0 is low and criterion 2 is critical, a score of `1.99` indicates it sits almost entirely on index `2` ("Blocking revenue right now").
- `confidence`: `number` (float `0.0` to `1.0`) — How decisively the mass falls around the winning score.
- `probabilities`: `Record<string, number>` — Probabilities mapped by string indices `"0"`, `"1"`, `"2"`, etc.
- `legend`: `Record<string, string | object | any[]>` — Echoes back the scale index definitions.

```json
{
  "type": "score",
  "score": 1.99,
  "confidence": 0.99,
  "probabilities": {
    "0": 0.00,
    "1": 0.01,
    "2": 0.99
  },
  "legend": {
    "0": "Can wait for the next release",
    "1": "Should be fixed this week",
    "2": "Blocking revenue right now"
  }
}
```

---

## 📡 API Reference & Schema Specification

### 1. HTTP Endpoint & Headers

- **Method:** `POST`
- **URL:** `https://openrouter.ai/api/alpha/decisions`
- **Headers:**
  - `Authorization`: `Bearer <OPENROUTER_API_KEY>` (Required)
  - `Content-Type`: `application/json` (Required)
  - `HTTP-Referer`: `<SITE_URL>` (Optional, identifies caller for rankings)
  - `X-Title`: `<SITE_TITLE>` (Optional, shows your application name in OpenRouter logs)
  - `x-session-id`: `<SESSION_ID>` (Optional fallback for session tracking)

---

### 2. Request Body Specification

```typescript
interface DecisionRequest {
  /** Model identifier: pinned 'typesafe/jev-1.13' or alias '~typesafe/jev-latest' */
  model: 'typesafe/jev-1.13' | '~typesafe/jev-latest' | string;

  /**
   * The content to evaluate: a plain string, or a JSON object or array of related context.
   * Maximum context length is 32,000 tokens.
   */
  state: string | Record<string, any> | any[];

  /**
   * Map of independent questions evaluated in parallel.
   * All questions evaluate the same `state` simultaneously and cannot see each other's answers.
   */
  questions: Record<string, QuestionDefinition>;

  /** Optional provider preferences */
  provider?: {
    allow_fallbacks?: boolean;
    [key: string]: any;
  } | null;

  /**
   * Unique identifier for grouping related requests in logs and observability.
   * Maximum length: 256 characters.
   */
  session_id?: string;

  /** Observability & tracing metadata */
  trace?: {
    trace_id?: string;
    trace_name?: string;
    span_name?: string;
    generation_name?: string;
    parent_span_id?: string;
    [customKey: string]: any;
  };

  /** End-user identifier for rate-limiting and tracking (max 256 characters) */
  user?: string;
}

type QuestionDefinition = ChoiceQuestion | NoulQuestion | ScoreQuestion;

interface ChoiceQuestion {
  type: 'choice';
  instructions: string | Record<string, any> | any[];
  criteria: Record<string, string | Record<string, any> | any[] | null>;
}

interface NoulQuestion {
  type: 'noul';
  instructions: string | Record<string, any> | any[];
  criteria: {
    true: string | Record<string, any> | any[];
    false: string | Record<string, any> | any[];
  };
}

interface ScoreQuestion {
  type: 'score';
  instructions: string | Record<string, any> | any[];
  criteria: Array<string | Record<string, any> | any[]>; // Minimum 1 item
}
```

---

### 3. Response Body Specification

```typescript
interface DecisionResponse {
  /** Unique decision generation ID (e.g., 'gen-dec-1789738314-X5e5eKGQdvR9rblyX250') */
  id: string;

  /** Dated model snapshot (e.g., 'typesafe/jev-1.13-20260917') */
  model: string;

  /** Provider name ('TypeSafe') */
  provider: string;

  /** Map of typed answers corresponding to the requested questions keys */
  answers: Record<string, ChoiceAnswer | NoulAnswer | ScoreAnswer>;

  /** Token usage and cost */
  usage: {
    input_tokens: number;
    output_tokens: number; // Always free / zero in billing
    cost: number;          // Exact USD cost of the decision call (e.g., 0.000019992)
  };
}

interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface NoulAnswer {
  type: 'noul';
  noul: number; // Probability between 0.0 and 1.0
}

interface ScoreAnswer {
  type: 'score';
  score: number;      // Weighted continuous float between 0 and N-1
  confidence: number;
  probabilities: Record<string, number>;
  legend: Record<string, string | Record<string, any> | any[]>;
}
```

---

### 4. HTTP Status Codes & Error Handling

| Status Code | Error Message / Condition | Meaning & Recommended Handling |
| :---: | :--- | :--- |
| **`200 OK`** | Successful execution | Parse `response.answers` and branch code. |
| **`400 Bad Request`** | `"Invalid request parameters"` | Malformed schema: check question types, missing criteria keys, or missing state. |
| **`401 Unauthorized`** | `"Missing Authentication header"` | Invalid or missing OpenRouter API key. |
| **`402 Payment Required`**| `"Insufficient credits. Add more using https://openrouter.ai/credits"` | OpenRouter credit balance is zero or exhausted. |
| **`403 Forbidden`** | `"Only management keys can perform this operation"` | API key permission mismatch. |
| **`404 Not Found`** | `"Resource not found"` | Endpoint path typo or nonexistent model identifier. |
| **`413 Payload Too Large`**| `"Request payload too large"` | Input context exceeded the 32,000 token window. |
| **`429 Too Many Requests`**| `"Rate limit exceeded"` | Back off with exponential jitter. |
| **`500 Internal Error`** | `"Internal Server Error"` | OpenRouter router issue. |
| **`502 Bad Gateway`** | `"Provider returned error"` | Upstream TypeSafe cluster error. Retry with backoff. |
| **`503 Unavailable`** | `"Service temporarily unavailable"` | Provider temporarily undergoing maintenance. |
| **`524 Timeout`** | `"Request timed out. Please try again later."` | Upstream evaluation timed out. |
| **`529 Overloaded`** | `"Provider returned error"` | TypeSafe engine overloaded. Retry with exponential backoff. |

---

## 💻 Code Calling Examples

### 1. Plain cURL

```bash
curl https://openrouter.ai/api/alpha/decisions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "typesafe/jev-1.13",
    "state": {
      "customer_tier": "enterprise",
      "ticket": "My checkout page shows a blank screen after I click Pay. I have tried two browsers."
    },
    "questions": {
      "is_bug": {
        "type": "noul",
        "instructions": "Is the customer reporting a software defect?",
        "criteria": {
          "true": "The customer describes broken or unexpected product behavior.",
          "false": "The customer is asking a question or requesting a feature."
        }
      },
      "team": {
        "type": "choice",
        "instructions": "Which team should own this ticket?",
        "criteria": {
          "payments": "Checkout, billing, or payment processing issues.",
          "frontend": "Rendering, layout, or browser compatibility issues.",
          "account": "Login, permissions, or profile issues."
        }
      },
      "urgency": {
        "type": "score",
        "instructions": "How urgent is this ticket?",
        "criteria": [
          "Can wait for the next release",
          "Should be fixed this week",
          "Blocking revenue right now"
        ]
      }
    }
  }'
```

### 2. TypeScript / Node.js (Fetch)

```typescript
const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://myapp.com',
    'X-Title': 'MyApp Automation',
  },
  body: JSON.stringify({
    model: 'typesafe/jev-1.13',
    state: {
      customer_tier: 'enterprise',
      ticket: 'My checkout page shows a blank screen after I click Pay.',
    },
    questions: {
      is_bug: {
        type: 'noul',
        instructions: 'Is the customer reporting a software defect?',
        criteria: {
          true: 'Customer describes broken behavior.',
          false: 'Customer asks a question or feature request.',
        },
      },
      team: {
        type: 'choice',
        instructions: 'Which team should own this ticket?',
        criteria: {
          payments: 'Checkout or billing.',
          frontend: 'Layout or rendering.',
          account: 'Login or auth.',
        },
      },
    },
  }),
});

const result = await response.json();
console.log('Jev Decisions:', result.answers);
console.log('Cost (USD):', result.usage.cost);
```

### 3. Upstream TypeSafe SDK (@typesafe-ai/sdk) via OpenRouter

```typescript
import { TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api', // OpenRouter routes this to /api/v1/systemone
});
```

---

## 🚀 High-Impact Workflow Architectural Patterns

### Pattern 1: Gate Agent Tool Calls (Autonomous Safety Guardrail)

```
[Agent Emits Tool Call] ──► [Jev Evaluates: Safe / Unsupported / Risky]
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
        High Conf: Safe         High Conf: Unsafe         Low Conf: Ambiguous
                 │                      │                      │
        [Execute Tool Direct]     [Reject Tool Call]     [Pause for Human (HITL)]
```

- **Problem:** AI Agents executing SQL queries, refunds, or deleting records can hallucinate dangerous parameters.
- **Jev Solution:**
  - `state`: `{ user_request: "...", tool_name: "issue_refund", args: { amount: 5000 } }`
  - `questions`:
    - `is_authorized`: `noul` (Does the user request explicitly ask for this exact refund?)
    - `risk_level`: `score` (0: Safe query, 1: Moderate edit, 2: Destructive action)
  - **Branching Logic:**
    - If `is_authorized.noul > 0.9` AND `risk_level.score < 1`: Execute automatically.
    - If `is_authorized.noul < 0.3`: Reject immediately with error.
    - Otherwise: Pause workflow and send interactive approval slack/email to a human operator.

---

### Pattern 2: 80% Cost Reduction via LLM Verification Cascades

```
[User Query + RAG Docs] ──► [Fast & Cheap LLM: Gemini Flash / GPT-4o-mini]
                                        │
                                 [Draft Response]
                                        │
                                        ▼
                             [Jev Verifies: Faithful?]
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              [Yes: Noul >= 0.85]             [No: Noul < 0.85]
                         │                             │
              [Return Cheap Answer]          [Escalate to Claude 3.7 / O3]
```

- **Problem:** Reasoning models (Claude 3.7 Sonnet, OpenAI o3, GPT-4o) are expensive and slow. Cheap models (Gemini Flash, Haiku) are fast but occasionally hallucinate facts.
- **Jev Solution:**
  1. Generate draft answer with ultra-cheap model ($0.05 / 1M tokens).
  2. Send `{ retrieved_context: [...], draft_answer: "..." }` to Jev.
  3. Question `is_faithful`:
     - `criteria.true`: "All claims in the draft answer are directly supported by the retrieved context."
     - `criteria.false`: "The draft answer contains hallucinations, unsupported claims, or contradicts the context."
  4. If `is_faithful.noul >= 0.85`: Return immediately! Total cost is pennies.
  5. If `is_faithful.noul < 0.85`: Escalate to the expensive flagship model.

---

### Pattern 3: Omnichannel Ticket Triage & Routing

Evaluate three questions simultaneously in parallel:
- `is_bug` (`noul`): True/False.
- `department` (`choice`): Payments vs Frontend vs Mobile vs Operations.
- `urgency` (`score`): Can wait vs Next sprint vs Revenue blocking.

All 3 answers arrive in a single HTTP response under 150ms, with zero JSON extraction errors.

---

## 📐 Threshold Engineering & Decision Science

A critical distinction when working with Jev is how to treat numbers:

### 1. Confidence vs. Probability
- **Probability (`probabilities[key]` or `noul`):** The likelihood of a specific hypothesis being true given the evidence.
- **Confidence (`confidence`):** How peaked/concentrated the distribution is. For instance, if an answer has options A, B, C and probabilities are `0.34, 0.33, 0.33`, the winning option has probability `0.34`, but confidence is `~0.01` (pure guess). If probabilities are `0.90, 0.05, 0.05`, confidence is high (`~0.85+`).

### 2. Never Use Arbitrary Round Numbers
Do not write `if (confidence > 0.8)` just because 0.8 sounds good. Always evaluate the **asymmetric cost of errors**:
- In **Spam Filtering**: A False Positive (classifying a real customer invoice as spam) is catastrophic. A False Negative (letting a spam email in) is mildly annoying. **Threshold should be set high (`noul > 0.95`)**.
- In **Fraud / Malware Detection**: A False Negative (letting a hacker execute) is fatal. A False Positive (asking a legitimate user for 2FA) is minor. **Threshold should be set low (`noul > 0.30`) to flag for review**.

---

## 🛠️ Integration Blueprint for n8n Community Node

When building the Jev node into `n8n-nodes-openrouter-official`:

1. **Isolation & Safety:**
   - Must be implemented as an independent node file `nodes/Jev/Jev.node.ts` with its own SVG icon `nodes/Jev/jev.svg`.
   - Shared authentication: Reuses existing `openRouterCommunityApi` credentials without modification.
   - Zero impact on `OpenRouter`, `EmbeddingsOpenRouter`, `RerankerOpenRouter`, or `OpenRouterCacheChatModel`.

2. **User Experience (UX):**
   - **Mode Selection:**
     - **Visual Question Builder (Fixed UI):** Add questions dynamically via UI collection (choose between Choice, Noul, Score) with dedicated inputs for Instructions and Criteria.
     - **JSON Schema Mode:** For power users who want to pass dynamic questions from upstream JSON or code.
   - **State Input:**
     - Support string, JSON object, or incoming item data (`$json`).
   - **Output Format Options:**
     - **Clean / Simplified:** Flattens `answers` directly to root output properties for instant use in `If` / `Switch` nodes.
     - **Raw Decisions API:** Returns full payload including `usage.cost`, `id`, `confidence`, and `probabilities`.
     - **Threshold Branching (Optional):** Built-in helper to categorize into Pass / Review / Reject.

---

*Document compiled and verified against official TypeSafe & OpenRouter specifications (September 2026).*
