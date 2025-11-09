import { createOpenAIHandler } from './openAICompatible.js';

/**
 * Обработчик для ChatGPT (OpenAI)
 */
export const handleChatGPT = createOpenAIHandler({
  serviceName: 'OpenAI',
  envVarName: 'OPENAI_API_KEY',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  defaultModel: 'gpt-3.5-turbo',
});

