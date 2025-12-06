import { useState, useCallback, useEffect } from 'react';
import { generateChangelog, getTags, ChangelogResult, Tag } from '../services/changelog';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownComponents } from '../utils/markdownComponents';
import { FileText, Sparkles, Download, RefreshCw, GitBranch, Tag as TagIcon, Calendar } from 'lucide-react';

export function ChangelogPage() {
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [branch, setBranch] = useState('main');
  const [modelType, setModelType] = useState('deepseek');
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [result, setResult] = useState<ChangelogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  // Загружаем теги при монтировании
  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const tagsData = await getTags();
      setTags(tagsData);
    } catch (err) {
      console.error('Ошибка при загрузке тегов:', err);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const changelogResult = await generateChangelog({
        since: since || undefined,
        until: until || undefined,
        branch,
        modelType,
        format,
      });

      setResult(changelogResult);
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации changelog');
      console.error('Ошибка при генерации changelog:', err);
    } finally {
      setIsLoading(false);
    }
  }, [since, until, branch, modelType, format, isLoading]);

  const handleDownload = useCallback(() => {
    if (!result) return;

    const content = result.changelog;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CHANGELOG_${result.metadata.branch}_${new Date(result.metadata.generatedAt).toISOString().split('T')[0]}.${format === 'markdown' ? 'md' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, format]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-[#e0e0e8]">
      {/* Заголовок */}
      <div className="border-b border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#0066ff] to-[#8000cc] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Генератор Changelog</h1>
              <p className="text-sm text-[#a0a0b0]">Автоматическая генерация changelog из коммитов GitHub</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Панель настроек слева */}
        <div className="w-80 border-r border-[#2a2a3a] bg-[#151520]/50 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Параметры периода */}
            <div>
              <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Период коммитов
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#a0a0b0] mb-1">С (since)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={since}
                      onChange={(e) => setSince(e.target.value)}
                      placeholder="v1.0.0 или SHA"
                      className="w-full px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#0066ff]"
                    />
                    {tags.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) setSince(e.target.value);
                        }}
                        className="mt-2 w-full px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white focus:outline-none focus:border-[#0066ff]"
                      >
                        <option value="">Выберите тег...</option>
                        {tags.slice(0, 20).map((tag) => (
                          <option key={tag.name} value={tag.name}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#a0a0b0] mb-1">До (until)</label>
                  <input
                    type="text"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                    placeholder="HEAD или SHA"
                    className="w-full px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#0066ff]"
                  />
                </div>
              </div>
            </div>

            {/* Ветка */}
            <div>
              <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Ветка
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#0066ff]"
              />
            </div>

            {/* Модель */}
            <div>
              <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Модель LLM
              </label>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                className="w-full px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white focus:outline-none focus:border-[#0066ff]"
              >
                <option value="deepseek">DeepSeek</option>
                <option value="yandex">Yandex GPT</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="huggingface">HuggingFace</option>
              </select>
            </div>

            {/* Формат */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Формат</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormat('markdown')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    format === 'markdown'
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white'
                      : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-white'
                  }`}
                >
                  Markdown
                </button>
                <button
                  onClick={() => setFormat('json')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    format === 'json'
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white'
                      : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-white'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

            {/* Кнопка генерации */}
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg font-medium hover:from-[#0055ff] hover:to-[#7000bb] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Сгенерировать Changelog
                </>
              )}
            </button>

            {/* Кнопка обновления тегов */}
            <button
              onClick={loadTags}
              disabled={isLoadingTags}
              className="w-full px-4 py-2 bg-[#1e1e2e] text-[#a0a0b0] rounded-lg font-medium hover:text-white hover:bg-[#2a2a3a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoadingTags ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <TagIcon className="w-4 h-4" />
                  Обновить теги
                </>
              )}
            </button>
          </div>
        </div>

        {/* Основная область с результатом */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {error && (
            <div className="m-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              <p className="font-medium">Ошибка</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Информация о результате */}
              <div className="border-b border-[#2a2a3a] px-6 py-3 bg-[#151520]/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-[#a0a0b0]">
                      <GitBranch className="w-4 h-4" />
                      <span>{result.metadata.branch}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#a0a0b0]">
                      <FileText className="w-4 h-4" />
                      <span>{result.metadata.commitsCount} коммитов</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#a0a0b0]">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(result.metadata.generatedAt).toLocaleString('ru-RU')}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-[#1e1e2e] text-white rounded-lg hover:bg-[#2a2a3a] transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Скачать
                  </button>
                </div>
              </div>

              {/* Changelog */}
              <div className="flex-1 overflow-y-auto p-6">
                {format === 'markdown' ? (
                  <div className="prose prose-invert max-w-none">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={getMarkdownComponents()}
                    >
                      {result.changelog}
                    </Markdown>
                  </div>
                ) : (
                  <pre className="bg-[#1e1e2e] p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{JSON.stringify(JSON.parse(result.changelog), null, 2)}</code>
                  </pre>
                )}
              </div>
            </>
          )}

          {!result && !error && (
            <div className="flex-1 flex items-center justify-center text-[#a0a0b0]">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Генератор Changelog</p>
                <p className="text-sm">Настройте параметры и нажмите "Сгенерировать Changelog"</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

