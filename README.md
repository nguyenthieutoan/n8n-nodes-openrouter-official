# n8n-nodes-openrouter-official

Developed and maintained by **[Jay Nguyen (Nguyễn Thiệu Toàn)](https://nguyenthieutoan.com)**.

🛡️ **[Verified n8n Creator](https://n8n.io/creators/nguyenthieutoan)** | 💼 CEO/Founder of **[GenStaff](https://genstaff.net)**

**Connect with me:**  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/nguyenthieutoan) [![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=flat&logo=facebook&logoColor=white)](https://www.facebook.com/nguyenthieutoan) [![Website](https://img.shields.io/badge/Website-nguyenthieutoan.com-brightgreen?style=flat)](https://nguyenthieutoan.com) [![Email](https://img.shields.io/badge/Email-me%40nguyenthieutoan.com-blue?style=flat)](mailto:me@nguyenthieutoan.com)

---

This is the official community node for OpenRouter in n8n. It allows you to consume OpenRouter's API seamlessly, providing access to a wide array of LLMs, embedding models, and rerankers.

## Features

* **Advanced Chat Models (AI Agent)**: Use any of the hundreds of OpenRouter models within your n8n AI Agent workflows.
* **Embeddings**: Generate vector embeddings for RAG and semantic search directly via OpenRouter.
* **Reranking**: Reorder and compress retrieved documents using OpenRouter's reranker models.
* **Direct API Node**: Call OpenRouter operations (analyze media, text-to-image, etc.) via the standard n8n node interface.

## Installation

Go to **Settings > Community Nodes** in your n8n instance and install:

```bash
n8n-nodes-openrouter-official
```

## Credentials Configuration

1. Get your API Key from the [OpenRouter Console](https://openrouter.ai/keys).
2. In n8n, set up a new **OpenRouter API** credential:
   * **API Key**: Enter your OpenRouter API key.
   * **Site URL (Optional)**: Your application's URL for OpenRouter rankings.
   * **Site Name (Optional)**: Your application's name.

## License

[MIT](LICENSE)
