import { OpenRouterApi } from './credentials/OpenRouterApi.credentials';
import { OpenRouter } from './nodes/OpenRouter/OpenRouter.node';
import { EmbeddingsOpenRouter } from './nodes/OpenRouterEmbeddings/EmbeddingsOpenRouter.node';
import { RerankerOpenRouter } from './nodes/OpenRouterReranker/RerankerOpenRouter.node';

export const credentials = [OpenRouterApi];
export const nodes = [OpenRouter, EmbeddingsOpenRouter, RerankerOpenRouter];
