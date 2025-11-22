/**
 * Утилита для отправки статусов через Server-Sent Events (SSE)
 * Используется для отправки промежуточных статусов при выполнении инструментов MCP
 */

/**
 * Map для хранения активных SSE соединений
 * Ключ: requestId (уникальный ID запроса)
 * Значение: Express Response объект
 */
const activeConnections = new Map();

/**
 * Регистрирует новое SSE соединение
 * @param {string} requestId - Уникальный ID запроса
 * @param {Express.Response} res - Express Response объект
 */
export function registerConnection(requestId, res) {
  // Настраиваем заголовки для SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  // Отправляем начальное сообщение для установки соединения
  res.write(`: connected\n\n`);
  
  // Сохраняем соединение
  activeConnections.set(requestId, res);

  // Обработка закрытия соединения
  res.on('close', () => {
    activeConnections.delete(requestId);
    console.log(`[StatusEmitter] Соединение закрыто для requestId: ${requestId}`);
  });

  console.log(`[StatusEmitter] Зарегистрировано соединение для requestId: ${requestId}`);
}

/**
 * Отправляет статус через SSE
 * @param {string} requestId - Уникальный ID запроса
 * @param {Object} status - Объект статуса
 * @param {string} status.toolName - Имя инструмента
 * @param {string} status.status - Статус: 'pending' | 'in_progress' | 'completed' | 'error'
 * @param {string} status.message - Сообщение статуса
 * @param {string} [status.serverName] - Название сервера
 * @param {string} [status.error] - Сообщение об ошибке (если есть)
 */
export function sendStatus(requestId, status) {
  const connection = activeConnections.get(requestId);
  
  if (!connection) {
    console.warn(`[StatusEmitter] Соединение не найдено для requestId: ${requestId}`);
    return false;
  }

  try {
    const data = JSON.stringify({
      toolName: status.toolName,
      status: status.status,
      message: status.message,
      serverName: status.serverName,
      error: status.error,
      timestamp: new Date().toISOString(),
    });

    // Отправляем данные в формате SSE
    connection.write(`data: ${data}\n\n`);
    
    console.log(`[StatusEmitter] Отправлен статус для requestId: ${requestId}, tool: ${status.toolName}, status: ${status.status}`);
    return true;
  } catch (error) {
    console.error(`[StatusEmitter] Ошибка при отправке статуса для requestId: ${requestId}:`, error);
    // Удаляем соединение при ошибке
    activeConnections.delete(requestId);
    return false;
  }
}

/**
 * Закрывает соединение и отправляет финальное сообщение
 * @param {string} requestId - Уникальный ID запроса
 * @param {string} [finalMessage] - Финальное сообщение
 */
export function closeConnection(requestId, finalMessage = null) {
  const connection = activeConnections.get(requestId);
  
  if (!connection) {
    return false;
  }

  try {
    if (finalMessage) {
      const data = JSON.stringify({
        type: 'complete',
        message: finalMessage,
        timestamp: new Date().toISOString(),
      });
      connection.write(`data: ${data}\n\n`);
    }
    
    // Отправляем событие закрытия
    connection.write(`event: close\n`);
    connection.write(`data: {"type": "close"}\n\n`);
    
    // Закрываем соединение
    connection.end();
    activeConnections.delete(requestId);
    
    console.log(`[StatusEmitter] Соединение закрыто для requestId: ${requestId}`);
    return true;
  } catch (error) {
    console.error(`[StatusEmitter] Ошибка при закрытии соединения для requestId: ${requestId}:`, error);
    activeConnections.delete(requestId);
    return false;
  }
}

/**
 * Проверяет, есть ли активное соединение для requestId
 * @param {string} requestId - Уникальный ID запроса
 * @returns {boolean}
 */
export function hasConnection(requestId) {
  return activeConnections.has(requestId);
}

/**
 * Получает количество активных соединений
 * @returns {number}
 */
export function getActiveConnectionsCount() {
  return activeConnections.size;
}

