import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeListSearchResult,
} from 'n8n-workflow';

export class OpenRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter',
		name: 'openRouter',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Consume OpenRouter API',
		defaults: {
			name: 'OpenRouter',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'openRouterApi',
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
						name: 'Analyze Media (Image/Audio/Video to Text)',
						value: 'analyze',
						description: 'Analyze an image, audio or video using a multimodal model',
						action: 'Analyze media',
					},
					{
						name: 'Generate Image',
						value: 'generateImage',
						description: 'Generate an image from a text prompt',
						action: 'Generate an image',
					},
					{
						name: 'Generate Video (Async)',
						value: 'generateVideo',
						description: 'Generate a video from a text prompt',
						action: 'Generate a video',
					},
					{
						name: 'Speech To Text',
						value: 'speechToText',
						description: 'Transcribe audio into text',
						action: 'Transcribe audio',
					},
					{
						name: 'Text To Speech',
						value: 'textToSpeech',
						description: 'Convert text into audio',
						action: 'Convert text to speech',
					},
				],
				default: 'analyze',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Choose from the list, or specify an ID',
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
						displayName: 'ID',
						name: 'id',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '.*',
									errorMessage: 'Not a valid model ID',
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['analyze', 'generateImage', 'generateVideo'],
					},
				},
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the file to process',
				displayOptions: {
					show: {
						operation: ['analyze', 'speechToText'],
					},
				},
			},
			{
				displayName: 'Text to Speak',
				name: 'text',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Resolution',
						name: 'resolution',
						type: 'options',
						options: [
							{ name: '512x512', value: '512' },
							{ name: '1K', value: '1K' },
							{ name: '2K', value: '2K' },
							{ name: '4K', value: '4K' },
						],
						default: '1K',
					},
					{
						displayName: 'Aspect Ratio',
						name: 'aspectRatio',
						type: 'string',
						default: '16:9',
					},
					{
						displayName: 'Duration (Seconds)',
						name: 'duration',
						type: 'number',
						default: 5,
					},
					{
						displayName: 'Voice',
						name: 'voice',
						type: 'string',
						default: 'alloy',
					},
					{
						displayName: 'Speed',
						name: 'speed',
						type: 'number',
						default: 1,
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			async searchModels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('openRouterApi');
				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://openrouter.ai/api/v1/models',
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					json: true,
				});

				const operation = this.getNodeParameter('operation', undefined) as string;
				let models = response.data;

				// Filter by functionality based on the current operation
				if (operation === 'analyze') {
					models = models.filter((m: any) => m.architecture?.modality?.includes('image') || m.architecture?.modality?.includes('video'));
				} else if (operation === 'speechToText' || operation === 'textToSpeech') {
					models = models.filter((m: any) => m.architecture?.modality?.includes('audio') || m.id.includes('audio') || m.id.includes('tts') || m.id.includes('stt') || m.id.includes('whisper'));
				} else if (operation === 'generateImage') {
					// Fallback for missing explicit image modalities in some OpenRouter models, just list image models if known
					models = models.filter((m: any) => m.architecture?.modality?.includes('image') || m.id.includes('dall-e') || m.id.includes('stable') || m.id.includes('flux') || m.id.includes('midjourney'));
				}

				let results = models.map((m: any) => ({
					name: m.name || m.id,
					value: m.id,
					description: m.architecture?.modality ? `Modality: ${m.architecture.modality}` : undefined,
				}));

				if (filter) {
					const f = filter.toLowerCase();
					results = results.filter((m: any) => m.name.toLowerCase().includes(f) || m.value.toLowerCase().includes(f));
				}

				return { results };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials<{ apiKey: string, siteUrl?: string, appName?: string }>('openRouterApi');
		const operation = this.getNodeParameter('operation', 0) as string;

		const defaultHeaders = {
			'Authorization': `Bearer ${credentials.apiKey}`,
			'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
			'X-Title': credentials.appName || 'n8n OpenRouter Node',
		};

		for (let i = 0; i < items.length; i++) {
			try {
				let model = this.getNodeParameter('model', i) as any;
				if (model && typeof model === 'object' && model.value) {
					model = model.value;
				}
				model = model as string;

				if (operation === 'analyze') {
					const prompt = this.getNodeParameter('prompt', i) as string;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
					const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
					
					const base64Data = binaryDataBuffer.toString('base64');
					const mimeType = binaryData.mimeType;
					
					// Assuming generic image_url type works for multimodal
					const content: any[] = [
						{ type: 'text', text: prompt },
						{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
					];

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/chat/completions',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body: {
							model,
							messages: [
								{
									role: 'user',
									content,
								},
							],
						},
						json: true,
					});

					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				} 
				else if (operation === 'generateImage' || operation === 'generateVideo') {
					const prompt = this.getNodeParameter('prompt', i) as string;
					const options = this.getNodeParameter('options', i) as any || {};
					const body: any = { model, prompt };

					if (operation === 'generateImage') {
						if (options.resolution) body.resolution = options.resolution;
						if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
						
						const response = await this.helpers.request({
							method: 'POST',
							url: 'https://openrouter.ai/api/v1/images/generations',
							headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
							body,
							json: true,
						});

						const base64Data = response.data[0].b64_json || response.data[0].url;
						let binary;
						
						if (base64Data && base64Data.startsWith('http')) {
							const imageBuffer = await this.helpers.request({
								method: 'GET',
								url: base64Data,
								encoding: null,
							});
							binary = await this.helpers.prepareBinaryData(imageBuffer, `image_${i}.png`, 'image/png');
						} else if (base64Data) {
							const buffer = Buffer.from(base64Data, 'base64');
							binary = await this.helpers.prepareBinaryData(buffer, `image_${i}.png`, 'image/png');
						}

						const outItem: INodeExecutionData = {
							json: { prompt, usage: response.usage || {} },
							pairedItem: { item: i },
						};
						if (binary) outItem.binary = { data: binary };
						returnData.push(outItem);
					} else {
						if (options.duration) body.duration = options.duration;
						const initResponse = await this.helpers.request({
							method: 'POST',
							url: 'https://openrouter.ai/api/v1/video/generations',
							headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
							body,
							json: true,
						});

						const jobId = initResponse.job_id || initResponse.id;
						let status = 'processing';
						let videoUrl = '';
						const maxRetries = 30;
						let attempts = 0;

						while ((status === 'processing' || status === 'pending') && attempts < maxRetries) {
							await new Promise((resolve) => setTimeout(resolve, 10000));
							attempts++;
							const checkResponse = await this.helpers.request({
								method: 'GET',
								url: `https://openrouter.ai/api/v1/video/generations/${jobId}`,
								headers: defaultHeaders,
								json: true,
							});
							status = checkResponse.status;
							if (status === 'completed' || status === 'succeeded') {
								videoUrl = checkResponse.video_url || checkResponse.data?.url;
								break;
							} else if (status === 'failed') {
								throw new Error(`Video generation failed: ${checkResponse.error?.message || 'Unknown error'}`);
							}
						}
						const videoBuffer = await this.helpers.request({
							method: 'GET',
							url: videoUrl,
							encoding: null,
						});
						const binaryData = await this.helpers.prepareBinaryData(videoBuffer, `video_${i}.mp4`, 'video/mp4');
						returnData.push({
							json: { jobId, prompt, status },
							binary: { data: binaryData },
							pairedItem: { item: i },
						});
					}
				}
				else if (operation === 'speechToText') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
					const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

					const base64Data = binaryDataBuffer.toString('base64');
					
					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/audio/transcriptions',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body: {
							model,
							file: `data:${binaryData.mimeType};base64,${base64Data}`,
						},
						json: true,
					});

					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				}
				else if (operation === 'textToSpeech') {
					const text = this.getNodeParameter('text', i) as string;
					const options = this.getNodeParameter('options', i) as any || {};
					
					const voice = options.voice || 'alloy';
					const speed = options.speed || 1;

					const audioBuffer = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/audio/speech',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body: {
							model,
							input: text,
							voice,
							speed,
						},
						encoding: null,
					});

					const binaryData = await this.helpers.prepareBinaryData(audioBuffer, `audio_${i}.mp3`, 'audio/mp3');

					returnData.push({
						json: { text, voice, speed },
						binary: { data: binaryData },
						pairedItem: { item: i },
					});
				}
			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error.message },
						pairedItem: { item: i },
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}
