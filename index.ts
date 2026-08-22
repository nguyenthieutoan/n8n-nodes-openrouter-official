import { OpenRouterCommunityApi } from './credentials/OpenRouterCommunityApi.credentials';
import { OpenRouter } from './nodes/OpenRouter/OpenRouter.node';
import { EmbeddingsOpenRouter } from './nodes/EmbeddingsOpenRouter/EmbeddingsOpenRouter.node';
import { RerankerOpenRouter } from './nodes/RerankerOpenRouter/RerankerOpenRouter.node';
import { OpenRouterCacheChatModel } from './nodes/OpenRouterCacheChatModel/OpenRouterCacheChatModel.node';

export const credentials = [OpenRouterCommunityApi];
export const nodes = [OpenRouter, EmbeddingsOpenRouter, RerankerOpenRouter, OpenRouterCacheChatModel];
