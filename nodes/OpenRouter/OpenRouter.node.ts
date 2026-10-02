import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeListSearchResult,
	NodeOperationError,
} from 'n8n-workflow';

export function extractImageUrls(input: any): string[] {
	if (!input) return [];

	if (Array.isArray(input)) {
		return input
			.map((item) => extractImageUrls(item))
			.reduce((acc: string[], val: string[]) => acc.concat(val), [])
			.filter(Boolean);
	}

	if (typeof input !== 'string') {
		input = String(input);
	}

	// Remove brackets [], quotes '', "", and backticks ``
	const cleaned = input.replace(/[\[\]"'\`]/g, ' ');

	// Split by comma or newline
	return cleaned
		.split(/[\r\n,]+/)
		.map((u: string) => u.trim())
		.filter((u: string) => u.length > 0);
}

export function buildMediaContent(binaryData: any, binaryDataBuffer: Buffer, fileName?: string): any {
	const mimeType = (binaryData?.mimeType || '').toLowerCase();
	const ext = (binaryData?.fileExtension || '').toLowerCase();
	const base64Data = binaryDataBuffer.toString('base64');

	// 1. Audio files (audio/mpeg, audio/wav, audio/ogg, audio/mp4, audio/aac, audio/webm, etc.)
	if (
		mimeType.startsWith('audio/') ||
		['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'weba'].includes(ext)
	) {
		const format = mimeType.includes('wav') || ext === 'wav' ? 'wav' : 'mp3';
		return {
			type: 'input_audio',
			input_audio: {
				data: base64Data,
				format,
			},
		};
	}

	// 2. Text / Code / CSV / JSON files -> Inject directly as text content
	if (
		mimeType.startsWith('text/') ||
		mimeType === 'application/json' ||
		mimeType === 'text/csv' ||
		['txt', 'csv', 'md', 'markdown', 'json', 'xml', 'log', 'yaml', 'yml'].includes(ext)
	) {
		const textContent = binaryDataBuffer.toString('utf-8');
		const label = fileName ? `Document (${fileName})` : 'Document';
		return {
			type: 'text',
			text: `\n--- Attached ${label} ---\n${textContent}\n--- End ${label} ---\n`,
		};
	}

	// 3. PDF Documents -> Standard data URI
	if (mimeType === 'application/pdf' || ext === 'pdf') {
		return {
			type: 'image_url',
			image_url: {
				url: `data:application/pdf;base64,${base64Data}`,
			},
		};
	}

	// 4. Video files -> data URI for multimodal video models (e.g. Gemini)
	if (
		mimeType.startsWith('video/') ||
		['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
	) {
		const videoMime = mimeType || (ext === 'webm' ? 'video/webm' : 'video/mp4');
		return {
			type: 'image_url',
			image_url: {
				url: `data:${videoMime};base64,${base64Data}`,
			},
		};
	}

	// 5. Default: Image files (image/jpeg, image/png, image/webp, image/gif, etc.)
	const imageMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
	return {
		type: 'image_url',
		image_url: {
			url: `data:${imageMime};base64,${base64Data}`,
		},
	};
}

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
						name: 'Chat / Generate Text',
						value: 'message',
						description: 'Generate text using a language model',
						action: 'Generate text',
					},
					{
						name: 'Analyze Content (Multimodal & Documents)',
						value: 'analyze',
						description: 'Analyze text, documents (PDF), images, audio or video using a supported multimodal model',
						action: 'Analyze content',
					},
				],
				default: 'message',
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
				description: 'The text prompt or question to send to the model',
			},
			{
				displayName: 'Media Source',
				name: 'mediaSource',
				type: 'options',
				options: [
					{
						name: 'Binary Data',
						value: 'binary',
						description: 'Analyze binary file(s) from incoming items (Images, Audio, PDF, Video, Text)',
					},
					{
						name: 'Media / Image URLs',
						value: 'urls',
						description: 'Analyze media from a comma-separated list of URLs (Images, Audio)',
					},
					{
						name: 'Both (Binary & URLs)',
						value: 'both',
						description: 'Combine both binary files and media URLs',
					},
				],
				default: 'binary',
				description: 'Choose where the media content comes from',
				displayOptions: {
					show: {
						operation: ['analyze'],
					},
				},
			},
			{
				displayName: 'Include All Binaries',
				name: 'allBinaries',
				type: 'boolean',
				default: false,
				description: 'Whether to process all binary properties present in the input item',
				displayOptions: {
					show: {
						operation: ['analyze'],
						mediaSource: ['binary', 'both'],
					},
				},
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property (or comma-separated list of properties, e.g. data1, data2) containing the file(s) to process',
				displayOptions: {
					show: {
						operation: ['analyze'],
					},
					hide: {
						mediaSource: ['urls'],
						allBinaries: [true],
					},
				},
			},
			{
				displayName: 'Media / Image URLs',
				name: 'imageUrls',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				placeholder: 'https://example.com/image1.jpg, https://example.com/audio.mp3',
				description: 'Comma-separated list of media or image URLs. Automatically strips brackets, quotes, and extra whitespace.',
				displayOptions: {
					show: {
						operation: ['analyze'],
						mediaSource: ['urls', 'both'],
					},
				},
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				default: '',
				description: 'Optional system prompt to guide the model\'s behavior',
				displayOptions: {
					show: {
						operation: ['message'],
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
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 2,
							numberPrecision: 1,
						},
						default: 0.7,
						description: 'Controls randomness: Lower values make responses more deterministic, higher values make output more creative',
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 2048,
						description: 'The maximum number of tokens to generate in the completion',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 1,
						description: 'Controls diversity via nucleus sampling',
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

				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://openrouter.ai/api/v1/models?output_modalities=text',
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					json: true,
				});

				let models = response.data || [];

				// For analyze operation, filter models that support multimodal inputs (image, video, audio, files)
				if (operation === 'analyze') {
					models = models.filter((m: any) => {
						const mod = m.architecture?.modality || '';
						const inMod = m.architecture?.input_modalities || [];
						return (
							mod.includes('image') ||
							mod.includes('video') ||
							mod.includes('audio') ||
							mod.includes('multimodal') ||
							inMod.includes('image') ||
							inMod.includes('video') ||
							inMod.includes('audio') ||
							inMod.includes('file')
						);
					});
				}

				let results = models.map((m: any) => ({
					name: m.id.startsWith('~') ? m.id.substring(1) : m.id,
					value: m.id,
				}));

				results.sort((a: any, b: any) => a.name.localeCompare(b.name));

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
		const credentials = await this.getCredentials<{ apiKey: string, siteUrl?: string, appName?: string }>('openRouterCommunityApi');
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
				const options = (this.getNodeParameter('options', i, {}) as any) || {};

				if (operation === 'message') {
					const prompt = this.getNodeParameter('prompt', i) as string;
					const systemPrompt = this.getNodeParameter('systemPrompt', i, '') as string;
					
					const messages: any[] = [];
					if (systemPrompt) {
						messages.push({ role: 'system', content: systemPrompt });
					}
					messages.push({ role: 'user', content: prompt });

					const body: any = {
						model,
						messages,
					};
					if (options.temperature !== undefined) body.temperature = options.temperature;
					if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
					if (options.topP !== undefined) body.top_p = options.topP;

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/chat/completions',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body,
						json: true,
					});

					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				} else if (operation === 'analyze') {
					const prompt = this.getNodeParameter('prompt', i) as string;
					const mediaSource = this.getNodeParameter('mediaSource', i, 'binary') as string;
					const content: any[] = [{ type: 'text', text: prompt }];

					// Process Binary Data
					if (mediaSource === 'binary' || mediaSource === 'both') {
						const allBinaries = this.getNodeParameter('allBinaries', i, false) as boolean;
						const itemBinary = items[i].binary;

						if (allBinaries) {
							if (itemBinary) {
								for (const key of Object.keys(itemBinary)) {
									const binaryData = itemBinary[key];
									const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, key);
									content.push(buildMediaContent(binaryData, binaryDataBuffer, binaryData.fileName || key));
								}
							}
						} else {
							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
							const keys = binaryPropertyName.split(',').map((k) => k.trim()).filter(Boolean);
							for (const key of keys) {
								const binaryData = this.helpers.assertBinaryData(i, key);
								const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, key);
								content.push(buildMediaContent(binaryData, binaryDataBuffer, binaryData.fileName || key));
							}
						}
					}

					// Process Image / Media URLs
					if (mediaSource === 'urls' || mediaSource === 'both') {
						const rawImageUrls = this.getNodeParameter('imageUrls', i, '') as any;
						const urls = extractImageUrls(rawImageUrls);
						for (const url of urls) {
							// If URL clearly points to audio, convert to base64 input_audio since Chat Completions requires base64 for audio
							if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(url)) {
								try {
									const audioBuffer = await this.helpers.request({
										method: 'GET',
										url,
										encoding: null,
									});
									const format = /\.wav(\?.*)?$/i.test(url) ? 'wav' : 'mp3';
									content.push({
										type: 'input_audio',
										input_audio: {
											data: audioBuffer.toString('base64'),
											format,
										},
									});
									continue;
								} catch (_) {
									// Fallback to image_url
								}
							}
							content.push({
								type: 'image_url',
								image_url: { url },
							});
						}
					}

					if (content.length <= 1) {
						throw new NodeOperationError(
							this.getNode(),
							'No valid binary files or media URLs were found to analyze. Please provide at least one media or binary file.',
							{ itemIndex: i },
						);
					}

					const body: any = {
						model,
						messages: [
							{
								role: 'user',
								content,
							},
						],
					};
					if (options.temperature !== undefined) body.temperature = options.temperature;
					if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
					if (options.topP !== undefined) body.top_p = options.topP;

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://openrouter.ai/api/v1/chat/completions',
						headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
						body,
						json: true,
					});

					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, { itemIndex: i });
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
