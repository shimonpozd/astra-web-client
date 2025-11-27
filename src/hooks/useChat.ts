import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Chat, Message, ChatRequest, VirtualDailyChat } from '../services/api';

import { debugLog } from '../utils/debugLogger';
import { emitGamificationEvent } from '../contexts/GamificationContext';
import { calcTextXp, docToPlainText } from '../utils/xpUtils';
function generateId(): string {
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    // Align with UUID v4 layout
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hexParts = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return [
      hexParts.slice(0, 4).join(''),
      hexParts.slice(4, 6).join(''),
      hexParts.slice(6, 8).join(''),
      hexParts.slice(8, 10).join(''),
      hexParts.slice(10, 16).join(''),
    ].join('-');
  }

  const randomSuffix = Math.random().toString(16).slice(2);
  return `fallback-${Date.now().toString(16)}-${randomSuffix}`;
}

function mapVirtualDailyChat(item: VirtualDailyChat): Chat {
  const displayValue = item.display_value || '';
  return {
    session_id: item.session_id,
    name: item.title_ru || item.title,
    last_modified: item.date,
    type: 'daily',
    completed: item.exists ?? false,
    stale: false,
    display_value: displayValue,
    display_value_he: item.he_display_value,
    display_value_ru: item.display_value_ru || displayValue,
    daily_category: item.category,
    daily_stream: item.stream
      ? {
          stream_id: item.stream.stream_id,
          units_total: item.stream.units_total,
          unit_index_today: item.stream.unit_index_today,
        }
      : undefined,
  };
}

function dateFromDailySessionId(sessionId: string): number | null {
  if (!sessionId.startsWith('daily-')) return null;
  const parts = sessionId.split('-');
  if (parts.length < 3) return null;
  const datePart = parts[1];
  const time = Date.parse(datePart);
  return Number.isNaN(time) ? null : time;
}

export function useChat(agentId: string = 'default', initialChatId?: string | null) {
  const navigate = useNavigate();
  // State for chat list
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for selected chat and its messages
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load initial chat list including daily chats
  useEffect(() => {
    async function loadChats() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load regular chats and daily virtual chats in parallel
        const [sessionList, dailyCalendar] = await Promise.all([
          api.getChatList(),
          api.getDailyCalendar()
        ]);
        
        debugLog('Daily calendar loaded:', dailyCalendar);

        const existingIds = new Set(sessionList.map(item => item.session_id));
        
        // Convert daily calendar to Chat format
        const dailyChats: Chat[] = dailyCalendar
          .filter(item => !existingIds.has(item.session_id))
          .map(mapVirtualDailyChat);
        
        debugLog('Daily chats created:', dailyChats);
        
        // Combine and sort (daily chats first, then by last_modified)
      const allChats = [...dailyChats, ...sessionList].sort((a, b) => {
        // Daily chats always come first
        if (a.type === 'daily' && b.type !== 'daily') return -1;
        if (a.type !== 'daily' && b.type === 'daily') return 1;
        if (a.type === 'daily' && b.type === 'daily') {
          const aStale = a.stale ? 1 : 0;
          const bStale = b.stale ? 1 : 0;
          if (aStale !== bStale) return aStale - bStale; // fresh above stale
          const aDate = dateFromDailySessionId(a.session_id);
          const bDate = dateFromDailySessionId(b.session_id);
          if (aDate && bDate && aDate !== bDate) {
            return bDate - aDate; // newer date first
          }
        }
        // Within same type, sort by last_modified (newest first)
        return new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime();
      });
        
        setChats(allChats);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadChats();
  }, []); // Runs once on mount

  // Load messages when a chat is selected
  useEffect(() => {
    if (!selectedChatId || window.location.pathname.startsWith('/study')) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        setIsLoadingMessages(true);
        const messageList = await api.getChatHistory(selectedChatId!);
        setMessages(messageList);
      } catch (e) {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    loadMessages();
  }, [selectedChatId]);

  const selectChat = useCallback((id: string) => {
    setSelectedChatId(id);
    navigate(`/chat/${id}`);
  }, [navigate]);

  const createChat = useCallback(() => {
    const newId = generateId();
    const newChat: Chat = {
      session_id: newId,
      name: "Новый чат",
      last_modified: new Date().toISOString(),
      type: 'chat',
    };
    setChats((prev) => [newChat, ...prev]);
    selectChat(newId);
  }, [selectChat]);

  const deleteChat = useCallback(async (sessionId: string) => {
    try {
      await api.deleteChat(sessionId);
      setChats((prev) => prev.filter((chat) => chat.session_id !== sessionId));
      if (selectedChatId === sessionId) {
        navigate('/');
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      setError('Failed to delete chat. Please try again.');
    }
  }, [navigate, selectedChatId]);

  const deleteSession = useCallback(async (sessionId: string, sessionType: 'chat' | 'study' | 'daily') => {
    try {
      await api.deleteSession(sessionId, sessionType);
      setChats((prev) => prev.filter((chat) => chat.session_id !== sessionId));
      if (selectedChatId === sessionId) {
        navigate('/');
      }
    } catch (error) {
      console.error(`Failed to delete ${sessionType} session:`, error);
      setError(`Failed to delete ${sessionType} session. Please try again.`);
    }
  }, [navigate, selectedChatId]);

  const completeDailySession = useCallback(async (sessionId: string, completed: boolean) => {
    try {
      // Ensure session exists before marking complete
      try {
        await api.createDailySessionLazy(sessionId);
      } catch (e) {
        // best-effort; if it fails we still try to mark
      }
      const result = await api.markDailyComplete(sessionId, completed);
      setChats((prev) =>
        prev.map((chat) =>
          chat.session_id === sessionId ? { ...chat, completed } : chat
        )
      );
      return result;
    } catch (error) {
      console.error("Failed to mark daily session complete:", error);
      setError('Не удалось отметить урок завершенным.');
      throw error;
    }
  }, []);

  const reloadChats = useCallback(async () => {
    try {
      debugLog('Reloading chats from API...');
      setIsLoading(true);
      setError(null);
      const [sessionList, dailyCalendar] = await Promise.all([
        api.getChatList(),
        api.getDailyCalendar(),
      ]);
      const existingIds = new Set(sessionList.map((item) => item.session_id));
      const dailyChats: Chat[] = dailyCalendar
        .filter((item) => !existingIds.has(item.session_id))
        .map(mapVirtualDailyChat);
      const allChats = [...dailyChats, ...sessionList].sort((a, b) => {
        if (a.type === 'daily' && b.type !== 'daily') return -1;
        if (a.type !== 'daily' && b.type === 'daily') return 1;
        return new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime();
      });
      debugLog('API returned sessions:', allChats);
      setChats(allChats);
      debugLog('Chats state updated');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error('❌ Failed to reload chats:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, context?: 'focus' | 'workbench-left' | 'workbench-right' | null) => {
    if (!selectedChatId) return;

    setIsSending(true);

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      content_type: 'text.v1',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      content_type: 'text.v1',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    const request: ChatRequest = {
      text,
      session_id: selectedChatId!,
      agent_id: agentId,
      context: context || undefined,
    };

    let assistantText = '';
    let assistantDoc: any = null;

    // XP за вопрос
    const askAmount = calcTextXp(text);
    if (askAmount > 0) {
      emitGamificationEvent({
        amount: askAmount,
        source: 'chat',
        verb: 'ask',
        label: `Вопрос · ${text.length} симв.`,
        meta: {
          session_id: selectedChatId,
          chars: text.length,
          event_id: ['chat', 'ask', selectedChatId || '', Math.ceil(Date.now() / 5000)].join('|'),
        },
      });
    }

    await api.sendMessage(request, {
      onChunk: (chunk) => {
        assistantText += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `${typeof msg.content === 'string' ? msg.content : ''}${chunk}`,
                  content_type: 'text.v1'
                }
              : msg
          )
        );
      },
      onDoc: (doc) => {
        assistantDoc = doc;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: doc, content_type: 'doc.v1' }
              : msg
          )
        );
      },
      onComplete: () => {
        setIsSending(false);
        const replyText = assistantDoc ? docToPlainText(assistantDoc) : assistantText;
        const amount = calcTextXp(replyText);
        if (amount > 0) {
          emitGamificationEvent({
            amount,
            source: 'chat',
            verb: 'reply',
            label: `Ответ · ${replyText.length} симв.`,
            meta: {
              session_id: selectedChatId,
              chars: replyText.length,
              event_id: ['chat', 'reply', selectedChatId || '', Math.ceil(Date.now() / 5000)].join('|'),
            },
          });
        }
      },
      onError: (error) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${error.message}`, content_type: 'text.v1' }
              : msg
          )
        );
        setIsSending(false);
      },
    });

  }, [agentId, selectedChatId]);

  return {
    chats,
    isLoading,
    error,
    messages,
    isLoadingMessages,
    selectedChatId,
    selectChat,
    createChat,
    sendMessage,
    isSending,
    deleteChat,
    deleteSession,
    completeDailySession,
    reloadChats,
    setSelectedChatId,
  };
}
