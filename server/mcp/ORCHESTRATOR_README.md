# MCP Orchestrator - Система оркестрации MCP серверов

## Описание

Система оркестрации для управления несколькими MCP (Model Context Protocol) серверами с поддержкой:
- Регистрации нескольких серверов с метаданными
- Автоматического выбора инструментов для LLM
- Выполнения длинных флоу взаимодействия
- Отслеживания истории выполнения

## Основные компоненты

### 1. MCP Orchestrator (`orchestrator.js`)

Центральный оркестратор для управления серверами и инструментами.

**Основные функции:**
- `registerMCPServer(registration)` - Регистрация нового сервера
- `getAllTools(options)` - Получение всех инструментов из всех серверов
- `callTool(toolName, args, serverId)` - Вызов инструмента через оркестратор
- `getAllToolsAsOpenAI(options)` - Получение инструментов в формате OpenAI
- `planToolChain(userQuery, context)` - Планирование цепочки инструментов
- `executeToolChain(toolChain, context)` - Выполнение цепочки инструментов

**Пример использования:**
```javascript
import { registerMCPServer, getAllToolsAsOpenAI, callTool } from './orchestrator.js';

// Регистрация сервера
registerMCPServer({
  id: 'my-server',
  name: 'My MCP Server',
  description: 'Описание сервера',
  category: 'general',
  priority: 10,
  getTools: async () => [...],
  callTool: async (toolName, args) => {...},
});

// Получение всех инструментов
const tools = await getAllToolsAsOpenAI({ category: 'todoist' });

// Вызов инструмента
const result = await callTool('createTask', { content: 'Новая задача' });
```

### 2. MCP Flow (`flow.js`)

Механизм для выполнения длинных флоу взаимодействия.

**Основные функции:**
- `createFlow(name, steps, context)` - Создание нового флоу
- `executeFlow(flowId, options)` - Выполнение всего флоу
- `executeFlowStep(flowId)` - Выполнение одного шага флоу
- `createArticleProcessingFlow(url, options)` - Готовый флоу для обработки статей
- `createTaskSearchFlow(query, options)` - Готовый флоу для поиска задач

**Пример использования:**
```javascript
import { createArticleProcessingFlow, executeFlow } from './flow.js';

// Создание флоу для обработки статьи
const flow = createArticleProcessingFlow('https://example.com/article', {
  maxTasks: 5,
  projectId: '123456',
});

// Выполнение флоу
const result = await executeFlow(flow.id);
console.log('Результат:', result);
```

### 3. MCP Init (`init.js`)

Конфигурация и инициализация всех серверов.

**Функции:**
- `initializeAllMCPServers()` - Инициализация всех серверов

## Регистрация сервера

Для регистрации нового MCP сервера используйте функцию `registerMCPServer`:

```javascript
registerMCPServer({
  id: 'unique-server-id',           // Уникальный идентификатор
  name: 'Server Name',               // Название сервера
  description: 'Server description', // Описание
  category: 'category',              // Категория (todoist, article, etc.)
  priority: 10,                      // Приоритет (чем выше, тем важнее)
  getTools: async () => {            // Функция получения инструментов
    return [
      {
        name: 'toolName',
        description: 'Tool description',
        inputSchema: { /* JSON Schema */ },
      },
    ];
  },
  callTool: async (toolName, args) => { // Функция вызова инструмента
    // Реализация вызова
    return result;
  },
  metadata: {                        // Дополнительные метаданные
    version: '1.0.0',
    supports: ['feature1', 'feature2'],
  },
});
```

## Создание флоу

Флоу - это последовательность шагов для выполнения сложной задачи:

```javascript
const flow = createFlow('My Flow', [
  {
    tool: 'readArticle',
    args: { url: 'https://example.com/article' },
    description: 'Чтение статьи',
    critical: true,              // Критический шаг (остановит флоу при ошибке)
    contextKey: 'article',       // Ключ для сохранения результата в контексте
  },
  {
    tool: 'createTask',
    args: {
      content: 'Проанализировать: ${article.title}',
      description: '${article.content}',
    },
    description: 'Создание задачи',
    critical: false,
    condition: (context) => context.article && context.article.title, // Условие выполнения
    transform: (result, context) => ({ ...result, articleId: context.article.id }), // Трансформация результата
  },
], {
  // Начальный контекст
  userId: '123',
});
```

## API Эндпоинты

### Получение списка серверов
```
GET /api/mcp/servers
```

### Получение инструментов
```
GET /api/mcp/tools?category=todoist&minPriority=5
```

### Получение истории выполнения
```
GET /api/mcp/history?serverId=todoist-mcp-server&limit=10
```

### Создание флоу
```
POST /api/mcp/flows
Body: {
  "type": "article",
  "params": {
    "url": "https://example.com/article",
    "options": { "maxTasks": 5 }
  }
}
```

### Выполнение флоу
```
POST /api/mcp/flows/:flowId/execute
Body: {
  "maxSteps": 100
}
```

### Получение состояния флоу
```
GET /api/mcp/flows/:flowId
```

## Интеграция с LLM

Оркестратор автоматически интегрирован с обработчиками LLM:

```javascript
// В обработчике LLM
import { getAllToolsAsOpenAI, callTool } from '../mcp/orchestrator.js';

// Получение инструментов для LLM
const tools = await getAllToolsAsOpenAI();
requestBody.tools = tools;

// Вызов инструмента через оркестратор
const result = await callTool(toolName, args);
```

## Преимущества

1. **Модульность**: Легко добавлять новые серверы без изменения существующего кода
2. **Категоризация**: Инструменты автоматически категоризируются по серверам
3. **Приоритеты**: Серверы с высоким приоритетом имеют приоритет при выборе инструментов
4. **История**: Все вызовы инструментов отслеживаются для отладки и анализа
5. **Флоу**: Поддержка сложных многошаговых операций
6. **Контекст**: Автоматическая передача контекста между шагами флоу

## Примеры использования

### Пример 1: Обработка статьи с созданием задач

```javascript
import { createArticleProcessingFlow, executeFlow } from './flow.js';

const flow = createArticleProcessingFlow('https://react.dev/reference/react/useEffect', {
  maxTasks: 5,
  projectId: '123456',
});

const result = await executeFlow(flow.id);
console.log('Создано задач:', result.flow.context.analysisTask);
```

### Пример 2: Поиск и обработка задач

```javascript
import { createTaskSearchFlow, executeFlow } from './flow.js';

const flow = createTaskSearchFlow('React hooks', {
  projectId: '123456',
});

const result = await executeFlow(flow.id);
console.log('Найдено задач:', result.flow.context.searchResults?.length);
```

### Пример 3: Кастомный флоу

```javascript
import { createFlow, executeFlow } from './flow.js';

const flow = createFlow('Custom Flow', [
  { tool: 'getTasks', args: {}, critical: true },
  { tool: 'searchTasks', args: { query: 'important' }, critical: false },
  { tool: 'createTask', args: { content: 'Summary task' }, critical: false },
]);

const result = await executeFlow(flow.id);
```

## Расширение

Для добавления нового типа сервера:

1. Создайте функции `getTools` и `callTool` для вашего сервера
2. Зарегистрируйте сервер через `registerMCPServer`
3. Добавьте инициализацию в `initializeAllMCPServers`

Примеры расширений:
- HTTP серверы
- WebSocket серверы
- Локальные плагины
- Внешние API

