import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  error: string | null;
}

export const useSpeechRecognition = (options: UseSpeechRecognitionOptions = {}) => {
  const {
    language = 'ru-RU',
    continuous = false,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    isSupported: false,
    error: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  // Обновляем refs при изменении callbacks
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  // Проверяем поддержку Web Speech API
  useEffect(() => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState(prev => ({
        ...prev,
        isSupported: false,
        error: 'Браузер не поддерживает распознавание речи',
      }));
      return;
    }

    setState(prev => ({ ...prev, isSupported: true }));

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null,
      }));
      finalTranscriptRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      finalTranscriptRef.current = finalTranscript;
      const fullTranscript = finalTranscript + interimTranscript;

      setState(prev => ({
        ...prev,
        transcript: fullTranscript.trim(),
      }));

      if (onResultRef.current) {
        onResultRef.current(fullTranscript.trim(), interimTranscript === '');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Ошибка распознавания речи';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Речь не обнаружена';
          break;
        case 'audio-capture':
          errorMessage = 'Микрофон недоступен';
          break;
        case 'not-allowed':
          errorMessage = 'Доступ к микрофону запрещен';
          break;
        case 'network':
          errorMessage = 'Ошибка сети';
          break;
        case 'aborted':
          errorMessage = 'Распознавание прервано';
          break;
        default:
          errorMessage = `Ошибка: ${event.error}`;
      }

      setState(prev => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }));

      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    };

    recognition.onend = () => {
      setState(prev => ({
        ...prev,
        isListening: false,
      }));
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Игнорируем ошибки при остановке
        }
      }
    };
  }, [language, continuous, interimResults]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setState(prev => ({
        ...prev,
        error: 'Распознавание речи не инициализировано',
      }));
      return;
    }

    try {
      finalTranscriptRef.current = '';
      setState(prev => ({ ...prev, transcript: '', error: null }));
      recognitionRef.current.start();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось начать распознавание';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isListening: false,
      }));
      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Игнорируем ошибки при остановке
      }
    }
  }, [state.isListening]);

  const reset = useCallback(() => {
    stopListening();
    finalTranscriptRef.current = '';
    setState(prev => ({
      ...prev,
      transcript: '',
      error: null,
    }));
  }, [stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    reset,
  };
};
