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

export class OpenRouterImage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Image Generation',
		name: 'openRouterImage',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{typeof $parameter["model"] === "object" ? ($parameter["model"].value || "") : $parameter["model"]}}',
		description: 'Generate and edit images using OpenRouter unified Image API with full parameter control',
		defaults: {
			name: 'OpenRouter Image',
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
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Choose from the list of OpenRouter image generation models, or specify a custom model ID',
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
						placeholder: 'bytedance-seed/seedream-5-0-flash',
					},
				],
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				required: true,
				description: 'Text description of the desired image',
			},
			{
				displayName: 'Generation Mode',
				name: 'mode',
				type: 'options',
				options: [
					{
						name: 'Text to Image',
						value: 'textToImage',
						description: 'Generate brand new image from prompt',
					},
					{
						name: 'Image to Image / Reference (Edit & Style)',
						value: 'imageToImage',
						description: 'Guide generation or edit with reference image(s)',
					},
				],
				default: 'textToImage',
				description: 'Whether to create a new image from scratch or guide generation using reference images',
			},
			{
				displayName: 'Reference Image Source',
				name: 'referenceSource',
				type: 'options',
				options: [
					{
						name: 'Binary Data (From Incoming Item)',
						value: 'binary',
						description: 'Use binary image files from previous nodes',
					},
					{
						name: 'Image URL(s)',
						value: 'urls',
						description: 'Use public image URLs',
					},
					{
						name: 'Both (Binary & URLs)',
						value: 'both',
						description: 'Combine both binary files and image URLs',
					},
				],
				default: 'binary',
				description: 'Choose where the reference image(s) come from',
				displayOptions: {
					show: {
						mode: ['imageToImage'],
					},
				},
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description:
					'Name of the binary property (or comma-separated properties, e.g. data1, data2) containing reference image(s)',
				displayOptions: {
					show: {
						mode: ['imageToImage'],
						referenceSource: ['binary', 'both'],
					},
				},
			},
			{
				displayName: 'Reference Image URL(s)',
				name: 'referenceUrls',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				placeholder: 'https://example.com/ref1.png, https://example.com/ref2.png',
				description: 'Comma-separated URLs of reference images. Automatically sanitized.',
				displayOptions: {
					show: {
						mode: ['imageToImage'],
						referenceSource: ['urls', 'both'],
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
						displayName: 'Aspect Ratio',
						name: 'aspectRatio',
						type: 'options',
						options: [
							{ name: '1:1 (Square)', value: '1:1' },
							{ name: '16:9 (Landscape Wide)', value: '16:9' },
							{ name: '9:16 (Portrait Story / Reel)', value: '9:16' },
							{ name: '4:3 (Landscape Standard)', value: '4:3' },
							{ name: '3:4 (Portrait Standard)', value: '3:4' },
							{ name: '3:2 (Classic 35mm Photo)', value: '3:2' },
							{ name: '2:3 (Classic Portrait Photo)', value: '2:3' },
							{ name: '4:5 (Instagram Portrait)', value: '4:5' },
							{ name: '5:4 (Instagram Landscape)', value: '5:4' },
							{ name: '21:9 (Ultrawide Cinema)', value: '21:9' },
							{ name: '9:21 (Tall Ultrawide)', value: '9:21' },
							{ name: 'Auto', value: 'auto' },
						],
						default: '1:1',
						description: 'Normalized aspect ratio of the generated image. Providers clamp to their supported subset.',
					},
					{
						displayName: 'Background',
						name: 'background',
						type: 'options',
						options: [
							{ name: 'Auto', value: 'auto' },
							{ name: 'Transparent (No Background)', value: 'transparent' },
							{ name: 'Opaque (Solid Background)', value: 'opaque' },
						],
						default: 'auto',
						description:
							'Background treatment. Transparent requires an outputFormat supporting alpha (PNG or WebP).',
					},
					{
						displayName: 'Explicit Size (Pixels or Tier)',
						name: 'size',
						type: 'string',
						placeholder: '1024x1024 or 2K',
						default: '',
						description:
							'Shorthand for output dimensions. Pass explicit pixels (e.g. 1024x1024, 2048x2048) or tier (2K, 4K). Note: explicit pixel size takes precedence over resolution/aspect_ratio.',
					},
					{
						displayName: 'Number of Images (n)',
						name: 'numImages',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 10,
						},
						default: 1,
						description:
							'Upper bound on the number of images to generate (1-10). Providers that only support single image generation return 1 image.',
					},
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property in which to store the generated image',
					},
					{
						displayName: 'Output Compression',
						name: 'outputCompression',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 100,
						},
						default: 90,
						description:
							'Compression level (0-100) for WebP/JPEG output. Ignored for PNG and by providers without compression knobs.',
					},
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'options',
						options: [
							{ name: 'PNG (Lossless / Supports Transparency)', value: 'png' },
							{ name: 'JPEG (Compact / Photos)', value: 'jpeg' },
							{ name: 'WebP (Modern Web / Supports Transparency)', value: 'webp' },
							{ name: 'SVG (Vector - Supported by Quiver & Vector Models)', value: 'svg' },
						],
						default: 'png',
						description:
							'Encoding of the returned image bytes. Most models produce raster formats (PNG, JPEG, WebP). SVG is supported by vectorization models.',
					},
					{
						displayName: 'Quality',
						name: 'quality',
						type: 'options',
						options: [
							{ name: 'Auto', value: 'auto' },
							{ name: 'Low', value: 'low' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High', value: 'high' },
							{ name: 'Extra High (xhigh)', value: 'xhigh' },
							{ name: 'Maximum', value: 'max' },
						],
						default: 'auto',
						description: 'Rendering quality. Providers without a quality knob ignore this.',
					},
					{
						displayName: 'Resolution Tier',
						name: 'resolution',
						type: 'options',
						options: [
							{ name: '512 (Fast / Draft)', value: '512' },
							{ name: '768', value: '768' },
							{ name: '1K (Standard HD)', value: '1K' },
							{ name: '1.5K', value: '1.5K' },
							{ name: '2K (High Resolution)', value: '2K' },
							{ name: '4K (Ultra High Definition)', value: '4K' },
						],
						default: '1K',
						description:
							'Normalized resolution tier of the generated image. Concrete pixel dimensions are derived per-provider.',
					},
					{
						displayName: 'Seed',
						name: 'seed',
						type: 'number',
						typeOptions: {
							numberPrecision: 0,
						},
						default: 0,
						description:
							'Random seed for deterministic sampling. Repeated requests with the same seed and parameters should return the same result.',
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
				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://openrouter.ai/api/v1/models?output_modalities=image',
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
					results = results.filter((m: any) => m.name.toLowerCase().includes(f) || m.value.toLowerCase().includes(f));
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
			'X-Title': credentials.appName || 'n8n OpenRouter Image Node',
			'Content-Type': 'application/json',
		};

		for (let i = 0; i < items.length; i++) {
			try {
				let model = this.getNodeParameter('model', i) as any;
				if (model && typeof model === 'object' && model.value) {
					model = model.value;
				}
				model = model as string;

				const prompt = this.getNodeParameter('prompt', i) as string;
				const mode = this.getNodeParameter('mode', i, 'textToImage') as string;
				const options = (this.getNodeParameter('options', i, {}) as any) || {};

				const body: any = {
					model,
					prompt,
				};

				// Handle Image-to-Image / input references
				if (mode === 'imageToImage') {
					const referenceSource = this.getNodeParameter('referenceSource', i, 'binary') as string;
					const inputReferences: Array<{ type: 'image_url'; image_url: { url: string } }> = [];

					if (referenceSource === 'binary' || referenceSource === 'both') {
						const binaryPropNames = (this.getNodeParameter('binaryPropertyName', i, 'data') as string)
							.split(',')
							.map((p) => p.trim())
							.filter(Boolean);

						for (const propName of binaryPropNames) {
							const binaryData = this.helpers.assertBinaryData(i, propName);
							const binaryBuffer = await this.helpers.getBinaryDataBuffer(i, propName);
							const mimeType = binaryData.mimeType || 'image/png';
							const base64 = binaryBuffer.toString('base64');
							inputReferences.push({
								type: 'image_url',
								image_url: {
									url: `data:${mimeType};base64,${base64}`,
								},
							});
						}
					}

					if (referenceSource === 'urls' || referenceSource === 'both') {
						const rawUrls = this.getNodeParameter('referenceUrls', i, '') as string;
						const urlList = rawUrls
							.split(',')
							.map((u) => sanitizeUrl(u))
							.filter(Boolean);

						for (const u of urlList) {
							inputReferences.push({
								type: 'image_url',
								image_url: {
									url: u,
								},
							});
						}
					}

					if (inputReferences.length > 0) {
						body.input_references = inputReferences;
					}
				}

				// Map optional parameters
				if (options.aspectRatio && options.aspectRatio !== 'auto') {
					body.aspect_ratio = options.aspectRatio;
				}
				if (options.resolution) {
					body.resolution = options.resolution;
				}
				if (options.size && typeof options.size === 'string' && options.size.trim()) {
					body.size = options.size.trim();
				}
				if (options.background && options.background !== 'auto') {
					body.background = options.background;
				}
				if (options.outputFormat) {
					body.output_format = options.outputFormat;
				}
				if (options.quality && options.quality !== 'auto') {
					body.quality = options.quality;
				}
				if (options.seed !== undefined && options.seed !== 0) {
					body.seed = options.seed;
				}
				if (options.numImages && options.numImages > 1) {
					body.n = options.numImages;
				}
				if (options.outputCompression !== undefined && options.outputCompression !== 90) {
					body.output_compression = options.outputCompression;
				}

				// Execute request to OpenRouter Image API
				const response = await this.helpers.request({
					method: 'POST',
					url: 'https://openrouter.ai/api/v1/images',
					headers: defaultHeaders,
					body,
					json: true,
				});

				const outBinaryProperty = options.outputBinaryPropertyName || 'data';
				const simplify = options.simplify !== false;
				const images = response.data || [];

				if (!images.length) {
					throw new Error('OpenRouter Image API returned an empty image list');
				}

				for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
					const imgObj = images[imgIdx];
					let mimeType = imgObj.media_type || (options.outputFormat ? `image/${options.outputFormat}` : 'image/png');
					if (options.outputFormat === 'svg' || mimeType.includes('svg')) {
						mimeType = 'image/svg+xml';
					}

					let ext = 'png';
					if (mimeType.includes('jpeg')) ext = 'jpg';
					else if (mimeType.includes('webp')) ext = 'webp';
					else if (mimeType.includes('svg')) ext = 'svg';

					let imageBuffer: Buffer;
					const base64Data = imgObj.b64_json;
					const remoteUrl = imgObj.url;

					if (base64Data) {
						imageBuffer = Buffer.from(base64Data, 'base64');
					} else if (remoteUrl && remoteUrl.startsWith('http')) {
						imageBuffer = (await this.helpers.request({
							method: 'GET',
							url: remoteUrl,
							encoding: null,
						})) as Buffer;
					} else {
						throw new Error(`Invalid image payload returned at index ${imgIdx}`);
					}

					const fileName = `generated_image_${i}_${imgIdx}.${ext}`;
					const binaryData = await this.helpers.prepareBinaryData(imageBuffer, fileName, mimeType);

					let jsonPayload: any;
					if (simplify) {
						jsonPayload = {
							prompt,
							model,
							imageIndex: imgIdx,
							totalImages: images.length,
							format: ext,
							mimeType,
							created: response.created,
							usage: response.usage || {},
							cost: response.usage?.cost,
						};
						if (options.seed !== undefined && options.seed !== 0) jsonPayload.seed = options.seed;
						if (options.aspectRatio) jsonPayload.aspectRatio = options.aspectRatio;
						if (options.resolution) jsonPayload.resolution = options.resolution;
						if (options.background && options.background !== 'auto') jsonPayload.background = options.background;
					} else {
						jsonPayload = {
							...response,
							imageIndex: imgIdx,
							currentImage: {
								media_type: mimeType,
								url: remoteUrl,
							},
						};
					}

					const executionItem: INodeExecutionData = {
						json: jsonPayload,
						binary: {
							[outBinaryProperty]: binaryData,
						},
						pairedItem: { item: i },
					};

					returnData.push(executionItem);
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
