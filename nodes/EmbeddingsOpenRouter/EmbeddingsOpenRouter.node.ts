import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type ILoadOptionsFunctions,
	type SupplyData,
} from 'n8n-workflow';
import { OpenAIEmbeddings } from '@langchain/openai';

/* eslint-disable @typescript-eslint/no-var-requires */
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

export class EmbeddingsOpenRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Embeddings',
		name: 'embeddingsOpenRouter',
		icon: { light: 'file:openrouter.svg', dark: 'file:openrouter.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Generate vector embeddings from text and images using OpenRouter',
		defaults: {
			name: 'OpenRouter Embeddings',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://openrouter.ai/docs/api_reference/embeddings',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiEmbedding],
		outputNames: ['Embeddings'],
		credentials: [
			{
				name: 'openRouterApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: '',
				description: 'The OpenRouter model to use for generating embeddings',
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions) {
				const credentials = await this.getCredentials('openRouterApi');
				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://openrouter.ai/api/v1/models',
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					json: true,
				});
				return response.data
					.map((m: { id: string; name: string }) => ({
						name: m.name || m.id,
						value: m.id,
					}));
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials<{ apiKey: string, siteUrl?: string, appName?: string }>('openRouterApi');
		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const embeddings = new OpenAIEmbeddings({
			openAIApiKey: credentials.apiKey,
			modelName,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: {
					'HTTP-Referer': credentials.siteUrl || 'https://n8n.io',
					'X-Title': credentials.appName || 'n8n OpenRouter Node',
				},
			},
		});

		return {
			response: getAiUtilities().logWrapper(embeddings, this),
		};
	}
}
