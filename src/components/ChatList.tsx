import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chat } from '../types/chat';
import { loadChats, createChat, deleteChat, updateChatTitle } from '../services/storage';
import { Plus, Edit, Trash2, MessageSquare, BarChart3 } from 'lucide-react';

interface ChatListProps {
  refreshTrigger?: number; // Триггер для обновления списка
}

const ChatList = ({ refreshTrigger }: ChatListProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Извлекаем chatId из пути /chat/:chatId
  const chatIdMatch = location.pathname.match(/^\/chat\/(.+)$/);
  const currentChatId = chatIdMatch ? chatIdMatch[1] : '';
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const prevRefreshTriggerRef = useRef(refreshTrigger);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    loadChatsList();
  }, []);
  
  // Обновляем при изменении триггера обновления (только если он действительно изменился)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger !== prevRefreshTriggerRef.current && !isLoadingRef.current) {
      prevRefreshTriggerRef.current = refreshTrigger;
      loadChatsList();
    }
  }, [refreshTrigger]);

  const loadChatsList = async () => {
    if (isLoadingRef.current) return; // Предотвращаем параллельные загрузки
    
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const loadedChats = await loadChats();
      
      // Обновляем только если данные действительно изменились
      setChats(prevChats => {
        const chatsChanged = JSON.stringify(prevChats) !== JSON.stringify(loadedChats);
        return chatsChanged ? loadedChats : prevChats;
      });
      
      // Если нет чатов, создаем первый
      if (loadedChats.length === 0) {
        const newChat = await createChat('Новый чат');
        if (newChat) {
          setChats([newChat]);
          navigate(`/chat/${newChat.id}`, { replace: true });
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке чатов:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleCreateChat = async () => {
    const newChat = await createChat(`Чат ${chats.length + 1}`);
    if (newChat) {
      setChats((prev) => [newChat, ...prev]);
      sessionStorage.setItem('lastSelectedChatId', newChat.id);
      navigate(`/chat/${newChat.id}`);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chats.length <= 1) {
      // Не позволяем удалить последний чат
      return;
    }
    
    if (confirm('Удалить этот чат?')) {
      const success = await deleteChat(chatId);
      if (success) {
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));
        // Если удалили текущий чат, переключаемся на первый доступный
        if (chatId === currentChatId) {
          const remainingChats = chats.filter((chat) => chat.id !== chatId);
          if (remainingChats.length > 0) {
            navigate(`/chat/${remainingChats[0].id}`, { replace: true });
          } else {
            navigate('/chat', { replace: true });
          }
        }
      }
    }
  };

  const handleStartEdit = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveEdit = async (chatId: string) => {
    if (editTitle.trim()) {
      const success = await updateChatTitle(chatId, editTitle.trim());
      if (success) {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId ? { ...chat, title: editTitle.trim() } : chat
          )
        );
      }
    }
    setEditingChatId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditTitle('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#a0a0b0]">Загрузка...</div>
      </div>
    );
  }

  const totalMessages = chats.reduce((sum, chat) => sum + chat.messageCount, 0);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Статистика в заголовке */}
      <div className="px-4 py-3 border-b border-[#2a2a3a]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#00f0ff]" />
            <span className="text-xs font-semibold text-[#00f0ff] uppercase tracking-wider">Чаты</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1e1e2e]/60 rounded-lg border border-[#2a2a3a]">
            <BarChart3 className="w-3 h-3 text-[#b026ff]" />
            <span className="text-xs text-[#e0e0e8] font-medium">{chats.length}</span>
          </div>
        </div>
        <button
          onClick={handleCreateChat}
          className="w-full px-4 py-2 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg hover:from-[#0055ff] hover:to-[#7000bb] transition-all duration-300 flex items-center justify-center gap-2 font-medium shadow-[0_0_10px_rgba(0,102,255,0.2)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Новый чат</span>
        </button>
        {totalMessages > 0 && (
          <div className="mt-2 text-xs text-[#a0a0b0] text-center">
            Всего сообщений: <span className="text-[#00f0ff] font-medium">{totalMessages}</span>
          </div>
        )}
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => {
              sessionStorage.setItem('lastSelectedChatId', chat.id);
              navigate(`/chat/${chat.id}`);
            }}
            className={`
              group relative p-3 rounded-lg cursor-pointer transition-all duration-200
              ${
                currentChatId === chat.id
                  ? 'bg-[#00f0ff]/20 border border-[#00f0ff]/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                  : 'bg-[#1e1e2e]/60 hover:bg-[#2a2a3a]/60 border border-transparent'
              }
            `}
          >
            {editingChatId === chat.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleSaveEdit(chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit(chat.id);
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  className="flex-1 px-2 py-1 bg-[#1e1e2e] border border-[#00f0ff]/50 rounded text-sm text-[#e0e0e8] focus:outline-none focus:ring-1 focus:ring-[#00f0ff]"
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#e0e0e8] truncate">
                      {chat.title}
                    </div>
                    <div className="text-xs text-[#a0a0b0] mt-1">
                      {chat.messageCount} сообщений
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartEdit(chat, e)}
                      className="p-1 hover:bg-[#2a2a3a] rounded text-[#a0a0b0] hover:text-[#00f0ff] transition-colors cursor-pointer"
                      title="Переименовать"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {chats.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="p-1 hover:bg-[#2a2a3a] rounded text-[#a0a0b0] hover:text-[#ff4444] transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;

