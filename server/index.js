import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Прокси-эндпоинт для Yandex GPT
app.post('/api/yandex-gpt', async (req, res) => {
  try {
    const { messages } = req.body;
    const apiKey = process.env.YANDEX_GPT_API_KEY;
    const folderId = process.env.YANDEX_GPT_FOLDER_ID;
    
    if (!apiKey) {
      return res.status(400).json({
        error: 'Yandex GPT API ключ не настроен на сервере. Проверьте переменную YANDEX_GPT_API_KEY в .env файле',
      });
    }

    if (!folderId) {
      return res.status(400).json({
        error: 'Folder ID не передан в запросе',
      });
    }

    const modelUri = `gpt://${folderId}/yandexgpt/latest`;

    const requestBody = {
      modelUri,
      completionOptions: {
        stream: false,
        temperature: 0.6,
        maxTokens: '2000',
      },
      messages: [
        {
          role: 'system',
          text: 'Ты - помощник по фронтенд-разработке. Отвечай кратко, по делу, с примерами кода когда это уместно.',
        },
        ...messages,
      ],
    };

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Yandex GPT API error: ${response.status} ${errorText}`;
      
      // Более детальные сообщения об ошибках
      if (response.status === 403) {
        errorMessage += '\n\nВозможные причины:\n' +
          '1. У сервисного аккаунта нет роли "ai.languageModels.user" или "editor"\n' +
          '2. API ключ создан для другого каталога\n' +
          '3. Область действия API ключа не совпадает с folder ID\n' +
          '4. Сервис YandexGPT не активирован в каталоге\n\n' +
          'Проверьте:\n' +
          '- Роли сервисного аккаунта в консоли Yandex Cloud (нужна роль ai.languageModels.user)\n' +
          '- Что API ключ создан с областью действия = ваш каталог\n' +
          '- Что folder ID в .env совпадает с ID каталога где создан сервисный аккаунт\n' +
          '- Что используете правильный тип ключа (API ключ, а не IAM токен)';
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.result?.alternatives?.[0]?.message?.text) {
      throw new Error('Invalid response format from Yandex GPT');
    }

    res.json({
      text: data.result.alternatives[0].message.text,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Произошла ошибка при обращении к Yandex GPT',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

