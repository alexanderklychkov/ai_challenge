import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTests, loadFlashcardSets, loadStudyPlans, deleteTest, deleteFlashcardSet, deleteStudyPlan, type Test, type FlashcardSet, type StudyPlan } from '../services/learning';
import { TestViewer } from './TestViewer';
import { FlashcardsViewer } from './FlashcardsViewer';
import { StudyPlanViewer } from './StudyPlanViewer';
import { BookOpen, FileText, CreditCard, Calendar, Loader2, ChevronRight, Trash2 } from 'lucide-react';

type ListTab = 'tests' | 'flashcards' | 'plans';

export function LearningPage() {
  const { testId, setId, planId } = useParams<{ testId?: string; setId?: string; planId?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ListTab>('tests');
  
  const [tests, setTests] = useState<Test[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  // Определяем активную вкладку на основе URL параметров
  useEffect(() => {
    if (testId) {
      setActiveTab('tests');
    } else if (setId) {
      setActiveTab('flashcards');
    } else if (planId) {
      setActiveTab('plans');
    }
  }, [testId, setId, planId]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [loadedTests, loadedSets, loadedPlans] = await Promise.all([
        loadTests(),
        loadFlashcardSets(),
        loadStudyPlans(),
      ]);
      setTests(loadedTests);
      setFlashcardSets(loadedSets);
      setStudyPlans(loadedPlans);
    } catch (error) {
      console.error('Ошибка при загрузке данных обучения:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSelect = (testId: string) => {
    navigate(`/learning/test/${testId}`);
  };

  const handleSetSelect = (setId: string) => {
    navigate(`/learning/flashcards/${setId}`);
  };

  const handlePlanSelect = (planId: string) => {
    navigate(`/learning/plan/${planId}`);
  };

  const handleBack = () => {
    navigate('/learning');
  };

  const handleDeleteTest = async (testIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить этот тест?')) {
      const success = await deleteTest(testIdToDelete);
      if (success) {
        await loadAllData();
        // Если удалили текущий тест, возвращаемся к списку
        if (testIdToDelete === testId) {
          navigate('/learning');
        }
      } else {
        alert('Не удалось удалить тест');
      }
    }
  };

  const handleDeleteSet = async (setIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить этот набор карточек?')) {
      const success = await deleteFlashcardSet(setIdToDelete);
      if (success) {
        await loadAllData();
        // Если удалили текущий набор, возвращаемся к списку
        if (setIdToDelete === setId) {
          navigate('/learning');
        }
      } else {
        alert('Не удалось удалить набор карточек');
      }
    }
  };

  const handleDeletePlan = async (planIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить этот план изучения?')) {
      const success = await deleteStudyPlan(planIdToDelete);
      if (success) {
        await loadAllData();
        // Если удалили текущий план, возвращаемся к списку
        if (planIdToDelete === planId) {
          navigate('/learning');
        }
      } else {
        alert('Не удалось удалить план изучения');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#00f0ff]" />
      </div>
    );
  }

  // Показываем конкретный элемент на основе URL параметров
  if (testId) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0f]/50 backdrop-blur-sm">
        {/* Заголовок */}
        <header className="h-16 border-b border-[#2a2a3a] px-6 bg-[#151520]/80 backdrop-blur-xl relative flex items-center">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
          <div className="flex items-center gap-3 relative z-10">
            <BookOpen className="w-7 h-7 text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
            <h1 className="text-2xl font-bold gradient-text">Обучение</h1>
          </div>
        </header>

        {/* Вкладки с кнопкой назад */}
        <div className="border-b border-[#2a2a3a] bg-[#151520]/50">
          <div className="flex items-end gap-1 px-6">
            <button
              onClick={handleBack}
              className="text-[#00f0ff] hover:text-[#b026ff] transition-colors flex items-center gap-2 px-4 py-3 text-sm font-medium cursor-pointer border-b-2 border-transparent hover:border-[#00f0ff]/50"
            >
              ← Назад к списку
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <TestViewer testId={testId} />
        </div>
      </div>
    );
  }

  if (setId) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0f]/50 backdrop-blur-sm">
        {/* Заголовок */}
        <header className="h-16 border-b border-[#2a2a3a] px-6 bg-[#151520]/80 backdrop-blur-xl relative flex items-center">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
          <div className="flex items-center gap-3 relative z-10">
            <BookOpen className="w-7 h-7 text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
            <h1 className="text-2xl font-bold gradient-text">Обучение</h1>
          </div>
        </header>

        {/* Вкладки с кнопкой назад */}
        <div className="border-b border-[#2a2a3a] bg-[#151520]/50">
          <div className="flex items-end gap-1 px-6">
            <button
              onClick={handleBack}
              className="text-[#00f0ff] hover:text-[#b026ff] transition-colors flex items-center gap-2 px-4 py-3 text-sm font-medium cursor-pointer border-b-2 border-transparent hover:border-[#00f0ff]/50"
            >
              ← Назад к списку
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <FlashcardsViewer setId={setId} />
        </div>
      </div>
    );
  }

  if (planId) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0f]/50 backdrop-blur-sm">
        {/* Заголовок */}
        <header className="h-16 border-b border-[#2a2a3a] px-6 bg-[#151520]/80 backdrop-blur-xl relative flex items-center">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
          <div className="flex items-center gap-3 relative z-10">
            <BookOpen className="w-7 h-7 text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
            <h1 className="text-2xl font-bold gradient-text">Обучение</h1>
          </div>
        </header>

        {/* Вкладки с кнопкой назад */}
        <div className="border-b border-[#2a2a3a] bg-[#151520]/50">
          <div className="flex items-end gap-1 px-6">
            <button
              onClick={handleBack}
              className="text-[#00f0ff] hover:text-[#b026ff] transition-colors flex items-center gap-2 px-4 py-3 text-sm font-medium cursor-pointer border-b-2 border-transparent hover:border-[#00f0ff]/50"
            >
              ← Назад к списку
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <StudyPlanViewer planId={planId} />
        </div>
      </div>
    );
  }

  // Показываем список
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]/50 backdrop-blur-sm">
      {/* Заголовок */}
      <header className="h-16 border-b border-[#2a2a3a] px-6 bg-[#151520]/80 backdrop-blur-xl relative flex items-center">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
        <div className="flex items-center gap-3 relative z-10">
          <BookOpen className="w-7 h-7 text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
          <h1 className="text-2xl font-bold gradient-text">Обучение</h1>
        </div>
      </header>

      {/* Вкладки */}
      <div className="border-b border-[#2a2a3a] bg-[#151520]/50">
        <div className="flex gap-1 px-6">
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === 'tests'
                ? 'text-[#00f0ff] border-[#00f0ff]'
                : 'text-[#a0a0b0] border-transparent hover:text-[#e0e0e8]'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Тесты ({tests.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === 'flashcards'
                ? 'text-[#00f0ff] border-[#00f0ff]'
                : 'text-[#a0a0b0] border-transparent hover:text-[#e0e0e8]'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Карточки ({flashcardSets.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === 'plans'
                ? 'text-[#00f0ff] border-[#00f0ff]'
                : 'text-[#a0a0b0] border-transparent hover:text-[#e0e0e8]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Планы ({studyPlans.length})
            </div>
          </button>
        </div>
      </div>

      {/* Содержимое */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'tests' && (
          <div className="space-y-3">
            {tests.length === 0 ? (
              <div className="text-center py-12 text-[#a0a0b0]">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Нет созданных тестов</p>
                <p className="text-sm mt-2">Создайте тест через чат с AI</p>
              </div>
            ) : (
              tests.map((test) => (
                <div
                  key={test.id}
                  className="p-4 bg-[#1e1e2e]/80 border border-[#2a2a3a] rounded-lg hover:border-[#00f0ff]/50 hover:bg-[#2a2a3a]/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleTestSelect(test.id)}
                    >
                      <h3 className="text-lg font-semibold text-[#e0e0e8] mb-2 group-hover:text-[#00f0ff] transition-colors">
                        {test.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-[#a0a0b0]">
                        <span>Тема: {test.topic}</span>
                        <span>•</span>
                        <span>Вопросов: {test.questionsCount || 0}</span>
                        <span>•</span>
                        <span className={`${
                          test.difficulty === 'easy' ? 'text-[#00ff88]' :
                          test.difficulty === 'medium' ? 'text-[#00f0ff]' :
                          'text-[#ff4444]'
                        }`}>
                          {test.difficulty === 'easy' ? 'Легкий' :
                           test.difficulty === 'medium' ? 'Средний' :
                           'Сложный'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteTest(test.id, e)}
                        className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Удалить тест"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-[#a0a0b0] group-hover:text-[#00f0ff] transition-colors cursor-pointer" onClick={() => handleTestSelect(test.id)} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="space-y-3">
            {flashcardSets.length === 0 ? (
              <div className="text-center py-12 text-[#a0a0b0]">
                <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Нет наборов карточек</p>
                <p className="text-sm mt-2">Создайте карточки через чат с AI</p>
              </div>
            ) : (
              flashcardSets.map((set) => (
                <div
                  key={set.setId}
                  className="p-4 bg-[#1e1e2e]/80 border border-[#2a2a3a] rounded-lg hover:border-[#00f0ff]/50 hover:bg-[#2a2a3a]/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleSetSelect(set.setId)}
                    >
                      <h3 className="text-lg font-semibold text-[#e0e0e8] mb-2 group-hover:text-[#00f0ff] transition-colors">
                        {set.topic}
                      </h3>
                      <div className="text-sm text-[#a0a0b0]">
                        Карточек: {set.cards.length}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteSet(set.setId, e)}
                        className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Удалить набор карточек"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-[#a0a0b0] group-hover:text-[#00f0ff] transition-colors cursor-pointer" onClick={() => handleSetSelect(set.setId)} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="space-y-3">
            {studyPlans.length === 0 ? (
              <div className="text-center py-12 text-[#a0a0b0]">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Нет планов изучения</p>
                <p className="text-sm mt-2">Создайте план через чат с AI</p>
              </div>
            ) : (
              studyPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-4 bg-[#1e1e2e]/80 border border-[#2a2a3a] rounded-lg hover:border-[#00f0ff]/50 hover:bg-[#2a2a3a]/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handlePlanSelect(plan.id)}
                    >
                      <h3 className="text-lg font-semibold text-[#e0e0e8] mb-2 group-hover:text-[#00f0ff] transition-colors">
                        {plan.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-[#a0a0b0] mb-2">
                        <span>Тема: {plan.topic}</span>
                        <span>•</span>
                        <span>Длительность: {plan.duration} дней</span>
                        <span>•</span>
                        <span>Шагов: {plan.stepsCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#2a2a3a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#00f0ff] to-[#b026ff] transition-all"
                            style={{ width: `${plan.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#00f0ff] font-medium">{plan.progress}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeletePlan(plan.id, e)}
                        className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Удалить план изучения"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-[#a0a0b0] group-hover:text-[#00f0ff] transition-colors cursor-pointer" onClick={() => handlePlanSelect(plan.id)} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

