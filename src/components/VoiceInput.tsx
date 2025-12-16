import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export const VoiceInput = ({ onTranscript, disabled = false }: VoiceInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  // Стабилизируем callback функции с помощью useCallback
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal && text.trim()) {
      onTranscript(text.trim());
      if (resetRef.current) {
        resetRef.current();
      }
      setIsRecording(false);
    }
  }, [onTranscript]);

  const handleError = useCallback((errorMessage: string) => {
    console.error('Speech recognition error:', errorMessage);
    setIsRecording(false);
  }, []);

  const {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    reset,
  } = useSpeechRecognition({
    language: 'ru-RU',
    continuous: false,
    interimResults: true,
    onResult: handleResult,
    onError: handleError,
  });

  // Сохраняем reset в ref для использования в handleResult
  useEffect(() => {
    resetRef.current = reset;
  }, [reset]);

  // Проверяем разрешение на использование микрофона
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (err) {
        setHasPermission(false);
      }
    };

    if (isSupported) {
      checkPermission();
    }
  }, [isSupported]);

  const handleToggleRecording = async () => {
    if (disabled || !isSupported) return;

    if (!hasPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (err) {
        setHasPermission(false);
        return;
      }
    }

    if (isListening) {
      stopListening();
      setIsRecording(false);
      // Небольшая задержка для получения финального результата
      setTimeout(() => {
        if (transcript.trim()) {
          onTranscript(transcript.trim());
        }
        reset();
      }, 100);
    } else {
      reset();
      startListening();
      setIsRecording(true);
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        className="flex-shrink-0 w-11 h-11 bg-[#1a1a1a] text-[#505050] rounded-lg cursor-not-allowed flex items-center justify-center"
        title="Браузер не поддерживает распознавание речи"
      >
        <MicOff className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggleRecording}
        disabled={disabled || !hasPermission}
        className={`flex-shrink-0 w-11 h-11 rounded-lg transition-all duration-300 flex items-center justify-center ${
          isRecording
            ? 'bg-gradient-to-r from-[#ff4444] to-[#cc0000] text-white shadow-[0_0_20px_rgba(255,68,68,0.5)] animate-pulse'
            : 'bg-[#1e1e2e] text-[#e0e0e8] border border-[#2a2a3a] hover:bg-[#2a2a3a] hover:border-[#00f0ff]/50 hover:text-[#00f0ff]'
        } ${
          disabled || !hasPermission
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00f0ff] focus:ring-offset-2 focus:ring-offset-[#151520]'
        }`}
        title={
          !hasPermission
            ? 'Разрешите доступ к микрофону'
            : isRecording
            ? 'Остановить запись'
            : 'Начать голосовой ввод'
        }
        aria-label={isRecording ? 'Остановить запись' : 'Начать голосовой ввод'}
      >
        {isListening ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Индикатор записи */}
      {isRecording && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-[#1e1e2e] border border-[#ff4444]/50 rounded-lg px-3 py-2 shadow-[0_0_20px_rgba(255,68,68,0.3)] animate-[slide-in_0.3s_ease-out]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#ff4444] rounded-full animate-pulse"></div>
            <span className="text-xs text-[#e0e0e8] whitespace-nowrap">Запись...</span>
          </div>
          {transcript && (
            <div className="mt-1 text-xs text-[#a0a0b0] max-w-[200px] truncate">
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* Сообщение об ошибке */}
      {error && !isRecording && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-[#2a1a1a] border border-[#ff4444]/50 rounded-lg px-3 py-2 shadow-[0_0_20px_rgba(255,68,68,0.3)] animate-[slide-in_0.3s_ease-out]">
          <span className="text-xs text-[#ff4444] whitespace-nowrap">{error}</span>
        </div>
      )}
    </div>
  );
};
