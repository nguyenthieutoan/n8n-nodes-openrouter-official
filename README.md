# n8n-nodes-openrouter-official

The **Ultimate OpenRouter Toolkit for n8n**. This package solves some of the most critical shortcomings in n8n's native AI capabilities, bringing unprecedented flexibility, power, and cost-efficiency to your workflows.

Developed and maintained by **[Jay Nguyen (Nguyễn Thiệu Toàn)](https://nguyenthieutoan.com)**.

🛡️ **[Verified n8n Creator](https://n8n.io/creators/nguyenthieutoan)** | 💼 CEO/Founder of **[GenStaff](https://genstaff.net)**

**Connect with me:**  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/nguyenthieutoan) [![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=flat&logo=facebook&logoColor=white)](https://www.facebook.com/nguyenthieutoan) [![Website](https://img.shields.io/badge/Website-nguyenthieutoan.com-brightgreen?style=flat)](https://nguyenthieutoan.com) [![Email](https://img.shields.io/badge/Email-me%40nguyenthieutoan.com-blue?style=flat)](mailto:me@nguyenthieutoan.com)

---

## 🌟 Why is this package a game-changer for n8n?

While n8n provides a solid foundation for AI Agent workflows, it has historical limitations when it comes to model variety, embedding flexibility, and advanced RAG (Retrieval-Augmented Generation) strategies like Reranking. **This package fixes all of that.**

By integrating OpenRouter deeply into n8n's standard operations and Advanced AI (LangChain) engine, you unlock three extremely powerful nodes:

### 1. The Core `OpenRouter` Node
n8n natively requires you to set up separate credentials, billing, and nodes for OpenAI, Anthropic, Google, etc. Furthermore, handling multimodal inputs (like PDFs, audio, video) can be notoriously clunky.
* **The Solution:** A unified node that connects to **hundreds of models** via a single API key.
* **Unmatched Multimodal Power:** We've designed this node to easily analyze ANY content—from plain text to complex documents (PDFs), images, audio, and video (provided the selected model, like Gemini or Claude, supports it). 
* **Beyond Text:** Support for Image Generation, Video Generation, and Audio processing workflows all within one unified interface.

### 2. `EmbeddingsOpenRouter` Node
n8n's native embedding options are highly restricted (mostly defaulting to OpenAI or a few others).
* **The Solution:** A massive step forward for RAG setups. This node allows you to use OpenRouter's vast ecosystem to generate vector embeddings. It gives you the freedom to choose the most cost-effective or domain-specific embedding models available on OpenRouter without being locked into OpenAI's ecosystem.

### 3. `RerankerOpenRouter` Node (Document Compressor)
Retrieval alone often yields irrelevant context, leading to hallucinations. Native n8n severely lacks accessible, high-quality Rerankers (often forcing you to use Cohere).
* **The Solution:** This node brings OpenRouter into the `Document Compressor` layer of n8n. You can now use any advanced reasoning LLM on OpenRouter to **rerank, score, and compress** your retrieved documents before they reach your final Agent. This drastically increases RAG accuracy and reduces token costs for the final generation step.

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
| **OpenRouter** | Standard Action Node | unified gateway to process text, analyze multimodal documents/PDFs/media, and generate images/video. |
| **OpenRouter Embeddings** | Advanced AI (LangChain) | Generate vector embeddings using any supported OpenRouter model for your Vector Stores. |
| **OpenRouter Reranker** | Advanced AI (LangChain) | Rerank and compress documents dynamically in RAG workflows to boost context accuracy. |

## License

[MIT](LICENSE)
