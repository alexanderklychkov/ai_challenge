import { useState } from 'react';
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';

/**
 * Обрабатывает текст и преобразует упоминания источников в markdown ссылки
 * @param text - Текст для обработки
 * @param sourceIndexMap - Маппинг номеров источников на имена файлов
 * @returns Текст с markdown ссылками
 */
export function processSourceReferences(text: string, sourceIndexMap: Record<number, string>): string {
  if (!text || Object.keys(sourceIndexMap).length === 0) {
    return text;
  }

  let processedText = text;
  
  // Отладка: проверяем, что функция вызывается
  const originalText = text;

  // Обрабатываем паттерны в обратном порядке (от более специфичных к менее специфичным)
  // Важно: не обрабатываем уже существующие markdown ссылки [текст](url)
  
  // 1. [Источник/Источнике/Источника/Источнику 1: filename.md] - полный формат с именем файла
  // Учитываем разные падежи слова "Источник"
  processedText = processedText.replace(
    /\[Источник[а-я]*\s+(\d+):\s*([^\]]+)\](?!\()/gi,
    (match, sourceNum, fileName) => {
      const file = fileName.trim();
      // match содержит [Источнике 1: filename.md], извлекаем текст без скобок
      const linkText = match.substring(1, match.length - 1); // убираем [ и ]
      return `[${linkText}](/documents/${encodeURIComponent(file)})`;
    }
  );

  // 2. [1: filename.md] - короткий формат с именем файла
  processedText = processedText.replace(
    /\[(\d+):\s*([^\]]+)\](?!\()/g,
    (match, sourceNum, fileName) => {
      const file = fileName.trim();
      const linkText = match.substring(1, match.length - 1);
      return `[${linkText}](/documents/${encodeURIComponent(file)})`;
    }
  );

  // 3. [Источник/Источнике/Источника/Источнику 1] - формат без имени файла, используем маппинг
  processedText = processedText.replace(
    /\[Источник[а-я]*\s+(\d+)\](?!\()/gi,
    (match, sourceNum) => {
      const num = parseInt(sourceNum, 10);
      const fileName = sourceIndexMap[num];
      if (fileName) {
        const linkText = match.substring(1, match.length - 1);
        return `[${linkText}](/documents/${encodeURIComponent(fileName)})`;
      }
      return match;
    }
  );

  // 4. [1] - короткий формат без имени файла, используем маппинг
  // Проверяем, что после ] нет открывающей скобки (чтобы не обрабатывать уже существующие ссылки)
  processedText = processedText.replace(
    /\[(\d+)\](?!\w)(?!\()/g,
    (match, sourceNum) => {
      const num = parseInt(sourceNum, 10);
      const fileName = sourceIndexMap[num];
      if (fileName) {
        const linkText = match.substring(1, match.length - 1);
        return `[${linkText}](/documents/${encodeURIComponent(fileName)})`;
      }
      return match;
    }
  );

  // Отладка: проверяем результат обработки
  if (processedText !== originalText) {
    console.log('Source references processed:', {
      original: originalText.substring(0, 200),
      processed: processedText.substring(0, 200),
      sourceIndexMap
    });
  }
  
  return processedText;
}

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

export const getMarkdownComponents = (
  isUserMessage: boolean,
  sourceChunksMap: Record<string, string> = {},
  sourceIndexMap: Record<number, string> = {}
): Components => {
  const isDark = isUserMessage;
  
  // Создаем компонент для ссылок на источники с навигацией
  const SourceLink = ({ fileName, children }: { fileName: string; children: any }) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      window.location.href = `/documents/${encodeURIComponent(fileName)}`;
    };
    
    return (
      <a
        href={`/documents/${encodeURIComponent(fileName)}`}
        onClick={handleClick}
        className="text-[#00f0ff] hover:text-[#b026ff] font-medium underline cursor-pointer transition-colors"
      >
        {children}
      </a>
    );
  };
  
  return {
    // Заголовки
    h1: ({ children }) => <h1 className={`text-2xl font-bold mb-3 mt-4 first:mt-0 ${isDark ? 'text-white' : 'gradient-text'}`}>{children}</h1>,
    h2: ({ children }) => <h2 className={`text-xl font-bold mb-2 mt-4 first:mt-0 ${isDark ? 'text-white' : 'gradient-text'}`}>{children}</h2>,
    h3: ({ children }) => {
      const text = typeof children === 'string' ? children : String(children);
      const isSourcesSection = text.toLowerCase().includes('источник') || text.includes('📚');
      return (
        <h3 className={`text-lg font-bold mb-3 mt-4 first:mt-0 ${
          isSourcesSection 
            ? 'text-[#00f0ff] border-b-2 border-[#00f0ff]/40 pb-2 flex items-center gap-2' 
            : (isDark ? 'text-white' : 'text-[#00f0ff]')
        }`}>
          {children}
        </h3>
      );
    },
    h4: ({ children }) => <h4 className={`text-base font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-[#00f0ff]'}`}>{children}</h4>,
    h5: ({ children }) => <h5 className={`text-sm font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-[#b026ff]'}`}>{children}</h5>,
    h6: ({ children }) => <h6 className={`text-xs font-bold mb-1 mt-2 first:mt-0 ${isDark ? 'text-white' : 'text-[#b026ff]'}`}>{children}</h6>,
    
    // Параграфы
    p: ({ children }) => {
      return (
        <p className={`mb-2 last:mb-0 leading-relaxed ${isDark ? 'text-white/95' : 'text-[#e0e0e8]'}`}>
          {children}
        </p>
      );
    },
    
    // Списки
    ul: ({ children }) => {
      // Проверяем, является ли список списком источников
      const childrenArray = Array.isArray(children) ? children : [children];
      const isSourcesList = childrenArray.some((child: any) => {
        if (!child || !child.props) return false;
        const children = child.props.children;
        const text = Array.isArray(children) 
          ? children.map((c: any) => String(c)).join('')
          : String(children || '');
        // Проверяем наличие паттерна [номер] или названия файла
        return /\[\d+\]/.test(text) && (/\.[a-z]+/i.test(text) || text.includes('📄') || text.includes('📝'));
      });
      
      return (
        <ul className={`${
          isSourcesList 
            ? 'list-none space-y-2.5 mb-4 bg-gradient-to-br from-[#151520]/80 to-[#1a1a2a]/80 p-4 rounded-xl border-2 border-[#00f0ff]/30 shadow-[0_0_20px_rgba(0,240,255,0.1)] backdrop-blur-sm' 
            : 'list-disc list-inside mb-3 space-y-1 ml-2'
        } ${isDark ? 'text-white/95' : 'text-[#e0e0e8]'}`}>
          {children}
        </ul>
      );
    },
    ol: ({ children }) => (
      <ol className={`list-decimal list-outside mb-3 space-y-1 ml-6 pl-2 ${isDark ? 'text-white/95' : 'text-[#e0e0e8]'}`} style={{ counterReset: 'list-counter' }}>
        {children}
      </ol>
    ),
    li: ({ children }) => {
      // Проверяем, является ли элемент списка элементом источника
      const childrenArray = Array.isArray(children) ? children : [children];
      const text = childrenArray.map((c: any) => {
        if (typeof c === 'string') return c;
        if (c?.props?.children) {
          return Array.isArray(c.props.children) 
            ? c.props.children.map((cc: any) => String(cc)).join('')
            : String(c.props.children);
        }
        return String(c);
      }).join('');
      
      const isSourceItem = /\[\d+\]/.test(text) && (/\.[a-z]+/i.test(text) || text.includes('📄') || text.includes('📝'));
      
      // Извлекаем название файла из текста
      let fileName: string | null = null;
      if (isSourceItem) {
        const fileNameMatch = text.match(/`([^`]+)`/);
        if (fileNameMatch) {
          fileName = fileNameMatch[1];
        } else {
          // Пытаемся найти название файла без обратных кавычек
          const fileMatch = text.match(/([\w\-\.]+\.(md|txt|pdf|js|ts|jsx|tsx|py|html|css|json|xml|yaml|yml))/i);
          if (fileMatch) {
            fileName = fileMatch[1];
          }
        }
      }
      
      return (
        <li className={`${
          isSourceItem 
            ? 'pl-0 flex items-center gap-3 text-sm py-2 px-3 rounded-lg bg-[#1e1e2e]/50 hover:bg-[#1e1e2e]/70 transition-colors border border-[#2a2a3a]/50' 
            : 'pl-0'
        }`} style={!isSourceItem ? { display: 'list-item' } : undefined}>
          {isSourceItem && (
            <span className="text-[#00f0ff] text-base flex-shrink-0">📄</span>
          )}
          {isSourceItem && fileName ? (
            <SourceLink fileName={fileName}>
              {children}
            </SourceLink>
          ) : (
            <span className={isSourceItem ? 'text-[#e0e0e8] font-medium' : ''}>{children}</span>
          )}
        </li>
      );
    },
    
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
    a: ({ href, children }) => {
      // Проверяем, является ли ссылка ссылкой на документ
      const isDocumentLink = href && href.startsWith('/documents/');
      
      if (isDocumentLink) {
        // Для ссылок на документы используем navigate вместо открытия в новой вкладке
        const handleClick = (e: React.MouseEvent) => {
          e.preventDefault();
          window.location.href = href;
        };
        
        return (
          <a
            href={href}
            onClick={handleClick}
            className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-[#00f0ff] hover:text-[#b026ff]'} underline break-all transition-colors duration-200 cursor-pointer`}
          >
            {children}
          </a>
        );
      }
      
      // Для внешних ссылок открываем в новой вкладке
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-[#00f0ff] hover:text-[#b026ff]'} underline break-all transition-colors duration-200 cursor-pointer`}
        >
          {children}
        </a>
      );
    },
    
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

