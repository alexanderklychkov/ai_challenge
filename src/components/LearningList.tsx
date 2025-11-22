import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadTests, loadFlashcardSets, loadStudyPlans, type Test, type FlashcardSet, type StudyPlan } from '../services/learning';
import { loadChats, type Chat } from '../services/storage';
import { FileText, CreditCard, Calendar, BookOpen, MessageSquare, ChevronRight } from 'lucide-react';

interface LearningListProps {
  refreshTrigger?: number;
}

interface LearningItem {
  id: string;
  type: 'test' | 'flashcard' | 'plan';
  title: string;
  chatId?: string;
  chatTitle?: string;
}

export function LearningList({ refreshTrigger }: LearningListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupedByChat, setGroupedByChat] = useState<Map<string, LearningItem[]>>(new Map());
  const [ungroupedItems, setUngroupedItems] = useState<LearningItem[]>([]);

  // Определяем текущий выбранный элемент обучения из URL
  const getCurrentLearningId = () => {
    const testMatch = location.pathname.match(/^\/learning\/test\/(.+)$/);
    if (testMatch) return { id: testMatch[1], type: 'test' as const };
    
    const setMatch = location.pathname.match(/^\/learning\/flashcards\/(.+)$/);
    if (setMatch) return { id: setMatch[1], type: 'flashcard' as const };
    
    const planMatch = location.pathname.match(/^\/learning\/plan\/(.+)$/);
    if (planMatch) return { id: planMatch[1], type: 'plan' as const };
    
    return null;
  };

  const currentLearning = getCurrentLearningId();

  useEffect(() => {
    loadAllData();
  }, [refreshTrigger]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [loadedTests, loadedSets, loadedPlans, loadedChats] = await Promise.all([
        loadTests(),
        loadFlashcardSets(),
        loadStudyPlans(),
        loadChats(),
      ]);

      setChats(loadedChats);

      // Преобразуем все обучения в единый формат
      const items: LearningItem[] = [];

      // Добавляем тесты
      loadedTests.forEach((test: Test) => {
        items.push({
          id: test.id,
          type: 'test',
          title: test.title,
          chatId: test.chatId,
        });
      });

      // Добавляем наборы карточек
      loadedSets.forEach((set: FlashcardSet) => {
        items.push({
          id: set.setId,
          type: 'flashcard',
          title: set.topic,
          chatId: set.chatId,
        });
      });

      // Добавляем планы изучения
      loadedPlans.forEach((plan: StudyPlan) => {
        items.push({
          id: plan.id,
          type: 'plan',
          title: plan.title,
          chatId: plan.chatId,
        });
      });

      // Группируем по чатам
      const grouped = new Map<string, LearningItem[]>();
      const ungrouped: LearningItem[] = [];

      items.forEach((item) => {
        if (item.chatId) {
          const chat = loadedChats.find(c => c.id === item.chatId);
          if (chat) {
            item.chatTitle = chat.title;
            if (!grouped.has(item.chatId)) {
              grouped.set(item.chatId, []);
            }
            grouped.get(item.chatId)!.push(item);
          } else {
            ungrouped.push(item);
          }
        } else {
          ungrouped.push(item);
        }
      });

      // Сортируем элементы внутри каждой группы
      grouped.forEach((items) => {
        items.sort((a, b) => a.title.localeCompare(b.title));
      });

      setGroupedByChat(grouped);
      setUngroupedItems(ungrouped);
      setLearningItems(items);
    } catch (error) {
      console.error('Ошибка при загрузке данных обучения:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = (item: LearningItem) => {
    if (item.type === 'test') {
      navigate(`/learning/test/${item.id}`);
    } else if (item.type === 'flashcard') {
      navigate(`/learning/flashcards/${item.id}`);
    } else if (item.type === 'plan') {
      navigate(`/learning/plan/${item.id}`);
    }
  };

  const handleChatClick = (chatId: string) => {
    navigate(`/chat/${chatId}`);
  };

  const getIcon = (type: LearningItem['type']) => {
    switch (type) {
      case 'test':
        return <FileText className="w-4 h-4" />;
      case 'flashcard':
        return <CreditCard className="w-4 h-4" />;
      case 'plan':
        return <Calendar className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-[#a0a0b0] text-sm">Загрузка...</div>
      </div>
    );
  }

  if (learningItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <BookOpen className="w-12 h-12 text-[#a0a0b0] opacity-50 mb-3" />
        <p className="text-sm text-[#a0a0b0]">Нет созданных обучений</p>
        <p className="text-xs text-[#808080] mt-1">Создайте обучение через чат с AI</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-4">
        {/* Группы по чатам */}
        {Array.from(groupedByChat.entries()).map(([chatId, items]) => {
          const chat = chats.find(c => c.id === chatId);
          const isExpanded = true; // Можно добавить состояние для сворачивания/разворачивания
          
          return (
            <div key={chatId} className="space-y-1">
              {/* Заголовок чата */}
              <div
                onClick={() => handleChatClick(chatId)}
                className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-[#00f0ff] hover:text-[#b026ff] cursor-pointer transition-colors group"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="flex-1 truncate">{chat?.title || 'Неизвестный чат'}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Элементы обучения из этого чата */}
              {isExpanded && (
                <div className="ml-4 space-y-0.5">
                  {items.map((item) => {
                    const isActive = currentLearning?.id === item.id && currentLearning?.type === item.type;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleItemClick(item)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all group ${
                          isActive
                            ? 'bg-gradient-to-r from-[#0066ff]/20 to-[#8000cc]/20 text-[#00f0ff] border-l-2 border-[#00f0ff]'
                            : 'text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]/50'
                        }`}
                      >
                        <div className="flex-shrink-0">{getIcon(item.type)}</div>
                        <span className="flex-1 truncate">{item.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Элементы без привязки к чату */}
        {ungroupedItems.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-[#2a2a3a]">
            <div className="px-2 py-1.5 text-xs font-semibold text-[#a0a0b0]">
              Без привязки к чату
            </div>
            <div className="space-y-0.5">
              {ungroupedItems.map((item) => {
                const isActive = currentLearning?.id === item.id && currentLearning?.type === item.type;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#0066ff]/20 to-[#8000cc]/20 text-[#00f0ff] border-l-2 border-[#00f0ff]'
                        : 'text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]/50'
                    }`}
                  >
                    <div className="flex-shrink-0">{getIcon(item.type)}</div>
                    <span className="flex-1 truncate">{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

