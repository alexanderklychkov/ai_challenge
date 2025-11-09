import { createOpenAIHandler } from './openAICompatible.js';

/**
 * Обработчик для DeepSeek
 */
export const handleDeepSeek = createOpenAIHandler({
  serviceName: 'DeepSeek',
  envVarName: 'DEEPSEEK_API_KEY',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  defaultModel: 'deepseek-chat',
});

