import { useState } from 'react';
import { generateCourse, type CourseGenerationParams } from '../services/courses';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface CourseGeneratorProps {
  onCourseGenerated?: (courseId: string) => void;
}

export function CourseGenerator({ onCourseGenerated }: CourseGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [duration, setDuration] = useState(7);
  const [description, setDescription] = useState('');
  const [generateTasks, setGenerateTasks] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Пожалуйста, укажите тему курса');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      const params: CourseGenerationParams = {
        topic: topic.trim(),
        difficulty,
        duration,
        description: description.trim() || undefined,
        generateTasks,
        generateContent: true, // Всегда генерируем контент
      };

      const course = await generateCourse(params);
      
      if (course) {
        setSuccess(true);
        setTimeout(() => {
          if (onCourseGenerated) {
            onCourseGenerated(course.id);
          }
        }, 1500);
      } else {
        setError('Не удалось сгенерировать курс. Попробуйте еще раз.');
      }
    } catch (err) {
      console.error('Ошибка при генерации курса:', err);
      setError('Произошла ошибка при генерации курса');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setTopic('');
    setDifficulty('beginner');
    setDuration(7);
    setDescription('');
    setGenerateTasks(false);
    setError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="border border-[#2a2a3a] rounded-lg p-8 bg-[#151520]/50 backdrop-blur-sm text-center">
        <CheckCircle2 className="w-16 h-16 text-[#00ff88] mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-[#e0e0e8] mb-2">Курс успешно создан!</h3>
        <p className="text-[#a0a0b0] mb-6">Курс "{topic}" готов к изучению</p>
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg hover:from-[#0055ff] hover:to-[#7000bb] transition-all"
        >
          Создать еще один курс
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-[#00f0ff]" />
        <h2 className="text-2xl font-bold gradient-text">Генератор курсов</h2>
      </div>

      <div className="space-y-4">
        {/* Тема курса */}
        <div>
          <label className="block text-sm font-medium text-[#e0e0e8] mb-2">
            Тема курса *
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Например: React, Node.js, Python, TypeScript..."
            className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] placeholder-[#808080] focus:outline-none focus:border-[#00f0ff] transition-colors"
            disabled={isGenerating}
          />
        </div>

        {/* Уровень сложности */}
        <div>
          <label className="block text-sm font-medium text-[#e0e0e8] mb-2">
            Уровень сложности *
          </label>
          <div className="flex gap-3">
            {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                disabled={isGenerating}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  difficulty === level
                    ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white'
                    : 'bg-[#1e1e2e] text-[#a0a0b0] hover:text-[#e0e0e8] hover:bg-[#2a2a3a]'
                }`}
              >
                {level === 'beginner' ? 'Начинающий' : 
                 level === 'intermediate' ? 'Средний' : 
                 'Продвинутый'}
              </button>
            ))}
          </div>
        </div>

        {/* Длительность */}
        <div>
          <label className="block text-sm font-medium text-[#e0e0e8] mb-2">
            Длительность курса (дней)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 7)}
            min="1"
            max="30"
            className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] focus:outline-none focus:border-[#00f0ff] transition-colors"
            disabled={isGenerating}
          />
        </div>

        {/* Описание */}
        <div>
          <label className="block text-sm font-medium text-[#e0e0e8] mb-2">
            Описание курса (опционально)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Дополнительное описание курса..."
            rows={3}
            className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] placeholder-[#808080] focus:outline-none focus:border-[#00f0ff] transition-colors resize-none"
            disabled={isGenerating}
          />
        </div>

        {/* Генерация задач в Todoist */}
        <div className="flex items-center gap-3 p-4 bg-[#1e1e2e]/50 rounded-lg border border-[#2a2a3a]">
          <input
            type="checkbox"
            id="generateTasks"
            checked={generateTasks}
            onChange={(e) => setGenerateTasks(e.target.checked)}
            disabled={isGenerating}
            className="w-5 h-5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-[#00f0ff] focus:ring-[#00f0ff] focus:ring-2 cursor-pointer"
          />
          <label htmlFor="generateTasks" className="flex-1 text-sm text-[#e0e0e8] cursor-pointer">
            Создать задачи в Todoist для каждого модуля курса
          </label>
        </div>

        {/* Информация о генерации контента */}
        <div className="p-4 bg-[#1e1e2e]/50 rounded-lg border border-[#2a2a3a]">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#00f0ff] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-[#e0e0e8]">Генерация контента через AI</div>
              <div className="text-xs text-[#a0a0b0] mt-1">
                Контент для модулей будет генерироваться параллельно. Курс будет доступен сразу, модули заполнятся по мере готовности.
              </div>
            </div>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="p-4 bg-[#ff4444]/10 border border-[#ff4444]/50 rounded-lg text-[#ff4444]">
            {error}
          </div>
        )}

        {/* Кнопка генерации */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          className="w-full px-6 py-3 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg font-medium hover:from-[#0055ff] hover:to-[#7000bb] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Генерация курса...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Сгенерировать курс
            </>
          )}
        </button>
      </div>
    </div>
  );
}

