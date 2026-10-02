import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
} from 'n8n-workflow';

const VIDEO_API_BASE = 'https://openrouter.ai/api/v1';
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 150; // ~10 minutes max

function sanitizeUrl(rawUrl: string): string {
	return rawUrl
		.trim()
		.replace(/^[<"'\(\[]+|[>"'\)\]]+$/g, '')
		.replace(/["']/g, '')
		.trim();
}

export class OpenRouterVideo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Video Studio',
		name: 'openRouterVideo',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{typeof $parameter["model"] === "object" ? ($parameter["model"].value || "") : $parameter["model"]}}',
		description:
			'Generate videos from text prompts or images using OpenRouter Video models (Wan, Veo, Kling, Hailuo, Seedance, and more). Supports Image-to-Video, resolution, duration, aspect ratio, and audio generation.',
		defaults: {
			name: 'OpenRouter Video',
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
			// ─── Model ───────────────────────────────────────────────────────
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description:
					'Choose an OpenRouter video generation model from the list, or enter a custom model ID',
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
						placeholder: 'wan-ai/wan2.1-t2v-turbo',
					},
				],
			},

			// ─── Prompt ───────────────────────────────────────────────────────
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				description: 'Text description of the video to generate',
				placeholder:
					'A serene mountain landscape at golden hour, cinematic, 4K, smooth camera pan',
			},

			// ─── Image-to-Video ───────────────────────────────────────────────
			{
				displayName: 'Image-to-Video (Frame Reference)',
				name: 'enableImageToVideo',
				type: 'boolean',
				default: false,
				description:
					'Whether to use one or more image references as starting/ending frames for the generated video',
			},
			{
				displayName: 'Frame Images',
				name: 'frameImages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				placeholder: 'Add Frame Image',
				default: { frames: [] },
				description:
					'Reference images used as frame anchors (e.g., first frame, last frame). Order matters.',
				displayOptions: {
					show: {
						enableImageToVideo: [true],
					},
				},
				options: [
					{
						displayName: 'Frame',
						name: 'frames',
						values: [
							{
								displayName: 'Image Source',
								name: 'imageSource',
								type: 'options',
								options: [
									{
										name: 'Binary Data (From Incoming Item)',
										value: 'binary',
										description: 'Use an image file from previous nodes',
									},
									{
										name: 'Image URL',
										value: 'url',
										description: 'Provide a direct public image URL',
									},
								],
								default: 'url',
								description: 'Where the frame image comes from',
							},
							{
								displayName: 'Binary Property Name',
								name: 'binaryPropertyName',
								type: 'string',
								default: 'data',
								description: 'Name of the binary property containing the frame image',
								displayOptions: {
									show: {
										imageSource: ['binary'],
									},
								},
							},
							{
								displayName: 'Image URL',
								name: 'imageUrl',
								type: 'string',
								default: '',
								placeholder: 'https://example.com/frame.jpg',
								description: 'Direct public URL to the frame image',
								displayOptions: {
									show: {
										imageSource: ['url'],
									},
								},
							},
							{
								displayName: 'Frame Role',
								name: 'frameRole',
								type: 'options',
								options: [
									{
										name: 'First Frame (Start)',
										value: 'first',
										description: 'Use this image as the opening frame of the video',
									},
									{
										name: 'Last Frame (End)',
										value: 'last',
										description: 'Use this image as the final frame of the video',
									},
									{
										name: 'Reference (Style/Subject)',
										value: 'reference',
										description: 'Use this image as a visual reference only',
									},
								],
								default: 'first',
								description: 'How this image is used in the video generation',
							},
						],
					},
				],
			},

			// ─── Video Options (Collection) ───────────────────────────────────
			{
				displayName: 'Video Options',
				name: 'videoOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Aspect Ratio',
						name: 'aspectRatio',
						type: 'options',
						options: [
							{ name: '16:9 (Landscape / YouTube)', value: '16:9' },
							{ name: '9:16 (Portrait / Reels & TikTok)', value: '9:16' },
							{ name: '1:1 (Square)', value: '1:1' },
							{ name: '4:3 (Classic TV)', value: '4:3' },
							{ name: '3:4 (Portrait Photo)', value: '3:4' },
							{ name: '21:9 (Cinematic Ultrawide)', value: '21:9' },
						],
						default: '16:9',
						description: 'Video aspect ratio (not all models support all ratios)',
					},
					{
						displayName: 'Resolution',
						name: 'resolution',
						type: 'options',
						options: [
							{ name: '480p', value: '480p' },
							{ name: '720p (HD)', value: '720p' },
							{ name: '1080p (Full HD)', value: '1080p' },
							{ name: '4K (Ultra HD)', value: '4k' },
						],
						default: '720p',
						description: 'Output video resolution (model-dependent)',
					},
					{
						displayName: 'Duration (Seconds)',
						name: 'duration',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 60,
							numberPrecision: 0,
						},
						default: 5,
						description: 'Desired video length in seconds (1–60, model-dependent)',
					},
					{
						displayName: 'Generate Audio',
						name: 'generateAudio',
						type: 'boolean',
						default: false,
						description:
							'Whether to generate ambient audio or sound effects alongside the video (model-dependent)',
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
							'Fixed seed for reproducible results. Use 0 to let the model choose randomly.',
					},
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property in which to store the downloaded video',
					},
					{
						displayName: 'Download Video',
						name: 'downloadVideo',
						type: 'boolean',
						default: true,
						description:
							'Whether to download the generated video as binary data. When false, only the video URL is returned.',
					},
					{
						displayName: 'Poll Timeout (Seconds)',
						name: 'pollTimeoutSecs',
						type: 'number',
						typeOptions: {
							minValue: 30,
							maxValue: 600,
							numberPrecision: 0,
						},
						default: 300,
						description: 'Maximum time to wait for video generation to complete (30–600 seconds)',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			async searchModels(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('openRouterCommunityApi');

				const response = await this.helpers.request({
					method: 'GET',
					url: `${VIDEO_API_BASE}/models?output_modalities=video`,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					json: true,
				});

				const models = response.data || [];
				let results = models.map((m: any) => ({
					name: m.id.startsWith('~') ? m.id.substring(1) : m.id,
					value: m.id,
					description: m.description || '',
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
		const credentials = await this.getCredentials<{
			apiKey: string;
			siteUrl?: string;
			appName?: string;
		}>('openRouterCommunityApi');

		const defaultHeaders = {
			Authorization: `Bearer ${credentials.apiKey}`,
			'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
			'X-Title': credentials.appName || 'n8n OpenRouter Video Studio',
			'Content-Type': 'application/json',
		};

		for (let i = 0; i < items.length; i++) {
			try {
				// ─── Resolve model ─────────────────────────────────────────
				let model = this.getNodeParameter('model', i) as any;
				if (model && typeof model === 'object' && model.value) {
					model = model.value;
				}
				model = model as string;

				const prompt = this.getNodeParameter('prompt', i) as string;
				const enableImageToVideo = this.getNodeParameter('enableImageToVideo', i, false) as boolean;
				const videoOptions = (this.getNodeParameter('videoOptions', i, {}) as any) || {};

				// ─── Build request body ────────────────────────────────────
				const body: any = {
					model,
					prompt,
				};

				// Optional params
				if (videoOptions.aspectRatio) body.aspect_ratio = videoOptions.aspectRatio;
				if (videoOptions.resolution) body.resolution = videoOptions.resolution;
				if (videoOptions.duration) body.duration = videoOptions.duration;
				if (videoOptions.generateAudio === true) body.generate_audio = true;
				if (videoOptions.seed && videoOptions.seed !== 0) body.seed = videoOptions.seed;

				// ─── Frame images (Image-to-Video) ─────────────────────────
				if (enableImageToVideo) {
					const frameImagesParam = this.getNodeParameter('frameImages', i, {
						frames: [],
					}) as any;
					const frames: any[] = frameImagesParam?.frames || [];

					if (frames.length > 0) {
						const frameRefs: any[] = [];

						for (const frame of frames) {
							let imageData: string | null = null;
							let imageUrl: string | null = null;

							if (frame.imageSource === 'binary') {
								const binaryProp = frame.binaryPropertyName || 'data';
								const binaryMeta = this.helpers.assertBinaryData(i, binaryProp);
								const binaryBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProp);
								const mimeType = binaryMeta.mimeType || 'image/jpeg';
								imageData = `data:${mimeType};base64,${binaryBuffer.toString('base64')}`;
							} else {
								const rawUrl = frame.imageUrl || '';
								imageUrl = sanitizeUrl(rawUrl);
							}

							const ref: any = {
								type: 'image_url',
								role: frame.frameRole || 'first',
							};

							if (imageData) {
								ref.image_url = { url: imageData };
							} else if (imageUrl) {
								ref.image_url = { url: imageUrl };
							}

							frameRefs.push(ref);
						}

						if (frameRefs.length > 0) {
							body.frame_images = frameRefs;
						}
					}
				}

				// ─── Submit video generation job ──────────────────────────
				const submitResponse = await this.helpers.request({
					method: 'POST',
					url: `${VIDEO_API_BASE}/videos`,
					headers: defaultHeaders,
					body,
					json: true,
				});

				const jobId: string = submitResponse?.id || submitResponse?.jobId;
				if (!jobId) {
					throw new Error(
						`Video API did not return a job ID. Response: ${JSON.stringify(submitResponse)}`,
					);
				}

				// ─── Poll for completion ───────────────────────────────────
				const maxWaitMs = (videoOptions.pollTimeoutSecs || 300) * 1000;
				const startTime = Date.now();
				let pollResult: any = null;
				let attempts = 0;

				while (attempts < MAX_POLL_ATTEMPTS) {
					if (Date.now() - startTime > maxWaitMs) {
						throw new Error(
							`Video generation timed out after ${videoOptions.pollTimeoutSecs || 300}s. Job ID: ${jobId}. You can check the status later.`,
						);
					}

					await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
					attempts++;

					const statusResponse = await this.helpers.request({
						method: 'GET',
						url: `${VIDEO_API_BASE}/videos/${jobId}`,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
							'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
							'X-Title': credentials.appName || 'n8n OpenRouter Video Studio',
						},
						json: true,
					});

					const status: string = (statusResponse?.status || '').toLowerCase();

					if (status === 'completed' || status === 'succeeded' || status === 'success') {
						pollResult = statusResponse;
						break;
					} else if (status === 'failed' || status === 'error') {
						throw new Error(
							`Video generation failed. Job ID: ${jobId}. Error: ${statusResponse?.error || JSON.stringify(statusResponse)}`,
						);
					}
					// else: 'pending', 'processing', 'queued' → continue polling
				}

				if (!pollResult) {
					throw new Error(
						`Video generation polling exhausted ${MAX_POLL_ATTEMPTS} attempts. Job ID: ${jobId}`,
					);
				}

				// ─── Extract video URL ─────────────────────────────────────
				const videoUrl: string =
					pollResult.url ||
					pollResult.video_url ||
					pollResult?.data?.[0]?.url ||
					pollResult?.output?.url ||
					'';

				// ─── Optionally download video as binary ───────────────────
				const shouldDownload = videoOptions.downloadVideo !== false;
				const outBinaryProp = videoOptions.outputBinaryPropertyName || 'data';

				const jsonResult: any = {
					jobId,
					model,
					prompt,
					videoUrl,
					status: pollResult.status,
					duration: pollResult.duration || videoOptions.duration,
					aspectRatio: pollResult.aspect_ratio || videoOptions.aspectRatio,
					resolution: pollResult.resolution || videoOptions.resolution,
					hasAudio: pollResult.has_audio ?? videoOptions.generateAudio,
					seed: pollResult.seed || videoOptions.seed,
					pollAttempts: attempts,
					usage: pollResult.usage,
				};

				if (shouldDownload && videoUrl) {
					const videoBuffer = (await this.helpers.request({
						method: 'GET',
						url: videoUrl,
						encoding: null,
					})) as Buffer;

					const ext = videoUrl.includes('.mp4')
						? 'mp4'
						: videoUrl.includes('.webm')
							? 'webm'
							: 'mp4';
					const mimeType = ext === 'webm' ? 'video/webm' : 'video/mp4';
					const fileName = `video_${jobId}.${ext}`;
					const binaryData = await this.helpers.prepareBinaryData(
						videoBuffer,
						fileName,
						mimeType,
					);

					returnData.push({
						json: jsonResult,
						binary: {
							[outBinaryProp]: binaryData,
						},
						pairedItem: { item: i },
					});
				} else {
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
