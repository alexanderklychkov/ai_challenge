# Руководство по настройке Ollama для AIMentor

## Описание

AIMentor поддерживает работу с локальной моделью Ollama. Вы можете использовать Ollama как на локальной машине, так и на удаленном сервере.

## Настройка Ollama на сервере

### Шаг 1: Установка Ollama на VPS

```bash
# Установка Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Запуск Ollama как сервиса
systemctl enable ollama
systemctl start ollama
```

### Шаг 2: Загрузка модели

```bash
# Загрузите легковесную модель (например, qwen2.5:0.5b)
ollama pull qwen2.5:0.5b

# Проверьте список загруженных моделей
ollama list
```

### Шаг 3: Настройка Ollama для внешнего доступа

```bash
# Остановите Ollama
systemctl stop ollama

# Создайте директорию для конфигурации
mkdir -p /etc/systemd/system/ollama.service.d

# Создайте файл конфигурации
nano /etc/systemd/system/ollama.service.d/override.conf
```

Добавьте следующее содержимое:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
```

Примените изменения:

```bash
# Перезагрузите конфигурацию systemd
systemctl daemon-reload

# Запустите Ollama
systemctl start ollama

# Проверьте статус
systemctl status ollama

# Проверьте, что Ollama слушает на всех интерфейсах
netstat -tlnp | grep 11434
```

### Шаг 4: Настройка Firewall

```bash
# Разрешите доступ к порту Ollama (11434)
ufw allow 11434/tcp

# Или ограничьте доступ только с вашего IP (рекомендуется)
# ufw delete allow 11434/tcp
# ufw allow from YOUR_IP to any port 11434

# Проверьте статус
ufw status
```

### Шаг 5: Проверка работы

```bash
# Проверьте локально на сервере
curl http://localhost:11434/api/tags

# Проверьте с внешнего IP (с вашего локального компьютера)
curl http://YOUR_SERVER_IP:11434/api/tags
```

## Настройка переменных окружения

### На сервере (server/.env или корень проекта)

Создайте или отредактируйте файл `.env` в корне проекта:

```env
# URL для подключения к Ollama на удаленном сервере
OLLAMA_URL=http://38.180.222.56:11434

# Модель по умолчанию
OLLAMA_MODEL=qwen2.5:0.5b

# Для совместимости с существующим кодом (опционально)
LM_STUDIO_URL=http://38.180.222.56:11434
LM_STUDIO_MODEL=qwen2.5:0.5b
```

### На локальной машине (для фронтенда)

Создайте или отредактируйте файл `.env` в корне проекта:

```env
# URL для подключения к Ollama через прокси-сервер
VITE_OLLAMA_PROXY_URL=http://localhost:3001/api/ollama

# URL для прямого подключения к Ollama (если нужно)
VITE_OLLAMA_DIRECT_URL=http://38.180.222.56:11434

# Модель по умолчанию
VITE_OLLAMA_DEFAULT_MODEL=qwen2.5:0.5b

# Включить офлайн режим (прямое подключение, минуя сервер)
# Установите в false, если хотите использовать через сервер
VITE_OLLAMA_OFFLINE_MODE=false
```

## Использование в приложении

### Через настройки чата

1. Откройте настройки чата (иконка настроек)
2. Добавьте нового агента
3. Выберите тип: **Ollama (локальная)**
4. Выберите модель из списка:
   - `qwen2.5:0.5b` - Qwen2.5 0.5B (самая легкая)
   - `tinyllama` - TinyLlama 1.1B
   - `phi3:mini` - Phi-3 Mini 3.8B
   - `gemma2:2b` - Gemma 2 2B
   - `__auto__` - Автоматический выбор первой доступной модели

### Программно

```typescript
import { createOllamaModel } from './services/ollama';

// Создание модели с настройками по умолчанию
const model = createOllamaModel({
  model: 'qwen2.5:0.5b',
  systemPrompt: 'Ты - помощник по программированию',
  temperature: 0.7,
});

// Отправка сообщения
const response = await model.sendMessage([
  { role: 'user', text: 'Привет!' }
]);
```

## Доступные модели Ollama

### Легковесные модели (для серверов с ограниченной памятью)

- **qwen2.5:0.5b** - ~300 MB, требует ~500-600 MB RAM
- **tinyllama** - ~637 MB, требует ~700-800 MB RAM
- **phi3:mini** - ~2.3 GB, требует ~2.5-3 GB RAM
- **gemma2:2b** - ~1.4 GB, требует ~1.5-2 GB RAM

### Загрузка моделей

```bash
# Загрузить модель
ollama pull qwen2.5:0.5b

# Загрузить квантованную версию (меньше памяти)
ollama pull tinyllama:q4_0

# Посмотреть список доступных моделей
ollama list
```

## Безопасность

### Рекомендации

1. **Ограничьте доступ по IP**: Настройте firewall так, чтобы только ваш IP мог подключаться к Ollama
2. **Используйте VPN**: Для дополнительной безопасности используйте VPN
3. **Nginx с аутентификацией**: Настройте Nginx как reverse proxy с базовой аутентификацией

### Пример настройки Nginx с аутентификацией

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:11434;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Базовая аутентификация
        auth_basic "Ollama Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

Создайте файл с паролем:

```bash
# Установите apache2-utils
apt install apache2-utils

# Создайте пользователя и пароль
htpasswd -c /etc/nginx/.htpasswd username
```

## Устранение неполадок

### Ollama не отвечает

```bash
# Проверьте статус сервиса
systemctl status ollama

# Проверьте логи
journalctl -u ollama -f

# Перезапустите Ollama
systemctl restart ollama
```

### Ошибка подключения с локальной машины

1. Проверьте firewall на сервере
2. Убедитесь, что Ollama слушает на `0.0.0.0:11434`
3. Проверьте, что порт 11434 открыт в firewall
4. Проверьте подключение: `curl http://YOUR_SERVER_IP:11434/api/tags`

### Модель не найдена

```bash
# Проверьте список загруженных моделей
ollama list

# Загрузите модель, если её нет
ollama pull qwen2.5:0.5b

# Проверьте доступные модели через API
curl http://localhost:11434/api/tags
```

### Нехватка памяти

Если модель требует больше памяти, чем доступно:

1. Используйте более легкую модель
2. Используйте квантованную версию модели
3. Увеличьте swap на сервере
4. Остановите другие процессы, потребляющие память

## API эндпоинты

### Получить список моделей

```bash
GET /api/ollama/models
```

Ответ:
```json
{
  "models": [
    {
      "id": "qwen2.5:0.5b",
      "name": "qwen2.5:0.5b",
      "size": 314572800,
      "modified_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Отправить запрос к модели

```bash
POST /api/ollama
Content-Type: application/json

{
  "messages": [
    { "role": "user", "text": "Привет!" }
  ],
  "model": "qwen2.5:0.5b",
  "temperature": 0.7,
  "max_tokens": 2000,
  "system_prompt": "Ты - помощник"
}
```

Ответ:
```json
{
  "text": "Привет! Чем могу помочь?",
  "tokens": 15,
  "inputTokens": 5,
  "outputTokens": 10
}
```

## Дополнительные ресурсы

- [Официальный сайт Ollama](https://ollama.com)
- [Документация Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Библиотека моделей Ollama](https://ollama.com/library)

