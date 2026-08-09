import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PlayerHoliday } from '../types';
import { supabase } from '../lib/supabase';

interface HolidayContextType {
  holidays: PlayerHoliday[];
  loading: boolean;
  setupMessage: string | null;
  addHoliday: (playerId: string, startDate: string, endDate: string, note?: string) => Promise<boolean>;
  deleteHoliday: (id: string) => Promise<boolean>;
  getPlayerHolidays: (playerId: string) => PlayerHoliday[];
}

const HolidayContext = createContext<HolidayContextType | undefined>(undefined);

function isHolidayTableMissing(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || '';
  return error?.code === 'PGRST116' || message.includes('player_holidays') || message.includes('relation') || message.includes('does not exist');
}

function normalizeHoliday(item: any): PlayerHoliday {
  return {
    id: item.id,
    playerId: item.player_id,
    startDate: item.start_date,
    endDate: item.end_date,
    note: item.note,
    createdAt: item.created_at
  };
}

export function HolidayProvider({ children }: { children: React.ReactNode }) {
  const [holidays, setHolidays] = useState<PlayerHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadHolidays = async () => {
      setLoading(true);

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('player_holidays')
            .select('*')
            .order('start_date', { ascending: true });

          if (error) {
            console.error('Error loading holidays:', error);
            if (isHolidayTableMissing(error)) {
              setSetupMessage('Holiday tracking needs the `player_holidays` table to be added in Supabase before shared holidays can be saved.');
            }
          } else if (data) {
            setHolidays(data.map(normalizeHoliday));
            setSetupMessage(null);
          }
        } catch (error) {
          console.error('Unexpected error loading holidays:', error);
        }
      } else {
        const raw = localStorage.getItem('cortapp_holidays');
        if (raw) {
          try {
            setHolidays(JSON.parse(raw));
          } catch {
            // Ignore invalid local data
          }
        }
      }

      setLoading(false);
    };

    loadHolidays();
  }, []);

  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('cortapp_holidays', JSON.stringify(holidays));
    }
  }, [holidays]);

  const addHoliday = async (playerId: string, startDate: string, endDate: string, note?: string) => {
    const trimmedNote = note?.trim() || undefined;

    if (supabase) {
      const { data, error } = await supabase
        .from('player_holidays')
        .insert([{
          player_id: playerId,
          start_date: startDate,
          end_date: endDate,
          note: trimmedNote
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding holiday:', error);
        if (isHolidayTableMissing(error)) {
          setSetupMessage('Holiday tracking needs the `player_holidays` table to be added in Supabase before shared holidays can be saved.');
        }
        return false;
      }

      if (data) {
        setHolidays(prev => [...prev, normalizeHoliday(data)].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      }
      return true;
    }

    const localHoliday: PlayerHoliday = {
      id: `holiday-${Date.now()}`,
      playerId,
      startDate,
      endDate,
      note: trimmedNote,
      createdAt: new Date().toISOString()
    };
    setHolidays(prev => [...prev, localHoliday].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    return true;
  };

  const deleteHoliday = async (id: string) => {
    if (supabase) {
      const { error } = await supabase.from('player_holidays').delete().eq('id', id);
      if (error) {
        console.error('Error deleting holiday:', error);
        if (isHolidayTableMissing(error)) {
          setSetupMessage('Holiday tracking needs the `player_holidays` table to be added in Supabase before shared holidays can be saved.');
        }
        return false;
      }
    }

    setHolidays(prev => prev.filter(holiday => holiday.id !== id));
    return true;
  };

  const getPlayerHolidays = (playerId: string) => {
    return holidays
      .filter(holiday => holiday.playerId === playerId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  };

  const value = useMemo(() => ({
    holidays,
    loading,
    setupMessage,
    addHoliday,
    deleteHoliday,
    getPlayerHolidays
  }), [holidays, loading, setupMessage]);

  return <HolidayContext.Provider value={value}>{children}</HolidayContext.Provider>;
}

export function useHolidays() {
  const context = useContext(HolidayContext);
  if (!context) throw new Error('useHolidays must be used within a HolidayProvider');
  return context;
}
