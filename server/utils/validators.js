/**
 * Проверяет наличие API ключа
 */
export function validateApiKey(apiKey, envVarName, serviceName) {
  if (!apiKey) {
    return {
      isValid: false,
      error: `${serviceName} API ключ не настроен на сервере. Проверьте переменную ${envVarName} в .env файле`,
    };
  }
  return { isValid: true };
}

/**
 * Проверяет наличие обязательных полей в запросе
 */
export function validateRequiredFields(reqBody, fields) {
  const missing = fields.filter(field => !reqBody[field]);
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Отсутствуют обязательные поля: ${missing.join(', ')}`,
    };
  }
  return { isValid: true };
}

