# OpenRouter Models API — Output Modalities Reference

## Overview

OpenRouter provides a query parameter `output_modalities` on the models discovery endpoint:
```http
GET https://openrouter.ai/api/v1/models?output_modalities=[value]
```

This endpoint filters models according to their primary output capability, ensuring n8n nodes only fetch and display models that are compatible with their specific execution context.

---

## Valid Values

| Value | Category | Description | Primary Node Usage |
| :--- | :--- | :--- | :--- |
| `text` | Generative LLM | Standard chat and completion models generating text | `OpenRouterCacheChatModel`, `OpenRouter` (`message`, `analyze`) |
| `image` | Text-to-Image | Models generating images (e.g., FLUX, Recraft, SDXL, GPT Image) | `OpenRouter` (`generateImage`) |
| `video` | Text/Image-to-Video | Video generation models (e.g., Wan 2.1, Veo 2, Kling, Hailuo) | `OpenRouter` (`generateVideo`) |
| `embeddings` | Vector Embeddings | Models returning vector embeddings for similarity / RAG | `EmbeddingsOpenRouter` |
| `rerank` | Document Compressor | Reranking models scoring search relevance in RAG | `RerankerOpenRouter` |
| `decisions` | System One Decisions | Deterministic decision models (Jev, D1, Mercury, Solar Decide) | `OpenRouterDecisions` |
| `speech` | Text-to-Speech | Audio generation / TTS models | `OpenRouter` (`textToSpeech`) |
| `transcription` | Speech-to-Text | Audio transcription / STT models | `OpenRouter` (`speechToText`) |
| `audio` | General Audio | Audio processing models | General audio tasks |
| `all` | Unfiltered | Returns all models across all modalities | Diagnostic / Debugging |

---

## Node Status in `n8n-nodes-openrouter-official`

### 1. `OpenRouterDecisions`
- **Status:** Integrated.
- **Endpoint:** `https://openrouter.ai/api/v1/models?output_modalities=decisions`
- **Purpose:** Fetches only System One decision models (`liquid/d1`, `typesafe/jev-1.13`, `upstage/solar-decide`, etc.).

### 2. `EmbeddingsOpenRouter`
- **Status:** Integrated.
- **Endpoint:** `https://openrouter.ai/api/v1/models?output_modalities=embeddings`
- **Purpose:** Fetches vector embedding models compatible with LangChain Vector Store.

### 3. `RerankerOpenRouter`
- **Status:** Integrated.
- **Endpoint:** `https://openrouter.ai/api/v1/models?output_modalities=rerank`
- **Purpose:** Fetches document compression / reranking models for RAG workflows.

### 4. `OpenRouterCacheChatModel`
- **Status:** Integrated.
- **Endpoint:** `/models?output_modalities=text`
- **Purpose:** Restricts dropdown strictly to text chat models (464+ models), preventing errors when attached to LangChain AI Agents.

### 5. `OpenRouter` Main Action Node
- **Status:** Integrated.
- **Endpoint:** Queries dynamic `?output_modalities=` per operation:
  - `message`: `output_modalities=text` (Chat / Generate text)
  - `generateImage`: `output_modalities=image` (FLUX, Recraft, SDXL, GPT Image, etc.)
  - `generateVideo`: `output_modalities=video` (Wan 2.1, Veo 2, Kling, Hailuo, etc.)
  - `textToSpeech`: `output_modalities=speech` (Microsoft MAI, Gemini TTS, etc.)
  - `speechToText`: `output_modalities=transcription` (Gemini Transcribe, AssemblyAI, etc.)
  - `analyze`: `output_modalities=text` filtered for models accepting multimodal inputs (image, video, audio, files).
