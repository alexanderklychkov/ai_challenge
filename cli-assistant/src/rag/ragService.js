/**
 * Сервис для работы с RAG (Retrieval-Augmented Generation)
 */

export class RAGService {
  constructor(indexer) {
    this.indexer = indexer;
  }

  buildRAGPrompt(question, chunks, noRelevantChunks = false) {
    if (!chunks || chunks.length === 0) {
      if (noRelevantChunks) {
        // Если нет релевантных чанков, просто возвращаем вопрос без ограничений
        // Модель может использовать инструменты для выполнения действий
        return question;
      }
      return question;
    }

    const contextText = chunks
      .map((chunk, index) => {
        const source = chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник';
        return `[Источник ${index + 1}: ${source}]\n${chunk.text}`;
      })
      .join('\n\n---\n\n');

    let prompt = `Используй следующую информацию из документов для ответа на вопрос. Если информация в документах не содержит ответа на вопрос, можешь использовать доступные инструменты для выполнения действий (например, создание задач, поиск информации и т.д.).

Контекст из документов:
${contextText}

Вопрос: ${question}

Ответ (можешь использовать инструменты если нужно):`;

    return prompt;
  }

  async searchRelevantChunks(question, topK = 5, minScore = 0.3) {
    try {
      const searchResults = await this.indexer.search(question, topK, minScore);

      return {
        chunks: searchResults.map(result => ({
          text: result.chunk.text,
          score: result.score,
          metadata: result.chunk.metadata,
          document: result.document,
        })),
      };
    } catch (error) {
      console.error('Ошибка при поиске релевантных чанков:', error);
      return { chunks: [] };
    }
  }

  async queryWithRAG(question, llmCaller, options = {}) {
    const { 
      topK = 5, 
      minScore = 0.3, 
      messages = [],
    } = options;

    const searchResult = await this.searchRelevantChunks(question, topK, minScore);
    const chunks = searchResult.chunks;
    
    const noRelevantChunks = chunks.length === 0;

    const ragPrompt = this.buildRAGPrompt(question, chunks, noRelevantChunks);

    const ragMessages = [
      ...messages.slice(0, -1),
      { role: 'user', content: ragPrompt },
    ];

    const response = await llmCaller(ragPrompt, ragMessages);
    
    let answer = response.text || response.content || response;

    return {
      answer: answer,
      chunks: chunks.map(chunk => ({
        text: chunk.text.substring(0, 200) + '...',
        score: chunk.score,
        source: chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник',
      })),
      chunksCount: chunks.length,
      usedRAG: true,
      metadata: {
        topK,
        minScore,
        tokens: response.tokens,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    };
  }
}

