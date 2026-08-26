// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { ChatRequest, Message as MessageType, StreamHandler } from '../../types';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2, AlertCircle, MessageSquare, ArrowLeft } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface BrainChatWithBlocksProps {
  persona: string;
  sessionId?: string;
  onPersonaChange?: (persona: string) => void;
  personas?: Array<{ id: string; name: string; description: string }>;
  onBack?: () => void;
}

export default function BrainChatWithBlocks({
  persona,
  sessionId,
  onPersonaChange,
  personas = [],
  onBack
}: BrainChatWithBlocksProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, streamingText]);

  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: MessageType = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsStreaming(true);
    setStreamingText('');
    setConnectionError(null);

    const request: ChatRequest = {
      text: currentInput,
      session_id: sessionId || crypto.randomUUID(),
      agent_id: persona
    };

    let accumulatedText = '';

    const streamHandler: StreamHandler = {
      onChunk: (chunk: string) => {
        accumulatedText += chunk;
        setStreamingText(accumulatedText);
      },

      onDoc: (doc: any) => {
        setStreamingText(typeof doc === 'string' ? doc : JSON.stringify(doc));
      },

      onComplete: () => {
        setIsStreaming(false);
        if (accumulatedText) {
          const assistantMessage: MessageType = {
            id: Date.now() + 1,
            role: 'assistant',
            content: accumulatedText,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        setStreamingText('');
      },

      onError: (error: Error) => {
        console.error('Stream error:', error);
        setIsStreaming(false);
        setStreamingText('');
        setConnectionError(error.message);
      }
    };

    try {
      await api.sendMessage(request, streamHandler);
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setStreamingText('');
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <CardTitle className="text-lg">Новый чат</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {personas.length > 0 && (
                <select
                  value={persona}
                  onChange={(e) => onPersonaChange?.(e.target.value)}
                  className="px-3 py-1 border rounded-md bg-background"
                >
                  {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap">
                      {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                    </div>
                  ) : (
                    <MarkdownRenderer content={message.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                  <MarkdownRenderer content={streamingText} />
                  {isStreaming && (
                    <div className="streaming-cursor animate-pulse mt-2">
                      <span className="text-gray-400">▋</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {connectionError && (
              <div className="flex justify-center">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{connectionError}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите сообщение..."
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isStreaming}
              className="self-end"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
