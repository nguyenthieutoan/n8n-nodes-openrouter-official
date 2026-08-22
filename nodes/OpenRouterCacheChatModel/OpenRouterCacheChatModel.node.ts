import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
	NodeConnectionTypes,
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
): typeof globalThis.fetch {
	return async (input, init) => {
		let modifiedInit = init;

		if (cacheConfig.enabled && init?.body && typeof init.body === 'string') {
			try {
				const body = JSON.parse(init.body) as ChatRequestBody;
				const modified = injectCacheControl(body, cacheConfig);
				modifiedInit = { ...init, body: JSON.stringify(modified) };
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
								url: '/models',
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
				],
			},
		],
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
		};

		const cacheConfig: CacheConfig = {
			enabled: options.enablePromptCaching !== false,
			ttl: options.cacheTtl ?? 'default',
			breakpoints: options.cacheBreakpoints ?? 'system',
		};

		const timeout = options.timeout;
		const configuration: ClientOptions = {
			baseURL: 'https://openrouter.ai/api/v1',
			defaultHeaders: {
				'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
				'X-Title': credentials.appName || 'n8n OpenRouter Node',
			},
			fetch: createCachingOpenRouterFetch(globalThis.fetch, cacheConfig),
		};

		const modelConfig: any = {
			apiKey: credentials.apiKey,
			model: modelName,
			...options,
			timeout,
			maxRetries: options.maxRetries ?? 2,
			configuration,
			modelKwargs: options.responseFormat
				? {
						response_format: { type: options.responseFormat },
					}
				: undefined,
		};

		const aiUtilities = getAiUtilities();
		if (aiUtilities && aiUtilities.N8nLlmTracing) {
			modelConfig.callbacks = [new aiUtilities.N8nLlmTracing(this)];
		}

		const model = new ChatOpenAI(modelConfig);

		return {
			response: model,
		};
	}
}

export function requireN8nDependency(dependencyName: string): any {
	try { return require(dependencyName); } catch (_) {}
	if (require.main && require.main.paths) {
		try {
			const p = require.resolve(dependencyName, { paths: require.main.paths });
			return require(p);
		} catch (_) {}
	}
	try {
		const workflowResolve = require.resolve('n8n-workflow');
		const index = workflowResolve.indexOf('node_modules');
		if (index !== -1) {
			const base = workflowResolve.substring(0, index + 12);
			return require(base + '/' + dependencyName);
		}
	} catch (_) {}
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
