import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type ILoadOptionsFunctions,
	type SupplyData,
} from 'n8n-workflow';
import { OpenAIEmbeddings } from '@langchain/openai';

export class EmbeddingsOpenRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Embeddings',
		name: 'embeddingsOpenRouter',
		icon: 'file:openrouter.svg',
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
			response: embeddings,
		};
	}
}
