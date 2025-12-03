# Сервис поддержки пользователей

AI ассистент для поддержки пользователей продукта AI Mentor с интеграцией RAG и MCP.

## Возможности

- 📚 **RAG для документации**: Использует RAG для поиска ответов в документации и FAQ
- 🎫 **Интеграция с CRM**: Работает с тикетами и пользователями через MCP
- 🔍 **Контекстная поддержка**: Учитывает историю тикетов пользователя и похожие решенные проблемы
- 💬 **Умные ответы**: Генерирует ответы с учетом всей доступной информации

## Как это работает

1. **Извлечение контекста**: Система автоматически извлекает email пользователя и ID тикета из вопроса
2. **Получение данных CRM**: Загружает информацию о пользователе и его тикетах через MCP
3. **Поиск похожих проблем**: Ищет решенные тикеты с похожими проблемами
4. **RAG поиск**: Находит релевантную информацию в документации и FAQ
5. **Генерация ответа**: Формирует ответ с учетом всего контекста

## API

### POST /api/support/query

Обрабатывает вопрос поддержки с учетом контекста пользователя и тикетов.

**Запрос:**
```json
{
  "question": "Почему не работает авторизация?",
  "modelType": "deepseek",
  "userEmail": "user@example.com",
  "ticketId": "ticket-123",
  "messages": [],
  "topK": 5,
  "minScore": 0.3,
  "model": "deepseek-chat",
  "temperature": 0.3,
  "max_tokens": 2000
}
```

**Ответ:**
```json
{
  "answer": "Ответ ассистента...",
  "userContext": {
    "userFound": true,
    "userEmail": "user@example.com",
    "userName": "Иван Петров",
    "openTicketsCount": 2
  },
  "ticketContext": {
    "ticketFound": true,
    "ticketId": "ticket-123",
    "ticketStatus": "open"
  },
  "similarTickets": [
    {
      "id": "ticket-456",
      "subject": "Проблема с авторизацией",
      "description": "..."
    }
  ],
  "ragChunks": [
    {
      "text": "Релевантный фрагмент документации...",
      "source": "faq.md",
      "score": 0.85
    }
  ],
  "metadata": {
    "tokens": 1500,
    "inputTokens": 1200,
    "outputTokens": 300
  }
}
```

## Примеры использования

### Пример 1: Вопрос с email в тексте

```bash
curl -X POST http://localhost:3001/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Привет, я ivan.petrov@example.com, почему не работает авторизация?",
    "modelType": "deepseek"
  }'
```

Система автоматически:
- Извлечет email из вопроса
- Загрузит информацию о пользователе
- Найдет открытые тикеты пользователя
- Использует контекст для ответа

### Пример 2: Вопрос с указанием тикета

```bash
curl -X POST http://localhost:3001/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Что с тикетом ticket-1?",
    "modelType": "deepseek"
  }'
```

Система:
- Найдет тикет по ID
- Загрузит историю сообщений тикета
- Использует контекст тикета для ответа

### Пример 3: Общий вопрос без контекста

```bash
curl -X POST http://localhost:3001/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Как перейти на премиум тариф?",
    "modelType": "deepseek"
  }'
```

Система:
- Найдет релевантную информацию в FAQ через RAG
- Найдет похожие решенные тикеты
- Сформирует ответ на основе документации

## Структура данных CRM

### Пользователи (server/data/crm/users.json)

```json
{
  "id": "user-1",
  "email": "user@example.com",
  "name": "Иван Петров",
  "role": "premium",
  "status": "active",
  "createdAt": "2024-01-15T10:00:00Z",
  "lastLogin": "2024-12-20T14:30:00Z",
  "metadata": {
    "company": "ООО ТехноСофт",
    "phone": "+7 (999) 123-45-67"
  }
}
```

### Тикеты (server/data/crm/tickets.json)

```json
{
  "id": "ticket-1",
  "userId": "user-1",
  "userEmail": "user@example.com",
  "subject": "Проблема с авторизацией",
  "description": "Не могу войти в систему...",
  "status": "open",
  "priority": "high",
  "category": "authentication",
  "createdAt": "2024-12-20T10:00:00Z",
  "updatedAt": "2024-12-20T10:00:00Z",
  "messages": [
    {
      "id": "msg-1",
      "author": "user",
      "text": "Не могу войти в систему",
      "timestamp": "2024-12-20T10:00:00Z"
    }
  ],
  "tags": ["авторизация", "вход", "ошибка"]
}
```

## MCP инструменты CRM

Сервис использует следующие MCP инструменты:

- `getUser` - Получить информацию о пользователе
- `getUserTickets` - Получить тикеты пользователя
- `getTicket` - Получить информацию о тикете
- `searchTickets` - Поиск тикетов по ключевым словам
- `createTicket` - Создать новый тикет
- `addTicketMessage` - Добавить сообщение в тикет
- `updateTicketStatus` - Обновить статус тикета

## Индексация FAQ

Для работы RAG необходимо проиндексировать FAQ:

```bash
curl -X POST http://localhost:3001/api/documents/index/file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "server/data/documents/faq.md"
  }'
```

Или через скрипт:

```bash
node server/rag/scripts/indexDocuments.js
```

## Настройка

Сервис автоматически использует существующую инфраструктуру:
- RAG сервис из `server/rag/ragService.js`
- MCP оркестратор для работы с CRM
- LLM handlers для различных моделей

## Расширение функциональности

### Добавление новых источников данных

Вы можете расширить сервис, добавив:
- Интеграцию с внешними CRM системами
- Дополнительные источники документации
- Кастомные промпты для специфических категорий вопросов

### Настройка промптов

Промпты формируются в методе `buildSupportPrompt` класса `SupportService`. Вы можете настроить формат промпта для ваших нужд.

## Примеры интеграции

### Использование в Telegram боте

```javascript
import { SupportService } from './support/supportService.js';
import { RAGService } from './rag/ragService.js';

const ragService = new RAGService(indexer);
const supportService = new SupportService(ragService);

// Обработка сообщения от пользователя
const result = await supportService.processSupportQuestion(
  userMessage,
  llmCaller,
  {
    userEmail: user.email,
    ticketId: currentTicket?.id,
  }
);
```

### Использование в веб-интерфейсе

```typescript
const response = await fetch('/api/support/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: userQuestion,
    modelType: 'deepseek',
    userEmail: currentUser.email,
  }),
});

const result = await response.json();
```

