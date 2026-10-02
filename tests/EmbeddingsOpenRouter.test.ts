import { EmbeddingsOpenRouter } from '../nodes/EmbeddingsOpenRouter/EmbeddingsOpenRouter.node';

describe('EmbeddingsOpenRouter Node', () => {
	let node: EmbeddingsOpenRouter;

	beforeEach(() => {
		node = new EmbeddingsOpenRouter();
	});

	it('should have valid metadata', () => {
		expect(node.description.name).toBe('embeddingsOpenRouter');
		expect(node.description.displayName).toBe('OpenRouter Embeddings');
	});

	it('should dynamically fetch embeddings models via searchModels (output_modalities=embeddings)', async () => {
		const mockContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-openrouter-key' }),
			helpers: {
				request: jest.fn().mockResolvedValue({
					data: [
						{
							id: 'openai/text-embedding-3-small',
							name: 'OpenAI: Text Embedding 3 Small',
							description: 'High-performance text embeddings',
							pricing: { prompt: '0.00000002', completion: '0' },
						},
						{
							id: 'voyageai/voyage-4',
							name: 'VoyageAI by MongoDB: voyage-4',
							description: 'General-purpose embedding model',
							pricing: { prompt: '0.00000006', completion: '0' },
						},
					],
				}),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext);
		expect(mockContext.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: 'https://openrouter.ai/api/v1/models?output_modalities=embeddings',
				headers: {
					Authorization: 'Bearer mock-openrouter-key',
				},
				json: true,
			}),
		);

		expect(result.results.length).toBe(2);
		expect(result.results[0].value).toBe('openai/text-embedding-3-small');
		expect(result.results[1].value).toBe('voyageai/voyage-4');
	});

	it('should filter embeddings models when filter parameter is provided', async () => {
		const mockContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-openrouter-key' }),
			helpers: {
				request: jest.fn().mockResolvedValue({
					data: [
						{ id: 'openai/text-embedding-3-small', name: 'OpenAI: Text Embedding 3 Small' },
						{ id: 'google/gemini-embedding-2', name: 'Google: Gemini Embedding 2' },
					],
				}),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext, 'gemini');
		expect(result.results.length).toBe(1);
		expect(result.results[0].value).toBe('google/gemini-embedding-2');
	});

	it('should return fallback embeddings models if API request fails', async () => {
		const mockContext = {
			getCredentials: jest.fn().mockRejectedValue(new Error('Network error')),
			helpers: {
				request: jest.fn().mockRejectedValue(new Error('Network error')),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext);
		expect(result.results.length).toBeGreaterThan(0);
		expect(result.results.some((m: any) => m.value === 'openai/text-embedding-3-small')).toBe(true);
	});
});
