import { useState, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import ChatList from './components/ChatList.tsx';
import { LearningList } from './components/LearningList.tsx';
import { LearningPage } from './components/LearningPage.tsx';
import { ChatPage } from './pages/ChatPage.tsx';
import { DocumentViewerPage } from './pages/DocumentViewerPage.tsx';
import { Code, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

function App() {
  const location = useLocation();
  const [chatListRefreshTrigger, setChatListRefreshTrigger] = useState(0);
  const isChatRoute = location.pathname.startsWith('/chat');
  const isLearningRoute = location.pathname.startsWith('/learning');
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChatListRefresh = useCallback(() => {
    // Debounce обновления списка чатов
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      setChatListRefreshTrigger(prev => prev + 1);
    }, 500);
  }, []);

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] overflow-hidden relative">
      {/* Фоновые эффекты */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00f0ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ transform: 'translateZ(0)' }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b026ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ animationDelay: '1.5s', transform: 'translateZ(0)' }}></div>
      </div>
      
      <div className="relative z-10 flex w-full">
        {/* Панель с чатами слева */}
        <aside className="hidden md:flex flex-col w-[280px] border-r border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl relative">
          {/* Градиентная линия сверху */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
          
          {/* Переключатель вида */}
          <div className="h-16 border-b border-[#2a2a3a] flex items-center px-4">
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
          </div>
          
          {/* Список чатов (только для режима чата) */}
          {isChatRoute && (
            <div className="flex-1 overflow-hidden">
              <ChatList 
                refreshTrigger={chatListRefreshTrigger}
              />
            </div>
          )}
          
          {/* Список обучений (только для режима обучения) */}
          {isLearningRoute && (
            <div className="flex-1 overflow-hidden">
              <LearningList />
            </div>
          )}
          
          {/* Градиентная линия снизу */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent"></div>
        </aside>
        
        {/* Основной контент */}
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage chatListRefreshTrigger={chatListRefreshTrigger} onChatListRefresh={handleChatListRefresh} />} />
            <Route path="/chat/:chatId" element={<ChatPage chatListRefreshTrigger={chatListRefreshTrigger} onChatListRefresh={handleChatListRefresh} />} />
            <Route path="/learning" element={<LearningPage />} />
            <Route path="/learning/test/:testId" element={<LearningPage />} />
            <Route path="/learning/flashcards/:setId" element={<LearningPage />} />
            <Route path="/learning/plan/:planId" element={<LearningPage />} />
            <Route path="/documents/:fileName" element={<DocumentViewerPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
