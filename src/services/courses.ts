import { getAuthHeader } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL?.replace(/\/api\/.*$/, '') || 'http://localhost:3001';

export type ModuleType = 'theory' | 'test' | 'practice' | 'project';

export interface CourseModule {
  id: string;
  type: ModuleType;
  title: string;
  order: number;
  // Для теории
  content?: string;
  // Для теста
  testId?: string;
  // Для практики
  practiceTask?: string;
  practiceSolution?: string;
  // Для проекта
  projectDescription?: string;
  projectRequirements?: string[];
  // Общие
  estimatedTime?: string;
  completed?: boolean;
  contentGenerating?: boolean; // Флаг генерации контента
  contentWaiting?: boolean; // Флаг ожидания генерации (модуль ждет своей очереди)
}

export interface Course {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // в днях
  modules: CourseModule[];
  progress: number;
  completed: boolean;
  createdAt: string;
  chatId?: string;
  todoistProjectId?: string;
}

export interface CourseGenerationParams {
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration?: number;
  description?: string;
  generateTasks?: boolean;
  generateContent?: boolean; // Генерировать ли контент для модулей через AI
}

/**
 * Загружает список всех курсов
 */
export async function loadCourses(topic?: string): Promise<Course[]> {
  try {
    const url = topic 
      ? `${API_BASE_URL}/api/courses?topic=${encodeURIComponent(topic)}`
      : `${API_BASE_URL}/api/courses`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const courses = await response.json();
    return courses.map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке курсов:', error);
    return [];
  }
}

/**
 * Загружает курс по ID
 */
export async function getCourse(courseId: string): Promise<Course | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error: ${response.status}`);
    }

    const course = await response.json();
    return {
      ...course,
      createdAt: new Date(course.createdAt),
    };
  } catch (error) {
    console.error('Ошибка при загрузке курса:', error);
    return null;
  }
}

/**
 * Генерирует новый курс
 */
export async function generateCourse(params: CourseGenerationParams): Promise<Course | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const course = await response.json();
    return {
      ...course,
      createdAt: new Date(course.createdAt),
    };
  } catch (error) {
    console.error('Ошибка при генерации курса:', error);
    return null;
  }
}

/**
 * Обновляет прогресс модуля курса
 */
export async function updateCourseModuleProgress(
  courseId: string,
  moduleId: string,
  completed: boolean
): Promise<Course | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/modules/${moduleId}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const course = await response.json();
    return {
      ...course,
      createdAt: new Date(course.createdAt),
    };
  } catch (error) {
    console.error('Ошибка при обновлении прогресса:', error);
    return null;
  }
}

/**
 * Генерирует задачи в Todoist для курса
 */
export async function generateCourseTasks(courseId: string): Promise<{ success: boolean; projectId?: string; tasksCount?: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/generate-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка при генерации задач:', error);
    return { success: false };
  }
}

/**
 * Удаляет курс
 */
export async function deleteCourse(courseId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return false;
      }
      throw new Error(`HTTP error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка при удалении курса:', error);
    return false;
  }
}

