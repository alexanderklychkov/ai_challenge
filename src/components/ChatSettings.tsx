import { useState, useEffect } from 'react';
import { Chat, ChatSettings as ChatSettingsType, AgentConfig, ModelMode, AgentType } from '../types/chat';
import { Settings, Plus, Trash2, Save } from 'lucide-react';
import Select from './Select';
import Dialog from './Dialog';
import RadioGroup from './RadioGroup';
import Switch from './Switch';

interface ChatSettingsProps {
  chat: Chat;
  onSave: (settings: ChatSettingsType) => void;
  onClose: () => void;
  open: boolean;
}

const generateAgentId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const getDefaultAgent = (): AgentConfig => ({
  id: generateAgentId(),
  type: 'deepseek',
  name: 'DeepSeek',
  model: 'deepseek-chat',
  temperature: 0.3,
  enableMCP: true,
});

const AGENT_TYPES: { value: AgentType; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'yandex', label: 'Yandex GPT' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

const MODEL_PRESETS: Record<AgentType, { value: string; label: string }[]> = {
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-coder', label: 'DeepSeek Coder' },
  ],
  huggingface: [
    { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek-R1' },
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS-120b' },
    { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5 7B' },
    { value: 'google/gemma-2-9b-it', label: 'Gemma 2 9B' },
    { value: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B' },
  ],
  yandex: [
    { value: 'yandexgpt', label: 'YandexGPT' },
    { value: 'yandexgpt-lite', label: 'YandexGPT Lite' },
  ],
  chatgpt: [
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
};

const MODE_OPTIONS: { value: ModelMode; label: string; description: string }[] = [
  { value: 'parallel', label: 'Параллельно', description: 'Все модели отвечают одновременно' },
  { value: 'chain', label: 'Цепочкой', description: 'Модели отвечают последовательно' },
  { value: 'chain-fast', label: 'Быстрая цепочка', description: 'Параллельно, первая завершившаяся пишет первой' },
];

const ChatSettings = ({ chat, onSave, onClose, open }: ChatSettingsProps) => {
  const [settings, setSettings] = useState<ChatSettingsType>(
    chat.settings || {
      mode: 'chain-fast',
      agents: [getDefaultAgent()],
      enableCompression: false,
      compressionInterval: 6,
    }
  );

  const handleAddAgent = () => {
    const newAgent: AgentConfig = {
      ...getDefaultAgent(),
      name: `Агент ${settings.agents.length + 1}`,
    };
    setSettings((prev) => ({
      ...prev,
      agents: [...prev.agents, newAgent],
    }));
  };

  const handleRemoveAgent = (agentId: string) => {
    if (settings.agents.length <= 1) {
      return; // Не позволяем удалить последнего агента
    }
    setSettings((prev) => ({
      ...prev,
      agents: prev.agents.filter((a) => a.id !== agentId),
    }));
  };

  const handleUpdateAgent = (agentId: string, updates: Partial<AgentConfig>) => {
    setSettings((prev) => {
      const updatedAgents = prev.agents.map((a) => {
        if (a.id === agentId) {
          const updated = { ...a, ...updates };
          // Если изменился тип агента, сбрасываем модель если она не подходит новому типу
          if (updates.type && updates.type !== a.type) {
            const newType = updates.type;
            const isModelValid = MODEL_PRESETS[newType].some(p => p.value === updated.model);
            if (!isModelValid && updated.model !== '__custom__') {
              updated.model = MODEL_PRESETS[newType][0]?.value || '';
            }
          }
          return updated;
        }
        return a;
      });
      return { ...prev, agents: updatedAgents };
    });
  };

  const handleSave = () => {
    // Убеждаемся, что у всех агентов есть ID
    const agentsWithIds = settings.agents.map((agent) => ({
      ...agent,
      id: agent.id || generateAgentId(),
    }));
    onSave({ ...settings, agents: agentsWithIds });
  };

  return (
    <Dialog open={open} onClose={onClose} title={
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-[#00f0ff]" />
        <span>Настройки чата</span>
      </div>
    } footer={
      <>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[#a0a0b0] hover:text-[#e0e0e8] transition-colors cursor-pointer"
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg hover:from-[#0055ff] hover:to-[#7000bb] transition-all flex items-center gap-2 font-medium shadow-[0_0_10px_rgba(0,102,255,0.2)] cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Сохранить
        </button>
      </>
    }>
      <div className="space-y-6">
        {/* Режим работы */}
        <div>
          <label className="block text-sm font-semibold text-[#00f0ff] mb-2">Режим работы</label>
          <RadioGroup
            value={settings.mode}
            onChange={(value) => setSettings((prev) => ({ ...prev, mode: value as ModelMode }))}
            options={MODE_OPTIONS}
          />
        </div>

          {/* Агенты */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-[#00f0ff]">Агенты</label>
              <button
                onClick={handleAddAgent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0066ff] hover:bg-[#0055ff] text-white rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Добавить
              </button>
            </div>
            <div className="space-y-3">
              {settings.agents.map((agent, index) => (
                <div
                  key={agent.id || index}
                  className="p-4 bg-[#1e1e2e]/60 border border-[#2a2a3a] rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#a0a0b0]">#{index + 1}</span>
                      <input
                        type="text"
                        value={agent.name}
                        onChange={(e) => handleUpdateAgent(agent.id || index.toString(), { name: e.target.value })}
                        className="flex-1 px-2 py-1 bg-[#151520] border border-[#2a2a3a] rounded text-sm text-[#e0e0e8] focus:outline-none focus:ring-1 focus:ring-[#00f0ff] focus:border-[#00f0ff]"
                        placeholder="Название агента"
                      />
                    </div>
                    {settings.agents.length > 1 && (
                      <button
                        onClick={() => handleRemoveAgent(agent.id || index.toString())}
                        className="p-1 hover:bg-[#2a2a3a] rounded text-[#a0a0b0] hover:text-[#ff4444] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#a0a0b0] mb-1">Тип</label>
                      <Select
                        value={agent.type}
                        onChange={(value) =>
                          handleUpdateAgent(agent.id || index.toString(), { type: value as AgentType })
                        }
                        options={AGENT_TYPES.map((type) => ({ value: type.value, label: type.label }))}
                        placeholder="Выберите тип..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#a0a0b0] mb-1">Модель</label>
                      {agent.model === '__custom__' || (agent.model && !MODEL_PRESETS[agent.type].some(p => p.value === agent.model)) ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={agent.model === '__custom__' ? '' : agent.model}
                            onChange={(e) => handleUpdateAgent(agent.id || index.toString(), { model: e.target.value })}
                            className="flex-1 px-2 py-1.5 bg-[#151520] border border-[#2a2a3a] rounded text-sm text-[#e0e0e8] focus:outline-none focus:ring-1 focus:ring-[#00f0ff]"
                            placeholder="Введите модель"
                          />
                          <button
                            onClick={() => handleUpdateAgent(agent.id || index.toString(), { model: MODEL_PRESETS[agent.type][0]?.value || '' })}
                            className="px-3 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] text-[#e0e0e8] rounded text-sm transition-colors cursor-pointer"
                          >
                            Из списка
                          </button>
                        </div>
                      ) : (
                        <Select
                          value={agent.model || ''}
                          onChange={(value) => {
                            if (value === '__custom__') {
                              handleUpdateAgent(agent.id || index.toString(), { model: '__custom__' });
                            } else if (value) {
                              handleUpdateAgent(agent.id || index.toString(), { model: value });
                            }
                          }}
                          options={[
                            ...MODEL_PRESETS[agent.type].map((preset) => ({ value: preset.value, label: preset.label })),
                            { value: '__custom__', label: 'Своя модель...' },
                          ]}
                          placeholder="Выберите модель..."
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#a0a0b0] mb-1">
                        Температура: {agent.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={agent.temperature}
                        onChange={(e) =>
                          handleUpdateAgent(agent.id || index.toString(), {
                            temperature: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    {agent.type === 'huggingface' && (
                      <div>
                        <label className="block text-xs text-[#a0a0b0] mb-1">Провайдер</label>
                        <Select
                          value={agent.provider || 'auto'}
                          onChange={(value) =>
                            handleUpdateAgent(agent.id || index.toString(), { provider: value })
                          }
                          options={[
                            { value: 'auto', label: 'Auto' },
                            { value: 'fastest', label: 'Fastest' },
                            { value: 'cheapest', label: 'Cheapest' },
                          ]}
                          placeholder="Выберите провайдер..."
                        />
                      </div>
                    )}
                  </div>

                  {agent.type === 'deepseek' && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={agent.enableMCP || false}
                        onChange={(checked) =>
                          handleUpdateAgent(agent.id || index.toString(), { enableMCP: checked })
                        }
                      />
                      <label className="text-sm text-[#a0a0b0] cursor-pointer">Включить MCP</label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Сжатие истории */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Switch
                checked={settings.enableCompression || false}
                onChange={(checked) => setSettings((prev) => ({ ...prev, enableCompression: checked }))}
              />
              <label className="text-sm font-semibold text-[#00f0ff] cursor-pointer">Включить сжатие истории</label>
            </div>
            {settings.enableCompression && (
              <div className="mt-2">
                <label className="block text-xs text-[#a0a0b0] mb-1">
                  Интервал сжатия: {settings.compressionInterval || 6} сообщений
                </label>
                <input
                  type="range"
                  min="3"
                  max="20"
                  step="1"
                  value={settings.compressionInterval || 6}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, compressionInterval: parseInt(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
    </Dialog>
  );
};

export default ChatSettings;

