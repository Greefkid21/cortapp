import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SeasonArchive, Player, Match } from '../types';
import { supabase } from '../lib/supabase';

interface SeasonContextType {
  currentSeasonName: string;
  currentSeasonStart: string;
  currentSeasonId: string | null;
  archives: SeasonArchive[];
  archiveAndStart: (newSeasonName: string, playersSnapshot: Player[], matchesSnapshot: Match[]) => Promise<void>;
  deleteArchive: (id: string) => Promise<void>;
  loading: boolean;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [currentSeasonName, setCurrentSeasonName] = useState<string>('Season 1');
  const [currentSeasonStart, setCurrentSeasonStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [archives, setArchives] = useState<SeasonArchive[]>([]);
  const [loading, setLoading] = useState(true);

  // Load seasons
  useEffect(() => {
    const loadSeasons = async () => {
      if (supabase) {
        try {
          // 1. Get current active season
          const { data: activeSeason } = await supabase
            .from('seasons')
            .select('*')
            .eq('is_active', true)
            .single();

          if (activeSeason) {
            setCurrentSeasonName(activeSeason.name);
            setCurrentSeasonStart(activeSeason.start_date);
            setCurrentSeasonId(activeSeason.id);
          } else {
            // No active season? Create one if none exists?
            // Or maybe this is the first run.
            // For now, let's assume if none, we rely on default or create one.
          }

          // 2. Get archives (inactive seasons)
          const { data: pastSeasons } = await supabase
            .from('seasons')
            .select('*')
            .eq('is_active', false)
            .order('end_date', { ascending: false });

          if (pastSeasons) {
            const mappedArchives: SeasonArchive[] = pastSeasons.map(s => ({
              id: s.id,
              name: s.name,
              startDate: s.start_date,
              endDate: s.end_date,
              players: s.final_standings?.players || [], // Assuming we store { players: [], matches: [] } in jsonb
              matches: s.final_standings?.matches || []
            }));
            setArchives(mappedArchives);
          }

        } catch (error) {
          console.error('Error loading seasons:', error);
        }
      } else {
        // Mock Mode
        const raw = localStorage.getItem('cortapp_seasons');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              setCurrentSeasonName(parsed.currentSeasonName || 'Season 1');
              setCurrentSeasonStart(parsed.currentSeasonStart || new Date().toISOString().split('T')[0]);
              setArchives(parsed.archives || []);
            }
          } catch {}
        }
      }
      setLoading(false);
    };

    loadSeasons();
  }, []);

  // Sync to local storage for mock mode
  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('cortapp_seasons', JSON.stringify({
        currentSeasonName,
        currentSeasonStart,
        archives
      }));
    }
  }, [currentSeasonName, currentSeasonStart, archives]);

  const archiveAndStart = async (newSeasonName: string, playersSnapshot: Player[], matchesSnapshot: Match[]) => {
    if (supabase) {
      const now = new Date().toISOString().split('T')[0];

      // 1. Archive current season
      if (currentSeasonId) {
        const { error } = await supabase
          .from('seasons')
          .update({
            is_active: false,
            end_date: now,
            final_standings: {
              players: playersSnapshot,
              matches: matchesSnapshot // Optional: might be too big, but fine for small league
            }
          })
          .eq('id', currentSeasonId);
          
        if (error) console.error('Error archiving season:', error);
      } else {
        // If no ID (first run?), create an archived record for the implicit previous season?
        // Or just proceed.
      }

      // 2. Create new season
      const { data: newSeason, error: createError } = await supabase
        .from('seasons')
        .insert([{
          name: newSeasonName,
          start_date: now,
          is_active: true
        }])
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating new season:', createError);
        return;
      }

      // 3. Reset Players Stats (This is tricky, App.tsx manages state, but we need to update DB)
      // We will assume App.tsx calls this, and then App.tsx ALSO calls `resetStats()` which updates the DB.
      // But `archiveAndStart` here is responsible for the Season entity.
      
      // Update local state
      if (newSeason) {
        setCurrentSeasonName(newSeason.name);
        setCurrentSeasonStart(newSeason.start_date);
        setCurrentSeasonId(newSeason.id);
        
        // Add to archives list
        const newArchive: SeasonArchive = {
          id: currentSeasonId || 'temp-id',
          name: currentSeasonName,
          startDate: currentSeasonStart,
          endDate: now,
          players: playersSnapshot,
          matches: matchesSnapshot
        };
        setArchives(prev => [newArchive, ...prev]);
      }

    } else {
      // Mock Mode
      const archive: SeasonArchive = {
        id: Math.random().toString(36).slice(2),
        name: currentSeasonName,
        startDate: currentSeasonStart,
        endDate: new Date().toISOString().split('T')[0],
        players: playersSnapshot,
        matches: matchesSnapshot,
      };
      setArchives(prev => [archive, ...prev]);
      setCurrentSeasonName(newSeasonName);
      setCurrentSeasonStart(new Date().toISOString().split('T')[0]);
    }
  };

  const deleteArchive = async (id: string) => {
    if (supabase) {
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting archived season:', error);
        return;
      }
    }
    
    // Update local state (works for both supabase and mock)
    setArchives(prev => prev.filter(a => a.id !== id));
  };

  const value = useMemo(() => ({
    currentSeasonName,
    currentSeasonStart,
    currentSeasonId,
    archives,
    archiveAndStart,
    deleteArchive,
    loading
  }), [currentSeasonName, currentSeasonStart, currentSeasonId, archives, loading]);

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeason must be used within a SeasonProvider');
  return ctx;
}
