/**
 * Обрабатывает ошибки от API и возвращает понятное сообщение
 */
export async function handleApiError(response, serviceName) {
  let errorData;
  try {
    errorData = await response.json();
  } catch {
    const errorText = await response.text();
    errorData = { error: errorText };
  }
  
  const errorMessage = errorData.error?.message || errorData.error || 'Unknown error';
  return `${serviceName} API error: ${response.status} - ${errorMessage}`;
}

/**
 * Обрабатывает ошибки и отправляет ответ клиенту
 */
export function sendErrorResponse(res, error, defaultMessage) {
  res.status(500).json({
    error: error.message || defaultMessage,
  });
}

/**
 * Отправляет ответ об отсутствии API ключа
 */
export function sendApiKeyError(res, envVarName, serviceName) {
  res.status(400).json({
    error: `${serviceName} API ключ не настроен на сервере. Проверьте переменную ${envVarName} в .env файле`,
  });
}

