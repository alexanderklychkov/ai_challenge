import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFlashcardSets, deleteFlashcardSet, type FlashcardSet, type Flashcard } from '../services/learning';
import { RotateCcw, ChevronLeft, ChevronRight, Loader2, BookOpen, Trash2 } from 'lucide-react';

interface FlashcardsViewerProps {
  setId: string;
}

export function FlashcardsViewer({ setId }: FlashcardsViewerProps) {
  const navigate = useNavigate();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSet();
  }, [setId]);

  const loadSet = async () => {
    setIsLoading(true);
    try {
      const sets = await loadFlashcardSets();
      const foundSet = sets.find(s => s.setId === setId);
      if (foundSet) {
        setSet(foundSet);
      }
    } catch (error) {
      console.error('Ошибка при загрузке карточек:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (!set) return;
    setCurrentIndex((prev) => (prev + 1) % set.cards.length);
    setIsFlipped(false);
  };

  const handlePrev = () => {
    if (!set) return;
    setCurrentIndex((prev) => (prev - 1 + set.cards.length) % set.cards.length);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleDelete = async () => {
    if (confirm('Вы уверены, что хотите удалить этот набор карточек?')) {
      const success = await deleteFlashcardSet(setId);
      if (success) {
        navigate('/learning');
      } else {
        alert('Не удалось удалить набор карточек');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#00f0ff]" />
      </div>
    );
  }

  if (!set || set.cards.length === 0) {
    return (
      <div className="p-4 text-center text-[#a0a0b0]">
        Набор карточек не найден
      </div>
    );
  }

  const currentCard = set.cards[currentIndex];

  return (
    <div className="border border-[#2a2a3a] rounded-lg p-6 bg-[#151520]/50 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#00f0ff]" />
          <h3 className="text-xl font-bold gradient-text">{set.topic}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-[#a0a0b0]">
            {currentIndex + 1} / {set.cards.length}
          </div>
          <button
            onClick={handleDelete}
            className="p-2 text-[#a0a0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-all cursor-pointer"
            title="Удалить набор карточек"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="relative h-64 mb-6 cursor-pointer perspective-1000"
        onClick={handleFlip}
        style={{ perspective: '1000px' }}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Лицевая сторона */}
          <div
            className={`absolute inset-0 backface-hidden rounded-lg p-6 flex flex-col items-center justify-center border ${
              !isFlipped ? 'bg-gradient-to-br from-[#00f0ff]/20 to-[#b026ff]/20 border-[#00f0ff]/50' : 'bg-[#1e1e2e]/50 border-[#2a2a3a]'
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-sm text-[#a0a0b0] mb-2">Вопрос</div>
            <div className="text-xl font-semibold text-[#e0e0e8] text-center">
              {currentCard.question}
            </div>
            {currentCard.hint && (
              <div className="mt-4 text-sm text-[#a0a0b0] italic">
                Подсказка: {currentCard.hint}
              </div>
            )}
            <div className="mt-4 text-xs text-[#00f0ff] flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Нажмите, чтобы перевернуть
            </div>
          </div>

          {/* Обратная сторона */}
          <div
            className={`absolute inset-0 backface-hidden rounded-lg p-6 flex flex-col items-center justify-center border rotate-y-180 ${
              isFlipped ? 'bg-gradient-to-br from-[#00ff88]/20 to-[#00f0ff]/20 border-[#00ff88]/50' : 'bg-[#1e1e2e]/50 border-[#2a2a3a]'
            }`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="text-sm text-[#a0a0b0] mb-2">Ответ</div>
            <div className="text-xl font-semibold text-[#e0e0e8] text-center">
              {currentCard.answer}
            </div>
            <div className="mt-4 text-xs text-[#00f0ff] flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Нажмите, чтобы перевернуть
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          className="px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] hover:bg-[#2a2a3a] hover:border-[#00f0ff]/50 transition-all flex items-center gap-2 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>

        <button
          onClick={handleFlip}
          className="px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] hover:bg-[#2a2a3a] hover:border-[#00f0ff]/50 transition-all flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Перевернуть
        </button>

        <button
          onClick={handleNext}
          className="px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-[#e0e0e8] hover:bg-[#2a2a3a] hover:border-[#00f0ff]/50 transition-all flex items-center gap-2 cursor-pointer"
        >
          Далее
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

