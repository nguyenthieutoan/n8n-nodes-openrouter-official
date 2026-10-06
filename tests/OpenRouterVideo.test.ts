import { OpenRouterVideo } from '../nodes/OpenRouterVideo/OpenRouterVideo.node';

describe('OpenRouterVideo', () => {
	let node: OpenRouterVideo;

	beforeEach(() => {
		node = new OpenRouterVideo();
	});

	it('should be instantiable', () => {
		expect(node).toBeInstanceOf(OpenRouterVideo);
	});

	it('should have correct displayName', () => {
		expect(node.description.displayName).toBe('OpenRouter Video Studio');
	});

	it('should have correct internal name', () => {
		expect(node.description.name).toBe('openRouterVideo');
	});

	it('should use openRouterCommunityApi credentials', () => {
		const creds = node.description.credentials ?? [];
		expect(creds.some((c: any) => c.name === 'openRouterCommunityApi')).toBe(true);
	});

	it('should have main inputs and outputs', () => {
		expect(node.description.inputs).toContain('main');
		expect(node.description.outputs).toContain('main');
	});

	it('should expose a model resourceLocator property', () => {
		const props = node.description.properties;
		const modelProp = props.find((p: any) => p.name === 'model');
		expect(modelProp).toBeDefined();
		expect(modelProp?.type).toBe('resourceLocator');
	});

	it('should expose a prompt string property', () => {
		const props = node.description.properties;
		const promptProp = props.find((p: any) => p.name === 'prompt');
		expect(promptProp).toBeDefined();
		expect(promptProp?.type).toBe('string');
	});

	it('should expose enableImageToVideo boolean', () => {
		const props = node.description.properties;
		const p = props.find((p: any) => p.name === 'enableImageToVideo');
		expect(p).toBeDefined();
		expect(p?.type).toBe('boolean');
		expect(p?.default).toBe(false);
	});

	it('should expose videoOptions collection with expected sub-options', () => {
		const props = node.description.properties;
		const p = props.find((p: any) => p.name === 'videoOptions');
		expect(p).toBeDefined();
		expect(p?.type).toBe('collection');
		const optionNames = (p?.options ?? []).map((o: any) => o.name);
		expect(optionNames).toContain('aspectRatio');
		expect(optionNames).toContain('resolution');
		expect(optionNames).toContain('duration');
		expect(optionNames).toContain('generateAudio');
		expect(optionNames).toContain('seed');
		expect(optionNames).toContain('downloadVideo');
		expect(optionNames).toContain('pollTimeoutSecs');
		expect(optionNames).toContain('waitForCompletion');
	});

	it('should implement searchModels listSearch method', () => {
		expect(node.methods?.listSearch?.searchModels).toBeInstanceOf(Function);
	});

	it('should implement execute method', () => {
		expect(node.execute).toBeInstanceOf(Function);
	});
});
