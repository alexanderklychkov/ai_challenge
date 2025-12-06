import { useState, useEffect } from 'react';
import { type CourseModule } from '../../services/courses';
import { getTest, type Test } from '../../services/learning';
import { CheckSquare, Loader2 } from 'lucide-react';
import { TestViewer } from '../TestViewer';

interface TestModuleProps {
  module: CourseModule;
}

export function TestModule({ module }: TestModuleProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (module.testId) {
      loadTest();
    } else {
      setIsLoading(false);
    }
  }, [module.testId]);

  const loadTest = async () => {
    if (!module.testId) return;
    
    setIsLoading(true);
    try {
      const loadedTest = await getTest(module.testId);
      setTest(loadedTest);
    } catch (error) {
      console.error('Ошибка при загрузке теста:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#00f0ff]" />
        </div>
      </div>
    );
  }

  if (!module.testId) {
    return (
      <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <CheckSquare className="w-6 h-6 text-[#00f0ff]" />
          <h2 className="text-2xl font-bold gradient-text">{module.title}</h2>
        </div>
        <div className="text-center py-12 text-[#a0a0b0]">
          <p>Тест не привязан к этому модулю</p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <CheckSquare className="w-6 h-6 text-[#00f0ff]" />
          <h2 className="text-2xl font-bold gradient-text">{module.title}</h2>
        </div>
        <div className="text-center py-12 text-[#a0a0b0]">
          <p>Тест не найден</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#2a2a3a] rounded-lg bg-[#151520]/50 backdrop-blur-sm">
      <div className="p-6 border-b border-[#2a2a3a]">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-[#00f0ff]" />
          <h2 className="text-2xl font-bold gradient-text">{module.title}</h2>
        </div>
      </div>
      <div className="p-6">
        <TestViewer testId={module.testId} />
      </div>
    </div>
  );
}

