# AI Ассистент поддержки пользователей - Сводка

## Что было создано

### 1. MCP сервер для CRM (`server/mcp/servers/crmMCP.js`)
- Интеграция с CRM через Model Context Protocol
- Инструменты для работы с пользователями и тикетами
- Автоматическая регистрация в оркестраторе MCP

### 2. Инструменты CRM (`server/mcp/tools/crm.js`)
- `getUser` - получение информации о пользователе
- `getUserTickets` - получение тикетов пользователя
- `getTicket` - получение информации о тикете
- `searchTickets` - поиск тикетов по ключевым словам
- `createTicket` - создание нового тикета
- `addTicketMessage` - добавление сообщения в тикет
- `updateTicketStatus` - обновление статуса тикета

### 3. Структура данных CRM
- `server/data/crm/users.json` - список пользователей
- `server/data/crm/tickets.json` - список тикетов поддержки

### 4. Сервис поддержки (`server/support/supportService.js`)
- Интеграция RAG для поиска в документации
- Интеграция MCP для работы с CRM
- Автоматическое извлечение контекста (email, ticketId)
- Поиск похожих решенных проблем
- Формирование контекстных ответов

### 5. API Endpoint (`/api/support/query`)
- Обработка вопросов поддержки
- Учет контекста пользователя и тикетов
- Интеграция с различными LLM моделями

### 6. FAQ и документация
- `server/data/documents/faq.md` - часто задаваемые вопросы
- `server/support/README.md` - документация сервиса
- `server/support/USAGE.md` - руководство по использованию

## Как использовать

### Быстрый старт

1. **Проиндексируйте FAQ:**
```bash
node server/rag/scripts/indexDocuments.js --file server/data/documents/faq.md
```

2. **Запустите сервер:**
```bash
npm run dev:server
```

3. **Протестируйте:**
```bash
curl -X POST http://localhost:3001/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Почему не работает авторизация?",
    "modelType": "deepseek",
    "userEmail": "ivan.petrov@example.com"
  }'
```

## Пример работы

**Вопрос:** "Почему не работает авторизация?"

**Что делает система:**
1. Извлекает email пользователя (если указан)
2. Загружает информацию о пользователе из CRM
3. Находит открытые тикеты пользователя
4. Ищет похожие решенные тикеты
5. Ищет релевантную информацию в FAQ через RAG
6. Формирует ответ с учетом всего контекста

**Ответ включает:**
- Решение на основе FAQ
- Информацию о похожих решенных проблемах
- Контекст текущих тикетов пользователя

## Структура файлов

```
server/
├── mcp/
│   ├── servers/
│   │   └── crmMCP.js          # MCP сервер для CRM
│   ├── tools/
│   │   └── crm.js             # Инструменты CRM
│   └── init.js                # Регистрация CRM MCP
├── support/
│   ├── supportService.js       # Основной сервис поддержки
│   ├── README.md              # Документация
│   └── USAGE.md               # Руководство
├── data/
│   ├── crm/
│   │   ├── users.json         # Пользователи
│   │   └── tickets.json       # Тикеты
│   └── documents/
│       └── faq.md             # FAQ для индексации
└── index.js                   # API endpoint /api/support/query
```

## Интеграция

Сервис интегрирован с:
- ✅ RAG системой для поиска в документации
- ✅ MCP оркестратором для работы с CRM
- ✅ Существующими LLM handlers (DeepSeek, YandexGPT, ChatGPT, HuggingFace)
- ✅ Системой индексации документов

## Следующие шаги

1. **Проиндексируйте FAQ** перед использованием
2. **Добавьте больше тикетов** в `server/data/crm/tickets.json` для лучшего контекста
3. **Расширьте FAQ** в `server/data/documents/faq.md` для более полных ответов
4. **Настройте промпты** в `supportService.js` под ваши нужды
5. **Интегрируйте с фронтендом** используя `/api/support/query`

## Примеры интеграции

### React компонент
```tsx
const response = await fetch('/api/support/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: userQuestion,
    modelType: 'deepseek',
    userEmail: currentUser.email,
  }),
});
```

### Создание тикета
```javascript
import { callCRMMCPTool } from './mcp/servers/crmMCP.js';

await callCRMMCPTool('createTicket', {
  userEmail: 'user@example.com',
  subject: 'Проблема',
  description: 'Описание проблемы',
  priority: 'high',
});
```

## Документация

- Полная документация: `server/support/README.md`
- Руководство по использованию: `server/support/USAGE.md`
- FAQ: `server/data/documents/faq.md`

