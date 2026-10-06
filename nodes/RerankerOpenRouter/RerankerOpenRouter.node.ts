import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type ILoadOptionsFunctions,
	type SupplyData,
	type INodeListSearchResult,
} from 'n8n-workflow';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-var-requires */
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
		return {
			getConnectionHintNoticeField: (hints: any) => ({
				displayName: '',
				name: 'notice',
				type: 'notice',
				default: '',
			}),
			logWrapper: (instance: any, context: any) => instance,
		};
	}
}

export class RerankerOpenRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Reranker',
		name: 'rerankerOpenRouter',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Use OpenRouter to reorder documents by relevance to the given query',
		defaults: {
			name: 'OpenRouter Reranker',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Rerankers'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://openrouter.ai/docs/api_reference',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiReranker],
		outputNames: ['Compressor'],
		credentials: [
			{
				name: 'openRouterCommunityApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'list', value: 'voyageai/rerank-3-lite' },
				required: true,
				description: 'The OpenRouter model to use for reranking',
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
						placeholder: 'voyageai/rerank-3-lite',
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
		],
	};

	methods = {
		listSearch: {
			async searchModels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				let models: any[] = [];
				try {
					let credentials: { apiKey?: string } | undefined;
					try {
						credentials = await this.getCredentials('openRouterCommunityApi');
					} catch (_) {}

					const headers: Record<string, string> = {};
					if (credentials?.apiKey) {
						headers.Authorization = `Bearer ${credentials.apiKey}`;
					}

					const response = await this.helpers.request({
						method: 'GET',
						url: 'https://openrouter.ai/api/v1/models?output_modalities=rerank',
						headers,
						json: true,
					});

					if (response && Array.isArray(response.data)) {
						models = response.data;
					}
				} catch (error) {
					// Fallback to known reranker models if network or API request fails
					models = [
						{
							id: 'voyageai/rerank-3-lite',
							name: 'VoyageAI by MongoDB: rerank-3-lite',
							description: 'High-speed, low-latency reranker with 32k context',
						},
						{
							id: 'voyageai/rerank-3',
							name: 'VoyageAI by MongoDB: rerank-3',
							description: 'Top-tier reranking quality optimized for deep RAG retrieval',
						},
						{
							id: 'qwen/qwen3-reranker-8b',
							name: 'Qwen3 Reranker 8B',
							description: 'Alibaba Cloud 8B multilingual reranker with 40k context',
						},
						{
							id: 'cohere/rerank-v3.5',
							name: 'Cohere: Rerank v3.5',
							description: 'Cohere foundation reranking model for semantic search',
						},
						{
							id: 'cohere/rerank-4-pro',
							name: 'Cohere: Rerank 4 Pro',
							description: 'High-capability 32k context search foundation model',
						},
						{
							id: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
							name: 'NVIDIA: Llama Nemotron Rerank VL 1B V2 (free)',
							description: 'Free multimodal reranker from NVIDIA for text and document images',
						},
					];
				}

				const results = models.map((m: any) => {
					const displayName = m.name ? `${m.name} (${m.id})` : (m.id.startsWith('~') ? m.id.substring(1) : m.id);
					let desc = m.description || '';
					if (m.pricing) {
						const promptPrice = m.pricing.prompt && m.pricing.prompt !== '0'
							? `$${(parseFloat(m.pricing.prompt) * 1000000).toFixed(2)}/M in`
							: 'Free in';
						desc = desc ? `[${promptPrice}] ${desc}` : `[${promptPrice}]`;
					}
					if (desc.length > 140) {
						desc = desc.substring(0, 137) + '...';
					}

					return {
						name: displayName,
						value: m.id,
						description: desc || undefined,
					};
				});

				results.sort((a: any, b: any) => {
					if (a.value === 'voyageai/rerank-3-lite') return -1;
					if (b.value === 'voyageai/rerank-3-lite') return 1;
					if (a.value === 'cohere/rerank-v3.5') return -1;
					if (b.value === 'cohere/rerank-v3.5') return 1;
					return a.name.localeCompare(b.name);
				});

				if (filter) {
					const f = filter.toLowerCase();
					return {
						results: results.filter(
							(m: any) =>
								m.name.toLowerCase().includes(f) ||
								m.value.toLowerCase().includes(f) ||
								(m.description && m.description.toLowerCase().includes(f)),
						),
					};
				}

				return { results };
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials<{ apiKey: string, siteUrl?: string, appName?: string }>('openRouterCommunityApi');

		let modelName = this.getNodeParameter('model', itemIndex) as any;
		if (modelName && typeof modelName === 'object' && modelName.value) {
			modelName = modelName.value;
		}
		modelName = modelName as string;

		const { OpenRouterRerankerAdapter } = requireN8nDependency('./OpenRouterRerankerCompressor');
		const compressor = new OpenRouterRerankerAdapter(
			credentials.apiKey,
			modelName,
			credentials.siteUrl || 'https://n8n.io',
			credentials.appName || 'n8n OpenRouter Node',
		);

		return {
			response: getAiUtilities().logWrapper(compressor, this),
		};
	}
}
