/**
 * Разбивает текст на чанки для индексации
 */

export class TextChunker {
  static chunkText(text, options = {}) {
    const {
      chunkSize = 1000,
      chunkOverlap = 200,
      separator = '\n\n',
    } = options;

    if (!text || text.length === 0) {
      return [];
    }

    if (text.length <= chunkSize) {
      return [{
        text: text.trim(),
        startIndex: 0,
        endIndex: text.length,
      }];
    }

    const chunks = [];
    const parts = text.split(separator);
    let currentChunk = '';
    let currentStartIndex = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      const potentialChunk = currentChunk 
        ? `${currentChunk}${separator}${part}`
        : part;

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

          const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
          currentChunk = overlapText ? `${overlapText}${separator}${part}` : part;
          currentStartIndex = chunkEndIndex - (overlapText?.length || 0);
        } else {
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

    if (currentChunk) {
      chunks.push({
        text: currentChunk,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + currentChunk.length,
      });
    }

    return chunks.filter(chunk => chunk.text.trim().length > 0);
  }

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

          const overlapWords = this.getOverlapWords(currentChunk, chunkOverlap);
          currentChunk = overlapWords ? `${overlapWords} ${word}` : word;
          currentStartIndex = chunkEndIndex - (overlapWords?.length || 0);
        } else {
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

  static getOverlapText(text, overlapSize) {
    if (text.length <= overlapSize) {
      return text;
    }
    return text.slice(-overlapSize);
  }

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
















