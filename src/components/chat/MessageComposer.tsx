import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Send, Keyboard, Loader2, Mic, X, MoreHorizontal } from 'lucide-react';
import PersonaSelector from '../PersonaSelector';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import type { PanelActions, PanelQuickAction, Persona } from '../../types/chat';

const MAX_RECORDING_MS = 2 * 60 * 1000;
const MIN_RECORDING_MS = 500;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const AUTO_SEND_TRANSCRIPTION = true;
const TOAST_TIMEOUT_MS = 4000;
const DEFAULT_TRANSCRIPTION_PROMPT =
  'Ты — система точной транскрибации. Записывай речь дословно, без пересказа и добавлений. Сохраняй язык оригинала, не переводя. Если фрагмент неразборчив, явно укажи, что он неразборчив.';

const LOCALE = {
  placeholder: {
    withFocus: 'Спросите о выделенном тексте...',
    default: 'Введите сообщение...',
  },
  recording: {
    label: 'Запись:',
    buttonTitle: 'Записать аудио (Ctrl/Cmd + M)',
    buttonAriaLabel: 'Записать голосовое сообщение',
    cancel: 'Отменить',
    send: 'Отправить запись',
  },
  status: {
    processing: 'Обработка аудио...',
    cancelled: 'Запись отменена',
    tooShort: 'Запись слишком короткая',
    tooLarge: 'Аудио слишком большое для обработки',
    ready: 'Транскрипция готова',
  },
  errors: {
    noMicrophone: 'Микрофон недоступен в этом браузере',
    notSupported: 'Запись не поддерживается',
    permissionDenied: 'Доступ к микрофону запрещен',
    rateLimit: 'Превышен лимит запросов транскрибации. Подождите немного.',
    noApiKey: 'Отсутствует API ключ OpenRouter',
    transcriptionFailed: 'Ошибка транскрибации',
    noTranscription: 'Транскрипция не получена',
    genericError: 'Не удалось обработать аудио',
  },
  quickActions: {
    empty: 'Выделите текст для быстрых действий',
  },
} as const;

const truncateRef = (ref: string, maxLength = 24) => {
  if (ref.length <= maxLength) return ref;
  return `${ref.slice(0, maxLength - 3)}...`;
};
interface MessageComposerProps {
  onSendMessage: (message: string) => Promise<void> | void;
  disabled?: boolean;
  discussionFocusRef?: string;
  panelActions?: PanelActions;
  layoutMode?: 'horizontal' | 'vertical';
  transcriptionModel?: string;
  onTranscriptionError?: (error: Error) => void;
  currentPersona?: Persona;
  availablePersonas?: Persona[];
  onPersonaChange?: (persona: Persona) => void;
  maxRows?: number;
  autoFocus?: boolean;
  draftKey?: string;
}

const formatRecordingTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to encode audio'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.readAsDataURL(blob);
  });

export default function MessageComposer({
  onSendMessage,
  disabled,
  discussionFocusRef,
  panelActions,
  layoutMode = 'horizontal',
  transcriptionModel = 'google/gemini-2.5-flash',
  onTranscriptionError,
  currentPersona,
  availablePersonas,
  onPersonaChange,
  maxRows = 6,
  autoFocus = false,
  draftKey = 'composer:draft',
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [pending, setPending] = useState(false);
  const [hebrewKeyboard, setHebrewKeyboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const transcriptionTimestampsRef = useRef<number[]>([]);
  const recordingCancelledRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  const composerDisabled = disabled || pending || isTranscribing || isRecording;
  const transcriptionPrompt =
    import.meta.env.VITE_TRANSCRIPTION_PROMPT || DEFAULT_TRANSCRIPTION_PROMPT;
  const transcriptionLanguage = import.meta.env.VITE_TRANSCRIPTION_LANGUAGE;

  const hebrewKeys = [
    ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
    ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
    ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ', 'Backspace'],
  ];

  // Load draft on mount
  useEffect(() => {
    const draft = sessionStorage.getItem(draftKey);
    if (draft) setText(draft);
  }, [draftKey]);

  // Save draft with debouncing
  useEffect(() => {
    const id = requestAnimationFrame(() => sessionStorage.setItem(draftKey, text));
    return () => cancelAnimationFrame(id);
  }, [text, draftKey]);

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';

    const lineHeight = 24;
    const minHeight = lineHeight * 1;
    const maxHeight = lineHeight * maxRows;
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;
  }, [text, maxRows]);

  const submitMessage = useCallback(
    async (rawMessage: string, options: { preserveInput?: boolean } = {}) => {
      const { preserveInput = false } = options;
      const trimmed = rawMessage.trim();
      if (!trimmed || pending || disabled || isTranscribing) return;

      if (!preserveInput) {
        setText('');
      }

      setPending(true);

      try {
        await onSendMessage(trimmed);
      } catch (error) {
        console.error('Failed to send message:', error);
        if (!preserveInput) {
          setText(trimmed);
        }
      } finally {
        setPending(false);
      }
    },
    [pending, disabled, onSendMessage, isTranscribing],
  );

  const send = useCallback(() => {
    if (!text.trim()) return;
    void submitMessage(text);
  }, [submitMessage, text]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
        e.preventDefault();
        send();
      }
    },
    [send, isComposing],
  );

  const onFocus = useCallback(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const toggleHebrewKeyboard = useCallback(() => {
    setHebrewKeyboard((prev) => !prev);
  }, []);

  const insertHebrewChar = useCallback((char: string) => {
    if (char === 'Backspace') {
      setText((prev) => prev.slice(0, -1));
    } else {
      setText((prev) => prev + char);
    }
    textareaRef.current?.focus();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const ref = e.dataTransfer.getData('text/astra-commentator-ref');
      if (ref) {
        setText((prev) => (prev ? `${prev} ${ref}` : ref));
      }
    },
    [],
  );

  const handleQuickAction = useCallback(
    (action: PanelQuickAction) => {
      if (action.disabled) return;
      void submitMessage(action.message, { preserveInput: true });
    },
    [submitMessage],
  );

  const cleanupRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStartRef.current = null;
    audioChunksRef.current = [];
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const cancelRecording = useCallback(() => {
    if (!isRecording) return;
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    setStatusMessage(LOCALE.status.cancelled);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (composerDisabled || isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusMessage(LOCALE.errors.noMicrophone);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        const err = error instanceof Error ? error : new Error(LOCALE.errors.notSupported);
        setStatusMessage(err.message);
        onTranscriptionError?.(err);
        return;
      }
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setStatusMessage(null);
      recordingStartRef.current = Date.now();
      recordingCancelledRef.current = false;
      setRecordingTime(0);
      setIsRecording(true);

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const start = recordingStartRef.current;
        const chunks = audioChunksRef.current.slice();
        const wasCancelled = recordingCancelledRef.current;
        cleanupRecording();
        recordingCancelledRef.current = false;
        if (!start || wasCancelled) return;
        const duration = Date.now() - start;
        if (duration < MIN_RECORDING_MS) {
          setStatusMessage(LOCALE.status.tooShort);
          return;
        }
        const blob = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size > MAX_AUDIO_BYTES) {
          setStatusMessage(LOCALE.status.tooLarge);
          return;
        }
        void transcribe(blob);
      });

      recordingTimerRef.current = window.setInterval(() => {
        const start = recordingStartRef.current;
        if (!start) return;
        const elapsed = Date.now() - start;
        setRecordingTime(elapsed);
        if (elapsed >= MAX_RECORDING_MS) {
          recorder.stop();
        }
      }, 250);

      recorder.start();
    } catch (error) {
      console.error('Failed to start recording', error);
      const err = error instanceof Error ? error : new Error(LOCALE.errors.permissionDenied);
      setStatusMessage(err.message);
      onTranscriptionError?.(err);
      cleanupRecording();
    }
  }, [cleanupRecording, composerDisabled, isRecording, onTranscriptionError]);

  const finishRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
  }, [isRecording]);

  const transcribe = useCallback(
    async (audioBlob: Blob) => {
      transcriptionAbortRef.current?.abort();
      const controller = new AbortController();
      transcriptionAbortRef.current = controller;

      const now = Date.now();
      transcriptionTimestampsRef.current = transcriptionTimestampsRef.current
        .filter((ts) => now - ts < 60_000)
        .concat(now);
      if (transcriptionTimestampsRef.current.length > 5) {
        const error = new Error(LOCALE.errors.rateLimit);
        setStatusMessage(error.message);
        onTranscriptionError?.(error);
        return;
      }

      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        const error = new Error(LOCALE.errors.noApiKey);
        setStatusMessage(error.message);
        onTranscriptionError?.(error);
        return;
      }

      setIsTranscribing(true);
      setStatusMessage(LOCALE.status.processing);
      try {
        const base64Audio = await blobToBase64(audioBlob);
        const format = (audioBlob.type.split('/')[1] || 'webm').split(';')[0];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: transcriptionModel,
            messages: [
              {
                role: 'system',
                content: transcriptionLanguage
                  ? `${transcriptionPrompt} Язык аудио: ${transcriptionLanguage}. Транскрибируй только на этом языке и сохраняй исходное письмо.`
                  : transcriptionPrompt,
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe this audio:' },
                  {
                    type: 'input_audio',
                    inputAudio: {
                      data: base64Audio,
                      format,
                    },
                  },
                ],
              },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`${LOCALE.errors.transcriptionFailed} (${response.status}): ${body}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        let transcript = '';
        if (Array.isArray(content)) {
          const textPart = content.find((item: any) => item?.type === 'text');
          transcript = textPart?.text || '';
        } else if (typeof content === 'string') {
          transcript = content;
        }

        transcript = (transcript || '').trim();
        if (!transcript) {
          throw new Error(LOCALE.errors.noTranscription);
        }

        setText(transcript);
        setStatusMessage(LOCALE.status.ready);
        if (AUTO_SEND_TRANSCRIPTION) {
          void submitMessage(transcript);
        } else {
          textareaRef.current?.focus();
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        const err = error instanceof Error ? error : new Error(LOCALE.errors.genericError);
        setStatusMessage(err.message);
        onTranscriptionError?.(err);
        console.error(err);
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscriptionError, submitMessage, transcriptionModel],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        if (isRecording) {
          finishRecording();
        } else {
          void startRecording();
        }
      }
      if (event.key === 'Escape' && isRecording) {
        event.preventDefault();
        cancelRecording();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cancelRecording, finishRecording, isRecording, startRecording]);

  // Auto-clear status as lightweight toast
  useEffect(() => {
    if (!statusMessage) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setStatusMessage(null), TOAST_TIMEOUT_MS);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [statusMessage]);

  const leftActions = panelActions?.leftWorkbench ?? [];
  const focusActions = panelActions?.focus ?? [];
  const rightActions = panelActions?.rightWorkbench ?? [];
  const primaryLeft = leftActions[0];
  const primaryRight = rightActions[0];
  const primaryFocus = focusActions[0];

  const displayGroups = useMemo(() => {
    const vertical = layoutMode === 'vertical';
    if (vertical) {
      const secondary = leftActions.length ? leftActions : rightActions;
      return [
        { id: 'focus', actions: focusActions, align: 'center' as const },
        { id: 'secondary', actions: secondary, align: 'center' as const },
      ].filter((group) => group.actions.length > 0);
    }
    return [
      { id: 'left', actions: leftActions, align: 'start' as const },
      { id: 'focus', actions: focusActions, align: 'center' as const },
      { id: 'right', actions: rightActions, align: 'end' as const },
    ].filter((group) => group.actions.length > 0);
  }, [focusActions, layoutMode, leftActions, rightActions]);

  useEffect(() => {
    return () => {
      transcriptionAbortRef.current?.abort();
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {}
      }
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="panel-padding-lg panel-inner">
      <div className="max-w-2xl mx-auto w-full">
        <div
          className="relative overflow-hidden rounded-3xl bg-card/95 backdrop-blur-2xl border border-border/60 shadow-2xl shadow-black/30 transition-all hover:border-primary/60 focus-within:border-primary/70 focus-within:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)]"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none" />
          {panelActions && (focusActions.length > 0 || primaryLeft || primaryRight) && (
            <div className="px-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="flex flex-wrap gap-2 px-1 justify-center">
                {primaryLeft && (
                  <button
                    key={primaryLeft.id}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-muted/60 hover:bg-muted text-foreground text-sm font-medium transition-all hover:scale-105 active:scale-95 whitespace-nowrap max-w-[200px] overflow-hidden"
                    onClick={() => handleQuickAction(primaryLeft)}
                    disabled={composerDisabled || primaryLeft.disabled}
                    title={primaryLeft.disabledReason || primaryLeft.ref}
                  >
                    <span>Объясни</span>
                    <kbd className="font-mono text-[10px] opacity-70 ml-1 max-w-[90px] overflow-hidden text-ellipsis">
                      {truncateRef(primaryLeft.ref)}
                    </kbd>
                  </button>
                )}

                {focusActions.slice(0, 3).map((action) => (
                  <button
                    key={action.id}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-all hover:scale-105 active:scale-95 whitespace-nowrap max-w-[200px] overflow-hidden"
                    onClick={() => handleQuickAction(action)}
                    disabled={composerDisabled || action.disabled}
                    title={action.disabledReason || action.ref}
                  >
                    <span>{action.label}</span>
                    <kbd className="font-mono text-[10px] opacity-70 ml-1 max-w-[90px] overflow-hidden text-ellipsis">
                      {truncateRef(action.ref)}
                    </kbd>
                  </button>
                ))}
                {focusActions.length > 3 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-all hover:scale-105 active:scale-95">
                        Ещё…
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      {focusActions.slice(3).map((action) => (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          disabled={composerDisabled || action.disabled}
                        >
                          {action.label}
                          <span className="ml-auto text-xs text-muted-foreground max-w-[120px] overflow-hidden text-ellipsis">
                            {truncateRef(action.ref)}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {primaryRight && (
                  <button
                    key={primaryRight.id}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-muted/60 hover:bg-muted text-foreground text-sm font-medium transition-all hover:scale-105 active:scale-95 whitespace-nowrap max-w-[200px] overflow-hidden"
                    onClick={() => handleQuickAction(primaryRight)}
                    disabled={composerDisabled || primaryRight.disabled}
                    title={primaryRight.disabledReason || primaryRight.ref}
                  >
                    <span>Объясни</span>
                    <kbd className="font-mono text-[10px] opacity-70 ml-1 max-w-[90px] overflow-hidden text-ellipsis">
                      {truncateRef(primaryRight.ref)}
                    </kbd>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="relative px-5 pt-2">
            <Textarea
              ref={textareaRef}
              value={text}
              autoFocus={autoFocus}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={
                discussionFocusRef ? LOCALE.placeholder.withFocus : LOCALE.placeholder.default
              }
              disabled={composerDisabled}
              className="composer-textarea min-h-12 max-h-40 px-5 py-4 border-0 bg-transparent resize-none text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 rounded-2xl"
              style={{ lineHeight: '1.5' }}
            />

            {isRecording && (
              <div className="absolute inset-0 rounded-2xl bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  {LOCALE.recording.label} {formatRecordingTime(recordingTime)}
                </div>
                <div className="flex items-end gap-1 h-8">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span
                      key={index}
                      className="w-1.5 rounded-full bg-destructive/70 animate-pulse"
                      style={{
                        animationDelay: `${index * 120}ms`,
                        height: `${12 + (index % 3) * 6}px`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelRecording}
                    aria-label={LOCALE.recording.cancel}
                  >
                    <X className="h-4 w-4 mr-1" />
                    {LOCALE.recording.cancel}
                  </Button>
                  <Button size="sm" onClick={finishRecording} aria-label={LOCALE.recording.send}>
                    <Send className="h-4 w-4 mr-1" />
                    {LOCALE.recording.send}
                  </Button>
                </div>
              </div>
            )}

            {isTranscribing && (
              <div className="absolute inset-0 rounded-2xl bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{LOCALE.status.processing}</p>
              </div>
            )}
          </div>

          <div className="px-4 pb-3 flex items-center gap-3">
            <div className="flex items-center gap-1 sm:gap-2 flex-1">
              <Button
                size="icon"
                variant="ghost"
                className={`w-9 h-9 rounded-full hover:bg-accent/60 ${isRecording ? 'bg-destructive/10 text-destructive animate-pulse' : ''}`}
                disabled={disabled || pending || isTranscribing}
                onClick={() => {
                  if (isRecording) {
                    finishRecording();
                  } else {
                    void startRecording();
                  }
                }}
                title={LOCALE.recording.buttonTitle}
                aria-label={LOCALE.recording.buttonAriaLabel}
                aria-pressed={isRecording}
              >
                <Mic className="h-5 w-5" />
              </Button>

              <div className="hidden sm:block">
                <PersonaSelector
                  currentPersona={currentPersona}
                  personas={availablePersonas}
                  onSelect={onPersonaChange}
                  disabled={composerDisabled}
                />
              </div>

              <Button
                size="icon"
                variant={hebrewKeyboard ? 'default' : 'ghost'}
                className="w-10 h-10 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground"
                disabled={composerDisabled}
                onClick={toggleHebrewKeyboard}
                title="Переключить ивритскую клавиатуру"
                aria-label="Переключить ивритскую клавиатуру"
              >
                <Keyboard className="h-5 w-5" />
              </Button>
            </div>
            <Button
              size="icon"
              className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform duration-150 ease-out hover:scale-105 active:scale-95 disabled:opacity-60"
              onClick={send}
              disabled={composerDisabled || !text.trim()}
              title="Отправить (Enter)"
              aria-label="Отправить сообщение"
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div className="px-2 pt-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/60 text-foreground text-xs px-3 py-1 shadow-sm animate-in fade-in slide-in-from-bottom-1">
              {statusMessage}
            </div>
          </div>
        )}

        <div
          className={`mt-3 overflow-hidden transition-all duration-300 transform ${
            hebrewKeyboard ? 'max-h-64 translate-y-0' : 'max-h-0 translate-y-4'
          }`}
        >
          {hebrewKeyboard && (
            <div className="p-4 bg-card rounded-2xl shadow-sm border border-border/40">
              <div className="space-y-2">
                {hebrewKeys.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex gap-1 justify-center">
                    {row.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="min-w-8 h-8 p-0 text-sm"
                        onClick={() => insertHebrewChar(key)}
                        disabled={composerDisabled}
                      >
                        {key === 'Backspace' ? '⌫' : key}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
  );
}
