# n8n-nodes-openrouter-official

The **Ultimate OpenRouter Toolkit for n8n**. This comprehensive suite solves the most critical shortcomings in n8n's native AI capabilities, bringing unprecedented flexibility, multimodal power, vector embeddings, advanced RAG reranking, prompt caching, and System One structured decision-making to your workflows.

Developed and maintained by **[Jay Nguyen (Nguyễn Thiệu Toàn)](https://nguyenthieutoan.com)**.

🛡️ **[Verified n8n Creator](https://n8n.io/creators/nguyenthieutoan)** | 💼 CEO/Founder of **[GenStaff](https://genstaff.net)**

**Connect with me:**  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/nguyenthieutoan) [![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=flat&logo=facebook&logoColor=white)](https://www.facebook.com/nguyenthieutoan) [![Website](https://img.shields.io/badge/Website-nguyenthieutoan.com-brightgreen?style=flat)](https://nguyenthieutoan.com) [![Email](https://img.shields.io/badge/Email-me%40nguyenthieutoan.com-blue?style=flat)](mailto:me@nguyenthieutoan.com)

---

## 🌟 Why is this package a game-changer for n8n?

While n8n provides a solid foundation for AI Agent workflows, it has historical limitations when it comes to model variety, embedding flexibility, RAG document reranking, prompt caching costs, and deterministic decision-making. **This package fixes all of that.**

By integrating OpenRouter deeply into n8n's standard operations and Advanced AI (LangChain) engine, you unlock **eight specialized, enterprise-grade nodes** covering every AI workflow need:

### 1. The Core `OpenRouter` Node (Chat & Multimodal Analysis)
n8n natively requires you to set up separate credentials, billing, and nodes for OpenAI, Anthropic, Google, etc. Furthermore, handling multimodal inputs (like PDFs, audio, video) can be notoriously clunky.
* **The Solution:** A unified node that connects to **hundreds of models** via a single API key for both text generation and multimodal content analysis.
* **Unmatched Multimodal Power:** Easily analyze ANY content—from plain text to complex documents (PDFs), images, audio, and video (provided the selected model, like Gemini or Claude, supports it). Seamlessly supports processing all incoming binary files at once (**Include All Binaries**), comma-separated binary properties, or comma-separated lists of **Image URLs** with automatic bracket/quote/whitespace sanitization.
* **Fine-Tuned Generation:** Full control over generation options including `Temperature`, `Max Tokens`, and `Top P`.

### 2. `EmbeddingsOpenRouter` Node (Vector Embeddings)
n8n's native embedding options are highly restricted (mostly defaulting to OpenAI or a few others).
* **The Solution:** A massive step forward for RAG setups. This node allows you to use OpenRouter's vast ecosystem to generate vector embeddings. It gives you the freedom to choose the most cost-effective or domain-specific embedding models available on OpenRouter without being locked into OpenAI's ecosystem.

### 3. `RerankerOpenRouter` Node (Document Compressor)
Retrieval alone often yields irrelevant context, leading to hallucinations. Native n8n severely lacks accessible, high-quality Rerankers (often forcing you to use Cohere).
* **The Solution:** This node brings OpenRouter into the `Document Compressor` layer of n8n. You can now use any advanced reasoning LLM on OpenRouter to **rerank, score, and compress** your retrieved documents before they reach your final Agent. This drastically increases RAG accuracy and reduces token costs for the final generation step.

### 4. `OpenRouterCacheChatModel` Node (LangChain AI Language Model with Prompt Caching & Provider Pinning)
Repeatedly sending large system prompts, extensive documentation, or few-shot examples to generative LLMs in n8n AI Agents leads to unnecessary token costs and slow response times. Furthermore, OpenRouter often routes requests across different backend providers (e.g., Google AI Studio vs. Google Vertex), which have different prices and service tiers.
* **The Solution:** A high-performance Chat Model node for n8n AI Agents and chains featuring **automatic Prompt Caching injection** (`cache_control: { type: "ephemeral" }`) and **advanced Provider Routing & Pinning**.
* **Smart Breakpoints:** Intelligently tags system messages and previous user conversation turns to trigger cache hits on supported OpenRouter providers (Anthropic, DeepSeek, Google, etc.).
* **Provider Routing & Pinning:**
  - **Dynamic Endpoint Selector:** Select specific provider endpoints directly from a dynamic dropdown (e.g., `Google AI Studio (Flex)` [0.15$/M prompt], `Google Vertex (Global)`, etc.) complete with real-time pricing per 1M tokens.
  - **Strict Pinning (`Allow Fallbacks: false`):** Lock down inference exclusively to your chosen provider/endpoint. If the provider runs out of quota or experiences rate limits, the request fails immediately rather than silently falling back to a more expensive tier or different provider.
  - **Service Tier Support:** Directly select `Flex` tier for substantial cost savings or `Priority` tier for reduced latency.
  - **Custom Provider Routing:** Configure `Custom Providers (Only)`, `Custom Provider Order`, `Ignore Providers`, dynamic sorting (`Price`, `Throughput`, `Latency`), and zero-data-retention policy compliance (`Data Collection: Deny`).
* **Cost & Latency Optimization:** Slashes recurring prompt token costs by up to 90% and dramatically cuts Time-to-First-Token (TTFT) for complex agentic workflows.

### 5. `OpenRouter Decisions (System One)` Node
Traditional LLMs are often misused for narrow software decisions (like classification, gatekeeping, or triage), introducing high latency, hallucinations, and fragile JSON parsing.
* **The Solution:** A dedicated decision node interfacing with OpenRouter's native Decisions router (`/api/alpha/decisions`) and live System One decision models (LiquidAI `liquid/d1`, Together `togethercomputer/tev1-4b-experimental`, Inception `inception/mercury-decide:free`, Upstage `upstage/solar-decide`, Respan `respan/span-01`, TypeSafe `typesafe/jev-1.13`, etc.) discovered dynamically via `https://openrouter.ai/api/v1/models?output_modalities=decisions`.
* **Deterministic & Typed:** System One models do not output free-form text or reasoning traces. They evaluate application state against typed questions and return mathematical probabilities and confidence scores.
* **Zero Output Token Cost:** You only pay for input tokens; output decision tokens are **100% FREE**.
* **Three Mathematical Primitives:**
  - **`Choice`**: Picks one discrete option from mutually exclusive alternatives with calibrated confidence.
  - **`Noul`**: Evaluates whether a boolean condition holds true (probability 0.0 to 1.0; 0.5 represents maximum ambiguity).
  - **`Score`**: Places input onto an ordered continuous scale (probability-weighted position from 0 to N-1).
* **Game-Changing Patterns:**
  - **Gate Agent Tool Calls:** Safeguard autonomous agents by validating tool parameters before execution.
  - **LLM Verification Cascades:** Draft with cheap models, verify faithfulness with Jev/D1, and escalate to expensive models only on failure (cutting costs by 80%+).
  - **Support & Lead Triage:** Evaluate department, bug status, and urgency in a single parallel request under 150ms.

### 6. `OpenRouter Image Generation` Node
Traditional image generation nodes often lock you into rigid defaults, failing to expose provider-specific capabilities or image editing workflows.
* **The Solution:** A dedicated image generation node interfacing with OpenRouter's unified Image API (`/api/v1/images`), dynamically discovering all live image models (FLUX, Recraft, SDXL, GPT Image, ByteDance Seedream, etc.).
* **Full Parameter Control:**
  - **Aspect Ratio & Resolution:** Pick from standard aspect ratios (`1:1`, `16:9`, `9:16`, `4:3`, `3:2`, `21:9`, `auto`) and normalized tiers (`512`, `768`, `1K`, `1.5K`, `2K`, `4K`) or explicit pixel dimensions.
  - **Transparent Backgrounds:** Native `background: transparent` support for generating icons, logos, and stickers without backgrounds.
  - **Image-to-Image / Style Reference:** Pass reference images via n8n binary properties or public image URLs to guide style, edit, or transform images.
  - **Format & Compression:** Output as PNG, JPEG, WebP, or SVG with customizable compression levels.
  - **Deterministic Seeds & Multi-image:** Generate multiple variations (`n` up to 10) and pin seeds for reproducibility.

### 7. `OpenRouter Audio Studio` Node
A full-spectrum speech engine interfacing with OpenRouter's Speech (`/api/v1/audio/speech`) and Transcriptions (`/api/v1/audio/transcriptions`) APIs.
* **Text to Speech (TTS):**
  - **Voice Cloning & Design:** Stateless zero-shot voice cloning using reference audio clips (`input_references`) and optional transcripts.
  - **Customizable Output:** Choose format (`mp3`, `wav`, `pcm`), speeds from `0.25` to `4.0`, and custom voice identifiers.
* **Speech to Text (STT / Transcriptions):**
  - **Speaker Diarization:** Identify and tag distinct speakers (`Speaker 1`, `Speaker 2`) in interviews and conference calls.
  - **Word-Level Timestamps:** Generate fine-grained timestamps per word or sentence for automatic video captions and subtitles.
  - **Domain Keyterms:** Provide custom vocabulary, company names, or medical/technical terms to bias speech recognition.
  - **Dual Source:** Accepts incoming binary audio files or direct remote audio URLs.

### 8. `OpenRouter Video Studio` Node
A dedicated generative video studio interfacing with OpenRouter's Video models (Wan, Veo, Kling, Hailuo, Seedance, and more).
* **Text-to-Video & Image-to-Video:** Generate high-definition motion videos from detailed text prompts or guide starting frames with reference images.
* **Fine Parameter Tuning:** Full control over resolution, duration, aspect ratios, camera movement instructions, and audio soundtrack generation.

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
| **OpenRouter** | Standard Action Node | Unified gateway to generate text and analyze multimodal content (PDFs, images, audio, video, documents). |
| **OpenRouter Image Generation** | Standard Action Node | Dedicated image studio with full parameter control (aspect ratio, resolution, transparent backgrounds, seed, image-to-image). |
| **OpenRouter Video Studio** | Standard Action Node | Dedicated video studio supporting text-to-video, image-to-video, camera control, and audio generation. |
| **OpenRouter Audio Studio** | Standard Action Node | Comprehensive audio suite: Text to Speech with Voice Cloning and Speech to Text with Speaker Diarization, Word Timestamps, and Keyterms. |
| **OpenRouter Decisions (System One)** | Standard Action Node | Fast, typed, probabilistic decision-making (Choice, Noul, Score) using live System One models on OpenRouter. |
| **OpenRouter Embeddings** | Advanced AI (LangChain) | Generate vector embeddings using any supported OpenRouter model for your Vector Stores. |
| **OpenRouter Reranker** | Advanced AI (LangChain) | Rerank and compress documents dynamically in RAG workflows to boost context accuracy. |
| **OpenRouter Cache Chat Model** | Advanced AI (LangChain) | Chat model with prompt caching and strict provider routing/pinning (Flex tier, fallback control). |

## 🎯 OpenRouter Decisions (System One) — Rapid Probabilistic Decisions

The **OpenRouter Decisions** node integrates OpenRouter's native Decisions API powered by TypeSafe Jev (System One). Unlike standard LLMs that generate conversational prose or unpredictable markdown JSON blocks, System One models make **instant, typed, and mathematically calibrated decisions** with zero output token latency and **100% free output tokens** (billed only on input tokens).

### 💡 The 3 Decision Types (Primitives):
1. **Yes / No (Boolean - Noul)**: Evaluates whether a condition holds true. Returns a calibrated probability from `0.0` (Definite No) to `1.0` (Definite Yes). A score of `0.5` represents maximum ambiguity (50/50 uncertainty).
2. **Choice (Classification)**: Picks the single best option from predefined categories. Returns the winning key, confidence score, and full probability distribution.
3. **Score (Ordered Scale)**: Places input onto an ordered scale (e.g. Low, Medium, High urgency) and returns a probability-weighted continuous score.

### ⚡ Downstream Workflow Integration:
When **Simplify Output** is enabled (default), decisions are automatically flattened directly to the root for instant conditional branching in n8n:
- **IF Node**: Use `{{ $json.verdict.is_urgent }}` (boolean `true`/`false`) or `{{ $json.decision.is_urgent >= 0.8 }}`.
- **Switch Node**: Use `{{ $json.decision.category }}` to route between teams (e.g. `support`, `billing`, `sales`).
- **Human Review**: When **Flag Ambiguity** is enabled, route edge cases where `{{ $json.isAmbiguous }}` is `true` directly to human operators.

## License

[MIT](LICENSE)


