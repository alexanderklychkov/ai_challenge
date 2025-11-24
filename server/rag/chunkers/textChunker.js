/**
 * Разбивает текст на чанки для индексации
 */
export class TextChunker {
  /**
   * Разбивает текст на чанки
   * @param {string} text - Текст для разбивки
   * @param {object} options - Опции разбивки
   * @param {number} options.chunkSize - Размер чанка в символах
   * @param {number} options.chunkOverlap - Перекрытие между чанками в символах
   * @param {string} options.separator - Разделитель для разбивки
   * @returns {Array<{text: string, startIndex: number, endIndex: number}>}
   */
  static chunkText(text, options = {}) {
    const {
      chunkSize = 1000,
      chunkOverlap = 200,
      separator = '\n\n',
    } = options;

    if (!text || text.length === 0) {
      return [];
    }

    // Если текст меньше размера чанка, возвращаем его целиком
    if (text.length <= chunkSize) {
      return [{
        text: text.trim(),
        startIndex: 0,
        endIndex: text.length,
      }];
    }

    const chunks = [];
    
    // Пытаемся разбить по разделителю
    const parts = text.split(separator);
    let currentChunk = '';
    let currentStartIndex = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      const potentialChunk = currentChunk 
        ? `${currentChunk}${separator}${part}`
        : part;

      // Если добавление части не превышает размер чанка
      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Сохраняем текущий чанк
        if (currentChunk) {
          const chunkEndIndex = currentStartIndex + currentChunk.length;
          chunks.push({
            text: currentChunk,
            startIndex: currentStartIndex,
            endIndex: chunkEndIndex,
          });

          // Начинаем новый чанк с перекрытием
          const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
          currentChunk = overlapText ? `${overlapText}${separator}${part}` : part;
          currentStartIndex = chunkEndIndex - (overlapText?.length || 0);
        } else {
          // Если даже одна часть больше чанка, разбиваем её по словам
          const subChunks = this.chunkByWords(part, chunkSize, chunkOverlap, currentStartIndex);
          chunks.push(...subChunks);
          if (subChunks.length > 0) {
            const lastChunk = subChunks[subChunks.length - 1];
            currentStartIndex = lastChunk.endIndex;
            currentChunk = '';
          }
        }
      }
    }

    // Добавляем последний чанк
    if (currentChunk) {
      chunks.push({
        text: currentChunk,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + currentChunk.length,
      });
    }

    return chunks.filter(chunk => chunk.text.trim().length > 0);
  }

  /**
   * Разбивает текст по словам
   */
  static chunkByWords(text, chunkSize, chunkOverlap, startIndex = 0) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = '';
    let currentStartIndex = startIndex;

    for (const word of words) {
      const potentialChunk = currentChunk 
        ? `${currentChunk} ${word}`
        : word;

      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          const chunkEndIndex = currentStartIndex + currentChunk.length;
          chunks.push({
            text: currentChunk,
            startIndex: currentStartIndex,
            endIndex: chunkEndIndex,
          });

          // Перекрытие
          const overlapWords = this.getOverlapWords(currentChunk, chunkOverlap);
          currentChunk = overlapWords ? `${overlapWords} ${word}` : word;
          currentStartIndex = chunkEndIndex - (overlapWords?.length || 0);
        } else {
          // Если даже одно слово больше чанка, разбиваем по символам
          const subChunks = this.chunkByCharacters(word, chunkSize, chunkOverlap, currentStartIndex);
          chunks.push(...subChunks);
          if (subChunks.length > 0) {
            const lastChunk = subChunks[subChunks.length - 1];
            currentStartIndex = lastChunk.endIndex;
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push({
        text: currentChunk,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + currentChunk.length,
      });
    }

    return chunks;
  }

  /**
   * Разбивает текст по символам (последний резерв)
   */
  static chunkByCharacters(text, chunkSize, chunkOverlap, startIndex = 0) {
    const chunks = [];
    let i = 0;

    while (i < text.length) {
      const chunk = text.slice(i, i + chunkSize);
      chunks.push({
        text: chunk,
        startIndex: startIndex + i,
        endIndex: startIndex + i + chunk.length,
      });
      i += chunkSize - chunkOverlap;
    }

    return chunks;
  }

  /**
   * Получает текст для перекрытия из конца чанка
   */
  static getOverlapText(text, overlapSize) {
    if (text.length <= overlapSize) {
      return text;
    }
    return text.slice(-overlapSize);
  }

  /**
   * Получает слова для перекрытия
   */
  static getOverlapWords(text, overlapSize) {
    const words = text.split(/\s+/);
    let overlapText = '';
    
    for (let i = words.length - 1; i >= 0; i--) {
      const potentialOverlap = words[i] + (overlapText ? ' ' + overlapText : '');
      if (potentialOverlap.length <= overlapSize) {
        overlapText = potentialOverlap;
      } else {
        break;
      }
    }
    
    return overlapText;
  }

  /**
   * Разбивает документ на чанки с сохранением метаданных
   * @param {{text: string, metadata: object}} document - Документ для разбивки
   * @param {object} options - Опции разбивки
   * @returns {Array<{text: string, metadata: object, chunkIndex: number}>}
   */
  static chunkDocument(document, options = {}) {
    const chunks = this.chunkText(document.text, options);
    
    return chunks.map((chunk, index) => ({
      text: chunk.text,
      metadata: {
        ...document.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
      },
      chunkIndex: index,
    }));
  }
}


