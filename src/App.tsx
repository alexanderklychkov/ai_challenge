import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar.tsx';
import ChatArea from './components/ChatArea.tsx';
import ContextPanel from './components/ContextPanel.tsx';
import { useChat } from './hooks/useChat';
import { createYandexGPTModel } from './services/yandexGPT';
import { createDeepSeekModel } from './services/deepSeek';
import { createHuggingFaceModel } from './services/huggingFace';

export type ActiveTab = 'chat' | 'knowledge' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  
  const models = useMemo(() => [
    // { model: createYandexGPTModel({ model: 'yandexgpt', temperature: 0 }), name: 'Yandex GPT. Температура: 0' },
    // { model: createYandexGPTModel({ model: 'yandexgpt', temperature: 0.5 }), name: 'Yandex GPT. Температура: 0.5' },
    // { model: createYandexGPTModel({ model: 'yandexgpt', temperature: 1 }), name: 'Yandex GPT. Температура: 1' },

    // { model: createDeepSeekModel({ model: 'deepseek-chat', temperature: 0 }), name: 'DeepSeek. Температура: 0' },
    // { model: createDeepSeekModel({ model: 'deepseek-chat', temperature: 1 }), name: 'DeepSeek. Температура: 1' },
    // { model: createDeepSeekModel({ model: 'deepseek-chat', temperature: 1.5 }), name: 'DeepSeek. Температура: 1.5' },

    // HuggingFace Inference Providers примеры
    // { model: createHuggingFaceModel({ model: 'deepseek-ai/DeepSeek-R1', provider: 'fastest', temperature: 0 }), name: 'HuggingFace (DeepSeek-R1, fastest)' },
    // { model: createHuggingFaceModel({ model: 'deepseek-ai/DeepSeek-R1', provider: 'cheapest', temperature: 0.5 }), name: 'HuggingFace (DeepSeek-R1, cheapest)' },
    // { model: createHuggingFaceModel({ model: 'openai/gpt-oss-120b', provider: 'auto', temperature: 0.3 }), name: 'HuggingFace (GPT-OSS-120b, auto)' },
    // { model: createHuggingFaceModel({ model: 'Qwen/Qwen2.5-7B-Instruct', provider: 'cheapest', temperature: 0.3 }), name: 'HuggingFace (Qwen2.5 7B, cheapest)' },
    // { model: createHuggingFaceModel({ model: 'google/gemma-2-9b-it', provider: 'auto', temperature: 0.4 }), name: 'HuggingFace (Gemma 2 9B)' },
    // { model: createHuggingFaceModel({ model: 'meta-llama/Llama-3.2-3B-Instruct', provider: 'cheapest', temperature: 0.3 }), name: 'HuggingFace (Llama 3.2 3B Instruct)' },
    { model: createHuggingFaceModel({ model: 'zai-org/GLM-4.6:novita', provider: 'auto', temperature: 0.4 }), name: 'Начало списка моделей HuggingFace (Zai-Org GLM-4.6)' },
    { model: createHuggingFaceModel({ model: 'bunnycore/Llama-3.2-1B-General-Best:featherless-ai', provider: 'cheapest', temperature: 0.3 }), name: 'Середина списка моделей HuggingFace (Llama-3.2-1B-General-Best )' },
    { model: createHuggingFaceModel({ model: 'Cchaos/Qwen2.5-0.5B-Instruct-Gensyn-Swarm-climbing_crested_condor:featherless-ai', provider: 'cheapest', temperature: 0.3 }), name: 'Конец списка моделей HuggingFace (Qwen2.5-0.5B-Instruct-Gensyn-Swarm-climbing_crested_condor)' },
  ], []);

  // Модель-анализатор для команды /analyze
  const analyzerModel = useMemo(() => ({
    model: createHuggingFaceModel({ 
      model: 'openai/gpt-oss-120b', 
      provider: 'auto', 
      temperature: 0.3 
    }),
    name: 'Анализатор (GPT-OSS-120b)'
  }), []);
  
  // Режим работы: 'parallel' - параллельно, 'chain' - цепочкой
  const { messages, isLoading, sendMessage, clearMessages } = useChat({ 
    models, 
    mode: 'chain-fast', // или 'parallel' для параллельного режима
    analyzerModel // Модель для анализа ответов (команда /analyze)
  });

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <ChatArea messages={messages} isLoading={isLoading} onSendMessage={sendMessage} onClearMessages={clearMessages} />
      <ContextPanel />
    </div>
  );
}

export default App;
