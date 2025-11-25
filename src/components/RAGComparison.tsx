import { useState } from 'react';
import { RAGComparisonResult } from '../services/rag';
import { ChevronDown, ChevronUp, FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownComponents } from '../utils/markdownComponents';

interface RAGComparisonProps {
  comparison: RAGComparisonResult;
}

export function RAGComparison({ comparison }: RAGComparisonProps) {
  const [expandedSection, setExpandedSection] = useState<'rag' | 'noRag' | 'chunks' | null>('rag');

  const toggleSection = (section: 'rag' | 'noRag' | 'chunks') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const tokenDiff = comparison.comparison.tokenDifference;
  const tokenDiffPercent = comparison.comparison.noRagTokens > 0
    ? Math.round((tokenDiff / comparison.comparison.noRagTokens) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Заголовок сравнения */}
      <div className="bg-[#1e1e2e]/80 border border-[#2a2a3a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[#e0e0e8] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00f0ff]" />
            Сравнение ответов: RAG vs Без RAG
          </h3>
        </div>
        
        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#151520] rounded-lg p-3 border border-[#2a2a3a]">
            <div className="text-xs text-[#a0a0b0] mb-1">Использовано чанков</div>
            <div className="text-lg font-bold text-[#00f0ff]">
              {comparison.comparison.ragUsedChunks}
            </div>
          </div>
          <div className="bg-[#151520] rounded-lg p-3 border border-[#2a2a3a]">
            <div className="text-xs text-[#a0a0b0] mb-1">Токены (RAG)</div>
            <div className="text-lg font-bold text-[#00ff88]">
              {comparison.comparison.ragTokens}
            </div>
          </div>
          <div className="bg-[#151520] rounded-lg p-3 border border-[#2a2a3a]">
            <div className="text-xs text-[#a0a0b0] mb-1">Токены (Без RAG)</div>
            <div className="text-lg font-bold text-[#b026ff]">
              {comparison.comparison.noRagTokens}
            </div>
          </div>
          <div className="bg-[#151520] rounded-lg p-3 border border-[#2a2a3a]">
            <div className="text-xs text-[#a0a0b0] mb-1">Разница</div>
            <div className={`text-lg font-bold flex items-center gap-1 ${
              tokenDiff > 0 ? 'text-[#ff4444]' : tokenDiff < 0 ? 'text-[#00ff88]' : 'text-[#a0a0b0]'
            }`}>
              {tokenDiff > 0 ? <TrendingUp className="w-4 h-4" /> : 
               tokenDiff < 0 ? <TrendingDown className="w-4 h-4" /> : 
               <Minus className="w-4 h-4" />}
              {tokenDiff > 0 ? '+' : ''}{tokenDiff} ({tokenDiffPercent > 0 ? '+' : ''}{tokenDiffPercent}%)
            </div>
          </div>
        </div>
      </div>

      {/* Ответ с RAG */}
      <div className="bg-[#1e1e2e]/80 border border-[#00f0ff]/30 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('rag')}
          className="w-full px-4 py-3 bg-[#151520]/50 hover:bg-[#151520] transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"></div>
            <span className="font-semibold text-[#00f0ff]">Ответ с RAG</span>
            <span className="text-xs text-[#a0a0b0] ml-2">
              ({comparison.ragChunks.length} чанков)
            </span>
          </div>
          {expandedSection === 'rag' ? (
            <ChevronUp className="w-5 h-5 text-[#a0a0b0]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#a0a0b0]" />
          )}
        </button>
        {expandedSection === 'rag' && (
          <div className="p-4 border-t border-[#2a2a3a]">
            <div className="prose prose-invert max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={getMarkdownComponents()}
              >
                {comparison.ragAnswer}
              </Markdown>
            </div>
            {comparison.ragMetadata.tokens && (
              <div className="mt-3 text-xs text-[#a0a0b0]">
                Токены: {comparison.ragMetadata.inputTokens || 0} входных / {comparison.ragMetadata.outputTokens || 0} выходных
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ответ без RAG */}
      <div className="bg-[#1e1e2e]/80 border border-[#b026ff]/30 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('noRag')}
          className="w-full px-4 py-3 bg-[#151520]/50 hover:bg-[#151520] transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#b026ff] animate-pulse"></div>
            <span className="font-semibold text-[#b026ff]">Ответ без RAG</span>
          </div>
          {expandedSection === 'noRag' ? (
            <ChevronUp className="w-5 h-5 text-[#a0a0b0]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#a0a0b0]" />
          )}
        </button>
        {expandedSection === 'noRag' && (
          <div className="p-4 border-t border-[#2a2a3a]">
            <div className="prose prose-invert max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={getMarkdownComponents()}
              >
                {comparison.noRagAnswer}
              </Markdown>
            </div>
            {comparison.noRagMetadata.tokens && (
              <div className="mt-3 text-xs text-[#a0a0b0]">
                Токены: {comparison.noRagMetadata.inputTokens || 0} входных / {comparison.noRagMetadata.outputTokens || 0} выходных
              </div>
            )}
          </div>
        )}
      </div>

      {/* Релевантные чанки */}
      {comparison.ragChunks.length > 0 && (
        <div className="bg-[#1e1e2e]/80 border border-[#2a2a3a] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('chunks')}
            className="w-full px-4 py-3 bg-[#151520]/50 hover:bg-[#151520] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00ff88]" />
              <span className="font-semibold text-[#e0e0e8]">
                Релевантные чанки ({comparison.ragChunks.length})
              </span>
            </div>
            {expandedSection === 'chunks' ? (
              <ChevronUp className="w-5 h-5 text-[#a0a0b0]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#a0a0b0]" />
            )}
          </button>
          {expandedSection === 'chunks' && (
            <div className="p-4 border-t border-[#2a2a3a] space-y-3">
              {comparison.ragChunks.map((chunk, index) => (
                <div
                  key={index}
                  className="bg-[#151520] rounded-lg p-3 border border-[#2a2a3a]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#00f0ff]">
                      {chunk.source}
                    </span>
                    <span className="text-xs text-[#a0a0b0]">
                      Score: {chunk.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-sm text-[#e0e0e8] line-clamp-3">
                    {chunk.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

