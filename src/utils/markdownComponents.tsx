import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';

interface CodeBlockProps {
  code: string;
  language: string;
  isDark: boolean;
}

const CodeBlock = ({ code, language, isDark }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  // Всегда используем тёмную тему для блоков кода
  const codeStyle = vscDarkPlus;

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
    <div className="my-3 relative group">
      <button
        onClick={handleCopy}
        className={`absolute top-2 cursor-pointer right-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all z-10 shadow-lg backdrop-blur-sm border ${
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
          style={codeStyle}
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

export const getMarkdownComponents = (isUserMessage: boolean): Components => {
  const isDark = isUserMessage;
  
  return {
    // Заголовки
    h1: ({ children }) => <h1 className={`text-2xl font-bold mb-3 mt-4 first:mt-0 ${isDark ? 'text-white' : 'gradient-text'}`}>{children}</h1>,
    h2: ({ children }) => <h2 className={`text-xl font-bold mb-2 mt-4 first:mt-0 ${isDark ? 'text-white' : 'gradient-text'}`}>{children}</h2>,
    h3: ({ children }) => <h3 className={`text-lg font-bold mb-2 mt-3 first:mt-0 ${isDark ? 'text-white' : 'text-[#00f0ff]'}`}>{children}</h3>,
    h4: ({ children }) => <h4 className={`text-base font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-[#00f0ff]'}`}>{children}</h4>,
    h5: ({ children }) => <h5 className={`text-sm font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-[#b026ff]'}`}>{children}</h5>,
    h6: ({ children }) => <h6 className={`text-xs font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-[#b026ff]'}`}>{children}</h6>,
    
    // Параграфы
    p: ({ children }) => <p className={`mb-2 last:mb-0 leading-relaxed ${isDark ? 'text-white/95' : 'text-[#e0e0e8]'}`}>{children}</p>,
    
    // Списки
    ul: ({ children }) => <ul className={`list-disc list-inside mb-3 space-y-1 ml-2 ${isDark ? 'text-white/95' : 'text-[#e0e0e8]'}`}>{children}</ul>,
    ol: ({ children }) => <ol className={`list-decimal list-inside mb-3 space-y-1 ml-2 ${isDark ? 'text-white/95' : 'text-[#e0e0e8]'}`}>{children}</ol>,
    li: ({ children }) => <li className="pl-1">{children}</li>,
    
    // Блоки кода
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className={`${isDark ? 'bg-white/20' : 'bg-[#00f0ff]/20'} px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? 'text-white' : 'text-[#00f0ff]'} border border-[#00f0ff]/30`} {...props}>
            {children}
          </code>
        );
      }
      
      const codeString = String(children).replace(/\n$/, '');
      
      return (
        <CodeBlock code={codeString} language={language} isDark={isDark} />
      );
    },
    
    // Предформатированный текст
    pre: ({ children }) => <pre className="mb-3">{children}</pre>,
    
    // Ссылки
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-[#00f0ff] hover:text-[#b026ff]'} underline break-all transition-colors duration-200 cursor-pointer`}
      >
        {children}
      </a>
    ),
    
    // Выделение текста
    strong: ({ children }) => <strong className="font-bold text-[#00f0ff]">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    
    // Горизонтальная линия
    hr: () => <hr className={`my-4 border-t border-[#2a2a3a] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent`} />,
    
    // Блоки цитат
    blockquote: ({ children }) => (
      <blockquote className={`border-l-4 ${isDark ? 'border-white/40 bg-white/10' : 'border-[#00f0ff]/50 bg-[#00f0ff]/10'} pl-4 py-2 my-3 italic rounded-r ${isDark ? 'text-white/90' : 'text-[#e0e0e8]'} shadow-[0_0_10px_rgba(0,240,255,0.1)]`}>
        {children}
      </blockquote>
    ),
    
    // Таблицы
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 -mx-2">
        <div className="inline-block min-w-full align-middle px-2">
          <table className={`min-w-full border-collapse ${isDark ? 'border-white/30' : 'border-[#2a2a3a]'} text-sm rounded-lg overflow-hidden border border-[#2a2a3a]`}>
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={isDark ? 'bg-white/10' : 'bg-[#1e1e2e]/80 backdrop-blur-sm'}>
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className={isDark ? 'divide-y divide-white/20' : 'divide-y divide-[#2a2a3a]'}>
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-[#2a2a3a]/50'} transition-colors duration-200`}>
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className={`${isDark ? 'border-white/30 text-white' : 'border-[#2a2a3a] text-[#00f0ff]'} border px-3 py-2 text-left font-semibold align-top`}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className={`${isDark ? 'border-white/30 text-white/90' : 'border-[#2a2a3a] text-[#e0e0e8]'} border px-3 py-2 align-top`}>
        {children}
      </td>
    ),
  };
};

