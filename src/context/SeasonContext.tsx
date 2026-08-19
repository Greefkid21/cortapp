import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SeasonArchive, Player, Match, Season } from '../types';
import { supabase } from '../lib/supabase';

interface SeasonContextType {
  currentSeasonName: string;
  currentSeasonStart: string;
  currentSeasonId: string | null;
  currentSeasonDivisionCount: number;
  archives: SeasonArchive[];
  archiveAndStart: (newSeasonName: string, playersSnapshot: Player[], matchesSnapshot: Match[], divisionCount: number) => Promise<{ ok: boolean; error?: string }>;
  deleteArchive: (id: string) => Promise<void>;
  createDraftSeason: (name: string, divisionCount?: number) => Promise<string | null>;
  getDraftSeason: () => Promise<Season | null>;
  updateDraftSeason: (id: string, data: Partial<Season>) => Promise<{ ok: boolean; error?: string }>;
  loading: boolean;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [currentSeasonName, setCurrentSeasonName] = useState<string>('Season 1');
  const [currentSeasonStart, setCurrentSeasonStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [currentSeasonDivisionCount, setCurrentSeasonDivisionCount] = useState<number>(2);
  const [archives, setArchives] = useState<SeasonArchive[]>([]);
  const [loading, setLoading] = useState(true);

  const getDivisionCountFromSeason = (season: { final_standings?: Season['final_standings'] } | null | undefined) => {
    const raw = Number(season?.final_standings?.meta?.divisionCount ?? 2);
    if (!Number.isFinite(raw) || raw < 1) return 2;
    return Math.floor(raw);
  };

  const isMissingDraftColumnError = (error: { message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('is_draft') && (message.includes('column') || message.includes('schema cache'));
  };

  // Load seasons
  useEffect(() => {
    const loadSeasons = async () => {
      if (supabase) {
        try {
          // 1. Get current active season
          const { data: activeSeason, error: activeSeasonError } = await supabase
            .from('seasons')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();

          if (activeSeasonError) {
            console.error('Error loading active season:', activeSeasonError);
          }

          if (activeSeason) {
            setCurrentSeasonName(activeSeason.name);
            setCurrentSeasonStart(activeSeason.start_date);
            setCurrentSeasonId(activeSeason.id);
            setCurrentSeasonDivisionCount(getDivisionCountFromSeason(activeSeason));
          } else {
            // No active season? Create one if none exists?
            // Or maybe this is the first run.
            // For now, let's assume if none, we rely on default or create one.
          }

          // 2. Get archives (inactive seasons)
          let pastSeasons: any[] | null = null;
          const archiveQuery = await supabase
            .from('seasons')
            .select('*')
            .eq('is_active', false)
            .eq('is_draft', false)
            .order('end_date', { ascending: false });

          if (archiveQuery.error && isMissingDraftColumnError(archiveQuery.error)) {
            const fallbackQuery = await supabase
              .from('seasons')
              .select('*')
              .eq('is_active', false)
              .order('end_date', { ascending: false });

            if (fallbackQuery.error) {
              console.error('Error loading archived seasons:', fallbackQuery.error);
            } else {
              pastSeasons = fallbackQuery.data;
            }
          } else if (archiveQuery.error) {
            console.error('Error loading archived seasons:', archiveQuery.error);
          } else {
            pastSeasons = archiveQuery.data;
          }

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
              setCurrentSeasonDivisionCount(parsed.currentSeasonDivisionCount || 2);
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
        currentSeasonDivisionCount,
        archives
      }));
    }
  }, [currentSeasonName, currentSeasonStart, currentSeasonDivisionCount, archives]);

  const archiveAndStart = async (newSeasonName: string, playersSnapshot: Player[], matchesSnapshot: Match[], divisionCount: number) => {
    const safeDivisionCount = Number.isFinite(divisionCount) && divisionCount > 0 ? Math.floor(divisionCount) : 1;

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
              matches: matchesSnapshot,
              meta: {
                divisionCount: currentSeasonDivisionCount
              }
            }
          })
          .eq('id', currentSeasonId);
          
        if (error) {
          console.error('Error archiving season:', error);
          return { ok: false, error: error.message };
        }
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
          is_active: true,
          is_draft: false,
          final_standings: {
            meta: {
              divisionCount: safeDivisionCount
            }
          }
        }])
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating new season:', createError);
        return { ok: false, error: createError.message };
      }

      // 3. Reset Players Stats (This is tricky, App.tsx manages state, but we need to update DB)
      // We will assume App.tsx calls this, and then App.tsx ALSO calls `resetStats()` which updates the DB.
      // But `archiveAndStart` here is responsible for the Season entity.
      
      // Update local state
      if (newSeason) {
        setCurrentSeasonName(newSeason.name);
        setCurrentSeasonStart(newSeason.start_date);
        setCurrentSeasonId(newSeason.id);
        setCurrentSeasonDivisionCount(safeDivisionCount);
        
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

      return { ok: true };

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
      setCurrentSeasonDivisionCount(safeDivisionCount);
      return { ok: true };
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

  const createDraftSeason = async (name: string, divisionCount: number = currentSeasonDivisionCount): Promise<string | null> => {
    const safeDivisionCount = Number.isFinite(divisionCount) && divisionCount > 0 ? Math.floor(divisionCount) : 1;

    if (supabase) {
      const { data, error } = await supabase
        .from('seasons')
        .insert([{
          name,
          start_date: new Date().toISOString().split('T')[0],
          is_active: false,
          is_draft: true,
          final_standings: {
            meta: {
              divisionCount: safeDivisionCount
            }
          }
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating draft season:', error);
        return null;
      }
      return data.id;
    }
    return 'draft-id';
  };

  const getDraftSeason = async (): Promise<Season | null> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_draft', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        if (!isMissingDraftColumnError(error)) {
          console.error('Error fetching draft season:', error);
        }
        return null;
      }
      if (data) {
        return {
          id: data.id,
          name: data.name,
          start_date: data.start_date,
          is_active: data.is_active,
          is_draft: data.is_draft,
          final_standings: data.final_standings
        };
      }
    }
    return null;
  };

  const updateDraftSeason = async (id: string, data: Partial<Season>) => {
    if (supabase) {
      const { error } = await supabase
        .from('seasons')
        .update({
          name: data.name,
          final_standings: data.final_standings
        })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating draft season:', error);
        return { ok: false, error: error.message };
      }
    }
    return { ok: true };
  };

  const value = useMemo(() => ({
    currentSeasonName,
    currentSeasonStart,
    currentSeasonId,
    currentSeasonDivisionCount,
    archives,
    archiveAndStart,
    deleteArchive,
    createDraftSeason,
    getDraftSeason,
    updateDraftSeason,
    loading
  }), [currentSeasonName, currentSeasonStart, currentSeasonId, currentSeasonDivisionCount, archives, loading]);

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeason must be used within a SeasonProvider');
  return ctx;
}
