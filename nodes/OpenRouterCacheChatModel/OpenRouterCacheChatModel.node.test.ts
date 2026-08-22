import {
	injectCacheControl,
	fixEmptyToolCallArguments,
	createCachingOpenRouterFetch,
} from './OpenRouterCacheChatModel.node';

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
}

describe('injectCacheControl', () => {
	const enabledConfig = { enabled: true, ttl: 'default' as const, breakpoints: 'system' as const };

	it('should not modify when disabled', () => {
		const body = {
			model: 'anthropic/claude-sonnet-4-20250514',
			messages: [{ role: 'system', content: 'You are helpful' }],
		};
		const result = injectCacheControl(body, { ...enabledConfig, enabled: false });
		expect(result.messages![0].content).toBe('You are helpful');
	});

	it('should transform system message to content blocks with cache_control', () => {
		const body = {
			model: 'anthropic/claude-sonnet-4-20250514',
			messages: [
				{ role: 'system', content: 'You are helpful' },
				{ role: 'user', content: 'Hello' },
			],
		};
		const result = injectCacheControl(body, enabledConfig);
		expect(result.messages![0].content).toEqual([
			{ type: 'text', text: 'You are helpful', cache_control: { type: 'ephemeral' } },
		]);
	});

	it('should work for Gemini models (same cache_control format)', () => {
		const body = {
			model: 'google/gemini-2.5-flash',
			messages: [
				{ role: 'system', content: 'You are a coding assistant' },
				{ role: 'user', content: 'Write code' },
			],
		};
		const result = injectCacheControl(body, enabledConfig);
		expect(result.messages![0].content).toEqual([
			{ type: 'text', text: 'You are a coding assistant', cache_control: { type: 'ephemeral' } },
		]);
	});

	it('should add ttl when set to 1h', () => {
		const body = {
			messages: [{ role: 'system', content: 'System prompt' }],
		};
		const result = injectCacheControl(body, { ...enabledConfig, ttl: '1h' });
		expect(result.messages![0].content).toEqual([
			{ type: 'text', text: 'System prompt', cache_control: { type: 'ephemeral', ttl: '1h' } },
		]);
	});

	it('should not add ttl when set to default', () => {
		const body = {
			messages: [{ role: 'system', content: 'System prompt' }],
		};
		const result = injectCacheControl(body, enabledConfig);
		const content = result.messages![0].content;
		expect(Array.isArray(content) && content[0].cache_control).toEqual({ type: 'ephemeral' });
	});

	it('should also cache last user message when breakpoints is system_and_last_user', () => {
		const body = {
			messages: [
				{ role: 'system', content: 'You are helpful' },
				{ role: 'user', content: 'First message' },
				{ role: 'assistant', content: 'Response' },
				{ role: 'user', content: 'Second message' },
			],
		};
		const result = injectCacheControl(body, { ...enabledConfig, breakpoints: 'system_and_last_user' });

		expect(result.messages![0].content).toEqual([
			{ type: 'text', text: 'You are helpful', cache_control: { type: 'ephemeral' } },
		]);
		expect(result.messages![1].content).toBe('First message');
		expect(result.messages![3].content).toEqual([
			{ type: 'text', text: 'Second message', cache_control: { type: 'ephemeral' } },
		]);
	});

	it('should not cache user message when breakpoints is system only', () => {
		const body = {
			messages: [
				{ role: 'system', content: 'You are helpful' },
				{ role: 'user', content: 'Hello' },
			],
		};
		const result = injectCacheControl(body, enabledConfig);
		expect(result.messages![1].content).toBe('Hello');
	});

	it('should handle missing messages array', () => {
		const body = { model: 'test' };
		const result = injectCacheControl(body, enabledConfig);
		expect(result).toEqual({ model: 'test' });
	});

	it('should handle body with no system message', () => {
		const body = {
			messages: [{ role: 'user', content: 'Hello' }],
		};
		const result = injectCacheControl(body, enabledConfig);
		expect(result.messages![0].content).toBe('Hello');
	});

	it('should not transform system message that is already an array', () => {
		const existingContent = [{ type: 'text', text: 'Already array' }];
		const body = {
			messages: [{ role: 'system', content: existingContent as any }],
		};
		const result = injectCacheControl(body, enabledConfig);
		expect(result.messages![0].content).toBe(existingContent);
	});

	it('should handle multiple system messages', () => {
		const body = {
			messages: [
				{ role: 'system', content: 'First system' },
				{ role: 'system', content: 'Second system' },
				{ role: 'user', content: 'Hello' },
			],
		};
		const result = injectCacheControl(body, enabledConfig);
		expect(result.messages![0].content).toEqual([
			{ type: 'text', text: 'First system', cache_control: { type: 'ephemeral' } },
		]);
		expect(result.messages![1].content).toEqual([
			{ type: 'text', text: 'Second system', cache_control: { type: 'ephemeral' } },
		]);
	});
});

describe('fixEmptyToolCallArguments', () => {
	it('should return false for non-choice responses', () => {
		expect(fixEmptyToolCallArguments({ models: ['a'] })).toBe(false);
		expect(fixEmptyToolCallArguments(null)).toBe(false);
		expect(fixEmptyToolCallArguments('string')).toBe(false);
	});

	it('should return false when no tool calls need fixing', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [{ function: { name: 'test', arguments: '{"key":"value"}' } }],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(false);
	});

	it('should fix empty string arguments to {}', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [{ function: { name: 'get_time', arguments: '' } }],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(true);
		expect(json.choices[0].message!.tool_calls![0].function!.arguments).toBe('{}');
	});

	it('should fix whitespace-only arguments to {}', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [{ function: { name: 'test', arguments: '   ' } }],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(true);
		expect(json.choices[0].message!.tool_calls![0].function!.arguments).toBe('{}');
	});

	it('should fix null arguments to {}', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [{ function: { name: 'test', arguments: null } }],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(true);
		expect(json.choices[0].message!.tool_calls![0].function!.arguments).toBe('{}');
	});

	it('should stringify plain object arguments', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [{ function: { name: 'test', arguments: { location: 'NYC' } } }],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(true);
		expect(json.choices[0].message!.tool_calls![0].function!.arguments).toBe('{"location":"NYC"}');
	});

	it('should fix array arguments to {}', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [{ function: { name: 'test', arguments: [1, 2] } }],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(true);
		expect(json.choices[0].message!.tool_calls![0].function!.arguments).toBe('{}');
	});

	it('should only fix broken tool calls in a mixed set', () => {
		const json = {
			choices: [{
				message: {
					tool_calls: [
						{ function: { name: 'weather', arguments: '{"city":"NYC"}' } },
						{ function: { name: 'time', arguments: '' } },
						{ function: { name: 'date', arguments: '{"format":"iso"}' } },
					],
				},
			}],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(true);
		expect(json.choices[0].message!.tool_calls![0].function!.arguments).toBe('{"city":"NYC"}');
		expect(json.choices[0].message!.tool_calls![1].function!.arguments).toBe('{}');
		expect(json.choices[0].message!.tool_calls![2].function!.arguments).toBe('{"format":"iso"}');
	});

	it('should return false for choices without tool_calls', () => {
		const json = {
			choices: [{ message: { role: 'assistant', content: 'Hello' } }],
		};
		expect(fixEmptyToolCallArguments(json)).toBe(false);
	});
});

describe('createCachingOpenRouterFetch', () => {
	const cacheConfig = { enabled: true, ttl: 'default' as const, breakpoints: 'system' as const };

	it('should inject cache_control into request body', async () => {
		let capturedBody: string | undefined;
		const mockFetch = jest.fn(async (_input: any, init: any) => {
			capturedBody = init?.body;
			return jsonResponse({ choices: [{ message: { content: 'Hi' } }] });
		}) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		await wrappedFetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4-20250514',
				messages: [
					{ role: 'system', content: 'Be helpful' },
					{ role: 'user', content: 'Hi' },
				],
			}),
		});

		const parsed = JSON.parse(capturedBody!);
		expect(parsed.messages[0].content).toEqual([
			{ type: 'text', text: 'Be helpful', cache_control: { type: 'ephemeral' } },
		]);
		expect(parsed.messages[1].content).toBe('Hi');
	});

	it('should inject cache_control for Gemini models', async () => {
		let capturedBody: string | undefined;
		const mockFetch = jest.fn(async (_input: any, init: any) => {
			capturedBody = init?.body;
			return jsonResponse({ choices: [{ message: { content: 'Hi' } }] });
		}) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		await wrappedFetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			body: JSON.stringify({
				model: 'google/gemini-2.5-pro',
				messages: [
					{ role: 'system', content: 'Be helpful' },
					{ role: 'user', content: 'Hi' },
				],
			}),
		});

		const parsed = JSON.parse(capturedBody!);
		expect(parsed.messages[0].content).toEqual([
			{ type: 'text', text: 'Be helpful', cache_control: { type: 'ephemeral' } },
		]);
	});

	it('should not modify body when caching disabled', async () => {
		let capturedBody: string | undefined;
		const mockFetch = jest.fn(async (_input: any, init: any) => {
			capturedBody = init?.body;
			return jsonResponse({ id: 'ok' });
		}) as unknown as typeof globalThis.fetch;

		const disabledConfig = { ...cacheConfig, enabled: false };
		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, disabledConfig);
		const originalBody = JSON.stringify({
			messages: [{ role: 'system', content: 'Test' }],
		});

		await wrappedFetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			body: originalBody,
		});

		expect(capturedBody).toBe(originalBody);
	});

	it('should fix empty tool call arguments in response', async () => {
		const mockFetch = jest.fn(async () =>
			jsonResponse({
				choices: [{
					message: {
						tool_calls: [{ function: { name: 'test', arguments: '' } }],
					},
				}],
			}),
		) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		const response = await wrappedFetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			body: JSON.stringify({ messages: [] }),
		});

		const result = await response.json() as any;
		expect(result.choices[0].message.tool_calls[0].function.arguments).toBe('{}');
	});

	it('should pass through non-JSON responses', async () => {
		const mockFetch = jest.fn(async () =>
			new Response('plain text', {
				status: 200,
				headers: { 'content-type': 'text/plain' },
			}),
		) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		const response = await wrappedFetch('https://openrouter.ai/api/v1/models', {
			method: 'GET',
		});

		expect(await response.text()).toBe('plain text');
	});

	it('should pass through JSON responses without choices', async () => {
		const body = { data: [{ id: 'model-1' }] };
		const mockFetch = jest.fn(async () => jsonResponse(body)) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		const response = await wrappedFetch('https://openrouter.ai/api/v1/models');

		expect(await response.json()).toEqual(body);
	});

	it('should handle malformed request body gracefully', async () => {
		const mockFetch = jest.fn(async () =>
			jsonResponse({ id: 'ok' }),
		) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		await wrappedFetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			body: 'not-json{{{',
		});

		expect(mockFetch).toHaveBeenCalled();
	});

	it('should handle request with no body', async () => {
		const mockFetch = jest.fn(async () =>
			jsonResponse({ data: [] }),
		) as unknown as typeof globalThis.fetch;

		const wrappedFetch = createCachingOpenRouterFetch(mockFetch, cacheConfig);
		await wrappedFetch('https://openrouter.ai/api/v1/models');

		expect(mockFetch).toHaveBeenCalled();
	});
});
