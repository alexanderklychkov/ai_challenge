import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTest, submitTestAnswers, deleteTest, type Test, type QuestionResult } from '../services/learning';
import { CheckCircle2, XCircle, Loader2, BookOpen, Trash2 } from 'lucide-react';

interface TestViewerProps {
  testId: string;
}

export function TestViewer({ testId }: TestViewerProps) {
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<QuestionResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    loadTest();
  }, [testId]);

  const loadTest = async () => {
    setIsLoading(true);
    try {
      const loadedTest = await getTest(testId);
      if (loadedTest) {
        setTest(loadedTest);
        setAnswers(new Array(loadedTest.questions.length).fill(''));
      }
    } catch (error) {
      console.error('Ошибка при загрузке теста:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (!test) return;
    
    // Проверяем, что все вопросы отвечены
    const unanswered = answers.findIndex(a => !a && a !== 'false');
    if (unanswered !== -1) {
      alert('Пожалуйста, ответьте на все вопросы');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitTestAnswers(testId, answers);
      if (result) {
        setResults(result.results);
        setScore(result.score);
      }
    } catch (error) {
      console.error('Ошибка при отправке ответов:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#00f0ff]" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="p-4 text-center text-[#a0a0b0]">
        Тест не найден
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirm('Вы уверены, что хотите удалить этот тест?')) {
      const success = await deleteTest(testId);
      if (success) {
        navigate('/learning');
      } else {
        alert('Не удалось удалить тест');
      }
    }
  };

  if (results && score !== null) {
    // Показываем результаты
    return (
      <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
        <div className="mb-6 text-center relative">
          <button
            onClick={handleDelete}
            className="absolute top-0 right-0 p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all cursor-pointer"
            title="Удалить тест"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <h3 className="text-2xl font-bold gradient-text mb-2">{test.title}</h3>
          <div className={`text-4xl font-bold mb-2 ${
            score >= 80 ? 'text-[#00ff88]' : score >= 60 ? 'text-[#00f0ff]' : 'text-[#ff4444]'
          }`}>
            {score}%
          </div>
          <p className="text-[#a0a0b0]">
            Правильных ответов: {results.filter(r => r.isCorrect).length} из {test.questions.length}
          </p>
        </div>

        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                result.isCorrect
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/50'
                  : result.isCorrect === false
                  ? 'bg-[#ff4444]/10 border-[#ff4444]/50'
                  : 'bg-[#2a2a3a]/50 border-[#2a2a3a]'
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                {result.isCorrect === true && (
                  <CheckCircle2 className="w-5 h-5 text-[#00ff88] flex-shrink-0 mt-0.5" />
                )}
                {result.isCorrect === false && (
                  <XCircle className="w-5 h-5 text-[#ff4444] flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#e0e0e8] mb-2">{result.question}</p>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-[#a0a0b0]">Ваш ответ: </span>
                      <span className={result.isCorrect ? 'text-[#00ff88]' : 'text-[#ff4444]'}>
                        {result.userAnswer}
                      </span>
                    </div>
                    {result.isCorrect === false && (
                      <div>
                        <span className="text-[#a0a0b0]">Правильный ответ: </span>
                        <span className="text-[#00ff88]">{result.correctAnswer}</span>
                      </div>
                    )}
                    {result.explanation && (
                      <div className="mt-2 p-2 bg-[#1e1e2e]/50 rounded text-[#a0a0b0]">
                        {result.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Показываем тест для прохождения
  const currentQuestion = test.questions[currentQuestionIndex];

  return (
    <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#00f0ff]" />
          <h3 className="text-xl font-bold gradient-text">{test.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-[#a0a0b0]">
            Вопрос {currentQuestionIndex + 1} из {test.questions.length}
          </div>
          <button
            onClick={handleDelete}
            className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all cursor-pointer"
            title="Удалить тест"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="h-2 bg-[#2a2a3a] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00f0ff] to-[#b026ff] transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / test.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-lg font-semibold text-[#e0e0e8] mb-4">
          {currentQuestion.question}
        </h4>

        {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
          <div className="space-y-2">
            {currentQuestion.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  answers[currentQuestionIndex] === optionIndex.toString()
                    ? 'bg-[#00f0ff]/20 border-[#00f0ff]'
                    : 'bg-[#1e1e2e]/50 border-[#2a2a3a] hover:border-[#00f0ff]/50'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestionIndex}`}
                  value={optionIndex}
                  checked={answers[currentQuestionIndex] === optionIndex.toString()}
                  onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                  className="mr-3"
                />
                <span className="text-[#e0e0e8]">{option}</span>
              </label>
            ))}
          </div>
        )}

        {currentQuestion.type === 'true-false' && (
          <div className="space-y-2">
            {['true', 'false'].map((value) => (
              <label
                key={value}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  answers[currentQuestionIndex] === value
                    ? 'bg-[#00f0ff]/20 border-[#00f0ff]'
                    : 'bg-[#1e1e2e]/50 border-[#2a2a3a] hover:border-[#00f0ff]/50'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestionIndex}`}
                  value={value}
                  checked={answers[currentQuestionIndex] === value}
                  onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                  className="mr-3"
                />
                <span className="text-[#e0e0e8]">{value === 'true' ? 'Правда' : 'Ложь'}</span>
              </label>
            ))}
          </div>
        )}

        {currentQuestion.type === 'open-ended' && (
          <textarea
            value={answers[currentQuestionIndex] || ''}
            onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
            placeholder="Введите ваш ответ..."
            className="w-full p-3 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] focus:outline-none focus:border-[#00f0ff] resize-none"
            rows={4}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
          disabled={currentQuestionIndex === 0}
          className="px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] hover:bg-[#2a2a3a] hover:border-[#00f0ff]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          Назад
        </button>

        {currentQuestionIndex < test.questions.length - 1 ? (
          <button
            onClick={() => setCurrentQuestionIndex(Math.min(test.questions.length - 1, currentQuestionIndex + 1))}
            className="px-4 py-2 bg-gradient-to-r from-[#00f0ff] to-[#b026ff] text-white rounded-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all cursor-pointer"
          >
            Далее
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-gradient-to-r from-[#00ff88] to-[#00f0ff] text-white rounded-lg hover:shadow-[0_0_20px_rgba(0,255,136,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Проверка...
              </>
            ) : (
              'Завершить тест'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

