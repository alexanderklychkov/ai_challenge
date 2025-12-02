# GitHub MCP Server

MCP сервер для работы с GitHub репозиторием.

## Возможности

- **getCurrentBranch** - Получает название текущей ветки git репозитория
- **getBranchInfo** - Получает подробную информацию о ветке из GitHub (требует GITHUB_TOKEN)
- **getOpenFiles** - Получает список измененных/открытых файлов в рабочей директории
- **getRepositoryInfo** - Получает информацию о текущем GitHub репозитории (owner/repo)

## Настройка

### Базовое использование (без токена)

Сервер работает без токена для базовых операций:
- Получение текущей ветки
- Получение списка измененных файлов
- Получение информации о репозитории из git remote

### Расширенное использование (с токеном)

Для доступа к GitHub API и получения подробной информации о ветках:

1. Создайте Personal Access Token на GitHub:
   - Перейдите в Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Создайте новый токен с правами `repo` (для приватных репозиториев) или без прав (для публичных)

2. Добавьте токен в `.env`:
   ```env
   GITHUB_TOKEN=your_github_token_here
   ```

## Использование

### Через команду /help

```
/help выведи текущую ветку
/help какие файлы изменены
/help информация о репозитории
```

### Через MCP API

```javascript
import { callGitHubMCPTool } from './servers/githubMCP.js';

// Получить текущую ветку
const result = await callGitHubMCPTool('getCurrentBranch', {});

// Получить информацию о ветке из GitHub
const branchInfo = await callGitHubMCPTool('getBranchInfo', { branch: 'main' });

// Получить список измененных файлов
const files = await callGitHubMCPTool('getOpenFiles', {});
```

## Отличия от Git MCP

GitHub MCP предоставляет:
- ✅ Интеграцию с GitHub API для получения подробной информации
- ✅ Информацию о коммитах и защищенных ветках
- ✅ Список измененных файлов
- ✅ Информацию о репозитории из GitHub

Git MCP был простым и работал только локально через git команды.



