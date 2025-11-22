const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL?.replace(/\/api\/.*$/, '') || 'http://localhost:3001';

export interface Test {
  id: string;
  title: string;
  material: string;
  questions: Question[];
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  attempts?: TestAttempt[];
  createdAt: string;
  chatId?: string;
}

export interface Question {
  question: string;
  type: 'multiple-choice' | 'true-false' | 'open-ended';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface TestAttempt {
  answers: string[];
  results: QuestionResult[];
  score: number;
  completedAt: string;
}

export interface QuestionResult {
  questionIndex: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  explanation?: string;
}

export interface Flashcard {
  id: string;
  setId: string;
  topic: string;
  question: string;
  answer: string;
  hint?: string;
  createdAt: string;
}

export interface FlashcardSet {
  setId: string;
  topic: string;
  cards: Flashcard[];
  chatId?: string;
}

export interface StudyPlan {
  id: string;
  title: string;
  material: string;
  duration: number;
  steps: StudyStep[];
  topic: string;
  completed: boolean;
  progress: number;
  createdAt: string;
  chatId?: string;
}

export interface StudyStep {
  day: number;
  title: string;
  description: string;
  tasks?: string[];
  estimatedTime?: string;
  completed?: boolean;
}

/**
 * Загружает список всех тестов
 */
export async function loadTests(topic?: string): Promise<Test[]> {
  try {
    const url = topic 
      ? `${API_BASE_URL}/api/learning/tests?topic=${encodeURIComponent(topic)}`
      : `${API_BASE_URL}/api/learning/tests`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка при загрузке тестов:', error);
    return [];
  }
}

/**
 * Загружает тест по ID
 */
export async function getTest(testId: string): Promise<Test | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/tests/${testId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка при загрузке теста:', error);
    return null;
  }
}

/**
 * Отправляет ответы на тест для проверки
 */
export async function submitTestAnswers(testId: string, answers: string[]): Promise<{
  score: number;
  correctCount: number;
  totalQuestions: number;
  results: QuestionResult[];
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/tests/${testId}/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка при отправке ответов:', error);
    return null;
  }
}

/**
 * Загружает наборы флеш-карточек
 */
export async function loadFlashcardSets(topic?: string): Promise<FlashcardSet[]> {
  try {
    const url = topic 
      ? `${API_BASE_URL}/api/learning/flashcards?topic=${encodeURIComponent(topic)}`
      : `${API_BASE_URL}/api/learning/flashcards`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка при загрузке флеш-карточек:', error);
    return [];
  }
}

/**
 * Загружает список планов изучения
 */
export async function loadStudyPlans(topic?: string): Promise<StudyPlan[]> {
  try {
    const url = topic 
      ? `${API_BASE_URL}/api/learning/study-plans?topic=${encodeURIComponent(topic)}`
      : `${API_BASE_URL}/api/learning/study-plans`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const plans = await response.json();
    return plans.map((p: any) => ({
      ...p,
      createdAt: new Date(p.createdAt),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке планов изучения:', error);
    return [];
  }
}

/**
 * Загружает план изучения по ID
 */
export async function getStudyPlan(planId: string): Promise<StudyPlan | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/study-plans/${planId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error: ${response.status}`);
    }

    const plan = await response.json();
    return {
      ...plan,
      createdAt: new Date(plan.createdAt),
    };
  } catch (error) {
    console.error('Ошибка при загрузке плана изучения:', error);
    return null;
  }
}

/**
 * Обновляет прогресс плана изучения
 */
export async function updateStudyPlanProgress(
  planId: string,
  stepIndex: number,
  completed: boolean
): Promise<StudyPlan | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/study-plans/${planId}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stepIndex, completed }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const plan = await response.json();
    return {
      ...plan,
      createdAt: new Date(plan.createdAt),
    };
  } catch (error) {
    console.error('Ошибка при обновлении прогресса:', error);
    return null;
  }
}

/**
 * Удаляет тест
 */
export async function deleteTest(testId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/tests/${testId}`, {
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
    console.error('Ошибка при удалении теста:', error);
    return false;
  }
}

/**
 * Удаляет набор флеш-карточек
 */
export async function deleteFlashcardSet(setId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/flashcards/${setId}`, {
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
    console.error('Ошибка при удалении набора карточек:', error);
    return false;
  }
}

/**
 * Удаляет план изучения
 */
export async function deleteStudyPlan(planId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/learning/study-plans/${planId}`, {
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
    console.error('Ошибка при удалении плана изучения:', error);
    return false;
  }
}

