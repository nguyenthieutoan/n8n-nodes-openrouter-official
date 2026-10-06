import type { ChatOpenAI as ChatOpenAIType, ClientOptions } from '@langchain/openai';
import * as path from 'path';
import {
	NodeConnectionTypes,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

interface CacheConfig {
	enabled: boolean;
	ttl: 'default' | '1h';
	breakpoints: 'system' | 'system_and_last_user';
}

export interface ProviderRoutingConfig {
	endpoint?: string;
	only?: string[];
	order?: string[];
	ignore?: string[];
	allow_fallbacks?: boolean;
	service_tier?: string;
	sort?: string;
	data_collection?: 'allow' | 'deny';
}

interface ContentBlock {
	type: string;
	text: string;
	cache_control?: { type: string; ttl?: string };
}

interface ChatMessage {
	role: string;
	content: string | ContentBlock[];
}

interface ChatRequestBody {
	model?: string;
	messages?: ChatMessage[];
	provider?: Record<string, unknown>;
	service_tier?: string;
	[key: string]: unknown;
}

interface OpenAIToolCall {
	function?: { arguments?: unknown };
}

interface OpenAIChoice {
	message?: { tool_calls?: OpenAIToolCall[] };
}

function isOpenAIResponseWithChoices(json: unknown): json is { choices: OpenAIChoice[] } {
	return (
		typeof json === 'object' &&
		json !== null &&
		'choices' in json &&
		Array.isArray((json as { choices: unknown }).choices)
	);
}

export function injectCacheControl(body: ChatRequestBody, config: CacheConfig): ChatRequestBody {
	if (!config.enabled) return body;

	const messages = body.messages;
	if (!Array.isArray(messages)) return body;

	const cacheMarker: ContentBlock['cache_control'] = { type: 'ephemeral' };
	if (config.ttl === '1h') {
		cacheMarker.ttl = '1h';
	}

	for (const msg of messages) {
		if (msg.role === 'system' && typeof msg.content === 'string') {
			msg.content = [
				{
					type: 'text',
					text: msg.content,
					cache_control: cacheMarker,
				},
			];
		}
	}

	if (config.breakpoints === 'system_and_last_user') {
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role === 'user' && typeof msg.content === 'string') {
				msg.content = [
					{
						type: 'text',
						text: msg.content,
						cache_control: { type: 'ephemeral' },
					},
				];
				break;
			}
		}
	}

	return body;
}

export function injectProviderRouting(
	body: ChatRequestBody,
	routing?: ProviderRoutingConfig,
): ChatRequestBody {
	if (!routing) return body;

	const provider: Record<string, unknown> =
		typeof body.provider === 'object' && body.provider !== null
			? { ...(body.provider as Record<string, unknown>) }
			: {};

	const onlyList: string[] = Array.isArray(provider.only) ? [...(provider.only as string[])] : [];

	if (routing.endpoint && routing.endpoint.trim()) {
		const ep = routing.endpoint.trim();
		if (!onlyList.includes(ep)) {
			onlyList.push(ep);
		}
	}

	if (Array.isArray(routing.only)) {
		for (const o of routing.only) {
			const clean = typeof o === 'string' ? o.trim() : '';
			if (clean && !onlyList.includes(clean)) {
				onlyList.push(clean);
			}
		}
	}

	if (onlyList.length > 0) {
		provider.only = onlyList;
	}

	if (Array.isArray(routing.order) && routing.order.length > 0) {
		provider.order = routing.order;
	}

	if (Array.isArray(routing.ignore) && routing.ignore.length > 0) {
		provider.ignore = routing.ignore;
	}

	if (routing.allow_fallbacks !== undefined) {
		provider.allow_fallbacks = routing.allow_fallbacks;
	}

	if (routing.sort && routing.sort !== 'default') {
		provider.sort = routing.sort;
	}

	if (routing.data_collection && (routing.data_collection === 'allow' || routing.data_collection === 'deny')) {
		provider.data_collection = routing.data_collection;
	}

	if (Object.keys(provider).length > 0) {
		body.provider = provider;
	}

	if (routing.service_tier && routing.service_tier !== 'auto') {
		body.service_tier = routing.service_tier;
	}

	return body;
}

export function fixEmptyToolCallArguments(json: unknown): boolean {
	if (!isOpenAIResponseWithChoices(json)) return false;

	const isInvalidArgs = (args: unknown): boolean => typeof args !== 'string' || !args.trim();

	const toolCallsToFix = json.choices
		.flatMap((choice) => choice.message?.tool_calls ?? [])
		.filter((tc) => tc.function && isInvalidArgs(tc.function.arguments));

	if (toolCallsToFix.length === 0) return false;

	for (const tc of toolCallsToFix) {
		if (!tc.function) continue;
		const { arguments: args } = tc.function;
		const isPlainObject = typeof args === 'object' && args !== null && !Array.isArray(args);
		tc.function.arguments = isPlainObject ? JSON.stringify(args) : '{}';
	}

	return true;
}

export function createCachingOpenRouterFetch(
	baseFetch: typeof globalThis.fetch,
	cacheConfig: CacheConfig,
	routingConfig?: ProviderRoutingConfig,
): typeof globalThis.fetch {
	return async (input, init) => {
		let modifiedInit = init;

		if (init?.body && typeof init.body === 'string') {
			try {
				let body = JSON.parse(init.body) as ChatRequestBody;
				if (cacheConfig.enabled) {
					body = injectCacheControl(body, cacheConfig);
				}
				if (routingConfig) {
					body = injectProviderRouting(body, routingConfig);
				}
				modifiedInit = { ...init, body: JSON.stringify(body) };
			} catch {
				// Parse failed — pass through unchanged
			}
		}

		const response = await baseFetch(input, modifiedInit);

		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('json')) return response;

		const clone = response.clone();
		let json: unknown;
		try {
			json = await response.json();
		} catch {
			return clone;
		}

		if (!fixEmptyToolCallArguments(json)) return clone;

		const fixedBody = JSON.stringify(json);
		return new Response(fixedBody, {
			status: response.status,
			statusText: response.statusText,
			headers: { 'content-type': contentType },
		});
	};
}

export class OpenRouterCacheChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Cache Chat Model',
		name: 'lmChatOpenRouterCache',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: [1],
		description:
			'OpenRouter Chat Model with prompt caching support for reduced costs and latency',
		defaults: {
			name: 'OpenRouter Cache Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://openrouter.ai/docs/guides/best-practices/prompt-caching',
					},
				],
			},
		},

		inputs: [],

		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'openRouterCommunityApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: 'https://openrouter.ai/api/v1',
		},
		properties: [
			{
				displayName:
					'If using JSON response format, you must include word "json" in the prompt in your chain or agent. Also, make sure to select latest models released post November 2023.',
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						'/options.responseFormat': ['json_object'],
					},
				},
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				description:
					'The model which will generate the completion. <a href="https://openrouter.ai/docs/models">Learn more</a>.',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/models?output_modalities=text',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data',
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{$responseItem.id}}',
											value: '={{$responseItem.id}}',
										},
									},
									{
										type: 'sort',
										properties: {
											key: 'name',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				default: 'anthropic/claude-sonnet-4-20250514',
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Enable Prompt Caching',
						name: 'enablePromptCaching',
						type: 'boolean',
						default: true,
						description:
							'Whether to enable prompt caching to reduce costs and latency for repeated system prompts. Works with Anthropic and Gemini models via OpenRouter. <a href="https://openrouter.ai/docs/guides/best-practices/prompt-caching">Learn more</a>.',
					},
					{
						displayName: 'Cache TTL',
						name: 'cacheTtl',
						type: 'options',
						default: 'default',
						description: 'How long cached prompts are retained',
						options: [
							{
								name: '5 Minutes (Default)',
								value: 'default',
								description: 'Standard ephemeral cache. No extra write cost.',
							},
							{
								name: '1 Hour',
								value: '1h',
								description:
									'Extended cache for long-running sessions. 2x write cost on Anthropic. Not supported on Gemini (fixed ~3-5min TTL).',
							},
						],
					},
					{
						displayName: 'Cache Breakpoints',
						name: 'cacheBreakpoints',
						type: 'options',
						default: 'system',
						description: 'Which messages to mark for caching',
						options: [
							{
								name: 'System Message Only',
								value: 'system',
								description:
									'Cache the system prompt. Best for AI Agent workflows with stable instructions.',
							},
							{
								name: 'System + Last User Message',
								value: 'system_and_last_user',
								description:
									'Also cache the last user message. Useful for multi-turn conversations with long context.',
							},
						],
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 32,768).',
						type: 'number',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						default: 'text',
						type: 'options',
						options: [
							{
								name: 'Text',
								value: 'text',
								description: 'Regular text response',
							},
							{
								name: 'JSON',
								value: 'json_object',
								description:
									'Enables JSON mode, which should guarantee the message the model generates is valid JSON',
							},
						],
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 360000,
						description:
							'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
						type: 'number',
					},
					{
						displayName: 'Provider / Endpoint',
						name: 'providerEndpoint',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getProviders',
							loadOptionsDependsOn: ['model'],
						},
						default: '',
						description:
							'Route requests to a specific provider endpoint for this model. <a href="https://openrouter.ai/docs/features/provider-routing">Learn more</a>.',
					},
					{
						displayName: 'Allow Fallbacks',
						name: 'allowFallbacks',
						type: 'boolean',
						default: true,
						description:
							'Whether to allow fallback to other providers if the selected provider is unavailable or rate-limited. Set to false to pin strictly.',
					},
					{
						displayName: 'Service Tier',
						name: 'serviceTier',
						type: 'options',
						default: 'auto',
						description:
							'Select an inference service tier. Flex tier offers significant cost savings.',
						options: [
							{
								name: 'Auto (Default)',
								value: 'auto',
								description: 'Standard routing without forcing a service tier',
							},
							{
								name: 'Flex',
								value: 'flex',
								description:
									'Route to flex pricing endpoints (e.g. Google AI Studio Flex) for lowest costs',
							},
							{
								name: 'Priority',
								value: 'priority',
								description:
									'Route to priority endpoints for higher throughput and reduced queueing',
							},
						],
					},
					{
						displayName: 'Provider Sort',
						name: 'providerSort',
						type: 'options',
						default: 'default',
						description: 'How to sort providers dynamically when routing',
						options: [
							{
								name: 'Default',
								value: 'default',
								description: 'Use OpenRouter default sorting',
							},
							{
								name: 'Price (Lowest First)',
								value: 'price',
								description: 'Sort providers by lowest price first',
							},
							{
								name: 'Throughput (Fastest First)',
								value: 'throughput',
								description: 'Sort providers by highest token throughput',
							},
							{
								name: 'Latency (Lowest TTFT)',
								value: 'latency',
								description: 'Sort providers by lowest time-to-first-token',
							},
						],
					},
					{
						displayName: 'Data Collection Policy',
						name: 'dataCollection',
						type: 'options',
						default: 'default',
						description: 'Whether to allow or deny providers that may retain or train on data',
						options: [
							{
								name: 'Default',
								value: 'default',
								description: 'Allow according to OpenRouter account settings',
							},
							{
								name: 'Deny (Zero Data Retention)',
								value: 'deny',
								description: 'Only route to providers with zero data retention policies',
							},
							{
								name: 'Allow',
								value: 'allow',
								description: 'Allow providers regardless of retention policy',
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getProviders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = (await this.getCredentials('openRouterCommunityApi')) as {
					apiKey: string;
					siteUrl?: string;
					appName?: string;
				};

				let model = '';
				try {
					model = this.getNodeParameter('model', 0) as string;
				} catch {
					try {
						model = this.getCurrentNodeParameter('model') as string;
					} catch {}
				}

				if (typeof model === 'object' && model !== null && 'value' in model) {
					model = (model as { value: string }).value;
				}
				model = String(model || '').trim();

				if (!model) {
					return [
						{
							name: 'Default / Auto (Select a model above first)',
							value: '',
							description: 'OpenRouter will route requests automatically',
						},
					];
				}

				const cleanModel = model.startsWith('~') ? model.substring(1) : model;
				const url = `https://openrouter.ai/api/v1/models/${cleanModel}/endpoints`;

				try {
					const headers: Record<string, string> = {
						'HTTP-Referer': credentials?.siteUrl || 'https://n8n.io',
						'X-Title': credentials?.appName || 'n8n OpenRouter Node',
					};
					if (credentials?.apiKey) {
						headers.Authorization = `Bearer ${credentials.apiKey}`;
					}

					const response = await this.helpers.request({
						method: 'GET',
						url,
						headers,
						json: true,
					});

					const endpoints = response?.data?.endpoints || [];
					if (!Array.isArray(endpoints) || endpoints.length === 0) {
						return [
							{
								name: 'Default / Auto (OpenRouter automatic routing)',
								value: '',
								description:
									'OpenRouter routes automatically to the best provider for this model',
							},
						];
					}

					const options: INodePropertyOptions[] = [
						{
							name: 'Default / Auto (OpenRouter automatic routing)',
							value: '',
							description: 'Allow OpenRouter to select the best provider automatically',
						},
					];

					for (const ep of endpoints) {
						const tag = ep.tag || '';
						if (!tag) continue;
						const providerName = ep.provider_name || 'Unknown Provider';
						const quant =
							ep.quantization && ep.quantization !== 'unknown' ? ` [${ep.quantization}]` : '';

						const promptPerM = ep.pricing?.prompt
							? (parseFloat(ep.pricing.prompt) * 1_000_000).toFixed(2)
							: '';
						const compPerM = ep.pricing?.completion
							? (parseFloat(ep.pricing.completion) * 1_000_000).toFixed(2)
							: '';
						const pricingStr =
							promptPerM && compPerM ? ` ($${promptPerM} / $${compPerM} per 1M tokens)` : '';

						let label = `${providerName}: ${tag}${quant}${pricingStr}`;
						if (tag.includes('/flex') && !label.includes('Flex')) {
							label = `${providerName} (Flex): ${tag}${quant}${pricingStr}`;
						} else if (tag.includes('/priority') && !label.includes('Priority')) {
							label = `${providerName} (Priority): ${tag}${quant}${pricingStr}`;
						}

						const uptime =
							ep.uptime_last_1d !== null && ep.uptime_last_1d !== undefined
								? ` | 24h Uptime: ${Number(ep.uptime_last_1d).toFixed(1)}%`
								: '';
						const contextLen = ep.context_length
							? ` | Context: ${ep.context_length.toLocaleString()}`
							: '';

						options.push({
							name: label,
							value: tag,
							description: `Provider: ${providerName} | Tag: ${tag}${contextLen}${uptime}`,
						});
					}

					return options;
				} catch (error) {
					return [
						{
							name: 'Default / Auto (OpenRouter automatic routing)',
							value: '',
							description: 'OpenRouter will route requests automatically',
						},
					];
				}
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = (await this.getCredentials('openRouterCommunityApi')) as {
			apiKey: string;
			siteUrl?: string;
			appName?: string;
		};

		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			enablePromptCaching?: boolean;
			cacheTtl?: 'default' | '1h';
			cacheBreakpoints?: 'system' | 'system_and_last_user';
			frequencyPenalty?: number;
			maxTokens?: number;
			maxRetries: number;
			timeout: number;
			presencePenalty?: number;
			temperature?: number;
			topP?: number;
			responseFormat?: 'text' | 'json_object';
			providerEndpoint?: string;
			allowFallbacks?: boolean;
			serviceTier?: string;
			customProvidersOnly?: string;
			customProviderOrder?: string;
			customProvidersIgnore?: string;
			providerSort?: string;
			dataCollection?: 'allow' | 'deny' | 'default';
		};

		const cacheConfig: CacheConfig = {
			enabled: options.enablePromptCaching !== false,
			ttl: options.cacheTtl ?? 'default',
			breakpoints: options.cacheBreakpoints ?? 'system',
		};

		const routingConfig: ProviderRoutingConfig = {};
		if (options.providerEndpoint && options.providerEndpoint.trim()) {
			routingConfig.endpoint = options.providerEndpoint.trim();
		}
		if (options.customProvidersOnly) {
			const only = options.customProvidersOnly.split(',').map((s) => s.trim()).filter(Boolean);
			if (only.length > 0) routingConfig.only = only;
		}
		if (options.customProviderOrder) {
			const order = options.customProviderOrder.split(',').map((s) => s.trim()).filter(Boolean);
			if (order.length > 0) routingConfig.order = order;
		}
		if (options.customProvidersIgnore) {
			const ignore = options.customProvidersIgnore.split(',').map((s) => s.trim()).filter(Boolean);
			if (ignore.length > 0) routingConfig.ignore = ignore;
		}
		// Only inject allow_fallbacks when explicitly set to false (strict pinning).
		// Default true is OpenRouter's own default — no need to send it.
		if (options.allowFallbacks === false) {
			routingConfig.allow_fallbacks = false;
		}
		if (options.serviceTier && options.serviceTier !== 'auto') {
			routingConfig.service_tier = options.serviceTier;
		}
		if (options.providerSort && options.providerSort !== 'default') {
			routingConfig.sort = options.providerSort;
		}
		if (options.dataCollection && options.dataCollection !== 'default') {
			routingConfig.data_collection = options.dataCollection as 'allow' | 'deny';
		}

		// Only pass routingConfig to fetch when it has at least one key.
		// The fetch interceptor (createCachingOpenRouterFetch) is the single source of truth
		// for injecting provider routing — do NOT also put it in modelKwargs to avoid double-inject.
		const activeRoutingConfig: ProviderRoutingConfig | undefined =
			Object.keys(routingConfig).length > 0 ? routingConfig : undefined;

		const modelKwargs: Record<string, unknown> = {};
		if (options.responseFormat) {
			modelKwargs.response_format = { type: options.responseFormat };
		}

		const timeout = options.timeout;
		const configuration: ClientOptions = {
			baseURL: 'https://openrouter.ai/api/v1',
			defaultHeaders: {
				'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
				'X-Title': credentials.appName || 'n8n OpenRouter Node',
			},
			fetch: createCachingOpenRouterFetch(globalThis.fetch, cacheConfig, activeRoutingConfig) as any,
		};

		const modelConfig: any = {
			apiKey: credentials.apiKey,
			model: modelName,
			...options,
			timeout,
			maxRetries: options.maxRetries ?? 2,
			configuration,
			modelKwargs: Object.keys(modelKwargs).length > 0 ? modelKwargs : undefined,
		};

		const aiUtilities = getAiUtilities();
		if (aiUtilities && aiUtilities.N8nLlmTracing) {
			modelConfig.callbacks = [new aiUtilities.N8nLlmTracing(this)];
		}

		const { ChatOpenAI } = requireN8nDependency('@langchain/openai');
		const model = new ChatOpenAI(modelConfig) as ChatOpenAIType;

		return {
			response: model,
		};
	}
}

export function requireN8nDependency(dependencyName: string): any {
	// 1. Try standard require first
	try {
		return require(dependencyName);
	} catch (_) {}

	const tryRequire = (targetPath: string) => {
		try {
			return require(targetPath);
		} catch (_) {
			return null;
		}
	};

	// 2. Collect candidate base directories
	const candidateDirs: string[] = [];

	// Climb up from __dirname
	let currentDir = __dirname;
	while (currentDir) {
		candidateDirs.push(currentDir);
		const parent = path.dirname(currentDir);
		if (parent === currentDir) break;
		currentDir = parent;
	}

	// Climb up from process.cwd()
	try {
		if (process.cwd()) {
			let cwdDir = process.cwd();
			while (cwdDir) {
				candidateDirs.push(cwdDir);
				const parent = path.dirname(cwdDir);
				if (parent === cwdDir) break;
				cwdDir = parent;
			}
		}
	} catch (_) {}

	// Climb up from require.main.filename
	if (require.main && require.main.filename) {
		try {
			let mainDir = path.dirname(require.main.filename);
			while (mainDir) {
				candidateDirs.push(mainDir);
				const parent = path.dirname(mainDir);
				if (parent === mainDir) break;
				mainDir = parent;
			}
		} catch (_) {}
	}

	// Standard Docker / Global n8n paths
	const globalPaths = [
		'/home/node',
		'/data',
		'/usr/local/lib/node_modules/n8n',
		'/usr/local/lib/node_modules',
		'/usr/lib/node_modules',
		'/opt/n8n',
	];
	for (const gp of globalPaths) {
		candidateDirs.push(gp);
	}

	// 3. Try resolving relative to known n8n packages
	const n8nPackages = [
		'@n8n/n8n-nodes-langchain',
		'n8n-nodes-base',
		'n8n-workflow',
		'n8n',
	];
	for (const pkg of n8nPackages) {
		try {
			const pkgPath = require.resolve(pkg);
			let dir = path.dirname(pkgPath);
			while (dir) {
				candidateDirs.push(dir);
				const parent = path.dirname(dir);
				if (parent === dir) break;
				dir = parent;
			}
		} catch (_) {}
	}

	const uniqueDirs = [...new Set(candidateDirs)];

	// 4. Try require.resolve with search starting paths
	for (const sDir of uniqueDirs) {
		try {
			const resolved = require.resolve(dependencyName, { paths: [sDir] });
			const res = tryRequire(resolved);
			if (res) return res;
		} catch (_) {}
	}

	// 5. Direct path checks in candidates
	for (const dir of uniqueDirs) {
		let res = tryRequire(path.join(dir, 'node_modules', dependencyName));
		if (res) return res;

		res = tryRequire(path.join(dir, 'node_modules', '@n8n', 'n8n-nodes-langchain', 'node_modules', dependencyName));
		if (res) return res;

		res = tryRequire(path.join(dir, dependencyName));
		if (res) return res;
	}

	throw new Error(`Could not resolve ${dependencyName} from n8n's runtime`);
}

export function getAiUtilities(): any {
	try {
		const dep = ['@n8n', 'ai-utilities'].join('/');
		return requireN8nDependency(dep);
	} catch (e) {
		return null;
	}
}
