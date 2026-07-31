import { mock } from 'jest-mock-extended';
import { IExecuteFunctions, INodeExecutionData, NodeApiError } from 'n8n-workflow';
import { OpenRouter } from '../nodes/OpenRouter/OpenRouter.node';

describe('OpenRouter Node', () => {
	let node: OpenRouter;

	beforeEach(() => {
		node = new OpenRouter();
	});

	function createMockExecuteFunctions() {
		const mockExecuteFunctions = mock<IExecuteFunctions>();
		mockExecuteFunctions.helpers = {
			httpRequestWithAuthentication: jest.fn(),
		} as any;
		mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
		return mockExecuteFunctions;
	}

	it('should process Generate Image successfully (Happy Path)', async () => {
		const mockExecuteFunctions = createMockExecuteFunctions();
		
		mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'image';
			if (paramName === 'operation') return 'generate';
			if (paramName === 'prompt') return 'a cute cat';
			if (paramName === 'model') return 'mock-model';
			if (paramName === 'download') return false;
			return undefined;
		});

		(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
			data: [
				{ url: 'https://example.com/image.png', b64_json: 'mock-base64' }
			]
		});

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toHaveLength(1);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toEqual({
			url: 'https://example.com/image.png',
			b64_json: 'mock-base64'
		});
	});

	it('should throw NodeApiError on API failure (Failed API)', async () => {
		const mockExecuteFunctions = createMockExecuteFunctions();
		
		mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'image';
			if (paramName === 'operation') return 'generate';
			if (paramName === 'prompt') return 'test';
			if (paramName === 'model') return 'mock-model';
			return undefined;
		});
		mockExecuteFunctions.getNode.mockReturnValue({
			id: '1',
			name: 'OpenRouter',
			type: 'n8n-nodes-openrouter-official.OpenRouter',
			typeVersion: 1,
			position: [0, 0],
			parameters: {}
		});
		mockExecuteFunctions.continueOnFail.mockReturnValue(false);

		const apiError = new Error('API Error');
		(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(apiError);

		await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow();
	});

	it('should handle continueOnFail when API fails', async () => {
		const mockExecuteFunctions = createMockExecuteFunctions();
		
		mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'image';
			if (paramName === 'operation') return 'generate';
			if (paramName === 'prompt') return 'test';
			if (paramName === 'model') return 'mock-model';
			return undefined;
		});
		mockExecuteFunctions.continueOnFail.mockReturnValue(true);

		const apiError = new Error('API Error');
		(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(apiError);

		const result = await node.execute.call(mockExecuteFunctions);
		
		expect(result[0][0].json).toHaveProperty('error');
		expect(result[0][0].pairedItem).toEqual({ item: 0 });
	});
});
