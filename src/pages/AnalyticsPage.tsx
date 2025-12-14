import { useState, useRef } from 'react';
import { Upload, FileText, BarChart3, Send, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadDataFile, analyzeData, getDataStats, UploadedData } from '../services/analytics';
import { useAuth } from '../contexts/AuthContext';

export function AnalyticsPage() {
  const { isAuth } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [modelType, setModelType] = useState<'ollama' | 'lmstudio'>('ollama');
  const [model, setModel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setUploadedData(null);
    setAnswer(null);
    setLoading(true);

    try {
      // Проверяем тип файла
      const fileName = selectedFile.name.toLowerCase();
      const isValidType = 
        fileName.endsWith('.csv') || 
        fileName.endsWith('.json') || 
        fileName.endsWith('.log') ||
        fileName.includes('log');

      if (!isValidType) {
        throw new Error('Поддерживаются только файлы CSV, JSON и LOG');
      }

      const data = await uploadDataFile(selectedFile);
      setUploadedData(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке файла');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAnalyze = async () => {
    if (!uploadedData || !question.trim()) {
      return;
    }

    setAnalyzing(true);
    setAnswer(null);
    setError(null);

    try {
      const result = await analyzeData(
        uploadedData.data,
        uploadedData.summary,
        question,
        modelType,
        model ? { model } : undefined
      );
      setAnswer(result);
    } catch (err: any) {
      setError(err.message || 'Ошибка при анализе данных');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setUploadedData(null);
    setQuestion('');
    setAnswer(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exampleQuestions = [
    'Какая ошибка встречается чаще всего?',
    'Сколько всего записей в данных?',
    'Какие колонки есть в данных?',
    'Где больше всего пользователей теряется?',
    'Покажи статистику по ошибкам',
  ];

  if (!isAuth) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
          <p className="text-lg text-[#a0a0b0]">Необходима авторизация</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-[#e0e0e8] overflow-hidden">
      {/* Заголовок */}
      <div className="border-b border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-[#00f0ff]" />
            <h1 className="text-2xl font-bold text-white">Локальный аналитик данных</h1>
          </div>
          {uploadedData && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg bg-[#1e1e2e] text-[#a0a0b0] hover:text-white hover:bg-[#2a2a3a] transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Очистить
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Загрузка файла */}
        {!uploadedData && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-[#2a2a3a] rounded-xl p-12 text-center hover:border-[#00f0ff]/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.log"
              onChange={handleFileInputChange}
              className="hidden"
            />
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-[#00f0ff] animate-spin" />
                <p className="text-[#a0a0b0]">Загрузка и обработка файла...</p>
              </div>
            ) : (
              <>
                <Upload className="w-16 h-16 mx-auto mb-4 text-[#00f0ff]" />
                <h2 className="text-xl font-semibold mb-2">Загрузите файл данных</h2>
                <p className="text-[#a0a0b0] mb-4">
                  Поддерживаются форматы: CSV, JSON, LOG
                </p>
                <p className="text-sm text-[#808080]">
                  Перетащите файл сюда или нажмите для выбора
                </p>
              </>
            )}
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Ошибка</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Информация о загруженных данных */}
        {uploadedData && (
          <div className="space-y-6">
            {/* Сводка данных */}
            <div className="bg-[#151520]/80 backdrop-blur-xl rounded-xl p-6 border border-[#2a2a3a]">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-semibold">Данные загружены</h2>
                <span className="px-2 py-1 rounded bg-[#1e1e2e] text-xs text-[#a0a0b0] uppercase">
                  {uploadedData.type}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#a0a0b0] mb-1">Файл</p>
                  <p className="text-white font-medium">{uploadedData.fileName}</p>
                </div>
                <div>
                  <p className="text-sm text-[#a0a0b0] mb-1">Записей</p>
                  <p className="text-white font-medium">{uploadedData.summary.totalRows}</p>
                </div>
                {uploadedData.summary.columns && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-[#a0a0b0] mb-2">Колонки</p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedData.summary.columns.map((col, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded bg-[#1e1e2e] text-sm text-[#e0e0e8] border border-[#2a2a3a]"
                        >
                          {col.name} <span className="text-[#808080]">({col.type})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {uploadedData.summary.errorCount !== undefined && (
                  <>
                    <div>
                      <p className="text-sm text-[#a0a0b0] mb-1">Ошибок</p>
                      <p className="text-white font-medium text-red-400">
                        {uploadedData.summary.errorCount}
                      </p>
                    </div>
                    {uploadedData.summary.levelCounts && (
                      <div>
                        <p className="text-sm text-[#a0a0b0] mb-1">Уровни логирования</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(uploadedData.summary.levelCounts).map(([level, count]) => (
                            <span
                              key={level}
                              className="px-2 py-1 rounded bg-[#1e1e2e] text-xs text-[#e0e0e8]"
                            >
                              {level}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Настройки модели */}
            <div className="bg-[#151520]/80 backdrop-blur-xl rounded-xl p-6 border border-[#2a2a3a]">
              <h3 className="text-lg font-semibold mb-4">Настройки модели</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#a0a0b0] mb-2">Тип модели</label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value as 'ollama' | 'lmstudio')}
                    className="w-full px-4 py-2 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] text-white focus:outline-none focus:border-[#00f0ff]"
                  >
                    <option value="ollama">Ollama</option>
                    <option value="lmstudio">LM Studio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#a0a0b0] mb-2">
                    Модель (опционально)
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Оставьте пустым для модели по умолчанию"
                    className="w-full px-4 py-2 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] text-white placeholder-[#808080] focus:outline-none focus:border-[#00f0ff]"
                  />
                </div>
              </div>
            </div>

            {/* Примеры вопросов */}
            <div className="bg-[#151520]/80 backdrop-blur-xl rounded-xl p-6 border border-[#2a2a3a]">
              <h3 className="text-lg font-semibold mb-4">Примеры вопросов</h3>
              <div className="flex flex-wrap gap-2">
                {exampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuestion(q)}
                    className="px-4 py-2 rounded-lg bg-[#1e1e2e] text-[#a0a0b0] hover:text-white hover:bg-[#2a2a3a] transition-colors text-sm border border-[#2a2a3a]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Поле для вопроса */}
            <div className="bg-[#151520]/80 backdrop-blur-xl rounded-xl p-6 border border-[#2a2a3a]">
              <h3 className="text-lg font-semibold mb-4">Задайте вопрос</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAnalyze();
                    }
                  }}
                  placeholder="Например: Какая ошибка встречается чаще всего?"
                  className="flex-1 px-4 py-3 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] text-white placeholder-[#808080] focus:outline-none focus:border-[#00f0ff]"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !question.trim()}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white font-medium hover:from-[#0055ff] hover:to-[#7000bb] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Анализ...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Анализировать
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Ответ */}
            {answer && (
              <div className="bg-[#151520]/80 backdrop-blur-xl rounded-xl p-6 border border-[#2a2a3a]">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00f0ff]" />
                  Ответ
                </h3>
                <div className="prose prose-invert max-w-none">
                  <div className="text-[#e0e0e8] whitespace-pre-wrap">{answer}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
