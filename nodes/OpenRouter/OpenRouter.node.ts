import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
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
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
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
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
			},
			{
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'string',
				default: '16:9',
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'duration',
				type: 'number',
				default: 5,
				displayOptions: {
					show: {
						operation: ['generateVideo'],
					},
				},
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'string',
				default: 'alloy',
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
			},
			{
				displayName: 'Speed',
				name: 'speed',
				type: 'number',
				default: 1,
				displayOptions: {
					show: {
						operation: ['textToSpeech'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('openRouterApi');
				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://openrouter.ai/api/v1/models',
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					json: true,
				});
				return response.data.map((m: any) => ({
					name: m.name || m.id,
					value: m.id,
				}));
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
				const model = this.getNodeParameter('model', i) as string;

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
				else if (operation === 'generateImage') {
					const prompt = this.getNodeParameter('prompt', i) as string;
					const resolution = this.getNodeParameter('resolution', i) as string;
					const aspectRatio = this.getNodeParameter('aspectRatio', i) as string;

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/images/generations',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body: {
							model,
							prompt,
							resolution,
							aspect_ratio: aspectRatio,
						},
						json: true,
					});

					const base64Data = response.data[0].b64_json || response.data[0].url;
					let binary;
					
					if (base64Data && base64Data.startsWith('http')) {
						// It returned a URL instead of b64_json
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
				}
				else if (operation === 'generateVideo') {
					const prompt = this.getNodeParameter('prompt', i) as string;
					const duration = this.getNodeParameter('duration', i) as number;

					const initResponse = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/video/generations',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body: { model, prompt, duration },
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

					if (!videoUrl) {
						throw new Error('Video generation timed out.');
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
					const voice = this.getNodeParameter('voice', i) as string;
					const speed = this.getNodeParameter('speed', i) as number;

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
