import { type CourseModule } from '../../services/courses';
import { FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';

interface TheoryModuleProps {
  module: CourseModule;
}

interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };
  
  return (
    <div className="my-4 relative group">
      <button
        onClick={handleCopy}
        className={`absolute top-2 right-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all z-10 shadow-lg backdrop-blur-sm border ${
          copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } ${
          copied
            ? 'bg-[#00ff88] text-[#0a0a0f] border-[#00ff88]/50 shadow-[0_0_15px_rgba(0,255,136,0.5)]'
            : 'bg-[#1e1e2e]/90 text-[#00f0ff] border-[#00f0ff]/50 hover:bg-[#2a2a3a]/90 hover:border-[#00f0ff] hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]'
        }`}
        aria-label={copied ? 'Скопировано' : 'Копировать код'}
      >
        {copied ? '✓ Скопировано' : 'Копировать'}
      </button>
      <div className="rounded-lg overflow-hidden border border-[#2a2a3a] shadow-[0_0_20px_rgba(0,240,255,0.1)]">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            backgroundColor: '#1a1a2e',
            borderRadius: '0.5rem',
          }}
          className="rounded-lg text-sm"
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export function TheoryModule({ module }: TheoryModuleProps) {
  const isGenerating = module.contentGenerating || (!module.content || module.content.length < 50);

  return (
    <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-[#00f0ff]" />
        <h2 className="text-2xl font-bold gradient-text">{module.title}</h2>
      </div>

      {isGenerating ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00f0ff] mb-4" />
          <p className="text-[#a0a0b0] text-sm">Генерация контента модуля...</p>
          <p className="text-[#808080] text-xs mt-2">Это может занять несколько секунд</p>
        </div>
      ) : module.content ? (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-3xl font-bold text-[#e0e0e8] mb-4 mt-6">{children}</h1>,
              h2: ({ children }) => <h2 className="text-2xl font-bold text-[#e0e0e8] mb-3 mt-5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-xl font-semibold text-[#e0e0e8] mb-2 mt-4">{children}</h3>,
              p: ({ children }) => <p className="text-[#a0a0b0] mb-4 leading-relaxed">{children}</p>,
              code: ({ children, className, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                const isInline = !match;
                
                if (isInline) {
                  return (
                    <code className="px-1.5 py-0.5 bg-[#1e1e2e] text-[#00f0ff] rounded text-sm font-mono border border-[#00f0ff]/30" {...props}>
                      {children}
                    </code>
                  );
                }
                
                const codeString = String(children).replace(/\n$/, '');
                return <CodeBlock code={codeString} language={language} />;
              },
              pre: ({ children }) => <pre className="mb-0">{children}</pre>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2 text-[#a0a0b0]">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2 text-[#a0a0b0]">{children}</ol>,
              li: ({ children }) => <li className="ml-4">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-[#00f0ff] pl-4 italic text-[#a0a0b0] my-4">
                  {children}
                </blockquote>
              ),
            }}
          >
            {module.content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-12 text-[#a0a0b0]">
          <p>Контент модуля пока не загружен</p>
        </div>
      )}
    </div>
  );
}

