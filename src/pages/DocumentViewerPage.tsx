import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownComponents } from '../utils/markdownComponents';
import { getDocumentContent, DocumentContent } from '../services/documents';

export function DocumentViewerPage() {
  const { fileName } = useParams<{ fileName: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fileName) {
      loadDocument();
    }
  }, [fileName]);

  const loadDocument = async () => {
    if (!fileName) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const content = await getDocumentContent(fileName);
      setDocument(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке документа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center space-x-2 mb-4">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="w-3 h-3 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-full animate-bounce shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                style={{ animationDelay: `${index * 0.2}s` }}
              />
            ))}
          </div>
          <p className="text-lg gradient-text">Загрузка документа...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] items-center justify-center">
        <div className="text-center">
          <div className="text-[#ff4444] text-xl mb-4">⚠️</div>
          <p className="text-lg text-[#ff4444] mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-[#1e1e2e] text-[#e0e0e8] rounded-lg border border-[#2a2a3a] hover:bg-[#2a2a3a] transition-colors cursor-pointer"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-[#e0e0e8] overflow-hidden">
      {/* Заголовок */}
      <header className="h-16 border-b border-[#2a2a3a] px-4 md:px-6 bg-[#151520]/80 backdrop-blur-xl relative flex items-center">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
        <div className="flex items-center justify-between relative z-10 w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 text-[#a0a0b0] hover:text-[#00f0ff] hover:bg-[#1e1e2e] rounded-lg transition-all duration-300 cursor-pointer"
              title="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#00f0ff]" />
              <h1 className="text-xl md:text-2xl font-bold gradient-text">
                {document.fileName}
              </h1>
            </div>
          </div>
          <div className="text-sm text-[#a0a0b0]">
            {document.type.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Содержимое документа */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1e1e2e]/80 backdrop-blur-sm rounded-xl p-6 border border-[#2a2a3a] shadow-[0_0_15px_rgba(176,38,255,0.1)]">
            <div className="prose prose-invert max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={getMarkdownComponents(false)}
              >
                {document.content}
              </Markdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

