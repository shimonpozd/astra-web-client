import React from 'react';
import { MarkdownRenderer } from './chat/MarkdownRenderer';
import { coerceText } from '../lib/text/normalize';
import { useSpeechify } from '../hooks/useSpeechify';
import { useTTS } from '../hooks/useTTS';
import { Volume2 } from 'lucide-react';

/**
 * UnifiedMessageRenderer - renders messages with modern AST MarkdownRenderer
 * and supports TTS speech generation.
 */
export default function UnifiedMessageRenderer({ input }: { input: unknown }) {
  const { speechify, isLoading: isSpeechifying } = useSpeechify();
  const tts = useTTS({});

  const rawTextForSpeech = coerceText(input);
  const handleSpeechify = async () => {
    try {
      const speechText = await speechify({ text: rawTextForSpeech });
      await tts.play(speechText, { language: 'en' });
    } catch (e) {
      console.error('Speechify (chat) failed', e);
    }
  };

  return (
    <div className="group">
      <MarkdownRenderer content={input} />
      {rawTextForSpeech ? (
        <div className="flex justify-end mt-1 opacity-70 hover:opacity-100 transition-opacity">
          <button
            onClick={handleSpeechify}
            disabled={isSpeechifying}
            className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs"
            title="Озвучить сообщение"
            aria-label="Озвучить сообщение"
          >
            <span className="inline-flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Слушать
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
