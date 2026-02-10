import React, { createContext, useContext, useEffect, useState } from 'react';
import { PlayerAvailability } from '../types';
import { supabase } from '../lib/supabase';

interface AvailabilityContextType {
  availability: PlayerAvailability[];
  updateAvailability: (playerId: string, weekStartDate: string, isAvailable: boolean, daysAvailable: string[], note?: string) => Promise<void>;
  getAvailability: (playerId: string, weekStartDate: string) => PlayerAvailability | undefined;
  loading: boolean;
}

const AvailabilityContext = createContext<AvailabilityContextType | undefined>(undefined);

export function AvailabilityProvider({ children }: { children: React.ReactNode }) {
  const [availability, setAvailability] = useState<PlayerAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  // Load availability
  useEffect(() => {
    const loadAvailability = async () => {
      setLoading(true);
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('player_availability')
            .select('*');
            
          if (error) {
            console.error('Error loading availability:', error);
          } else if (data) {
            // Map DB columns to TS interface
            const mapped: PlayerAvailability[] = data.map(item => ({
                id: item.id,
                playerId: item.player_id,
                weekStartDate: item.week_start_date,
                isAvailable: item.is_available,
                daysAvailable: item.days_available || [],
                note: item.note,
                updatedAt: item.updated_at
            }));
            setAvailability(mapped);
          }
        } catch (err) {
            console.error(err);
        }
      } else {
        // Mock Mode
        const raw = localStorage.getItem('cortapp_availability');
        if (raw) {
            try {
                setAvailability(JSON.parse(raw));
            } catch {}
        }
      }
      setLoading(false);
    };

    loadAvailability();
  }, []);

  // Sync to local storage for mock mode
  useEffect(() => {
    if (!supabase) {
        localStorage.setItem('cortapp_availability', JSON.stringify(availability));
    }
  }, [availability]);

  const updateAvailability = async (playerId: string, weekStartDate: string, isAvailable: boolean, daysAvailable: string[], note?: string) => {
    const now = new Date().toISOString();
    
    // Optimistic Update
    setAvailability(prev => {
        const filtered = prev.filter(a => !(a.playerId === playerId && a.weekStartDate === weekStartDate));
        return [...filtered, { playerId, weekStartDate, isAvailable, daysAvailable, note, updatedAt: now }];
    });

    if (supabase) {
        // Upsert
        const { error } = await supabase
            .from('player_availability')
            .upsert({
                player_id: playerId,
                week_start_date: weekStartDate,
                is_available: isAvailable,
                days_available: daysAvailable,
                note: note,
                updated_at: now
            }, { onConflict: 'player_id, week_start_date' });
            
        if (error) {
            console.error('Error updating availability:', error);
            // TODO: Revert optimistic update?
        }
    }
  };

  const getAvailability = (playerId: string, weekStartDate: string) => {
    return availability.find(a => a.playerId === playerId && a.weekStartDate === weekStartDate);
  };

  return (
    <AvailabilityContext.Provider value={{ availability, updateAvailability, getAvailability, loading }}>
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailability() {
  const ctx = useContext(AvailabilityContext);
  if (!ctx) throw new Error('useAvailability must be used within AvailabilityProvider');
  return ctx;
}
