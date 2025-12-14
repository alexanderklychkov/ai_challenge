import { useState, useCallback, useRef, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ChatList from './components/ChatList.tsx';
import { LearningList } from './components/LearningList.tsx';
import { LearningPage } from './components/LearningPage.tsx';
import { ChatPage } from './pages/ChatPage.tsx';
import { DocumentViewerPage } from './pages/DocumentViewerPage.tsx';
import { SupportPage } from './pages/SupportPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { SupportButton } from './components/SupportButton.tsx';
import { Code, BookOpen, LogOut, User, Ticket, X, ChevronLeft, ChevronRight, Menu, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUserTickets, deleteTicket, Ticket as TicketType } from './services/tickets';

function App() {
  const location = useLocation();
  const { isAuth, user, logout } = useAuth();
  const [chatListRefreshTrigger, setChatListRefreshTrigger] = useState(0);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const isChatRoute = location.pathname.startsWith('/chat');
  const isLearningRoute = location.pathname.startsWith('/learning');
  const isSupportRoute = location.pathname === '/support';
  const isAnalyticsRoute = location.pathname === '/analytics';
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Сохраняем состояние панели в localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Загружаем тикеты при авторизации
  const loadTickets = useCallback(() => {
    if (isAuth && user) {
      console.log('Загрузка тикетов для пользователя:', user.id, user.email);
      setTicketsLoading(true);
      getUserTickets()
        .then((tickets) => {
          console.log('Тикеты загружены:', tickets.length);
          setTickets(tickets);
        })
        .catch((error) => {
          console.error('Ошибка при загрузке тикетов:', error);
          setTickets([]);
        })
        .finally(() => setTicketsLoading(false));
    } else {
      console.log('Пользователь не авторизован или отсутствует');
    }
  }, [isAuth, user]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Обновляем тикеты при создании нового
  useEffect(() => {
    const handleTicketCreated = () => {
      loadTickets();
    };
    window.addEventListener('ticketCreated', handleTicketCreated);
    return () => {
      window.removeEventListener('ticketCreated', handleTicketCreated);
    };
  }, [loadTickets]);

  // Обработчик удаления тикета
  const handleDeleteTicket = useCallback(async (ticketId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Вы уверены, что хотите удалить этот тикет?')) {
      return;
    }

    try {
      await deleteTicket(ticketId);
      loadTickets();
      // Если удаленный тикет был открыт, переходим на страницу поддержки без тикета
      if (location.pathname === '/support' && new URLSearchParams(location.search).get('ticket') === ticketId) {
        window.location.href = '/support';
      }
    } catch (error) {
      console.error('Ошибка при удалении тикета:', error);
      alert('Не удалось удалить тикет');
    }
  }, [loadTickets, location]);

  const handleChatListRefresh = useCallback(() => {
    // Debounce обновления списка чатов
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      setChatListRefreshTrigger(prev => prev + 1);
    }, 500);
  }, []);

  // Если пользователь не авторизован и не на странице авторизации, показываем страницу входа
  if (!isAuth && !isAuthRoute) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Если пользователь авторизован и на странице авторизации, перенаправляем в чат
  if (isAuth && isAuthRoute) {
    return <Navigate to="/chat" replace />;
  }

  // Если на странице авторизации, показываем только форму
  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] overflow-hidden relative">
      {/* Фоновые эффекты */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00f0ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ transform: 'translateZ(0)' }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b026ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ animationDelay: '1.5s', transform: 'translateZ(0)' }}></div>
      </div>
      
      <div className="relative z-10 flex w-full">
        {/* Панель с чатами слева */}
        <aside className={`hidden md:flex flex-col border-r border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl relative transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-[280px]'
        }`}>
          {/* Градиентная линия сверху */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
          
          {/* Переключатель вида */}
          <div className={`border-b border-[#2a2a3a] flex transition-all duration-300 ${
            sidebarCollapsed ? 'px-2 py-2 flex-col gap-2' : 'h-16 px-4 items-center'
          }`}>
            {sidebarCollapsed ? (
              <>
                <Link
                  to="/chat"
                  className={`w-full h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isChatRoute
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:from-[#0055ff] hover:to-[#7000bb]'
                      : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                  }`}
                  title="Чат"
                >
                  <Code className="w-5 h-5" />
                </Link>
                <Link
                  to="/learning"
                  className={`w-full h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isLearningRoute
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:from-[#0055ff] hover:to-[#7000bb]'
                      : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                  }`}
                  title="Обучение"
                >
                  <BookOpen className="w-5 h-5" />
                </Link>
                <Link
                  to="/analytics"
                  className={`w-full h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isAnalyticsRoute
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:from-[#0055ff] hover:to-[#7000bb]'
                      : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                  }`}
                  title="Аналитик"
                >
                  <BarChart3 className="w-5 h-5" />
                </Link>
              </>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex gap-2 w-full">
                  <Link
                    to="/chat"
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all text-center flex items-center justify-center cursor-pointer ${
                      isChatRoute
                        ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:from-[#0055ff] hover:to-[#7000bb]'
                        : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Code className="w-4 h-4" />
                      Чат
                    </div>
                  </Link>
                  <Link
                    to="/learning"
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all text-center flex items-center justify-center cursor-pointer ${
                      isLearningRoute
                        ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:from-[#0055ff] hover:to-[#7000bb]'
                        : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Обучение
                    </div>
                  </Link>
                </div>
                <Link
                  to="/analytics"
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all text-center flex items-center justify-center cursor-pointer ${
                    isAnalyticsRoute
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:from-[#0055ff] hover:to-[#7000bb]'
                      : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Аналитик
                  </div>
                </Link>
              </div>
            )}
          </div>
          
          {/* Список чатов (только для режима чата) */}
          {isChatRoute && !sidebarCollapsed && (
            <div className="flex-1 overflow-hidden">
              <ChatList 
                refreshTrigger={chatListRefreshTrigger}
              />
            </div>
          )}
          
          {/* Список обучений (только для режима обучения) */}
          {isLearningRoute && !sidebarCollapsed && (
            <div className="flex-1 overflow-hidden">
              <LearningList />
            </div>
          )}

          {/* Список тикетов (только для режима поддержки) */}
          {isSupportRoute && !sidebarCollapsed && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[#2a2a3a]">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Мои тикеты
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {ticketsLoading ? (
                  <div className="px-4 py-3 text-sm text-[#a0a0b0]">Загрузка...</div>
                ) : tickets.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[#a0a0b0]">Нет тикетов</div>
                ) : (
                  <div className="px-2 py-2 space-y-1">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="group relative px-3 py-2 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] hover:bg-[#2a2a3a] transition-colors"
                      >
                        <Link
                          to={`/support?ticket=${ticket.id}`}
                          className="block"
                        >
                          <div className="text-sm font-medium text-white truncate mb-1">
                            {ticket.subject}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded ${
                              ticket.status === 'open' 
                                ? 'bg-green-500/20 text-green-400' 
                                : ticket.status === 'closed'
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {ticket.status === 'open' ? 'Открыт' : ticket.status === 'closed' ? 'Закрыт' : 'В работе'}
                            </span>
                            <span className="text-[#a0a0b0]">
                              {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => handleDeleteTicket(ticket.id, e)}
                          className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#3a3a4a] text-[#a0a0b0] hover:text-red-400"
                          title="Удалить тикет"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Плейсхолдер когда панель свернута */}
          {(isChatRoute || isLearningRoute || isSupportRoute || isAnalyticsRoute) && sidebarCollapsed && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-[#808080] text-xs text-center px-2">
                <Menu className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <div>Панель свернута</div>
              </div>
            </div>
          )}
          
          {/* Кнопка сворачивания */}
          <div className={`border-t border-[#2a2a3a] transition-all duration-300 ${
            sidebarCollapsed ? 'px-2 py-2' : 'px-4 py-2'
          }`}>
            <button
              onClick={toggleSidebar}
              className={`w-full p-2 rounded-lg bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a] transition-all border border-[#2a2a3a] hover:border-[#00f0ff]/50 flex items-center justify-center gap-2 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-xs">Свернуть</span>
                </>
              )}
            </button>
          </div>

          {/* Информация о пользователе внизу */}
          {user && (
            <div className={`h-16 border-t border-[#2a2a3a] flex items-center transition-all duration-300 mt-2 ${
              sidebarCollapsed ? 'px-2 justify-center' : 'px-4 gap-3'
            }`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#0066ff] to-[#8000cc] flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{user.name}</div>
                    <div className="text-xs text-[#a0a0b0] truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-[#a0a0b0] hover:text-white hover:bg-[#2a2a3a] rounded-lg transition-colors flex-shrink-0"
                    title="Выйти"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
              {sidebarCollapsed && (
                <button
                  onClick={logout}
                  className="p-2 text-[#a0a0b0] hover:text-white hover:bg-[#2a2a3a] rounded-lg transition-colors flex-shrink-0 ml-auto"
                  title="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Градиентная линия снизу */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent"></div>
        </aside>
        
        {/* Основной контент */}
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage chatListRefreshTrigger={chatListRefreshTrigger} onChatListRefresh={handleChatListRefresh} /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage chatListRefreshTrigger={chatListRefreshTrigger} onChatListRefresh={handleChatListRefresh} /></ProtectedRoute>} />
            <Route path="/learning" element={<ProtectedRoute><LearningPage /></ProtectedRoute>} />
            <Route path="/learning/test/:testId" element={<ProtectedRoute><LearningPage /></ProtectedRoute>} />
            <Route path="/learning/flashcards/:setId" element={<ProtectedRoute><LearningPage /></ProtectedRoute>} />
            <Route path="/learning/plan/:planId" element={<ProtectedRoute><LearningPage /></ProtectedRoute>} />
            <Route path="/learning/course/:courseId" element={<ProtectedRoute><LearningPage /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/documents/:fileName" element={<ProtectedRoute><DocumentViewerPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </div>
      
      {/* Плавающая кнопка поддержки */}
      <SupportButton />
    </div>
  );
}

export default App;
