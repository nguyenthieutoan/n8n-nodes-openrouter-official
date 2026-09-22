import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class OpenRouterDecisions implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenRouter Decisions (System One)',
		name: 'openRouterDecisions',
		icon: { light: 'file:openrouter-decisions.svg', dark: 'file:openrouter-decisions.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["modelSelect"] === "custom" ? $parameter["customModel"] : $parameter["modelSelect"]}}',
		description: 'Make fast, typed, and probabilistic decisions (Choice, Noul, Score) using System One models like TypeSafe Jev on OpenRouter',
		defaults: {
			name: 'OpenRouter Decisions',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'openRouterCommunityApi',
				required: true,
			},
		],
		properties: [
			// 1. Model Selection
			{
				displayName: 'Model',
				name: 'modelSelect',
				type: 'options',
				options: [
					{
						name: 'TypeSafe Jev 1.13 (Pinned Stable)',
						value: 'typesafe/jev-1.13',
						description: 'Deterministic release, recommended for production decision workflows',
					},
					{
						name: 'TypeSafe Jev (Latest Release Alias)',
						value: '~typesafe/jev-latest',
						description: 'Automatically resolves to the latest dated Jev release snapshot',
					},
					{
						name: 'Custom Model Identifier',
						value: 'custom',
						description: 'Specify any System One or Decision model available on OpenRouter',
					},
				],
				default: 'typesafe/jev-1.13',
				description: 'The System One decision model to evaluate your questions',
			},
			{
				displayName: 'Custom Model ID',
				name: 'customModel',
				type: 'string',
				default: '',
				placeholder: 'typesafe/jev-1.13',
				description: 'Enter the exact OpenRouter model identifier to use',
				displayOptions: {
					show: {
						modelSelect: ['custom'],
					},
				},
				required: true,
			},

			// 2. Application State (Context to evaluate)
			{
				displayName: 'State Mode',
				name: 'stateMode',
				type: 'options',
				options: [
					{
						name: 'Current Item Data ($json)',
						value: 'currentItem',
						description: 'Use the entire incoming item JSON object as application state',
					},
					{
						name: 'Visual Field Builder',
						value: 'fieldBuilder',
						description: 'Construct application state as key-value fields visually',
					},
					{
						name: 'JSON Object',
						value: 'json',
						description: 'Provide state as a structured JSON object or expression',
					},
					{
						name: 'Plain Text String',
						value: 'string',
						description: 'Provide state as a raw text string',
					},
				],
				default: 'currentItem',
				description: 'How to supply the application state to evaluate (up to 32,000 tokens)',
			},
			{
				displayName: 'State Fields',
				name: 'stateFields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Define key-value pairs representing the application state',
				displayOptions: {
					show: {
						stateMode: ['fieldBuilder'],
					},
				},
				options: [
					{
						name: 'field',
						displayName: 'Field',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								placeholder: 'ticket',
								description: 'Property name for this piece of state',
								required: true,
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'My checkout page shows a blank screen after I click Pay.',
								description: 'Property value for this piece of state',
								required: true,
							},
						],
					},
				],
			},
			{
				displayName: 'State JSON',
				name: 'stateJson',
				type: 'json',
				default: '{\n  "ticket": "My checkout page shows a blank screen after I click Pay.",\n  "tier": "enterprise"\n}',
				description: 'JSON object representing the application state to evaluate',
				displayOptions: {
					show: {
						stateMode: ['json'],
					},
				},
				required: true,
			},
			{
				displayName: 'State Text',
				name: 'stateString',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				placeholder: 'Enter content or transcript to evaluate...',
				description: 'Text string representing the context to evaluate',
				displayOptions: {
					show: {
						stateMode: ['string'],
					},
				},
				required: true,
			},

			// 3. Questions Definition
			{
				displayName: 'Questions Input Mode',
				name: 'questionMode',
				type: 'options',
				options: [
					{
						name: 'Visual Interactive Builder (Recommended)',
						value: 'builder',
						description: 'Define Choice, Noul, and Score questions using structured form fields',
					},
					{
						name: 'Raw JSON Mode',
						value: 'json',
						description: 'Supply the complete questions object directly via JSON or expression',
					},
				],
				default: 'builder',
				description: 'How you want to define questions for this decision request',
			},
			{
				displayName: 'Questions Builder',
				name: 'questionsBuilder',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: "Add one or more independent questions evaluated in parallel against the 'state'",
				displayOptions: {
					show: {
						questionMode: ['builder'],
					},
				},
				options: [
					{
						name: 'question',
						displayName: 'Question',
						values: [
							{
								displayName: 'Question Key (Name)',
								name: 'name',
								type: 'string',
								default: '',
								placeholder: 'is_bug',
								description: 'Unique identifier key for this question (e.g. is_bug, team, urgency)',
								required: true,
							},
							{
								displayName: 'Primitive Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'Noul (Boolean Yes/No Evaluation)',
										value: 'noul',
										description: 'Evaluates whether a condition holds true (returns probability 0.0 to 1.0)',
									},
									{
										name: 'Choice (Pick 1 from Alternatives)',
										value: 'choice',
										description: 'Picks one winning option with confidence and probability distribution',
									},
									{
										name: 'Score (Ordered Scale Ranking)',
										value: 'score',
										description: 'Places input on an ordered discrete scale (returns probability-weighted continuous float)',
									},
								],
								default: 'noul',
								description: 'The mathematical decision primitive to apply',
							},
							{
								displayName: 'Instructions',
								name: 'instructions',
								type: 'string',
								typeOptions: {
									rows: 2,
								},
								default: '',
								placeholder: 'Is the customer reporting a software defect?',
								description: 'The question prompt and context guidance for the model',
								required: true,
							},
							// Noul Criteria
							{
								displayName: 'Criterion for TRUE (Yes)',
								name: 'criteriaTrue',
								type: 'string',
								default: 'The customer describes broken or unexpected product behavior.',
								description: 'Definition of what constitutes a positive/true answer',
								displayOptions: {
									show: {
										type: ['noul'],
									},
								},
								required: true,
							},
							{
								displayName: 'Criterion for FALSE (No)',
								name: 'criteriaFalse',
								type: 'string',
								default: 'The customer is asking a question or requesting a feature.',
								description: 'Definition of what constitutes a negative/false answer',
								displayOptions: {
									show: {
										type: ['noul'],
									},
								},
								required: true,
							},
							// Choice Criteria
							{
								displayName: 'Options',
								name: 'choiceOptions',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
								},
								default: {},
								description: 'List of alternative choices available for this question',
								displayOptions: {
									show: {
										type: ['choice'],
									},
								},
								options: [
									{
										name: 'option',
										displayName: 'Option',
										values: [
											{
												displayName: 'Option Key',
												name: 'key',
												type: 'string',
												default: '',
												placeholder: 'payments',
												description: 'Key identifier returned if this option is selected',
												required: true,
											},
											{
												displayName: 'Criterion Description',
												name: 'description',
												type: 'string',
												default: '',
												placeholder: 'Checkout, billing, or payment processing issues.',
												description: 'Definition of when this option should be selected',
												required: true,
											},
										],
									},
								],
							},
							// Score Criteria
							{
								displayName: 'Scale Levels (Ordered)',
								name: 'scoreLevels',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
								},
								default: {},
								description: 'Ordered scale criteria (from lowest index 0 to highest index N-1)',
								displayOptions: {
									show: {
										type: ['score'],
									},
								},
								options: [
									{
										name: 'level',
										displayName: 'Scale Level',
										values: [
											{
												displayName: 'Criterion Description',
												name: 'description',
												type: 'string',
												default: '',
												placeholder: 'Can wait for the next release',
												description: 'Description of this level in the ordered scale',
												required: true,
											},
										],
									},
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Questions JSON',
				name: 'questionsJson',
				type: 'json',
				default: '{\n  "is_bug": {\n    "type": "noul",\n    "instructions": "Is the customer reporting a software defect?",\n    "criteria": {\n      "true": "The customer describes broken or unexpected product behavior.",\n      "false": "The customer is asking a question or requesting a feature."\n    }\n  }\n}',
				description: 'JSON object defining the questions map conforming to OpenRouter Decisions schema',
				displayOptions: {
					show: {
						questionMode: ['json'],
					},
				},
				required: true,
			},

			// 4. Advanced Options
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Simplify Output',
						name: 'simplify',
						type: 'boolean',
						default: true,
						description: 'Whether to expose typed decision values at the root of the output JSON for instant downstream branching in If and Switch nodes',
					},
					{
						displayName: 'Flag Ambiguity',
						name: 'flagAmbiguity',
						type: 'boolean',
						default: false,
						description: 'Whether to automatically flag ambiguous decisions when confidence is low or boolean probability is near 0.5',
					},
					{
						displayName: 'Ambiguity Confidence Threshold',
						name: 'ambiguityThreshold',
						type: 'number',
						typeOptions: {
							minValue: 0.1,
							maxValue: 0.99,
							numberStepSize: 0.05,
						},
						default: 0.6,
						description: 'Confidence score below which a decision is marked as ambiguous (or noul probability near 0.5)',
						displayOptions: {
							show: {
								flagAmbiguity: [true],
							},
						},
					},
					{
						displayName: 'Allow Fallbacks',
						name: 'allowFallbacks',
						type: 'boolean',
						default: true,
						description: 'Whether OpenRouter may route to fallback providers if the primary provider encounters an error',
					},
					{
						displayName: 'Session ID',
						name: 'sessionId',
						type: 'string',
						default: '',
						placeholder: 'session-1234',
						description: 'A unique identifier for grouping related requests in OpenRouter Broadcast and private logging (max 256 chars)',
					},
					{
						displayName: 'Trace ID',
						name: 'traceId',
						type: 'string',
						default: '',
						placeholder: 'trace-abc123',
						description: 'Trace identifier for observability pipelines',
					},
					{
						displayName: 'Trace Name',
						name: 'traceName',
						type: 'string',
						default: '',
						placeholder: 'ticket-routing-pipeline',
						description: 'Trace name for observability pipelines',
					},
					{
						displayName: 'Custom Site URL (HTTP-Referer)',
						name: 'siteUrl',
						type: 'string',
						default: '',
						placeholder: 'https://mycompany.com',
						description: 'Override HTTP-Referer header for app attribution on OpenRouter',
					},
					{
						displayName: 'Custom App Title (X-Title)',
						name: 'siteTitle',
						type: 'string',
						default: '',
						placeholder: 'Support Ticket Router',
						description: 'Override X-Title header for app attribution on OpenRouter',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials<{ apiKey: string; siteUrl?: string; appName?: string }>('openRouterCommunityApi');

		for (let i = 0; i < items.length; i++) {
			try {
				// 1. Resolve Model
				const modelSelect = this.getNodeParameter('modelSelect', i, 'typesafe/jev-1.13') as string;
				let model = modelSelect;
				if (modelSelect === 'custom') {
					model = (this.getNodeParameter('customModel', i, '') as string).trim();
					if (!model) {
						throw new NodeOperationError(this.getNode(), 'Please specify a Custom Model ID', { itemIndex: i });
					}
				}

				// 2. Resolve State
				const stateMode = this.getNodeParameter('stateMode', i, 'currentItem') as string;
				let state: any;

				if (stateMode === 'currentItem') {
					state = items[i].json;
					if (!state || (typeof state === 'object' && Object.keys(state).length === 0)) {
						throw new NodeOperationError(
							this.getNode(),
							'The incoming item JSON is empty. Please provide valid input data or choose another State Mode.',
							{ itemIndex: i },
						);
					}
				} else if (stateMode === 'fieldBuilder') {
					const stateFields = this.getNodeParameter('stateFields', i, {}) as {
						field?: Array<{ key: string; value: string }>;
					};
					const builtState: Record<string, string> = {};
					if (stateFields.field && Array.isArray(stateFields.field)) {
						for (const f of stateFields.field) {
							const k = (f.key || '').trim();
							if (k) {
								builtState[k] = f.value ?? '';
							}
						}
					}
					if (Object.keys(builtState).length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Please define at least one field in State Fields',
							{ itemIndex: i },
						);
					}
					state = builtState;
				} else if (stateMode === 'json') {
					const rawJson = this.getNodeParameter('stateJson', i, {}) as any;
					if (typeof rawJson === 'string') {
						try {
							state = JSON.parse(rawJson);
						} catch (err: any) {
							throw new NodeOperationError(this.getNode(), `Invalid State JSON: ${err.message}`, { itemIndex: i });
						}
					} else if (typeof rawJson === 'object' && rawJson !== null) {
						state = rawJson;
					} else {
						throw new NodeOperationError(this.getNode(), 'State JSON must be a valid JSON object or string', { itemIndex: i });
					}
					if (!state || (typeof state === 'object' && Object.keys(state).length === 0)) {
						throw new NodeOperationError(this.getNode(), 'State JSON cannot be empty', { itemIndex: i });
					}
				} else if (stateMode === 'string') {
					state = this.getNodeParameter('stateString', i, '') as string;
					if (!state || (typeof state === 'string' && !state.trim())) {
						throw new NodeOperationError(this.getNode(), 'Please provide State Text to evaluate', { itemIndex: i });
					}
				}

				// 3. Resolve Questions
				const questionMode = this.getNodeParameter('questionMode', i, 'builder') as string;
				let questions: Record<string, any> = {};

				if (questionMode === 'json') {
					const rawQuestions = this.getNodeParameter('questionsJson', i, {}) as any;
					if (typeof rawQuestions === 'string') {
						try {
							questions = JSON.parse(rawQuestions);
						} catch (err: any) {
							throw new NodeOperationError(this.getNode(), `Invalid Questions JSON: ${err.message}`, { itemIndex: i });
						}
					} else if (typeof rawQuestions === 'object' && rawQuestions !== null) {
						questions = rawQuestions;
					} else {
						throw new NodeOperationError(this.getNode(), 'Questions JSON must be a valid JSON object or string', { itemIndex: i });
					}
				} else {
					const questionsBuilder = this.getNodeParameter('questionsBuilder', i, {}) as {
						question?: Array<{
							name: string;
							type: 'noul' | 'choice' | 'score';
							instructions: string;
							criteriaTrue?: string;
							criteriaFalse?: string;
							choiceOptions?: { option?: Array<{ key: string; description: string }> };
							scoreLevels?: { level?: Array<{ description: string }> };
						}>;
					};

					if (!questionsBuilder.question || questionsBuilder.question.length === 0) {
						throw new NodeOperationError(this.getNode(), 'Please define at least one Question in Questions Builder', { itemIndex: i });
					}

					for (const q of questionsBuilder.question) {
						const qName = (q.name || '').trim();
						if (!qName) continue;

						const qInstructions = (q.instructions || '').trim();
						if (!qInstructions) {
							throw new NodeOperationError(
								this.getNode(),
								`Please provide instructions for question '${qName}'`,
								{ itemIndex: i },
							);
						}

						if (q.type === 'noul') {
							questions[qName] = {
								type: 'noul',
								instructions: qInstructions,
								criteria: {
									true: q.criteriaTrue || 'True condition holds.',
									false: q.criteriaFalse || 'False condition holds.',
								},
							};
						} else if (q.type === 'choice') {
							const criteria: Record<string, string> = {};
							const optionsList = q.choiceOptions?.option || [];
							for (const opt of optionsList) {
								const optKey = (opt.key || '').trim();
								if (optKey) {
									criteria[optKey] = opt.description ?? '';
								}
							}
							if (Object.keys(criteria).length === 0) {
								throw new NodeOperationError(
									this.getNode(),
									`Choice question '${qName}' must have at least one option defined`,
									{ itemIndex: i },
								);
							}
							questions[qName] = {
								type: 'choice',
								instructions: qInstructions,
								criteria,
							};
						} else if (q.type === 'score') {
							const levelsList = q.scoreLevels?.level || [];
							const criteria = levelsList
								.map((lvl) => (lvl.description || '').trim())
								.filter((desc) => desc.length > 0);
							if (criteria.length === 0) {
								throw new NodeOperationError(
									this.getNode(),
									`Score question '${qName}' must have at least one scale level defined`,
									{ itemIndex: i },
								);
							}
							questions[qName] = {
								type: 'score',
								instructions: qInstructions,
								criteria,
							};
						}
					}
				}

				if (Object.keys(questions).length === 0) {
					throw new NodeOperationError(this.getNode(), 'No valid questions were defined for this decision request', { itemIndex: i });
				}

				// 4. Resolve Options & Request Payload
				const options = this.getNodeParameter('options', i, {}) as {
					simplify?: boolean;
					flagAmbiguity?: boolean;
					ambiguityThreshold?: number;
					allowFallbacks?: boolean;
					sessionId?: string;
					traceId?: string;
					traceName?: string;
					siteUrl?: string;
					siteTitle?: string;
				};

				const payload: Record<string, any> = {
					model,
					state,
					questions,
				};

				if (options.allowFallbacks !== undefined) {
					payload.provider = { allow_fallbacks: options.allowFallbacks };
				}

				if (options.sessionId) {
					payload.session_id = options.sessionId;
				}

				if (options.traceId || options.traceName) {
					payload.trace = {};
					if (options.traceId) payload.trace.trace_id = options.traceId;
					if (options.traceName) payload.trace.trace_name = options.traceName;
				}

				// 5. Construct Headers
				const headers: Record<string, string> = {
					'Authorization': `Bearer ${credentials.apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': options.siteUrl || credentials.siteUrl || 'https://n8n.io',
					'X-Title': options.siteTitle || credentials.appName || 'n8n Decisions Workflow',
				};

				if (options.sessionId) {
					headers['x-session-id'] = options.sessionId;
				}

				// 6. Execute HTTP Request to OpenRouter Decisions API
				let response = await this.helpers.request({
					method: 'POST',
					url: 'https://openrouter.ai/api/alpha/decisions',
					headers,
					body: payload,
					json: true,
				});

				if (typeof response === 'string') {
					try {
						response = JSON.parse(response);
					} catch (_) {}
				}

				if (response && response.error) {
					const errMsg = response.error.message || JSON.stringify(response.error);
					throw new NodeOperationError(this.getNode(), `OpenRouter Decisions error: ${errMsg}`, { itemIndex: i });
				}

				if (!response || !response.answers) {
					throw new NodeOperationError(this.getNode(), 'OpenRouter Decisions response is missing answers payload', { itemIndex: i });
				}

				// 7. Format Output Data
				const simplify = options.simplify !== false;
				const flagAmbiguity = options.flagAmbiguity === true;
				const threshold = options.ambiguityThreshold ?? 0.6;

				const answers = response.answers || {};
				const outputJson: Record<string, any> = { ...response };

				if (simplify) {
					const decisions: Record<string, any> = {};
					const confidences: Record<string, number> = {};
					const verdicts: Record<string, boolean> = {};
					let isAmbiguous = false;
					const ambiguityReasons: string[] = [];

					for (const [key, answer] of Object.entries<any>(answers)) {
						if (!answer) continue;

						if (answer.type === 'noul') {
							decisions[key] = answer.noul;
							verdicts[key] = answer.noul >= 0.5;
							// Confidence of a binary probability is its decisive distance from 0.5 (scaled 0.0 to 1.0)
							const noulConfidence = Number((Math.abs(answer.noul - 0.5) * 2).toFixed(4));
							confidences[key] = noulConfidence;

							if (noulConfidence < threshold) {
								isAmbiguous = true;
								ambiguityReasons.push(
									`Question '${key}' confidence (${noulConfidence.toFixed(2)}) is below threshold (${threshold}) with probability ${answer.noul}`,
								);
							}
						} else if (answer.type === 'choice') {
							decisions[key] = answer.choice;
							if (typeof answer.confidence === 'number') {
								confidences[key] = answer.confidence;
								if (answer.confidence < threshold) {
									isAmbiguous = true;
									ambiguityReasons.push(
										`Question '${key}' confidence (${answer.confidence}) is below threshold (${threshold})`,
									);
								}
							}
						} else if (answer.type === 'score') {
							decisions[key] = answer.score;
							if (typeof answer.confidence === 'number') {
								confidences[key] = answer.confidence;
								if (answer.confidence < threshold) {
									isAmbiguous = true;
									ambiguityReasons.push(
										`Question '${key}' confidence (${answer.confidence}) is below threshold (${threshold})`,
									);
								}
							}
						}
					}

					outputJson.decision = decisions;
					if (Object.keys(verdicts).length > 0) {
						outputJson.verdict = verdicts;
					}
					if (Object.keys(confidences).length > 0) {
						outputJson.confidence = confidences;
					}

					if (flagAmbiguity) {
						outputJson.isAmbiguous = isAmbiguous;
						outputJson.ambiguityReasons = ambiguityReasons;
					}
				}

				returnData.push({
					json: outputJson,
					pairedItem: { item: i },
				});
			} catch (error: any) {
				const errorMessage =
					error.response?.body?.error?.message ||
					error.error?.message ||
					error.message ||
					String(error);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							statusCode: error.statusCode || error.response?.status,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (error instanceof NodeOperationError) {
					throw error;
				}

				throw new NodeOperationError(
					this.getNode(),
					`OpenRouter Decisions error: ${errorMessage}`,
					{ itemIndex: i },
				);
			}
		}

		return [returnData];
	}
}
