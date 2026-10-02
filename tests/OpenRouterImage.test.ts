import { mock } from 'jest-mock-extended';
import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { OpenRouterImage } from '../nodes/OpenRouterImage/OpenRouterImage.node';

describe('OpenRouterImage Node', () => {
	let node: OpenRouterImage;

	beforeEach(() => {
		node = new OpenRouterImage();
	});

	function createMockExecuteFunctions() {
		const mockExecuteFunctions = mock<IExecuteFunctions>();
		mockExecuteFunctions.helpers = {
			request: jest.fn(),
			prepareBinaryData: jest.fn().mockResolvedValue('mock-binary-data'),
			assertBinaryData: jest.fn().mockReturnValue({ mimeType: 'image/png' }),
			getBinaryDataBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-ref-bytes')),
		} as any;
		mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
		mockExecuteFunctions.getCredentials.mockResolvedValue({
			apiKey: 'mock-openrouter-key',
			siteUrl: 'https://test.io',
			appName: 'TestApp',
		});
		return mockExecuteFunctions;
	}

	it('should have valid node description and metadata', () => {
		expect(node.description.name).toBe('openRouterImage');
		expect(node.description.displayName).toBe('OpenRouter Image Generation');
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
		expect(node.description.credentials).toEqual([
			{ name: 'openRouterCommunityApi', required: true },
		]);
	});

	describe('searchModels method', () => {
		it('should dynamically fetch image models via output_modalities=image', async () => {
			const mockContext = {
				getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-key' }),
				helpers: {
					request: jest.fn().mockResolvedValue({
						data: [
							{ id: 'recraft/recraft-v4.1-flash' },
							{ id: 'black-forest-labs/flux-3-image' },
						],
					}),
				},
			} as any;

			const result = await node.methods.listSearch.searchModels.call(mockContext);
			expect(mockContext.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'GET',
					url: 'https://openrouter.ai/api/v1/models?output_modalities=image',
					headers: { Authorization: 'Bearer mock-key' },
					json: true,
				}),
			);
			expect(result.results).toHaveLength(2);
			expect(result.results[0].value).toBe('black-forest-labs/flux-3-image');
			expect(result.results[1].value).toBe('recraft/recraft-v4.1-flash');
		});

		it('should filter search results when filter term is provided', async () => {
			const mockContext = {
				getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-key' }),
				helpers: {
					request: jest.fn().mockResolvedValue({
						data: [
							{ id: 'recraft/recraft-v4.1-flash' },
							{ id: 'black-forest-labs/flux-3-image' },
						],
					}),
				},
			} as any;

			const result = await node.methods.listSearch.searchModels.call(mockContext, 'recraft');
			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('recraft/recraft-v4.1-flash');
		});
	});

	describe('execute method', () => {
		it('should generate text-to-image with full options (Happy Path)', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'model') return 'recraft/recraft-v4.1-flash';
				if (paramName === 'prompt') return 'A cute cyber cat in neon city';
				if (paramName === 'mode') return 'textToImage';
				if (paramName === 'options') {
					return {
						aspectRatio: '16:9',
						resolution: '2K',
						background: 'transparent',
						outputFormat: 'webp',
						quality: 'high',
						seed: 42,
						numImages: 1,
						simplify: true,
					};
				}
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				created: 1748372400,
				data: [
					{
						b64_json: Buffer.from('mock-image-bytes').toString('base64'),
						media_type: 'image/webp',
					},
				],
				usage: { cost: 0.03, total_tokens: 2500 },
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/images',
					body: {
						model: 'recraft/recraft-v4.1-flash',
						prompt: 'A cute cyber cat in neon city',
						aspect_ratio: '16:9',
						resolution: '2K',
						background: 'transparent',
						output_format: 'webp',
						quality: 'high',
						seed: 42,
					},
				}),
			);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toEqual(
				expect.objectContaining({
					prompt: 'A cute cyber cat in neon city',
					model: 'recraft/recraft-v4.1-flash',
					format: 'webp',
					cost: 0.03,
					seed: 42,
					background: 'transparent',
				}),
			);
			expect(result[0][0].binary?.data).toBe('mock-binary-data');
		});

		it('should generate image-to-image with binary and URL reference images', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'model') return 'bytedance-seed/seedream-5-0-flash';
				if (paramName === 'prompt') return 'Transform into oil painting style';
				if (paramName === 'mode') return 'imageToImage';
				if (paramName === 'referenceSource') return 'both';
				if (paramName === 'binaryPropertyName') return 'data';
				if (paramName === 'referenceUrls') return 'https://example.com/style.png, "https://example.com/palette.jpg"';
				if (paramName === 'options') return { simplify: true };
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				created: 1748372400,
				data: [
					{
						b64_json: Buffer.from('mock-painted-bytes').toString('base64'),
						media_type: 'image/png',
					},
				],
				usage: { cost: 0.02 },
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/images',
					body: expect.objectContaining({
						model: 'bytedance-seed/seedream-5-0-flash',
						prompt: 'Transform into oil painting style',
						input_references: [
							{
								type: 'image_url',
								image_url: {
									url: `data:image/png;base64,${Buffer.from('mock-ref-bytes').toString('base64')}`,
								},
							},
							{
								type: 'image_url',
								image_url: {
									url: 'https://example.com/style.png',
								},
							},
							{
								type: 'image_url',
								image_url: {
									url: 'https://example.com/palette.jpg',
								},
							},
						],
					}),
				}),
			);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].binary?.data).toBe('mock-binary-data');
		});

		it('should return multiple execution items when numImages > 1', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'model') return 'black-forest-labs/flux-3-image';
				if (paramName === 'prompt') return 'Two variations of modern minimal chair';
				if (paramName === 'mode') return 'textToImage';
				if (paramName === 'options') return { numImages: 2, simplify: true };
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				created: 1748372400,
				data: [
					{ b64_json: 'base64_1', media_type: 'image/png' },
					{ b64_json: 'base64_2', media_type: 'image/png' },
				],
				usage: { cost: 0.06 },
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.imageIndex).toBe(0);
			expect(result[0][0].json.totalImages).toBe(2);
			expect(result[0][1].json.imageIndex).toBe(1);
			expect(result[0][1].json.totalImages).toBe(2);
		});

		it('should download and prepare binary when remote URL is returned', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'model') return 'bytedance-seed/seedream-5-0-flash';
				if (paramName === 'prompt') return 'A cute puppy';
				if (paramName === 'mode') return 'textToImage';
				if (paramName === 'options') return { simplify: true };
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock)
				.mockResolvedValueOnce({
					created: 1748372400,
					data: [{ url: 'https://images.openrouter.ai/sample.png' }],
					usage: { cost: 0.01 },
				})
				.mockResolvedValueOnce(Buffer.from('downloaded-image-bytes'));

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					method: 'GET',
					url: 'https://images.openrouter.ai/sample.png',
					encoding: null,
				}),
			);
			expect(result[0]).toHaveLength(1);
		});

		it('should handle continueOnFail when API throws error', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'model') return 'recraft/recraft-v4.1-flash';
				if (paramName === 'prompt') return 'Invalid request';
				if (paramName === 'mode') return 'textToImage';
				if (paramName === 'options') return {};
				return undefined;
			});

			mockExecuteFunctions.continueOnFail.mockReturnValue(true);
			(mockExecuteFunctions.helpers.request as jest.Mock).mockRejectedValue(
				new Error('OpenRouter Image API: Rate limit exceeded'),
			);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error', 'OpenRouter Image API: Rate limit exceeded');
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});

		it('should throw NodeApiError when continueOnFail is false', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'model') return 'recraft/recraft-v4.1-flash';
				if (paramName === 'prompt') return 'Invalid request';
				if (paramName === 'mode') return 'textToImage';
				if (paramName === 'options') return {};
				return undefined;
			});

			mockExecuteFunctions.getNode.mockReturnValue({
				id: '1',
				name: 'OpenRouter Image',
				type: 'n8n-nodes-openrouter-official.openRouterImage',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			});
			mockExecuteFunctions.continueOnFail.mockReturnValue(false);
			(mockExecuteFunctions.helpers.request as jest.Mock).mockRejectedValue(
				new Error('OpenRouter Image API: Internal Server Error'),
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow();
		});
	});
});
