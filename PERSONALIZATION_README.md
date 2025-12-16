# Персонализация агента

Система персонализации позволяет настроить агента под ваши предпочтения, привычки и стиль работы. Агент будет использовать эту информацию для адаптации своих ответов.

## Быстрый старт

1. Скопируйте пример конфига:
   ```bash
   cp personalization.example.json server/data/personalization/default.json
   ```

2. Отредактируйте файл `server/data/personalization/default.json` под себя

3. Перезапустите сервер

## Структура конфига персонализации

```json
{
  "name": "Ваше имя",
  "role": "Ваша роль/профессия",
  "interests": ["список", "интересов"],
  "skills": ["список", "навыков"],
  "preferences": {
    "language": "язык общения",
    "detailLevel": "уровень детализации (низкий/средний/высокий)",
    "examples": true/false,
    "codeStyle": "стиль кода",
    "explanationStyle": "стиль объяснений"
  },
  "habits": {
    "workHours": "рабочие часы",
    "preferredTime": "предпочитаемое время работы",
    "focusAreas": ["области", "фокуса"]
  },
  "workStyle": {
    "approach": "подход к работе",
    "priorities": ["приоритеты"],
    "preferredTools": ["инструменты"]
  },
  "communicationStyle": "стиль общения",
  "goals": ["цели"],
  "context": {
    "currentProject": "текущий проект",
    "techStack": "технологический стек",
    "teamSize": "размер команды",
    "experience": "опыт"
  }
}
```

## Персональная персонализация (для авторизованных пользователей)

Если вы авторизованы в системе, вы можете создать персональную персонализацию, которая будет использоваться только для вас:

1. Через API:
   ```bash
   # Получить текущую персонализацию
   GET /api/personalization
   Authorization: Bearer <token>
   
   # Сохранить персонализацию
   POST /api/personalization
   Authorization: Bearer <token>
   Content-Type: application/json
   
   {
     "name": "Ваше имя",
     "role": "Ваша роль",
     ...
   }
   
   # Обновить персонализацию (частичное обновление)
   PATCH /api/personalization
   Authorization: Bearer <token>
   Content-Type: application/json
   
   {
     "preferences": {
       "detailLevel": "высокий"
     }
   }
   ```

2. Файл будет сохранен в `server/data/personalization/<userId>.json`

## Как это работает

1. **Дефолтная персонализация**: Файл `server/data/personalization/default.json` используется для всех пользователей, у которых нет персональной персонализации.

2. **Персональная персонализация**: Если пользователь авторизован и имеет персональный файл, он будет использоваться вместо дефолтного.

3. **Интеграция в системные промпты**: Персонализация автоматически добавляется в системные промпты агента, обогащая их информацией о пользователе.

4. **CLI ассистент**: CLI ассистент также использует персонализацию из дефолтного файла.

## Примеры использования

### Пример 1: Настройка для фронтенд разработчика

```json
{
  "name": "Иван",
  "role": "Frontend разработчик",
  "interests": ["React", "TypeScript", "UI/UX"],
  "skills": ["React", "TypeScript", "CSS"],
  "preferences": {
    "language": "русский",
    "detailLevel": "средний",
    "examples": true,
    "codeStyle": "современный ES6+",
    "explanationStyle": "практический с примерами"
  },
  "workStyle": {
    "approach": "компонентный",
    "priorities": ["читаемость", "производительность"],
    "preferredTools": ["React", "TypeScript", "Vite"]
  }
}
```

### Пример 2: Настройка для бэкенд разработчика

```json
{
  "name": "Петр",
  "role": "Backend разработчик",
  "interests": ["Node.js", "Databases", "API Design"],
  "skills": ["Node.js", "PostgreSQL", "REST API"],
  "preferences": {
    "language": "русский",
    "detailLevel": "высокий",
    "examples": true,
    "explanationStyle": "технический с архитектурными решениями"
  },
  "workStyle": {
    "approach": "архитектурный",
    "priorities": ["масштабируемость", "безопасность"],
    "preferredTools": ["Node.js", "Express", "PostgreSQL"]
  }
}
```

## API эндпоинты

### GET /api/personalization
Получить текущую персонализацию пользователя.

**Требует авторизации**: Да

**Ответ**:
```json
{
  "name": "Имя",
  "role": "Роль",
  ...
}
```

### POST /api/personalization
Сохранить полную персонализацию пользователя.

**Требует авторизации**: Да

**Тело запроса**: JSON объект с персонализацией

**Ответ**:
```json
{
  "success": true,
  "personalization": { ... }
}
```

### PATCH /api/personalization
Обновить персонализацию пользователя (частичное обновление).

**Требует авторизации**: Да

**Тело запроса**: JSON объект с обновлениями

**Ответ**:
```json
{
  "success": true,
  "personalization": { ... }
}
```

## Интеграция в код

Персонализация автоматически интегрируется в:

1. **CLI ассистент** (`cli-assistant/src/assistant.js`)
2. **Серверные обработчики** (`server/handlers/deepSeek.js`, `server/handlers/ollama.js`)
3. **Системные промпты** через `buildPersonalizedSystemPrompt()`

Для использования в других местах:

```javascript
import { 
  loadPersonalization, 
  buildPersonalizedSystemPrompt 
} from './utils/personalizationService.js';

// Загрузить персонализацию
const personalization = await loadPersonalization(userId);

// Обогатить системный промпт
const personalizedPrompt = buildPersonalizedSystemPrompt(
  personalization, 
  baseSystemPrompt
);
```

## Примечания

- Если персонализация не найдена, используется базовый системный промпт без изменений
- Персональная персонализация имеет приоритет над дефолтной
- Все поля персонализации опциональны - заполняйте только то, что нужно
- Персонализация обновляется в реальном времени при следующем запросе к агенту
