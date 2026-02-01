import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppUser } from '../types';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  matchId: string;
  senderUserId: string;
  senderName?: string;
  text: string;
  timestamp: number;
}

interface ChatContextType {
  messages: ChatMessage[];
  getThread: (matchId: string) => ChatMessage[];
  sendMessage: (matchId: string, text: string, sender: AppUser) => Promise<void>;
  loading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      if (supabase) {
        try {
          const { data } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true });
            
          if (data) {
            const mappedMessages: ChatMessage[] = data.map(m => ({
              id: m.id,
              matchId: m.match_id,
              senderUserId: m.sender_user_id,
              senderName: m.sender_name,
              text: m.text,
              timestamp: new Date(m.created_at).getTime()
            }));
            setMessages(mappedMessages);
            
            // Subscribe to new messages
            const subscription = supabase
              .channel('public:messages')
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const newMsg = payload.new;
                const mapped: ChatMessage = {
                  id: newMsg.id,
                  matchId: newMsg.match_id,
                  senderUserId: newMsg.sender_user_id,
                  senderName: newMsg.sender_name,
                  text: newMsg.text,
                  timestamp: new Date(newMsg.created_at).getTime()
                };
                setMessages(prev => [...prev, mapped]);
              })
              .subscribe();
              
            return () => {
              supabase?.removeChannel(subscription);
            };
          }
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      } else {
        // Mock Mode
        const raw = localStorage.getItem('cortapp_chat');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setMessages(parsed);
          } catch {}
        }
      }
      setLoading(false);
    };

    loadMessages();
  }, []);

  // Sync to local storage for mock mode
  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('cortapp_chat', JSON.stringify(messages));
    }
  }, [messages]);

  const getThread = (matchId: string) =>
    messages.filter(m => m.matchId === matchId).sort((a, b) => a.timestamp - b.timestamp);

  const sendMessage = async (matchId: string, text: string, sender: AppUser) => {
    if (supabase) {
      const { error } = await supabase
        .from('messages')
        .insert([{
          match_id: matchId,
          sender_user_id: sender.id,
          sender_name: sender.name,
          text
        }]);
        
      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }
      
      // Optimistic update
      const optimisticMsg: ChatMessage = {
        id: 'temp-' + Date.now(),
        matchId,
        senderUserId: sender.id,
        senderName: sender.name,
        text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, optimisticMsg]);
    } else {
      const msg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        matchId,
        senderUserId: sender.id,
        senderName: sender.name,
        text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
    }
  };

  const value = useMemo(() => ({ messages, getThread, sendMessage, loading }), [messages, loading]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
