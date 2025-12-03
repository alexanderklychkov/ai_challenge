# Руководство по использованию сервиса поддержки

## Быстрый старт

### 1. Убедитесь, что CRM данные созданы

Проверьте наличие файлов:
- `server/data/crm/users.json` - список пользователей
- `server/data/crm/tickets.json` - список тикетов

### 2. Проиндексируйте FAQ

FAQ должен быть проиндексирован для работы RAG:

```bash
# Через API
curl -X POST http://localhost:3001/api/documents/index/file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "server/data/documents/faq.md"
  }'

# Или через скрипт (если доступен)
node server/rag/scripts/indexDocuments.js
```

### 3. Запустите сервер

```bash
npm run dev:server
```

### 4. Протестируйте сервис

```bash
curl -X POST http://localhost:3001/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Почему не работает авторизация?",
    "modelType": "deepseek",
    "userEmail": "ivan.petrov@example.com"
  }'
```

## Примеры сценариев

### Сценарий 1: Пользователь спрашивает о проблеме

**Вопрос:** "Почему не работает авторизация?"

**Что происходит:**
1. Система извлекает email из вопроса (если указан) или использует `userEmail` из запроса
2. Загружает информацию о пользователе через `getUser`
3. Находит открытые тикеты пользователя через `getUserTickets`
4. Ищет похожие решенные тикеты через `searchTickets`
5. Ищет релевантную информацию в FAQ через RAG
6. Формирует ответ с учетом всего контекста

**Ответ включает:**
- Решение проблемы на основе FAQ
- Информацию о похожих решенных тикетах
- Контекст открытых тикетов пользователя (если есть)

### Сценарий 2: Вопрос о конкретном тикете

**Вопрос:** "Что с тикетом ticket-1?"

**Что происходит:**
1. Система извлекает ID тикета из вопроса
2. Загружает полную информацию о тикете через `getTicket`
3. Загружает информацию о пользователе из тикета
4. Ищет релевантную информацию в FAQ
5. Формирует ответ с учетом истории тикета

**Ответ включает:**
- Текущий статус тикета
- Историю сообщений
- Рекомендации на основе FAQ и похожих тикетов

### Сценарий 3: Общий вопрос без контекста

**Вопрос:** "Как перейти на премиум тариф?"

**Что происходит:**
1. Система ищет релевантную информацию в FAQ через RAG
2. Ищет похожие решенные тикеты
3. Формирует ответ на основе документации

**Ответ включает:**
- Информацию из FAQ
- Примеры из похожих тикетов (если есть)

## Интеграция с фронтендом

### React компонент

```tsx
import { useState } from 'react';

function SupportChat() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/support/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          modelType: 'deepseek',
          userEmail: currentUser.email,
        }),
      });
      const result = await response.json();
      setAnswer(result.answer);
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Задайте вопрос..."
      />
      <button onClick={handleSubmit} disabled={loading}>
        Отправить
      </button>
      {answer && <div>{answer}</div>}
    </div>
  );
}
```

## Расширенные возможности

### Создание тикета через MCP

```javascript
import { callCRMMCPTool } from './mcp/servers/crmMCP.js';

// Создать новый тикет
const ticket = await callCRMMCPTool('createTicket', {
  userEmail: 'user@example.com',
  subject: 'Проблема с авторизацией',
  description: 'Не могу войти в систему',
  priority: 'high',
  category: 'authentication',
  tags: ['авторизация', 'вход'],
});
```

### Добавление сообщения в тикет

```javascript
await callCRMMCPTool('addTicketMessage', {
  ticketId: 'ticket-1',
  author: 'support',
  text: 'Ответ поддержки...',
});
```

### Обновление статуса тикета

```javascript
await callCRMMCPTool('updateTicketStatus', {
  ticketId: 'ticket-1',
  status: 'resolved',
});
```

## Настройка промптов

Вы можете настроить промпты в `server/support/supportService.js`:

```javascript
buildSupportPrompt(question, userContext, ticketContext, similarTickets, ragChunks) {
  // Ваша кастомная логика формирования промпта
}
```

## Отладка

### Проверка работы CRM MCP

```bash
curl http://localhost:3001/api/mcp/tools?category=crm
```

### Проверка индексации FAQ

```bash
curl http://localhost:3001/api/documents/stats
```

### Поиск в документации

```bash
curl -X POST http://localhost:3001/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "авторизация",
    "topK": 5
  }'
```

## Лучшие практики

1. **Всегда указывайте userEmail** - это позволяет системе использовать контекст пользователя
2. **Используйте ticketId** - для вопросов о конкретных тикетах
3. **Индексируйте FAQ регулярно** - при обновлении документации
4. **Мониторьте качество ответов** - используйте метаданные для анализа
5. **Обновляйте тикеты** - добавляйте сообщения и обновляйте статусы

## Ограничения

- Email должен быть указан явно или извлекаться из вопроса
- Тикеты хранятся в JSON файлах (для продакшена рекомендуется БД)
- RAG требует индексации документов перед использованием

