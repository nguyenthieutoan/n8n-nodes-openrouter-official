import { mock } from 'jest-mock-extended';
import { IExecuteFunctions, INodeExecutionData, NodeApiError } from 'n8n-workflow';
import { OpenRouter } from '../nodes/OpenRouter/OpenRouter.node';

describe('OpenRouter Node', () => {
	let node: OpenRouter;

	beforeEach(() => {
		node = new OpenRouter();
	});

	function createMockExecuteFunctions() {
		const mockExecuteFunctions = mock<IExecuteFunctions>();
		mockExecuteFunctions.helpers = {
			request: jest.fn(),
			prepareBinaryData: jest.fn().mockResolvedValue('mock-binary-data'),
		} as any;
		mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
		mockExecuteFunctions.getCredentials.mockResolvedValue({ apiKey: 'mock-key', siteUrl: '', appName: '' });
		return mockExecuteFunctions;
	}

	it('should process Generate Image successfully (Happy Path)', async () => {
		const mockExecuteFunctions = createMockExecuteFunctions();
		
		mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'operation') return 'generateImage';
			if (paramName === 'prompt') return 'a cute cat';
			if (paramName === 'model') return 'mock-model';
			if (paramName === 'resolution') return '1K';
			if (paramName === 'aspectRatio') return '16:9';
			return undefined;
		});

		(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
			data: [
				{ url: 'https://example.com/image.png', b64_json: 'mock-base64' }
			],
			usage: { total_tokens: 10 }
		});

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toHaveLength(1);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toEqual({
			prompt: 'a cute cat',
			usage: { total_tokens: 10 }
		});
		expect(result[0][0].binary?.data).toEqual('mock-binary-data');
	});

	it('should throw NodeApiError on API failure (Failed API)', async () => {
		const mockExecuteFunctions = createMockExecuteFunctions();
		
		mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'operation') return 'generateImage';
			if (paramName === 'prompt') return 'test';
			if (paramName === 'model') return 'mock-model';
			if (paramName === 'resolution') return '1K';
			if (paramName === 'aspectRatio') return '16:9';
			return undefined;
		});
		mockExecuteFunctions.getNode.mockReturnValue({
			id: '1',
			name: 'OpenRouter',
			type: 'n8n-nodes-openrouter-official.OpenRouter',
			typeVersion: 1,
			position: [0, 0],
			parameters: {}
		});
		mockExecuteFunctions.continueOnFail.mockReturnValue(false);

		const apiError = new Error('API Error');
		(mockExecuteFunctions.helpers.request as jest.Mock).mockRejectedValue(apiError);

		await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow();
	});

	it('should handle continueOnFail when API fails', async () => {
		const mockExecuteFunctions = createMockExecuteFunctions();
		
		mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'operation') return 'generateImage';
			if (paramName === 'prompt') return 'test';
			if (paramName === 'model') return 'mock-model';
			if (paramName === 'resolution') return '1K';
			if (paramName === 'aspectRatio') return '16:9';
			return undefined;
		});
		mockExecuteFunctions.continueOnFail.mockReturnValue(true);

		const apiError = new Error('API Error');
		(mockExecuteFunctions.helpers.request as jest.Mock).mockRejectedValue(apiError);

		const result = await node.execute.call(mockExecuteFunctions);
		
		expect(result[0][0].json).toHaveProperty('error');
		expect(result[0][0].pairedItem).toEqual({ item: 0 });
	});

	describe('Analyze Content - Image URLs & Multi-Binary', () => {
		it('extractImageUrls should sanitize strings with brackets, quotes, and newlines', () => {
			const { extractImageUrls } = require('../nodes/OpenRouter/OpenRouter.node');

			expect(extractImageUrls('["https://fb.com/pic1", "https://fb.com/pic2"]')).toEqual([
				'https://fb.com/pic1',
				'https://fb.com/pic2',
			]);

			expect(extractImageUrls("['https://fb.com/pic1', 'https://fb.com/pic2']")).toEqual([
				'https://fb.com/pic1',
				'https://fb.com/pic2',
			]);

			expect(extractImageUrls(' [ https://fb.com/pic1 , \n https://fb.com/pic2 ] ')).toEqual([
				'https://fb.com/pic1',
				'https://fb.com/pic2',
			]);

			expect(extractImageUrls(['https://fb.com/pic1', 'https://fb.com/pic2'])).toEqual([
				'https://fb.com/pic1',
				'https://fb.com/pic2',
			]);

			expect(extractImageUrls('')).toEqual([]);
			expect(extractImageUrls(null)).toEqual([]);
		});

		it('should process Analyze Content with multiple Image URLs (Happy Path)', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'analyze';
				if (paramName === 'prompt') return 'Describe these 2 pictures';
				if (paramName === 'model') return 'openai/gpt-4o';
				if (paramName === 'mediaSource') return 'urls';
				if (paramName === 'imageUrls') return '["https://scontent.xx.fbcdn.net/pic1", "https://scontent.xx.fbcdn.net/pic2"]';
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				choices: [{ message: { content: 'Two beautiful pictures' } }],
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toEqual({
				choices: [{ message: { content: 'Two beautiful pictures' } }],
			});

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://openrouter.ai/api/v1/chat/completions',
					body: {
						model: 'openai/gpt-4o',
						messages: [
							{
								role: 'user',
								content: [
									{ type: 'text', text: 'Describe these 2 pictures' },
									{ type: 'image_url', image_url: { url: 'https://scontent.xx.fbcdn.net/pic1' } },
									{ type: 'image_url', image_url: { url: 'https://scontent.xx.fbcdn.net/pic2' } },
								],
							},
						],
					},
				}),
			);
		});

		it('should process Analyze Content with Include All Binaries = true', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();
			mockExecuteFunctions.getInputData.mockReturnValue([
				{
					json: {},
					binary: {
						data1: { data: 'a', mimeType: 'image/jpeg', fileName: '1.jpg' } as any,
						data2: { data: 'b', mimeType: 'image/png', fileName: '2.png' } as any,
					},
				},
			]);

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'analyze';
				if (paramName === 'prompt') return 'Analyze all binaries';
				if (paramName === 'model') return 'google/gemini-2.0-flash';
				if (paramName === 'mediaSource') return 'binary';
				if (paramName === 'allBinaries') return true;
				return undefined;
			});

			(mockExecuteFunctions.helpers.getBinaryDataBuffer as any) = jest.fn()
				.mockResolvedValueOnce(Buffer.from('binary-content-1'))
				.mockResolvedValueOnce(Buffer.from('binary-content-2'));

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				choices: [{ message: { content: 'Analyzed 2 files' } }],
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toEqual({
				choices: [{ message: { content: 'Analyzed 2 files' } }],
			});

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					body: {
						model: 'google/gemini-2.0-flash',
						messages: [
							{
								role: 'user',
								content: [
									{ type: 'text', text: 'Analyze all binaries' },
									{
										type: 'image_url',
										image_url: { url: `data:image/jpeg;base64,${Buffer.from('binary-content-1').toString('base64')}` },
									},
									{
										type: 'image_url',
										image_url: { url: `data:image/png;base64,${Buffer.from('binary-content-2').toString('base64')}` },
									},
								],
							},
						],
					},
				}),
			);
		});

		it('should process Analyze Content with comma-separated binary properties', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();
			mockExecuteFunctions.getInputData.mockReturnValue([
				{
					json: {},
					binary: {
						img_front: { data: 'a', mimeType: 'image/jpeg' } as any,
						img_back: { data: 'b', mimeType: 'image/jpeg' } as any,
					},
				},
			]);

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'analyze';
				if (paramName === 'prompt') return 'Analyze front and back';
				if (paramName === 'model') return 'openai/gpt-4o';
				if (paramName === 'mediaSource') return 'binary';
				if (paramName === 'allBinaries') return false;
				if (paramName === 'binaryPropertyName') return 'img_front, img_back';
				return undefined;
			});

			(mockExecuteFunctions.helpers.assertBinaryData as any) = jest.fn((index, key) => ({
				data: 'mock',
				mimeType: 'image/jpeg',
			}));

			(mockExecuteFunctions.helpers.getBinaryDataBuffer as any) = jest.fn()
				.mockResolvedValueOnce(Buffer.from('front-buf'))
				.mockResolvedValueOnce(Buffer.from('back-buf'));

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				choices: [{ message: { content: 'Front and back valid' } }],
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toEqual({
				choices: [{ message: { content: 'Front and back valid' } }],
			});

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					body: {
						model: 'openai/gpt-4o',
						messages: [
							{
								role: 'user',
								content: [
									{ type: 'text', text: 'Analyze front and back' },
									{
										type: 'image_url',
										image_url: { url: `data:image/jpeg;base64,${Buffer.from('front-buf').toString('base64')}` },
									},
									{
										type: 'image_url',
										image_url: { url: `data:image/jpeg;base64,${Buffer.from('back-buf').toString('base64')}` },
									},
								],
							},
						],
					},
				}),
			);
		});

		it('buildMediaContent should correctly classify Audio, Video, PDF, Text, and Images', () => {
			const { buildMediaContent } = require('../nodes/OpenRouter/OpenRouter.node');

			// Audio (mp3)
			const audioResult = buildMediaContent({ mimeType: 'audio/mpeg' }, Buffer.from('mp3-data'));
			expect(audioResult).toEqual({
				type: 'input_audio',
				input_audio: {
					data: Buffer.from('mp3-data').toString('base64'),
					format: 'mp3',
				},
			});

			// Audio (wav)
			const wavResult = buildMediaContent({ mimeType: 'audio/wav' }, Buffer.from('wav-data'));
			expect(wavResult).toEqual({
				type: 'input_audio',
				input_audio: {
					data: Buffer.from('wav-data').toString('base64'),
					format: 'wav',
				},
			});

			// Text / CSV
			const textResult = buildMediaContent({ mimeType: 'text/csv' }, Buffer.from('col1,col2\nval1,val2'), 'data.csv');
			expect(textResult.type).toEqual('text');
			expect(textResult.text).toContain('col1,col2');

			// PDF
			const pdfResult = buildMediaContent({ mimeType: 'application/pdf' }, Buffer.from('pdf-data'));
			expect(pdfResult).toEqual({
				type: 'image_url',
				image_url: {
					url: `data:application/pdf;base64,${Buffer.from('pdf-data').toString('base64')}`,
				},
			});

			// Video
			const videoResult = buildMediaContent({ mimeType: 'video/mp4' }, Buffer.from('mp4-data'));
			expect(videoResult).toEqual({
				type: 'image_url',
				image_url: {
					url: `data:video/mp4;base64,${Buffer.from('mp4-data').toString('base64')}`,
				},
			});

			// Image
			const imgResult = buildMediaContent({ mimeType: 'image/png' }, Buffer.from('png-data'));
			expect(imgResult).toEqual({
				type: 'image_url',
				image_url: {
					url: `data:image/png;base64,${Buffer.from('png-data').toString('base64')}`,
				},
			});
		});

		it('should process Analyze Content with mixed media (Image + Audio) in All Binaries', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();
			mockExecuteFunctions.getInputData.mockReturnValue([
				{
					json: {},
					binary: {
						customer_photo: { data: 'a', mimeType: 'image/jpeg', fileName: 'photo.jpg' } as any,
						voice_note: { data: 'b', mimeType: 'audio/mpeg', fileName: 'voice.mp3' } as any,
					},
				},
			]);

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'analyze';
				if (paramName === 'prompt') return 'Analyze both photo and voice note';
				if (paramName === 'model') return 'google/gemini-2.0-flash';
				if (paramName === 'mediaSource') return 'binary';
				if (paramName === 'allBinaries') return true;
				return undefined;
			});

			(mockExecuteFunctions.helpers.getBinaryDataBuffer as any) = jest.fn()
				.mockResolvedValueOnce(Buffer.from('photo-bytes'))
				.mockResolvedValueOnce(Buffer.from('voice-bytes'));

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				choices: [{ message: { content: 'Both photo and voice note analyzed successfully' } }],
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toEqual({
				choices: [{ message: { content: 'Both photo and voice note analyzed successfully' } }],
			});

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					body: {
						model: 'google/gemini-2.0-flash',
						messages: [
							{
								role: 'user',
								content: [
									{ type: 'text', text: 'Analyze both photo and voice note' },
									{
										type: 'image_url',
										image_url: { url: `data:image/jpeg;base64,${Buffer.from('photo-bytes').toString('base64')}` },
									},
									{
										type: 'input_audio',
										input_audio: {
											data: Buffer.from('voice-bytes').toString('base64'),
											format: 'mp3',
										},
									},
								],
							},
						],
					},
				}),
			);
		});
	});
});
