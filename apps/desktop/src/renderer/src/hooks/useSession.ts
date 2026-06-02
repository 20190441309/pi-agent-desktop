// useSession Hook - Session management utilities
// v1.0.9: formatTimestamp 走 utils/format.formatRelative 统一入口

import { useCallback } from 'react';
import { useSessionStore, Session, Message } from '../stores/session-store';
import { formatRelative } from '../utils/format';

interface UseSessionReturn {
  sessions: Session[];
  currentSession: Session | null;
  currentSessionId: string | null;
  createSession: () => Session;
  deleteSession: (sessionId: string) => void;
  switchSession: (sessionId: string) => void;
  addMessage: (message: Message) => void;
  getSessionTitle: (session: Session) => string;
  formatTimestamp: (date: Date) => string;
}

export function useSession(): UseSessionReturn {
  const {
    sessions,
    currentSessionId,
    createSession: storeCreateSession,
    deleteSession,
    setCurrentSession,
    addMessage: storeAddMessage,
    getCurrentSession
  } = useSessionStore();
  
  const currentSession = getCurrentSession();
  

  const createSession = useCallback(() => {
    return storeCreateSession('default');
  }, [storeCreateSession]);
  
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSession(sessionId);
  }, [setCurrentSession]);
  
  const addMessage = useCallback((message: Message) => {
    if (currentSessionId) {
      storeAddMessage(currentSessionId, message);
    }
  }, [currentSessionId, storeAddMessage]);
  
  const getSessionTitle = useCallback((session: Session) => {
    if (session.messages.length > 0) {
      const firstUserMessage = session.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        const title = firstUserMessage.content.substring(0, 30);
        return title.length < firstUserMessage.content.length ? title + '...' : title;
      }
    }
    return session.title;
  }, []);

  // v1.0.9: 走 utils/format.formatRelative, 接受 Date / number / string 任意时间值
  // (注: 此函数目前返中文格式 "刚刚/分钟前", 因为不在 t() 抽取范围 — v1.0.10 收)
  const formatTimestamp = useCallback((date: Date) => {
    return formatRelative(date);
  }, []);

  return {
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    deleteSession,
    switchSession,
    addMessage,
    getSessionTitle,
    formatTimestamp
  };
}