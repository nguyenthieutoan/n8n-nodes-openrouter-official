import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';
import { Document } from '@langchain/core/documents';

export class OpenRouterRerankerAdapter extends BaseDocumentCompressor {
	constructor(
		private apiKey: string,
		private model: string,
		private siteUrl: string,
		private appName: string,
	) {
		super();
	}

	async compressDocuments(documents: Document[], query: string): Promise<Document[]> {
		const response = await fetch('https://openrouter.ai/api/v1/rerank', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': this.siteUrl,
				'X-Title': this.appName,
			},
			body: JSON.stringify({
				model: this.model,
				query,
				documents: documents.map((doc) => doc.pageContent),
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenRouter API Error: ${response.status} - ${error}`);
		}

		const result = await response.json();
		const rankedDocs: Document[] = [];

		for (const item of result.results || result.data || []) {
			const originalDoc = documents[item.index];
			rankedDocs.push(
				new Document({
					pageContent: originalDoc.pageContent,
					metadata: {
						...originalDoc.metadata,
						relevanceScore: item.relevance_score,
					},
				}),
			);
		}
		return rankedDocs;
	}
}
