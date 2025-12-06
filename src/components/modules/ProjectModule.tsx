import { type CourseModule } from '../../services/courses';
import { FolderKanban, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ProjectModuleProps {
  module: CourseModule;
}

export function ProjectModule({ module }: ProjectModuleProps) {
  const isGenerating = module.contentGenerating || (!module.projectDescription || module.projectDescription.length < 50);

  return (
    <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <FolderKanban className="w-6 h-6 text-[#00f0ff]" />
        <h2 className="text-2xl font-bold gradient-text">{module.title}</h2>
      </div>

      {isGenerating ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00f0ff] mb-4" />
          <p className="text-[#a0a0b0] text-sm">Генерация описания проекта...</p>
          <p className="text-[#808080] text-xs mt-2">Это может занять несколько секунд</p>
        </div>
      ) : module.projectDescription ? (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#e0e0e8] mb-3">Описание проекта</h3>
            <div className="p-4 bg-[#1e1e2e] rounded-lg border border-[#2a2a3a]">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-[#a0a0b0] mb-3 leading-relaxed">{children}</p>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-[#0a0a0f] text-[#00f0ff] rounded text-sm">{children}</code>
                    ) : (
                      <code className="block p-4 bg-[#0a0a0f] rounded-lg text-[#e0e0e8] overflow-x-auto">{children}</code>
                    );
                  },
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-[#a0a0b0]">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-[#a0a0b0]">{children}</ol>,
                }}
              >
                {module.projectDescription}
              </ReactMarkdown>
            </div>
          </div>

          {module.projectRequirements && module.projectRequirements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-[#e0e0e8] mb-3">Требования</h3>
              <div className="p-4 bg-[#1e1e2e] rounded-lg border border-[#2a2a3a]">
                <ul className="space-y-2">
                  {module.projectRequirements.map((requirement, index) => (
                    <li key={index} className="flex items-start gap-2 text-[#a0a0b0]">
                      <span className="text-[#00f0ff] flex-shrink-0 mt-1">•</span>
                      <span>{requirement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-[#a0a0b0]">
          <p>Описание проекта пока не загружено</p>
        </div>
      )}
    </div>
  );
}

