import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
} from 'n8n-workflow';

function sanitizeUrl(rawUrl: string): string {
	return rawUrl
		.trim()
		.replace(/^[<"'\(\[]+|[>"'\)\]]+$/g, '')
		.replace(/["']/g, '')
		.trim();
}

export class OpenRouterAudio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Audio Studio',
		name: 'openRouterAudio',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + (typeof $parameter["model"] === "object" ? ($parameter["model"].value || "") : $parameter["model"])}}',
		description:
			'Text to Speech with voice cloning and Speech to Text with speaker diarization, timestamps, and vocabulary control',
		defaults: {
			name: 'OpenRouter Audio',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'openRouterCommunityApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Text to Speech (TTS)',
						value: 'textToSpeech',
						description: 'Synthesize speech from text, with optional voice cloning from sample audio',
						action: 'Convert text to speech',
					},
					{
						name: 'Speech to Text (Transcription)',
						value: 'speechToText',
						description:
							'Transcribe audio into text with speaker diarization, word timestamps, and vocabulary bias',
						action: 'Transcribe audio to text',
					},
				],
				default: 'textToSpeech',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Choose from the list of OpenRouter audio models, or specify a custom model ID',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchModels',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'microsoft/mai-voice-2.1-flash',
					},
				],
			},

			// ----------------------------------
			// 1. Text to Speech (TTS) Properties
			// ----------------------------------
			{
				displayName: 'Text to Speak',
				name: 'text',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				required: true,
				description: 'The text content to convert into spoken audio',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'string',
				default: 'alloy',
				placeholder: 'alloy, echo, fable, onyx, nova, shimmer, en_paul_neutral',
				description:
					'Voice identifier supported by the model (e.g. OpenAI voices like alloy/echo, or provider-specific IDs)',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
			},
			{
				displayName: 'Voice Cloning / Reference Audio',
				name: 'enableVoiceCloning',
				type: 'boolean',
				default: false,
				description:
					'Whether to guide or clone the voice using reference audio clips (stateless zero-shot voice cloning)',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
			},
			{
				displayName: 'Clone Audio Source',
				name: 'cloneSource',
				type: 'options',
				options: [
					{
						name: 'Binary Data (From Incoming Item)',
						value: 'binary',
						description: 'Use binary audio file from previous nodes',
					},
					{
						name: 'Audio URL',
						value: 'url',
						description: 'Provide a direct public audio URL',
					},
					{
						name: 'Both (Binary & URL)',
						value: 'both',
						description: 'Combine binary file and audio URL',
					},
				],
				default: 'binary',
				description: 'Choose where the reference voice clip comes from',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
						enableVoiceCloning: [true],
					},
				},
			},
			{
				displayName: 'Clone Binary Property',
				name: 'cloneBinaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the sample voice audio clip',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
						enableVoiceCloning: [true],
						cloneSource: ['binary', 'both'],
					},
				},
			},
			{
				displayName: 'Clone Audio URL',
				name: 'cloneAudioUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/reference_voice.wav',
				description: 'Direct public URL to the sample voice clip',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
						enableVoiceCloning: [true],
						cloneSource: ['url', 'both'],
					},
				},
			},
			{
				displayName: 'Clone Sample Transcript',
				name: 'cloneTranscript',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				placeholder: 'I used to rule the world.',
				description:
					'Optional verbatim transcript of what is spoken in the reference audio clip. Maximizes voice cloning fidelity.',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
						enableVoiceCloning: [true],
					},
				},
			},
			{
				displayName: 'TTS Options',
				name: 'ttsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
				options: [
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property in which to store the generated audio stream',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'MP3 (MPEG Audio)', value: 'mp3' },
							{ name: 'WAV (Waveform Audio)', value: 'wav' },
							{ name: 'PCM (Raw Pulse-Code Modulation)', value: 'pcm' },
						],
						default: 'mp3',
						description: 'Audio output format returned by the synthesizer',
					},
					{
						displayName: 'Speed',
						name: 'speed',
						type: 'number',
						typeOptions: {
							minValue: 0.25,
							maxValue: 4.0,
							numberPrecision: 2,
						},
						default: 1.0,
						description: 'Playback speed multiplier (e.g. 1.0 is standard speed, 1.25 is faster)',
					},
				],
			},

			// ----------------------------------
			// 2. Speech to Text (STT) Properties
			// ----------------------------------
			{
				displayName: 'Audio Source',
				name: 'audioSource',
				type: 'options',
				options: [
					{
						name: 'Binary Data (From Incoming Item)',
						value: 'binary',
						description: 'Transcribe a binary audio file from previous nodes',
					},
					{
						name: 'Audio URL',
						value: 'url',
						description: 'Transcribe an audio file from a public URL',
					},
				],
				default: 'binary',
				description: 'Where the audio to transcribe is located',
				displayOptions: {
					show: {
						operation: ['speechToText'],
					},
				},
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the audio file to transcribe',
				displayOptions: {
					show: {
						operation: ['speechToText'],
						audioSource: ['binary'],
					},
				},
			},
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/podcast.mp3',
				description: 'Direct public URL to the audio file to transcribe',
				displayOptions: {
					show: {
						operation: ['speechToText'],
						audioSource: ['url'],
					},
				},
			},
			{
				displayName: 'STT Options',
				name: 'sttOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['speechToText'],
					},
				},
				options: [
					{
						displayName: 'Language',
						name: 'language',
						type: 'string',
						default: '',
						placeholder: 'vi or en',
						description: 'ISO-639-1 language code (e.g. vi for Vietnamese, en for English). Auto-detected if omitted.',
					},
					{
						displayName: 'Speaker Diarization (diarize)',
						name: 'diarize',
						type: 'boolean',
						default: false,
						description:
							'Whether to label each word with the speaker who said it (Speaker 1, Speaker 2). Automatically requests verbose_json.',
					},
					{
						displayName: 'Timestamp Granularities',
						name: 'timestampGranularities',
						type: 'multiOptions',
						options: [
							{ name: 'Word (Word-Level Subtitles / Karaoke)', value: 'word' },
							{ name: 'Segment (Sentence / Paragraph Level)', value: 'segment' },
						],
						default: ['segment'],
						description: 'Timestamp detail levels to include when response format is verbose_json',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'JSON (Text & Basic Usage)', value: 'json' },
							{
								name: 'Verbose JSON (Detailed Segments, Words, Timestamps, Duration)',
								value: 'verbose_json',
							},
						],
						default: 'json',
						description: 'Transcription output detail format',
					},
					{
						displayName: 'Keyterms (Custom Vocabulary)',
						name: 'keyterms',
						type: 'string',
						default: '',
						placeholder: 'GenStaff, n8n, OpenRouter, Doctor Jay',
						description:
							'Comma-separated domain terms, specialized jargon, or names to bias recognition toward',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 0,
						description: 'Sampling temperature for transcription. Higher values increase variability.',
					},
					{
						displayName: 'Simplify',
						name: 'simplify',
						type: 'boolean',
						default: true,
						description: 'Whether to return a simplified version of the response instead of the raw data',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			async searchModels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('openRouterCommunityApi');
				const operation = this.getNodeParameter('operation', undefined) as string;
				const modality = operation === 'speechToText' ? 'transcription' : 'speech';

				const response = await this.helpers.request({
					method: 'GET',
					url: `https://openrouter.ai/api/v1/models?output_modalities=${modality}`,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					json: true,
				});

				const models = response.data || [];
				let results = models.map((m: any) => ({
					name: m.id.startsWith('~') ? m.id.substring(1) : m.id,
					value: m.id,
				}));

				results.sort((a: any, b: any) => a.name.localeCompare(b.name));

				if (filter) {
					const f = filter.toLowerCase();
					results = results.filter(
						(m: any) => m.name.toLowerCase().includes(f) || m.value.toLowerCase().includes(f),
					);
				}

				return { results };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials<{ apiKey: string; siteUrl?: string; appName?: string }>(
			'openRouterCommunityApi',
		);

		const defaultHeaders = {
			Authorization: `Bearer ${credentials.apiKey}`,
			'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
			'X-Title': credentials.appName || 'n8n OpenRouter Audio Studio',
			'Content-Type': 'application/json',
		};

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let model = this.getNodeParameter('model', i) as any;
				if (model && typeof model === 'object' && model.value) {
					model = model.value;
				}
				model = model as string;

				// ----------------------------------------
				// Operation: Text to Speech (TTS)
				// ----------------------------------------
				if (operation === 'textToSpeech') {
					const text = this.getNodeParameter('text', i) as string;
					const voice = this.getNodeParameter('voice', i, 'alloy') as string;
					const ttsOptions = (this.getNodeParameter('ttsOptions', i, {}) as any) || {};
					const speed = ttsOptions.speed !== undefined ? ttsOptions.speed : 1.0;
					const responseFormat = ttsOptions.responseFormat || 'mp3';
					const outBinaryProp = ttsOptions.outputBinaryPropertyName || 'data';

					const body: any = {
						model,
						input: text,
						voice,
						speed,
						response_format: responseFormat,
					};

					// Voice Cloning / Input References
					const enableVoiceCloning = this.getNodeParameter('enableVoiceCloning', i, false) as boolean;
					if (enableVoiceCloning) {
						const cloneSource = this.getNodeParameter('cloneSource', i, 'binary') as string;
						const references: any[] = [];

						if (cloneSource === 'binary' || cloneSource === 'both') {
							const cloneBinaryProp = this.getNodeParameter('cloneBinaryPropertyName', i, 'data') as string;
							const binaryData = this.helpers.assertBinaryData(i, cloneBinaryProp);
							const binaryBuffer = await this.helpers.getBinaryDataBuffer(i, cloneBinaryProp);
							const mimeType = binaryData.mimeType || 'audio/wav';
							const base64 = binaryBuffer.toString('base64');
							references.push({
								type: 'input_audio',
								input_audio: {
									data: `data:${mimeType};base64,${base64}`,
								},
							});
						}

						if (cloneSource === 'url' || cloneSource === 'both') {
							const rawUrl = this.getNodeParameter('cloneAudioUrl', i, '') as string;
							const cleanUrl = sanitizeUrl(rawUrl);
							if (cleanUrl) {
								references.push({
									type: 'input_audio',
									input_audio: {
										data: cleanUrl,
									},
								});
							}
						}

						const cloneTranscript = this.getNodeParameter('cloneTranscript', i, '') as string;
						if (cloneTranscript.trim()) {
							references.push({
								type: 'text',
								text: cloneTranscript.trim(),
							});
						}

						if (references.length > 0) {
							body.input_references = references;
						}
					}

					// Request raw audio buffer
					const audioBuffer = (await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/audio/speech',
						headers: defaultHeaders,
						body,
						encoding: null,
					})) as Buffer;

					let mimeType = 'audio/mpeg';
					let ext = 'mp3';
					if (responseFormat === 'wav') {
						mimeType = 'audio/wav';
						ext = 'wav';
					} else if (responseFormat === 'pcm') {
						mimeType = 'application/octet-stream';
						ext = 'pcm';
					}

					const fileName = `speech_${i}.${ext}`;
					const binaryData = await this.helpers.prepareBinaryData(audioBuffer, fileName, mimeType);

					returnData.push({
						json: {
							text,
							model,
							voice,
							speed,
							format: responseFormat,
							hasVoiceCloning: enableVoiceCloning,
						},
						binary: {
							[outBinaryProp]: binaryData,
						},
						pairedItem: { item: i },
					});
				}

				// ----------------------------------------
				// Operation: Speech to Text (STT)
				// ----------------------------------------
				else if (operation === 'speechToText') {
					const audioSource = this.getNodeParameter('audioSource', i, 'binary') as string;
					const sttOptions = (this.getNodeParameter('sttOptions', i, {}) as any) || {};
					const body: any = {
						model,
					};

					if (audioSource === 'binary') {
						const binaryProp = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryProp);
						const binaryBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProp);
						let format = binaryData.fileExtension || 'mp3';
						if (format === 'mpeg') format = 'mp3';

						body.input_audio = {
							data: binaryBuffer.toString('base64'),
							format,
						};
					} else {
						const rawUrl = this.getNodeParameter('audioUrl', i) as string;
						body.input_audio = {
							url: sanitizeUrl(rawUrl),
						};
					}

					// Options mapping
					if (sttOptions.language && typeof sttOptions.language === 'string' && sttOptions.language.trim()) {
						body.language = sttOptions.language.trim();
					}

					if (sttOptions.diarize) {
						body.diarize = true;
						body.response_format = 'verbose_json';
					} else if (sttOptions.responseFormat) {
						body.response_format = sttOptions.responseFormat;
					}

					if (sttOptions.timestampGranularities && sttOptions.timestampGranularities.length > 0) {
						body.timestamp_granularities = sttOptions.timestampGranularities;
					}

					if (sttOptions.keyterms && typeof sttOptions.keyterms === 'string' && sttOptions.keyterms.trim()) {
						body.keyterms = sttOptions.keyterms
							.split(',')
							.map((k: string) => k.trim())
							.filter(Boolean);
					}

					if (sttOptions.temperature !== undefined) {
						body.temperature = sttOptions.temperature;
					}

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/audio/transcriptions',
						headers: defaultHeaders,
						body,
						json: true,
					});

					const simplify = sttOptions.simplify !== false;
					let jsonResult: any;

					if (simplify) {
						jsonResult = {
							text: response.text || '',
							model,
							language: response.language || sttOptions.language,
							duration: response.duration,
							hasDiarization: Boolean(sttOptions.diarize),
							wordsCount: response.words ? response.words.length : undefined,
							segmentsCount: response.segments ? response.segments.length : undefined,
							segments: response.segments,
							words: response.words,
							usage: response.usage,
						};
					} else {
						jsonResult = {
							...response,
							model,
						};
					}

					returnData.push({
						json: jsonResult,
						pairedItem: { item: i },
					});
				}
			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error.message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error);
			}
		}

		return [returnData];
	}
}
