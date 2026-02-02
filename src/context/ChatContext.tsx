import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppUser, Match, Player } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { sendEmailNotification, getParticipantsFromData } from '../lib/notifications';

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
  editMessage: (messageId: string, newText: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  markAsRead: (matchId: string) => void;
  getUnreadCount: (matchId: string) => number;
  loading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, users } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRead, setLastRead] = useState<Record<string, number>>({});

  // Load lastRead from local storage when user changes
  useEffect(() => {
    if (user) {
        const stored = localStorage.getItem(`cortapp_last_read_${user.id}`);
        if (stored) {
            try {
                setLastRead(JSON.parse(stored));
            } catch {}
        }
    }
  }, [user]);

  const markAsRead = (matchId: string) => {
    if (!user) return;
    const now = Date.now();
    setLastRead(prev => {
        const next = { ...prev, [matchId]: now };
        localStorage.setItem(`cortapp_last_read_${user.id}`, JSON.stringify(next));
        return next;
    });
  };

  const getUnreadCount = (matchId: string) => {
    if (!user) return 0;
    const readTime = lastRead[matchId] || 0;
    return messages.filter(m => 
        m.matchId === matchId && 
        m.timestamp > readTime && 
        m.senderUserId !== user.id
    ).length;
  };

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
            
            // Subscribe to changes
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
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
                const updated = payload.new;
                setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text } : m));
              })
              .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
                const deletedId = payload.old.id;
                setMessages(prev => prev.filter(m => m.id !== deletedId));
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

  const sendMessage = async (matchId: string, text: string, sender: AppUser, context?: { match: Match, players: Player[] }) => {
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

      // Send Email Notification
      if (context) {
          const { match, players } = context;
          const participants = getParticipantsFromData(match, players, users);
          
          // Filter out sender from recipients
          const recipientEmails = participants.emails.filter(email => email !== sender.email);
          
          if (recipientEmails.length > 0) {
              const subject = `New Message from ${sender.name}`;
              const html = `
                  <p><strong>${sender.name}</strong> sent a message in the match chat (${participants.names.join(' vs ')}):</p>
                  <blockquote style="background: #f1f5f9; padding: 10px; border-left: 4px solid #0f766e; border-radius: 4px;">${text}</blockquote>
                  <p><a href="https://cortapp.vercel.app/chat?matchId=${matchId}">Open Chat</a></p>
              `;
              sendEmailNotification(recipientEmails, subject, html);
          }
      }
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

  const editMessage = async (messageId: string, newText: string) => {
    if (supabase) {
      const { error } = await supabase
        .from('messages')
        .update({ text: newText })
        .eq('id', messageId);
      if (error) throw error;
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: newText } : m));
    } else {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: newText } : m));
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (supabase) {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const value = useMemo(() => ({ 
    messages, 
    getThread, 
    sendMessage,
    editMessage,
    deleteMessage,
    loading,
    markAsRead,
    getUnreadCount
  }), [messages, loading, lastRead, user]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
