import { getAuthHeader } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Ticket {
  id: string;
  userId: string | null;
  userEmail: string;
  subject: string;
  description: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'medium' | 'high';
  category: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
  tags: string[];
}

/**
 * Получает тикеты текущего пользователя
 */
export async function getUserTickets(): Promise<Ticket[]> {
  console.log('Загрузка тикетов...');
  const response = await fetch(`${API_BASE_URL}/api/support/tickets`, {
    method: 'GET',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Ошибка при получении тикетов:', error);
    throw new Error(error.error || 'Ошибка при получении тикетов');
  }

  const tickets = await response.json();
  console.log('Получено тикетов:', tickets.length, tickets);
  return tickets;
}

/**
 * Получает тикет по ID
 */
export async function getTicketById(ticketId: string): Promise<Ticket> {
  console.log('Загрузка тикета:', ticketId);
  const response = await fetch(`${API_BASE_URL}/api/support/tickets/${ticketId}`, {
    method: 'GET',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Ошибка при получении тикета:', error);
    throw new Error(error.error || 'Ошибка при получении тикета');
  }

  const ticket = await response.json();
  console.log('Тикет загружен:', ticket);
  return ticket;
}

/**
 * Удаляет тикет по ID
 */
export async function deleteTicket(ticketId: string): Promise<void> {
  console.log('Удаление тикета:', ticketId);
  const response = await fetch(`${API_BASE_URL}/api/support/tickets/${ticketId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Ошибка при удалении тикета:', error);
    throw new Error(error.error || 'Ошибка при удалении тикета');
  }

  console.log('Тикет удален:', ticketId);
}

