import { mock } from 'jest-mock-extended';
import { IExecuteFunctions } from 'n8n-workflow';
import { OpenRouterDecisions } from '../nodes/OpenRouterDecisions/OpenRouterDecisions.node';

describe('OpenRouterDecisions Node', () => {
	let node: OpenRouterDecisions;

	beforeEach(() => {
		node = new OpenRouterDecisions();
	});

	function createMockExecuteFunctions(inputData = [{ json: { ticket: 'Checkout blank screen', tier: 'enterprise' } }]) {
		const mockExecuteFunctions = mock<IExecuteFunctions>();
		mockExecuteFunctions.helpers = {
			request: jest.fn(),
		} as any;
		mockExecuteFunctions.getInputData.mockReturnValue(inputData as any);
		mockExecuteFunctions.getCredentials.mockResolvedValue({
			apiKey: 'mock-openrouter-key',
			siteUrl: 'https://testapp.com',
			appName: 'TestApp',
		});
		mockExecuteFunctions.getNode.mockReturnValue({ name: 'OpenRouter Decisions' } as any);
		mockExecuteFunctions.continueOnFail.mockReturnValue(false);
		return mockExecuteFunctions;
	}

	it('should have valid metadata and credentials specification', () => {
		expect(node.description.name).toBe('openRouterDecisions');
		expect(node.description.displayName).toBe('OpenRouter Decisions (System One)');
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
		expect(node.description.credentials).toEqual([
			{
				name: 'openRouterCommunityApi',
				required: true,
			},
		]);
	});

	it('should execute successfully with Visual Questions Builder (Noul, Choice, Score)', async () => {
		const mockExec = createMockExecuteFunctions();

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'modelSelect') return 'typesafe/jev-1.13';
			if (paramName === 'stateMode') return 'currentItem';
			if (paramName === 'questionMode') return 'builder';
			if (paramName === 'questionsBuilder') {
				return {
					question: [
						{
							name: 'is_bug',
							type: 'noul',
							instructions: 'Is the customer reporting a software defect?',
							criteriaTrue: 'Broken behavior',
							criteriaFalse: 'Feature request or question',
						},
						{
							name: 'team',
							type: 'choice',
							instructions: 'Which team owns this?',
							choiceOptions: {
								option: [
									{ key: 'payments', description: 'Payment and checkout issues' },
									{ key: 'frontend', description: 'UI or layout issues' },
								],
							},
						},
						{
							name: 'urgency',
							type: 'score',
							instructions: 'How urgent is this?',
							scoreLevels: {
								level: [
									{ description: 'Can wait' },
									{ description: 'This week' },
									{ description: 'Blocking revenue' },
								],
							},
						},
					],
				};
			}
			if (paramName === 'options') {
				return {
					simplify: true,
					allowFallbacks: true,
					sessionId: 'test-session-123',
				};
			}
			return undefined;
		});

		const mockApiResponse = {
			id: 'gen-dec-test-123',
			model: 'typesafe/jev-1.13-20260917',
			provider: 'TypeSafe',
			answers: {
				is_bug: { type: 'noul', noul: 0.96 },
				team: {
					type: 'choice',
					choice: 'payments',
					confidence: 0.85,
					probabilities: { payments: 0.88, frontend: 0.12 },
				},
				urgency: {
					type: 'score',
					score: 1.95,
					confidence: 0.92,
					probabilities: { '0': 0, '1': 0.05, '2': 0.95 },
					legend: { '0': 'Can wait', '1': 'This week', '2': 'Blocking revenue' },
				},
			},
			usage: { input_tokens: 450, output_tokens: 65, cost: 0.000018 },
		};

		(mockExec.helpers.request as jest.Mock).mockResolvedValue(mockApiResponse);

		const result = await node.execute.call(mockExec);

		expect(result).toHaveLength(1);
		expect(result[0]).toHaveLength(1);

		const outJson = result[0][0].json;
		expect(outJson.id).toBe('gen-dec-test-123');
		expect(outJson.decision).toEqual({
			is_bug: 0.96,
			team: 'payments',
			urgency: 1.95,
		});
		expect(outJson.confidence).toEqual({
			is_bug: 0.92,
			team: 0.85,
			urgency: 0.92,
		});
		expect(outJson.verdict).toEqual({
			is_bug: true,
		});

		// Verify API request payload
		expect(mockExec.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				url: 'https://openrouter.ai/api/alpha/decisions',
				body: {
					model: 'typesafe/jev-1.13',
					state: { ticket: 'Checkout blank screen', tier: 'enterprise' },
					questions: {
						is_bug: {
							type: 'noul',
							instructions: 'Is the customer reporting a software defect?',
							criteria: {
								true: 'Broken behavior',
								false: 'Feature request or question',
							},
						},
						team: {
							type: 'choice',
							instructions: 'Which team owns this?',
							criteria: {
								payments: 'Payment and checkout issues',
								frontend: 'UI or layout issues',
							},
						},
						urgency: {
							type: 'score',
							instructions: 'How urgent is this?',
							criteria: ['Can wait', 'This week', 'Blocking revenue'],
						},
					},
					// provider field should NOT be present when allow_fallbacks is default true
					session_id: 'test-session-123',
				},
				headers: expect.objectContaining({
					'Authorization': 'Bearer mock-openrouter-key',
					'x-session-id': 'test-session-123',
				}),
			}),
		);
	});

	it('should execute successfully with Raw JSON Questions and Custom Model', async () => {
		const mockExec = createMockExecuteFunctions();

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'modelSelect') return 'custom';
			if (paramName === 'customModel') return 'typesafe/jev-future-2.0';
			if (paramName === 'stateMode') return 'string';
			if (paramName === 'stateString') return 'User input text to analyze';
			if (paramName === 'questionMode') return 'json';
			if (paramName === 'questionsJson') {
				return {
					is_safe: {
						type: 'noul',
						instructions: 'Is this content safe?',
						criteria: { true: 'Safe', false: 'Toxic' },
					},
				};
			}
			if (paramName === 'options') {
				return { simplify: false };
			}
			return undefined;
		});

		const mockApiResponse = {
			id: 'gen-dec-456',
			model: 'typesafe/jev-future-2.0',
			provider: 'TypeSafe',
			answers: {
				is_safe: { type: 'noul', noul: 0.99 },
			},
			usage: { input_tokens: 120, output_tokens: 20, cost: 0.000005 },
		};

		(mockExec.helpers.request as jest.Mock).mockResolvedValue(mockApiResponse);

		const result = await node.execute.call(mockExec);

		expect(result[0][0].json).toEqual(mockApiResponse);
		expect(mockExec.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					model: 'typesafe/jev-future-2.0',
					state: 'User input text to analyze',
				}),
			}),
		);
	});

	it('should flag ambiguous decisions when flagAmbiguity is enabled and confidence is below threshold', async () => {
		const mockExec = createMockExecuteFunctions();

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'modelSelect') return 'typesafe/jev-1.13';
			if (paramName === 'stateMode') return 'currentItem';
			if (paramName === 'questionMode') return 'json';
			if (paramName === 'questionsJson') {
				return {
					ambiguous_choice: {
						type: 'choice',
						instructions: 'Pick A or B',
						criteria: { a: 'Option A', b: 'Option B' },
					},
					ambiguous_noul: {
						type: 'noul',
						instructions: 'Is it true?',
						criteria: { true: 'Yes', false: 'No' },
					},
				};
			}
			if (paramName === 'options') {
				return {
					simplify: true,
					flagAmbiguity: true,
					ambiguityThreshold: 0.7,
				};
			}
			return undefined;
		});

		const mockApiResponse = {
			id: 'gen-dec-ambiguity',
			model: 'typesafe/jev-1.13',
			answers: {
				ambiguous_choice: {
					type: 'choice',
					choice: 'a',
					confidence: 0.52, // Below 0.7 threshold!
					probabilities: { a: 0.55, b: 0.45 },
				},
				ambiguous_noul: {
					type: 'noul',
					noul: 0.52, // |0.52 - 0.5| * 2 = 0.04 confidence! (Below 0.7)
				},
			},
			usage: { input_tokens: 100, output_tokens: 20, cost: 0.000004 },
		};

		(mockExec.helpers.request as jest.Mock).mockResolvedValue(mockApiResponse);

		const result = await node.execute.call(mockExec);
		const outJson = result[0][0].json;

		expect(outJson.isAmbiguous).toBe(true);
		const reasons = outJson.ambiguityReasons as string[];
		expect(reasons).toHaveLength(2);
		expect(reasons[0]).toContain("Question 'ambiguous_choice' confidence (0.52) is below threshold (0.7)");
		expect(reasons[1]).toContain("Question 'ambiguous_noul' confidence (0.04) is below threshold (0.7)");
	});

	it('should throw error when Choice question has no options defined in Builder', async () => {
		const mockExec = createMockExecuteFunctions();

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'modelSelect') return 'typesafe/jev-1.13';
			if (paramName === 'stateMode') return 'currentItem';
			if (paramName === 'questionMode') return 'builder';
			if (paramName === 'questionsBuilder') {
				return {
					question: [
						{
							name: 'bad_choice',
							type: 'choice',
							instructions: 'Test',
							choiceOptions: { option: [] },
						},
					],
				};
			}
			if (paramName === 'options') return {};
			return undefined;
		});

		await expect(node.execute.call(mockExec)).rejects.toThrow(
			"Choice question 'bad_choice' must have at least one option defined",
		);
	});

	it('should handle API errors gracefully when continueOnFail is true', async () => {
		const mockExec = createMockExecuteFunctions();
		mockExec.continueOnFail.mockReturnValue(true);

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'modelSelect') return 'typesafe/jev-1.13';
			if (paramName === 'stateMode') return 'string';
			if (paramName === 'stateString') return 'test';
			if (paramName === 'questionMode') return 'json';
			if (paramName === 'questionsJson') return { q: { type: 'noul', instructions: 'test', criteria: { true: 'a', false: 'b' } } };
			if (paramName === 'options') return {};
			return undefined;
		});

		const apiError = new Error('Insufficient credits');
		(apiError as any).statusCode = 402;
		(apiError as any).response = {
			status: 402,
			body: {
				error: { code: 402, message: 'Insufficient credits. Add more using https://openrouter.ai/credits' },
			},
		};

		(mockExec.helpers.request as jest.Mock).mockRejectedValue(apiError);

		const result = await node.execute.call(mockExec);

		expect(result).toHaveLength(1);
		expect(result[0][0].json).toEqual({
			error: 'Insufficient credits. Add more using https://openrouter.ai/credits',
			statusCode: 402,
		});
	});

	it('should automatically infer criteria for noul when criteriaTrue and criteriaFalse are omitted', async () => {
		const mockExec = createMockExecuteFunctions();

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'modelSelect') return 'typesafe/jev-1.13';
			if (paramName === 'stateMode') return 'currentItem';
			if (paramName === 'questionMode') return 'builder';
			if (paramName === 'questionsBuilder') {
				return {
					question: [
						{
							name: 'is_urgent',
							type: 'noul',
							instructions: 'Is this message urgent?',
						},
					],
				};
			}
			if (paramName === 'options') return { simplify: true };
			return undefined;
		});

		(mockExec.helpers.request as jest.Mock).mockResolvedValue({
			id: 'test-noul-fallback',
			answers: {
				is_urgent: { type: 'noul', noul: 0.88 },
			},
		});

		const result = await node.execute.call(mockExec);
		const outJson = result[0][0].json as Record<string, any>;
		expect(outJson.decision.is_urgent).toBe(0.88);
		expect(outJson.verdict.is_urgent).toBe(true);

		expect(mockExec.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					questions: {
						is_urgent: {
							type: 'noul',
							instructions: 'Is this message urgent?',
							criteria: {
								true: 'The condition is met: "Is this message urgent?"',
								false: 'The condition is not met: "Is this message urgent?"',
							},
						},
					},
				}),
			}),
		);
	});

	it('should dynamically fetch decision models via searchModels (output_modalities=decisions)', async () => {
		const mockContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-openrouter-key' }),
			helpers: {
				request: jest.fn().mockResolvedValue({
					data: [
						{
							id: 'liquid/d1',
							name: 'LiquidAI: D1',
							description: 'Structured decision model',
							pricing: { prompt: '0.00000004', completion: '0' },
						},
						{
							id: 'typesafe/jev-1.13',
							name: 'TypeSafe: Jev 1.13',
							description: 'Deterministic release',
							pricing: { prompt: '0.000000042', completion: '0' },
						},
					],
				}),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext);
		expect(mockContext.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: 'https://openrouter.ai/api/v1/models?output_modalities=decisions',
				headers: {
					Authorization: 'Bearer mock-openrouter-key',
				},
				json: true,
			}),
		);

		expect(result.results.length).toBe(2);
		expect(result.results[0].value).toBe('typesafe/jev-1.13'); // prioritized at top
		expect(result.results[1].value).toBe('liquid/d1');
		expect(result.results[1].name).toBe('LiquidAI: D1 (liquid/d1)');
	});

	it('should filter decision models when filter parameter is provided', async () => {
		const mockContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-openrouter-key' }),
			helpers: {
				request: jest.fn().mockResolvedValue({
					data: [
						{ id: 'liquid/d1', name: 'LiquidAI: D1' },
						{ id: 'upstage/solar-decide', name: 'Upstage: Solar Decide' },
					],
				}),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext, 'solar');
		expect(result.results.length).toBe(1);
		expect(result.results[0].value).toBe('upstage/solar-decide');
	});

	it('should return fallback decision models if API request fails', async () => {
		const mockContext = {
			getCredentials: jest.fn().mockRejectedValue(new Error('Network error')),
			helpers: {
				request: jest.fn().mockRejectedValue(new Error('Network error')),
			},
		} as any;

		const result = await node.methods.listSearch.searchModels.call(mockContext);
		expect(result.results.length).toBeGreaterThan(0);
		expect(result.results.some((m: any) => m.value === 'typesafe/jev-1.13')).toBe(true);
		expect(result.results.some((m: any) => m.value === 'liquid/d1')).toBe(true);
	});

	it('should execute successfully using resourceLocator model object', async () => {
		const mockExec = createMockExecuteFunctions();

		mockExec.getNodeParameter.mockImplementation((paramName: string) => {
			if (paramName === 'model') return { mode: 'list', value: 'liquid/d1' };
			if (paramName === 'stateMode') return 'currentItem';
			if (paramName === 'questionMode') return 'builder';
			if (paramName === 'questionsBuilder') {
				return {
					question: [
						{
							name: 'is_spam',
							type: 'noul',
							instructions: 'Is this message spam?',
						},
					],
				};
			}
			if (paramName === 'options') return { simplify: true };
			return undefined;
		});

		(mockExec.helpers.request as jest.Mock).mockResolvedValue({
			id: 'test-liquid-d1',
			model: 'liquid/d1-20260930',
			answers: {
				is_spam: { type: 'noul', noul: 0.05 },
			},
		});

		const result = await node.execute.call(mockExec);
		const outJson = result[0][0].json as Record<string, any>;
		expect(outJson.decision.is_spam).toBe(0.05);
		expect(outJson.verdict.is_spam).toBe(false);

		expect(mockExec.helpers.request).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					model: 'liquid/d1',
				}),
			}),
		);
	});
});

