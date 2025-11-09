/**
 * Форматирует сообщения для OpenAI-совместимых API (DeepSeek, ChatGPT)
 */
export function formatOpenAIMessages(messages, systemPrompt) {
  return [
    ...(systemPrompt ? [{
      role: 'system',
      content: systemPrompt,
    }] : []),
    ...messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
      content: msg.text || msg.content || '',
    })),
  ];
}

/**
 * Извлекает текст из ответа OpenAI-совместимого API
 */
export function extractOpenAIResponse(data) {
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response format from API');
  }
  return data.choices[0].message.content;
}

