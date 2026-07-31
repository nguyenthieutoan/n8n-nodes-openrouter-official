import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type ILoadOptionsFunctions,
	type SupplyData,
} from 'n8n-workflow';
import { OpenRouterRerankerAdapter } from './OpenRouterRerankerCompressor';

export class RerankerOpenRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Reranker',
		name: 'rerankerOpenRouter',
		icon: 'file:openrouter.svg',
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
				description: 'The OpenRouter model to use for reranking',
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

		const compressor = new OpenRouterRerankerAdapter(
			credentials.apiKey,
			modelName,
			credentials.siteUrl || 'https://n8n.io',
			credentials.appName || 'n8n OpenRouter Node',
		);

		return {
			response: compressor,
		};
	}
}
