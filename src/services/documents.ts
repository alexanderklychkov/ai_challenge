/**
 * Сервис для работы с документами RAG
 */

export interface Document {
  id: string;
  fileName: string;
  filePath: string;
  type: string;
  addedAt: string;
}

export interface DocumentContent {
  fileName: string;
  content: string;
  type: string;
  filePath: string;
  addedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Получает список всех документов
 */
export async function getDocuments(): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/api/documents`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при получении документов');
  }
  
  return response.json();
}

/**
 * Получает содержимое документа по имени файла
 */
export async function getDocumentContent(fileName: string): Promise<DocumentContent> {
  const response = await fetch(`${API_BASE_URL}/api/documents/content/${encodeURIComponent(fileName)}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при получении содержимого документа');
  }
  
  return response.json();
}

