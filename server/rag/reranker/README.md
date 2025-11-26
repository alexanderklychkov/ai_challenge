# Reranker для RAG системы

Модуль для улучшения релевантности результатов поиска в RAG системе через reranking и фильтрацию.

## Возможности

- **Фильтрация по порогу релевантности** - простой и быстрый способ отсечения нерелевантных результатов
- **LLM-based reranking** - использование языковой модели для более точной оценки релевантности
- **Гибридный подход** - комбинация пороговой фильтрации и LLM оценки для оптимального баланса скорости и качества

## Стратегии reranking

### 1. Threshold (порог)
Простая фильтрация результатов по порогу score. Самый быстрый метод.

```javascript
{
  strategy: 'threshold',
  threshold: 0.5, // Порог релевантности (0-1)
  topKAfterRerank: 5 // Количество результатов после фильтрации
}
```

### 2. LLM Score
Использование LLM для оценки релевантности каждого результата. Более точный, но медленнее.

```javascript
{
  strategy: 'llm_score',
  threshold: 0.5,
  topKAfterRerank: 5,
  llmCaller: async (prompt, messages) => { /* ... */ }
}
```

### 3. Hybrid (гибридный)
Сначала применяется пороговая фильтрация, затем LLM оценивает топ результаты. Оптимальный баланс.

```javascript
{
  strategy: 'hybrid',
  threshold: 0.5,
  topKAfterRerank: 5,
  llmCaller: async (prompt, messages) => { /* ... */ }
}
```

## Использование

### В RAGService

```javascript
import { RAGService } from './rag/ragService.js';
import { RerankStrategy } from './rag/reranker/relevanceReranker.js';

// Создание RAGService с reranker
const rerankerConfig = {
  strategy: RerankStrategy.THRESHOLD,
  relevanceThreshold: 0.5,
  topKAfterRerank: 5,
};

const ragService = new RAGService(indexer, rerankerConfig);

// Запрос с reranker
const result = await ragService.queryWithRAG(question, llmCaller, {
  topK: 10,
  minScore: 0.3,
  useReranker: true,
  reranker: {
    strategy: 'threshold',
    threshold: 0.6,
    topKAfterRerank: 5,
  },
});
```

### Сравнение качества

```javascript
// Сравнение ответов с фильтром и без фильтра
const comparison = await ragService.compareWithAndWithoutReranker(question, llmCaller, {
  topK: 10,
  minScore: 0.3,
  reranker: {
    strategy: 'threshold',
    threshold: 0.5,
  },
});

console.log('С фильтром:', comparison.withReranker.answer);
console.log('Без фильтра:', comparison.withoutReranker.answer);
console.log('Разница в чанках:', comparison.comparison.chunksDifference);
console.log('Средний score с фильтром:', comparison.comparison.avgScoreWithReranker);
```

## API Endpoints

### Запрос с RAG и reranker

```bash
POST /api/rag/query
{
  "question": "Ваш вопрос",
  "modelType": "deepseek",
  "topK": 10,
  "minScore": 0.3,
  "useReranker": true,
  "reranker": {
    "strategy": "threshold",
    "threshold": 0.5,
    "topKAfterRerank": 5
  }
}
```

### Сравнение с фильтром и без

```bash
POST /api/rag/compare-reranker
{
  "question": "Ваш вопрос",
  "modelType": "deepseek",
  "topK": 10,
  "minScore": 0.3,
  "reranker": {
    "strategy": "threshold",
    "threshold": 0.5
  }
}
```

## Настройка порога отсечения

Порог релевантности (`threshold`) определяет, какие результаты будут включены в финальный ответ:

- **0.0-0.3** - очень низкий порог, включает почти все результаты (может быть шум)
- **0.4-0.6** - средний порог, баланс между релевантностью и количеством результатов
- **0.7-0.9** - высокий порог, только очень релевантные результаты (может быть слишком строго)
- **0.9-1.0** - очень высокий порог, только идеально релевантные результаты

Рекомендуется начать с **0.5** и настроить в зависимости от качества результатов.

## Статистика reranking

После применения reranker доступна статистика:

```javascript
{
  originalCount: 10,        // Количество результатов до reranking
  rerankedCount: 5,         // Количество результатов после reranking
  filteredOut: 5,           // Отфильтровано результатов
  strategy: "threshold",    // Использованная стратегия
  threshold: 0.5,           // Порог релевантности
  avgOriginalScore: 0.45,   // Средний score до reranking
  avgRerankedScore: 0.72    // Средний score после reranking
}
```

## Рекомендации

1. **Для быстрых запросов**: используйте `threshold` стратегию
2. **Для максимальной точности**: используйте `llm_score` стратегию
3. **Для баланса**: используйте `hybrid` стратегию
4. **Настройка порога**: начните с 0.5 и корректируйте на основе результатов
5. **Мониторинг**: отслеживайте статистику reranking для оптимизации параметров

