import { OpenRouterRerankerAdapter } from '../nodes/OpenRouterReranker/OpenRouterRerankerCompressor';
import { Document } from '@langchain/core/documents';

global.fetch = jest.fn();

describe('OpenRouterRerankerAdapter', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should compress and rank documents successfully (Happy Path)', async () => {
		const mockResponse = {
			results: [
				{ index: 1, relevance_score: 0.9 },
				{ index: 0, relevance_score: 0.1 },
			],
		};

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		});

		const adapter = new OpenRouterRerankerAdapter('mock-key', 'mock-model', 'https://mock.com', 'Mock App');
		const docs = [
			new Document({ pageContent: 'bad doc', metadata: { source: 'bad' } }),
			new Document({ pageContent: 'good doc', metadata: { source: 'good' } }),
		];

		const result = await adapter.compressDocuments(docs, 'find good doc');

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(result).toHaveLength(2);
		expect(result[0].pageContent).toBe('good doc');
		expect(result[0].metadata.relevanceScore).toBe(0.9);
		expect(result[1].pageContent).toBe('bad doc');
		expect(result[1].metadata.relevanceScore).toBe(0.1);
	});

	it('should handle API errors and throw (Failed API)', async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => 'Internal Server Error',
		});

		const adapter = new OpenRouterRerankerAdapter('mock-key', 'mock-model', 'https://mock.com', 'Mock App');
		const docs = [new Document({ pageContent: 'test' })];

		await expect(adapter.compressDocuments(docs, 'query')).rejects.toThrow(
			'OpenRouter API Error: 500 - Internal Server Error'
		);
	});

	it('should handle empty search result (Empty Search)', async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({ results: [] }),
		});

		const adapter = new OpenRouterRerankerAdapter('mock-key', 'mock-model', 'https://mock.com', 'Mock App');
		const result = await adapter.compressDocuments([], 'query');
		expect(result).toEqual([]);
	});
});
