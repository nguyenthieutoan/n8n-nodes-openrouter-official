# n8n-nodes-openrouter-official

The **Ultimate OpenRouter Toolkit for n8n**. This comprehensive suite solves the most critical shortcomings in n8n's native AI capabilities, bringing unprecedented flexibility, multimodal power, vector embeddings, advanced RAG reranking, prompt caching, and System One structured decision-making to your workflows.

Developed and maintained by **[Jay Nguyen (Nguyễn Thiệu Toàn)](https://nguyenthieutoan.com)**.

🛡️ **[Verified n8n Creator](https://n8n.io/creators/nguyenthieutoan)** | 💼 CEO/Founder of **[GenStaff](https://genstaff.net)**

**Connect with me:**  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/nguyenthieutoan) [![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=flat&logo=facebook&logoColor=white)](https://www.facebook.com/nguyenthieutoan) [![Website](https://img.shields.io/badge/Website-nguyenthieutoan.com-brightgreen?style=flat)](https://nguyenthieutoan.com) [![Email](https://img.shields.io/badge/Email-me%40nguyenthieutoan.com-blue?style=flat)](mailto:me@nguyenthieutoan.com)

---

## 🌟 Why is this package a game-changer for n8n?

While n8n provides a solid foundation for AI Agent workflows, it has historical limitations when it comes to model variety, embedding flexibility, RAG document reranking, prompt caching costs, and deterministic decision-making. **This package fixes all of that.**

By integrating OpenRouter deeply into n8n's standard operations and Advanced AI (LangChain) engine, you unlock **five specialized, enterprise-grade nodes** covering every AI workflow need:

### 1. The Core `OpenRouter` Node (Multimodal Action Node)
n8n natively requires you to set up separate credentials, billing, and nodes for OpenAI, Anthropic, Google, etc. Furthermore, handling multimodal inputs (like PDFs, audio, video) can be notoriously clunky.
* **The Solution:** A unified node that connects to **hundreds of models** via a single API key.
* **Unmatched Multimodal Power:** We've designed this node to easily analyze ANY content—from plain text to complex documents (PDFs), images, audio, and video (provided the selected model, like Gemini or Claude, supports it). Seamlessly supports processing all incoming binary files at once (**Include All Binaries**), comma-separated binary properties, or comma-separated lists of **Image URLs** with automatic bracket/quote/whitespace sanitization. 
* **Beyond Text:** Support for Image Generation, Video Generation, and Audio processing workflows all within one unified interface.

### 2. `EmbeddingsOpenRouter` Node (Vector Embeddings)
n8n's native embedding options are highly restricted (mostly defaulting to OpenAI or a few others).
* **The Solution:** A massive step forward for RAG setups. This node allows you to use OpenRouter's vast ecosystem to generate vector embeddings. It gives you the freedom to choose the most cost-effective or domain-specific embedding models available on OpenRouter without being locked into OpenAI's ecosystem.

### 3. `RerankerOpenRouter` Node (Document Compressor)
Retrieval alone often yields irrelevant context, leading to hallucinations. Native n8n severely lacks accessible, high-quality Rerankers (often forcing you to use Cohere).
* **The Solution:** This node brings OpenRouter into the `Document Compressor` layer of n8n. You can now use any advanced reasoning LLM on OpenRouter to **rerank, score, and compress** your retrieved documents before they reach your final Agent. This drastically increases RAG accuracy and reduces token costs for the final generation step.

### 4. `OpenRouterCacheChatModel` Node (LangChain AI Language Model with Prompt Caching)
Repeatedly sending large system prompts, extensive documentation, or few-shot examples to generative LLMs in n8n AI Agents leads to unnecessary token costs and slow response times.
* **The Solution:** A high-performance Chat Model node for n8n AI Agents and chains featuring **automatic Prompt Caching injection** (`cache_control: { type: "ephemeral" }`).
* **Smart Breakpoints:** Intelligently tags system messages and previous user conversation turns to trigger cache hits on supported OpenRouter providers (Anthropic, DeepSeek, Google, etc.).
* **Cost & Latency Optimization:** Slashes recurring prompt token costs by up to 90% and dramatically cuts Time-to-First-Token (TTFT) for complex agentic workflows.

### 5. `OpenRouter Decisions (System One)` Node
Traditional LLMs are often misused for narrow software decisions (like classification, gatekeeping, or triage), introducing high latency, hallucinations, and fragile JSON parsing.
* **The Solution:** A dedicated decision node interfacing with OpenRouter's native Decisions router (`/api/alpha/decisions`) and TypeSafe's **System One** model family (such as `typesafe/jev-1.13`).
* **Deterministic & Typed:** Jev does not output free-form text or reasoning traces. It evaluates application state against typed questions and returns mathematical probabilities and confidence scores.
* **Zero Output Token Cost:** You only pay for input tokens; output decision tokens are **100% FREE**.
* **Three Mathematical Primitives:**
  - **`Choice`**: Picks one discrete option from mutually exclusive alternatives with calibrated confidence.
  - **`Noul`**: Evaluates whether a boolean condition holds true (probability 0.0 to 1.0; 0.5 represents maximum ambiguity).
  - **`Score`**: Places input onto an ordered continuous scale (probability-weighted position from 0 to N-1).
* **Game-Changing Patterns:**
  - **Gate Agent Tool Calls:** Safeguard autonomous agents by validating tool parameters before execution.
  - **LLM Verification Cascades:** Draft with cheap models, verify faithfulness with Jev, and escalate to expensive models only on failure (cutting costs by 80%+).
  - **Support & Lead Triage:** Evaluate department, bug status, and urgency in a single parallel request under 150ms.

---

## 🚀 Installation

Go to **Settings > Community Nodes** in your n8n instance and install:

```bash
n8n-nodes-openrouter-official
```

## ⚙️ Credentials Configuration

1. Get your API Key from the [OpenRouter Console](https://openrouter.ai/keys).
2. In n8n, set up a new **OpenRouter API** credential:
   * **API Key**: Enter your OpenRouter API key.
   * **Site URL (Optional)**: Your application's URL for OpenRouter rankings.
   * **Site Name (Optional)**: Your application's name.

*(Bonus: You can use the built-in **Test Connection** button in n8n to instantly verify your API key!)*

## 📚 Included Nodes

| Node | Type | Description |
|------|------|-------------|
| **OpenRouter** | Standard Action Node | Unified gateway to process text, analyze multimodal documents/PDFs/media, and generate images/video. |
| **OpenRouter Decisions (System One)** | Standard Action Node | Fast, typed, probabilistic decision-making (Choice, Noul, Score) using TypeSafe Jev on OpenRouter. |
| **OpenRouter Embeddings** | Advanced AI (LangChain) | Generate vector embeddings using any supported OpenRouter model for your Vector Stores. |
| **OpenRouter Reranker** | Advanced AI (LangChain) | Rerank and compress documents dynamically in RAG workflows to boost context accuracy. |
| **OpenRouter Cache Chat Model** | Advanced AI (LangChain) | Chat model with prompt caching support to cut token costs and reduce latency. |

## License

[MIT](LICENSE)

