import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';

interface CodeBlockProps {
  code: string;
  language: string;
  isDark: boolean;
}

const CodeBlock = ({ code, language, isDark }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const codeStyle = isDark ? vscDarkPlus : oneLight;

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
        className={`absolute top-2 cursor-pointer right-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all z-10 shadow-md ${
          copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } ${
          isDark
            ? copied
              ? 'bg-green-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            : copied
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
        }`}
        aria-label={copied ? 'Скопировано' : 'Копировать код'}
      >
        {copied ? '✓ Скопировано' : 'Копировать'}
      </button>
      <div>
        <SyntaxHighlighter
          language={language}
          style={codeStyle}
          PreTag="div"
          className="rounded-lg text-sm !m-0 !p-4"
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
    h1: ({ children }) => <h1 className={`text-2xl font-bold mb-3 mt-4 first:mt-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h1>,
    h2: ({ children }) => <h2 className={`text-xl font-bold mb-2 mt-4 first:mt-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h2>,
    h3: ({ children }) => <h3 className={`text-lg font-bold mb-2 mt-3 first:mt-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h3>,
    h4: ({ children }) => <h4 className={`text-base font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h4>,
    h5: ({ children }) => <h5 className={`text-sm font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h5>,
    h6: ({ children }) => <h6 className={`text-xs font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h6>,
    
    // Параграфы
    p: ({ children }) => <p className={`mb-2 last:mb-0 leading-relaxed ${isDark ? 'text-white/95' : 'text-gray-800'}`}>{children}</p>,
    
    // Списки
    ul: ({ children }) => <ul className={`list-disc list-inside mb-3 space-y-1 ml-2 ${isDark ? 'text-white/95' : 'text-gray-800'}`}>{children}</ul>,
    ol: ({ children }) => <ol className={`list-decimal list-inside mb-3 space-y-1 ml-2 ${isDark ? 'text-white/95' : 'text-gray-800'}`}>{children}</ol>,
    li: ({ children }) => <li className="pl-1">{children}</li>,
    
    // Блоки кода
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className={`${isDark ? 'bg-white/20' : 'bg-gray-800/10'} px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? 'text-white' : 'text-gray-900'}`} {...props}>
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
        className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'} underline break-all`}
      >
        {children}
      </a>
    ),
    
    // Выделение текста
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    
    // Горизонтальная линия
    hr: () => <hr className={`my-4 ${isDark ? 'border-white/30' : 'border-gray-300'}`} />,
    
    // Блоки цитат
    blockquote: ({ children }) => (
      <blockquote className={`border-l-4 ${isDark ? 'border-white/40 bg-white/10' : 'border-gray-400 bg-gray-200/50'} pl-4 py-2 my-3 italic rounded-r ${isDark ? 'text-white/90' : 'text-gray-700'}`}>
        {children}
      </blockquote>
    ),
    
    // Таблицы
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 -mx-2">
        <div className="inline-block min-w-full align-middle px-2">
          <table className={`min-w-full border-collapse ${isDark ? 'border-white/30' : 'border-gray-300'} text-sm`}>
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={isDark ? 'bg-white/10' : 'bg-gray-100'}>
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className={isDark ? 'divide-y divide-white/20' : 'divide-y divide-gray-200'}>
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className={isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50 transition-colors'}>
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className={`${isDark ? 'border-white/30 text-white' : 'border-gray-300 text-gray-900'} border px-3 py-2 text-left font-semibold align-top`}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className={`${isDark ? 'border-white/30 text-white/90' : 'border-gray-300 text-gray-800'} border px-3 py-2 align-top`}>
        {children}
      </td>
    ),
  };
};

