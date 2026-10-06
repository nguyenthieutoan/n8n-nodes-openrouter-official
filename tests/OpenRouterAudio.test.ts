import { mock } from 'jest-mock-extended';
import { IExecuteFunctions } from 'n8n-workflow';
import { OpenRouterAudio } from '../nodes/OpenRouterAudio/OpenRouterAudio.node';

describe('OpenRouterAudio Node', () => {
	let node: OpenRouterAudio;

	beforeEach(() => {
		node = new OpenRouterAudio();
	});

	function createMockExecuteFunctions() {
		const mockExecuteFunctions = mock<IExecuteFunctions>();
		mockExecuteFunctions.helpers = {
			request: jest.fn(),
			prepareBinaryData: jest.fn().mockResolvedValue('mock-binary-audio-data'),
			assertBinaryData: jest.fn().mockReturnValue({ mimeType: 'audio/wav', fileExtension: 'wav' }),
			getBinaryDataBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-audio-bytes')),
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
		expect(node.description.name).toBe('openRouterAudio');
		expect(node.description.displayName).toBe('OpenRouter Audio Studio');
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
		expect(node.description.credentials).toEqual([
			{ name: 'openRouterCommunityApi', required: true },
		]);
	});

	describe('searchModels method', () => {
		it('should query output_modalities=speech for textToSpeech operation', async () => {
			const mockContext = {
				getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-key' }),
				getNodeParameter: jest.fn().mockReturnValue('textToSpeech'),
				helpers: {
					request: jest.fn().mockResolvedValue({
						data: [{ id: 'microsoft/mai-voice-2.1-flash' }],
					}),
				},
			} as any;

			const result = await node.methods.listSearch.searchModels.call(mockContext);
			expect(mockContext.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://openrouter.ai/api/v1/models?output_modalities=speech',
				}),
			);
			expect(result.results[0].value).toBe('microsoft/mai-voice-2.1-flash');
		});

		it('should query output_modalities=transcription for speechToText operation', async () => {
			const mockContext = {
				getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-key' }),
				getNodeParameter: jest.fn().mockReturnValue('speechToText'),
				helpers: {
					request: jest.fn().mockResolvedValue({
						data: [{ id: 'openai/whisper-large-v3' }],
					}),
				},
			} as any;

			const result = await node.methods.listSearch.searchModels.call(mockContext);
			expect(mockContext.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://openrouter.ai/api/v1/models?output_modalities=transcription',
				}),
			);
			expect(result.results[0].value).toBe('openai/whisper-large-v3');
		});
	});

	describe('execute method - Text to Speech', () => {
		it('should synthesize standard text-to-speech', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'textToSpeech';
				if (paramName === 'model') return 'microsoft/mai-voice-2.1-flash';
				if (paramName === 'text') return 'Hello from n8n Audio Studio!';
				if (paramName === 'voice') return 'alloy';
				if (paramName === 'enableVoiceCloning') return false;
				if (paramName === 'ttsOptions') return { speed: 1.25, responseFormat: 'mp3' };
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue(
				Buffer.from('synthesized-audio-bytes'),
			);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/audio/speech',
					body: {
						model: 'microsoft/mai-voice-2.1-flash',
						input: 'Hello from n8n Audio Studio!',
						voice: 'alloy',
						speed: 1.25,
						response_format: 'mp3',
					},
					encoding: null,
				}),
			);

			expect(result[0][0].json).toEqual({
				text: 'Hello from n8n Audio Studio!',
				model: 'microsoft/mai-voice-2.1-flash',
				voice: 'alloy',
				speed: 1.25,
				format: 'mp3',
				hasVoiceCloning: false,
			});
			expect(result[0][0].binary?.data).toBe('mock-binary-audio-data');
		});

		it('should synthesize text-to-speech with Voice Cloning reference audio and transcript', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'textToSpeech';
				if (paramName === 'model') return 'bytedance-seed/seed-audio-1-0';
				if (paramName === 'text') return 'Testing voice cloning.';
				if (paramName === 'voice') return 'custom';
				if (paramName === 'enableVoiceCloning') return true;
				if (paramName === 'cloneSource') return 'both';
				if (paramName === 'cloneBinaryPropertyName') return 'data';
				if (paramName === 'cloneAudioUrl') return 'https://example.com/reference.wav';
				if (paramName === 'cloneTranscript') return 'Sample voice reference transcript.';
				if (paramName === 'ttsOptions') return { responseFormat: 'wav' };
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue(
				Buffer.from('cloned-audio-bytes'),
			);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/audio/speech',
					body: expect.objectContaining({
						model: 'bytedance-seed/seed-audio-1-0',
						input_references: [
							{
								type: 'input_audio',
								input_audio: {
									data: Buffer.from('mock-audio-bytes').toString('base64'),
									format: 'wav',
								},
							},
							{
								type: 'input_audio',
								input_audio: {
									data: 'https://example.com/reference.wav',
								},
							},
							{
								type: 'text',
								text: 'Sample voice reference transcript.',
							},
						],
					}),
				}),
			);

			expect(result[0][0].json.hasVoiceCloning).toBe(true);
			expect(result[0][0].json.format).toBe('wav');
		});
	});

	describe('execute method - Speech to Text', () => {
		it('should transcribe audio binary file with simple output', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'speechToText';
				if (paramName === 'model') return 'openai/whisper-large-v3';
				if (paramName === 'audioSource') return 'binary';
				if (paramName === 'binaryPropertyName') return 'data';
				if (paramName === 'sttOptions') return { language: 'vi', simplify: true };
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				text: 'Xin chào thế giới!',
				language: 'vi',
				duration: 3.5,
				usage: { total_tokens: 15 },
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/audio/transcriptions',
					body: {
						model: 'openai/whisper-large-v3',
						input_audio: {
							data: Buffer.from('mock-audio-bytes').toString('base64'),
							format: 'wav',
						},
						language: 'vi',
					},
					json: true,
				}),
			);

			expect(result[0][0].json).toEqual(
				expect.objectContaining({
					text: 'Xin chào thế giới!',
					language: 'vi',
					duration: 3.5,
					hasDiarization: false,
				}),
			);
		});

		it('should transcribe audio URL with diarization, timestamps, and keyterms', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'speechToText';
				if (paramName === 'model') return 'assemblyai/universal-3-5-pro';
				if (paramName === 'audioSource') return 'url';
				if (paramName === 'audioUrl') return 'https://example.com/podcast.mp3';
				if (paramName === 'sttOptions') {
					return {
						diarize: true,
						timestampGranularities: ['word', 'segment'],
						keyterms: 'GenStaff, Doctor Jay, n8n',
						simplify: true,
					};
				}
				return undefined;
			});

			(mockExecuteFunctions.helpers.request as jest.Mock).mockResolvedValue({
				text: 'Doctor Jay: Welcome to GenStaff on n8n.',
				language: 'en',
				duration: 4.2,
				words: [
					{ word: 'Doctor', start: 0.1, end: 0.5, speaker: 0, speaker_label: 'Speaker 1' },
					{ word: 'Jay', start: 0.6, end: 0.9, speaker: 0, speaker_label: 'Speaker 1' },
				],
				segments: [
					{ id: 0, text: 'Doctor Jay: Welcome to GenStaff on n8n.', start: 0.1, end: 4.2 },
				],
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/audio/transcriptions',
					body: {
						model: 'assemblyai/universal-3-5-pro',
						input_audio: {
							url: 'https://example.com/podcast.mp3',
						},
						diarize: true,
						response_format: 'verbose_json',
						timestamp_granularities: ['word', 'segment'],
						keyterms: ['GenStaff', 'Doctor Jay', 'n8n'],
					},
				}),
			);

			expect(result[0][0].json).toEqual(
				expect.objectContaining({
					text: 'Doctor Jay: Welcome to GenStaff on n8n.',
					hasDiarization: true,
					wordsCount: 2,
					segmentsCount: 1,
				}),
			);
		});

		it('should handle continueOnFail when error occurs', async () => {
			const mockExecuteFunctions = createMockExecuteFunctions();

			mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
				if (paramName === 'operation') return 'speechToText';
				if (paramName === 'model') return 'openai/whisper-large-v3';
				if (paramName === 'audioSource') return 'url';
				if (paramName === 'audioUrl') return 'https://example.com/invalid.mp3';
				if (paramName === 'sttOptions') return {};
				return undefined;
			});

			mockExecuteFunctions.continueOnFail.mockReturnValue(true);
			(mockExecuteFunctions.helpers.request as jest.Mock).mockRejectedValue(
				new Error('Audio download failed: 404 Not Found'),
			);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error', 'Audio download failed: 404 Not Found');
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});
	});
});
