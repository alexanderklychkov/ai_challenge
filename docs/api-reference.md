# API Reference

## AI Models API

### Yandex GPT
**Endpoint**: `POST /api/yandex-gpt`

**Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "Привет!" }
  ],
  "model": "yandexgpt",
  "temperature": 0.3,
  "max_tokens": 2000,
  "system_prompt": ""
}
```

**Response**:
```json
{
  "content": "Ответ модели",
  "tokens": 150,
  "inputTokens": 10,
  "outputTokens": 140,
  "cost": 0.0001
}
```

### DeepSeek
**Endpoint**: `POST /api/deepseek`

Аналогично Yandex GPT, но использует DeepSeek API.

### ChatGPT
**Endpoint**: `POST /api/chatgpt`

Аналогично Yandex GPT, но использует OpenAI API.

### HuggingFace
**Endpoint**: `POST /api/huggingface`

Аналогично Yandex GPT, но использует HuggingFace Inference Providers.

## RAG API

### Query with RAG
**Endpoint**: `POST /api/rag/query`

**Request Body**:
```json
{
  "question": "Как работает RAG?",
  "modelType": "deepseek",
  "messages": [],
  "topK": 5,
  "minScore": 0.3,
  "model": "deepseek-chat",
  "temperature": 0.3,
  "max_tokens": 2000,
  "useReranker": false,
  "reranker": {
    "strategy": "threshold",
    "threshold": 0.5,
    "topKAfterRerank": 5
  }
}
```

**Response**:
```json
{
  "answer": "Ответ на основе RAG",
  "chunks": [
    {
      "text": "Фрагмент документа...",
      "score": 0.85,
      "source": "document.md"
    }
  ],
  "chunksCount": 3,
  "usedRAG": true,
  "metadata": {
    "topK": 5,
    "minScore": 0.3,
    "tokens": 200
  }
}
```

### Compare RAG vs No RAG
**Endpoint**: `POST /api/rag/compare`

Сравнивает ответы с использованием RAG и без него.

### Search Documents
**Endpoint**: `POST /api/documents/search`

**Request Body**:
```json
{
  "query": "поисковый запрос",
  "topK": 5,
  "minScore": 0.5
}
```

### Index File
**Endpoint**: `POST /api/documents/index/file`

**Request Body**:
```json
{
  "filePath": "path/to/file.md"
}
```

### Index Directory
**Endpoint**: `POST /api/documents/index/directory`

**Request Body**:
```json
{
  "dirPath": "path/to/directory",
  "ignorePatterns": [".git", "node_modules"]
}
```

## MCP API

### Get Servers
**Endpoint**: `GET /api/mcp/servers`

Возвращает список зарегистрированных MCP серверов.

### Get Tools
**Endpoint**: `GET /api/mcp/tools`

**Query Parameters**:
- `category` - Фильтр по категории
- `minPriority` - Минимальный приоритет

Возвращает список доступных инструментов.

### Get History
**Endpoint**: `GET /api/mcp/history`

**Query Parameters**:
- `serverId` - Фильтр по серверу
- `toolName` - Фильтр по инструменту
- `limit` - Лимит записей

Возвращает историю выполнения инструментов.

## Chats API

### Get Chats
**Endpoint**: `GET /api/chats`

Возвращает список всех чатов.

### Create Chat
**Endpoint**: `POST /api/chats`

**Request Body**:
```json
{
  "title": "Новый чат"
}
```

### Get Chat Messages
**Endpoint**: `GET /api/chats/:chatId/messages`

Возвращает сообщения конкретного чата.

### Save Chat Messages
**Endpoint**: `POST /api/chats/:chatId/messages`

**Request Body**:
```json
{
  "messages": [
    {
      "id": "msg-1",
      "type": "user",
      "content": "Привет",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Learning API

### Get Tests
**Endpoint**: `GET /api/learning/tests`

**Query Parameters**:
- `topic` - Фильтр по теме

### Get Flashcards
**Endpoint**: `GET /api/learning/flashcards`

**Query Parameters**:
- `topic` - Фильтр по теме

### Get Study Plans
**Endpoint**: `GET /api/learning/study-plans`

**Query Parameters**:
- `topic` - Фильтр по теме

