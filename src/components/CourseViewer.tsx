import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCourse, updateCourseModuleProgress, deleteCourse, generateCourseTasks, type Course, type CourseModule } from '../services/courses';
import { Loader2, BookOpen, CheckCircle2, Circle, Clock, Trash2, CheckSquare, FileText, Code, FolderKanban, Sparkles } from 'lucide-react';
import { TheoryModule } from './modules/TheoryModule';
import { TestModule } from './modules/TestModule';
import { PracticeModule } from './modules/PracticeModule';
import { ProjectModule } from './modules/ProjectModule';

interface CourseViewerProps {
  courseId: string;
}

export function CourseViewer({ courseId }: CourseViewerProps) {
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  useEffect(() => {
    loadCourse(true); // Первая загрузка с показом loading
  }, [courseId]);

  // Периодически обновляем курс, чтобы видеть прогресс генерации контента
  useEffect(() => {
    if (!course) return;
    
    const hasGeneratingModules = course.modules?.some(m => m.contentGenerating || m.contentWaiting);
    if (!hasGeneratingModules) return;

    const interval = setInterval(() => {
      loadCourse(false); // Периодическое обновление без loading
    }, 3000); // Обновляем каждые 3 секунды
    
    return () => clearInterval(interval);
  }, [course, courseId]);

  useEffect(() => {
    if (course && course.modules && course.modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(course.modules[0].id);
    }
  }, [course]);

  const loadCourse = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const loadedCourse = await getCourse(courseId);
      if (loadedCourse) {
        setCourse(loadedCourse);
        if (loadedCourse.modules && loadedCourse.modules.length > 0 && !selectedModuleId) {
          setSelectedModuleId(loadedCourse.modules[0].id);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке курса:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleToggleModule = async (moduleId: string) => {
    if (!course || isUpdating) return;

    const module = course.modules?.find(m => m.id === moduleId);
    if (!module) return;

    const newCompleted = !module.completed;

    setIsUpdating(true);
    try {
      const updatedCourse = await updateCourseModuleProgress(courseId, moduleId, newCompleted);
      if (updatedCourse) {
        setCourse(updatedCourse);
      }
    } catch (error) {
      console.error('Ошибка при обновлении прогресса:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!course || isGeneratingTasks) return;

    setIsGeneratingTasks(true);
    try {
      const result = await generateCourseTasks(courseId);
      if (result.success) {
        await loadCourse(); // Перезагружаем курс для получения обновленного todoistProjectId
        alert(`Задачи успешно созданы в Todoist! Создано задач: ${result.tasksCount}`);
      } else {
        alert('Не удалось создать задачи в Todoist');
      }
    } catch (error) {
      console.error('Ошибка при генерации задач:', error);
      alert('Произошла ошибка при создании задач');
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Вы уверены, что хотите удалить этот курс?')) {
      const success = await deleteCourse(courseId);
      if (success) {
        navigate('/learning');
      } else {
        alert('Не удалось удалить курс');
      }
    }
  };

  const getModuleIcon = (type: CourseModule['type']) => {
    switch (type) {
      case 'theory':
        return <FileText className="w-4 h-4" />;
      case 'test':
        return <CheckSquare className="w-4 h-4" />;
      case 'practice':
        return <Code className="w-4 h-4" />;
      case 'project':
        return <FolderKanban className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#00f0ff]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-4 text-center text-[#a0a0b0]">
        Курс не найден
      </div>
    );
  }

  const selectedModule = course.modules?.find(m => m.id === selectedModuleId);

  return (
    <div className="flex h-full bg-[#0a0a0f]/50 backdrop-blur-sm">
      {/* Навигация слева */}
      <aside className="w-80 border-r border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl flex flex-col">
        {/* Заголовок курса */}
        <div className="p-4 border-b border-[#2a2a3a]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#e0e0e8] mb-1">{course.title}</h2>
              <p className="text-xs text-[#a0a0b0]">{course.description}</p>
            </div>
            <button
              onClick={handleDelete}
              className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all cursor-pointer"
              title="Удалить курс"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Прогресс */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[#e0e0e8]">Прогресс</span>
              <span className="text-xs font-bold text-[#00f0ff]">{course.progress}%</span>
            </div>
            <div className="h-2 bg-[#2a2a3a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00f0ff] to-[#b026ff] transition-all"
                style={{ width: `${course.progress}%` }}
              />
            </div>
          </div>

          {/* Информация о курсе */}
          <div className="mt-3 flex items-center gap-4 text-xs text-[#a0a0b0]">
            <span>{course.difficulty === 'beginner' ? 'Начинающий' : course.difficulty === 'intermediate' ? 'Средний' : 'Продвинутый'}</span>
            <span>•</span>
            <span>{course.duration} дней</span>
            <span>•</span>
            <span>{course.modules?.length || 0} модулей</span>
          </div>

          {/* Кнопка генерации задач */}
          {!course.todoistProjectId && (
            <button
              onClick={handleGenerateTasks}
              disabled={isGeneratingTasks}
              className="mt-3 w-full px-3 py-2 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg text-xs font-medium hover:from-[#0055ff] hover:to-[#7000bb] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGeneratingTasks ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  Создать задачи в Todoist
                </>
              )}
            </button>
          )}
        </div>

        {/* Список модулей */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {(course.modules || []).map((module) => {
              const isSelected = module.id === selectedModuleId;
              const isCompleted = module.completed;
              const isGenerating = module.contentGenerating;
              const isWaiting = module.contentWaiting;

              return (
                <div
                  key={module.id}
                  onClick={() => setSelectedModuleId(module.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all group ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#0066ff]/20 to-[#8000cc]/20 border-l-2 border-[#00f0ff]'
                      : 'bg-[#1e1e2e]/50 border-l-2 border-transparent hover:bg-[#2a2a3a]/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleModule(module.id);
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#a0a0b0] hover:text-[#00f0ff] transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`flex-shrink-0 ${isSelected ? 'text-[#00f0ff]' : 'text-[#a0a0b0]'}`}>
                          {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#00f0ff]" />
                          ) : (
                            getModuleIcon(module.type)
                          )}
                        </div>
                        <span className={`text-sm font-medium truncate flex-1 ${
                          isSelected ? 'text-[#00f0ff]' : isCompleted ? 'text-[#00ff88]' : 'text-[#e0e0e8]'
                        }`}>
                          {module.title}
                        </span>
                        {isGenerating && (
                          <span className="text-xs text-[#00f0ff] font-medium flex-shrink-0">Генерация...</span>
                        )}
                        {isWaiting && !isGenerating && (
                          <span className="text-xs text-[#a0a0b0] font-medium flex-shrink-0">Ожидание...</span>
                        )}
                      </div>
                      {module.estimatedTime && (
                        <div className="flex items-center gap-1 text-xs text-[#808080]">
                          <Clock className="w-3 h-3" />
                          {module.estimatedTime}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Основной контент */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedModule ? (
          <div className="max-w-4xl mx-auto">
            {selectedModule.type === 'theory' && (
              <TheoryModule module={selectedModule} />
            )}
            {selectedModule.type === 'test' && (
              <TestModule module={selectedModule} />
            )}
            {selectedModule.type === 'practice' && (
              <PracticeModule module={selectedModule} />
            )}
            {selectedModule.type === 'project' && (
              <ProjectModule module={selectedModule} />
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-[#a0a0b0]">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Выберите модуль для просмотра</p>
          </div>
        )}
      </div>
    </div>
  );
}

