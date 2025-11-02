import { useState } from 'react';
import Sidebar from './components/Sidebar.tsx';
import ChatArea from './components/ChatArea.tsx';
import ContextPanel from './components/ContextPanel.tsx';
import { useChat } from './hooks/useChat';

export type ActiveTab = 'chat' | 'knowledge' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const { messages, isLoading, sendMessage } = useChat();

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <ChatArea messages={messages} isLoading={isLoading} onSendMessage={sendMessage} />
      <ContextPanel />
    </div>
  );
}

export default App;
