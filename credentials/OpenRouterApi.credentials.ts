import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OpenRouterApi implements ICredentialType {
	name = 'openRouterApi';
	displayName = 'OpenRouter API';
	documentationUrl = 'https://openrouter.ai/keys';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The API Key to connect to OpenRouter',
		},
		{
			displayName: 'Site URL (Optional)',
			name: 'siteUrl',
			type: 'string',
			default: '',
			description: 'A URL to your site, for OpenRouter rankings',
		},
		{
			displayName: 'Site Name (Optional)',
			name: 'appName',
			type: 'string',
			default: '',
			description: 'A name for your site, for OpenRouter rankings',
		}
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.apiKey}}',
				'HTTP-Referer': '={{$credentials.siteUrl}}',
				'X-Title': '={{$credentials.appName}}',
			},
		},
	};
}
