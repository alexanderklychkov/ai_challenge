import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudyPlan, updateStudyPlanProgress, deleteStudyPlan, type StudyPlan } from '../services/learning';
import { CheckCircle2, Circle, Loader2, BookOpen, Clock, Trash2 } from 'lucide-react';

interface StudyPlanViewerProps {
  planId: string;
}

export function StudyPlanViewer({ planId }: StudyPlanViewerProps) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadPlan();
  }, [planId]);

  const loadPlan = async () => {
    setIsLoading(true);
    try {
      const loadedPlan = await getStudyPlan(planId);
      if (loadedPlan) {
        setPlan(loadedPlan);
      }
    } catch (error) {
      console.error('Ошибка при загрузке плана:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStep = async (stepIndex: number) => {
    if (!plan || isUpdating) return;

    const step = plan.steps[stepIndex];
    const newCompleted = !step.completed;

    setIsUpdating(true);
    try {
      const updatedPlan = await updateStudyPlanProgress(planId, stepIndex, newCompleted);
      if (updatedPlan) {
        setPlan(updatedPlan);
      }
    } catch (error) {
      console.error('Ошибка при обновлении прогресса:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Вы уверены, что хотите удалить этот план изучения?')) {
      const success = await deleteStudyPlan(planId);
      if (success) {
        navigate('/learning');
      } else {
        alert('Не удалось удалить план изучения');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#00f0ff]" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-4 text-center text-[#a0a0b0]">
        План изучения не найден
      </div>
    );
  }

  return (
    <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#00f0ff]" />
            <h3 className="text-2xl font-bold gradient-text">{plan.title}</h3>
          </div>
          <button
            onClick={handleDelete}
            className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all cursor-pointer"
            title="Удалить план изучения"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#a0a0b0]">
          <span>Тема: {plan.topic}</span>
          <span>•</span>
          <span>Длительность: {plan.duration} дней</span>
        </div>
      </div>

      {/* Прогресс */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#e0e0e8]">Прогресс</span>
          <span className="text-sm font-bold text-[#00f0ff]">{plan.progress}%</span>
        </div>
        <div className="h-3 bg-[#2a2a3a] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00f0ff] to-[#b026ff] transition-all duration-300"
            style={{ width: `${plan.progress}%` }}
          />
        </div>
      </div>

      {/* Шаги плана */}
      <div className="space-y-4">
        {plan.steps.map((step, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border transition-all ${
              step.completed
                ? 'bg-[#00ff88]/10 border-[#00ff88]/50'
                : 'bg-[#1e1e2e]/50 border-[#2a2a3a] hover:border-[#00f0ff]/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => handleToggleStep(index)}
                disabled={isUpdating}
                className="flex-shrink-0 mt-1 cursor-pointer"
              >
                {step.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-[#00ff88]" />
                ) : (
                  <Circle className="w-6 h-6 text-[#a0a0b0] hover:text-[#00f0ff] transition-colors" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#00f0ff]">
                    День {step.day}
                  </span>
                  {step.estimatedTime && (
                    <div className="flex items-center gap-1 text-xs text-[#a0a0b0]">
                      <Clock className="w-3 h-3" />
                      {step.estimatedTime}
                    </div>
                  )}
                </div>
                <h4 className={`text-lg font-semibold mb-2 ${
                  step.completed ? 'text-[#00ff88]' : 'text-[#e0e0e8]'
                }`}>
                  {step.title}
                </h4>
                <p className="text-[#a0a0b0] mb-3">{step.description}</p>
                {step.tasks && step.tasks.length > 0 && (
                  <ul className="space-y-1 list-none">
                    {step.tasks.map((task, taskIndex) => (
                      <li key={taskIndex} className="text-sm text-[#a0a0b0] flex items-center gap-2">
                        <span className="text-[#00f0ff] flex-shrink-0">•</span>
                        <span className="flex-1">{task}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {plan.completed && (
        <div className="mt-6 p-4 bg-gradient-to-r from-[#00ff88]/20 to-[#00f0ff]/20 border border-[#00ff88]/50 rounded-lg text-center">
          <CheckCircle2 className="w-8 h-8 text-[#00ff88] mx-auto mb-2" />
          <p className="text-lg font-semibold text-[#00ff88]">
            Поздравляем! План изучения завершен!
          </p>
        </div>
      )}
    </div>
  );
}

