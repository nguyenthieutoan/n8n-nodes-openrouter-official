import { OpenRouterRerankerAdapter } from '../nodes/RerankerOpenRouter/OpenRouterRerankerCompressor';
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

describe('RerankerOpenRouter Node searchModels', () => {
	it('should dynamically fetch reranker models via searchModels (output_modalities=rerank)', async () => {
		const { RerankerOpenRouter } = require('../nodes/RerankerOpenRouter/RerankerOpenRouter.node');
		const node = new RerankerOpenRouter();

		const mockContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-openrouter-key' }),
			helpers: {
				request: jest.fn().mockResolvedValue({
					data: [
						{
							id: 'voyageai/rerank-3-lite',
							name: 'VoyageAI by MongoDB: rerank-3-lite',
							description: 'High-speed reranker',
							pricing: { prompt: '0', completion: '0' },
						},
						{
							id: 'cohere/rerank-v3.5',
							name: 'Cohere: Rerank v3.5',
							description: 'Cohere foundation reranking model',
							pricing: { prompt: '0', completion: '0' },
						},
					],
				}),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext);
		expect(mockContext.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: 'https://openrouter.ai/api/v1/models?output_modalities=rerank',
				headers: {
					Authorization: 'Bearer mock-openrouter-key',
				},
				json: true,
			}),
		);

		expect(result.results.length).toBe(2);
		expect(result.results[0].value).toBe('voyageai/rerank-3-lite');
		expect(result.results[1].value).toBe('cohere/rerank-v3.5');
	});

	it('should filter rerank models when filter is passed', async () => {
		const { RerankerOpenRouter } = require('../nodes/RerankerOpenRouter/RerankerOpenRouter.node');
		const node = new RerankerOpenRouter();

		const mockContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-openrouter-key' }),
			helpers: {
				request: jest.fn().mockResolvedValue({
					data: [
						{ id: 'voyageai/rerank-3-lite', name: 'VoyageAI: rerank-3-lite' },
						{ id: 'qwen/qwen3-reranker-8b', name: 'Qwen3 Reranker 8B' },
					],
				}),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext, 'qwen');
		expect(result.results.length).toBe(1);
		expect(result.results[0].value).toBe('qwen/qwen3-reranker-8b');
	});

	it('should fallback to default rerank models on API error', async () => {
		const { RerankerOpenRouter } = require('../nodes/RerankerOpenRouter/RerankerOpenRouter.node');
		const node = new RerankerOpenRouter();

		const mockContext = {
			getCredentials: jest.fn().mockRejectedValue(new Error('Network error')),
			helpers: {
				request: jest.fn().mockRejectedValue(new Error('Network error')),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext);
		expect(result.results.length).toBeGreaterThan(0);
		expect(result.results.some((m: any) => m.value === 'voyageai/rerank-3-lite')).toBe(true);
	});
});

