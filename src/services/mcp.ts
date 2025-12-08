/**
 * Сервис для работы с MCP (Model Context Protocol) инструментами
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface MCPToolCallResult {
  result: any;
  serverId?: string;
  serverName?: string;
  serverCategory?: string;
  error?: string;
}

/**
 * Вызывает MCP инструмент
 */
export async function callMCPTool(
  toolName: string,
  args: Record<string, any> = {},
  serverId?: string
): Promise<MCPToolCallResult> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      toolName,
      args,
      serverId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при вызове MCP инструмента');
  }

  return response.json();
}

/**
 * Получает список доступных MCP инструментов
 */
export async function getMCPTools(category?: string, minPriority?: number) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (minPriority !== undefined) params.append('minPriority', minPriority.toString());

  const response = await fetch(`${API_BASE_URL}/api/mcp/tools?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при получении списка инструментов');
  }

  return response.json();
}







