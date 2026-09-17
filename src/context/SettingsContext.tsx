import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface LeagueSettings {
  id: number;
  league_name: string;
  logo_url?: string;
  logo_height?: number; // Height in pixels
  points_win: number;
  points_draw: number;
  points_loss: number;
}

interface SettingsContextType {
  settings: LeagueSettings;
  updateSettings: (newSettings: Partial<LeagueSettings>) => Promise<void>;
  loading: boolean;
}

const defaultSettings: LeagueSettings = {
  id: 0,
  league_name: 'cørtapp',
  points_win: 2,
  points_draw: 1,
  points_loss: 0
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: async () => {},
  loading: true
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<LeagueSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { activeWorkspace } = useAuth();

  useEffect(() => {
    fetchSettings();
  }, [activeWorkspace?.workspace.id]);

  const fetchSettings = async () => {
    if (!activeWorkspace?.workspace.id && supabase) {
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('workspace_id', activeWorkspace!.workspace.id)
          .order('id', { ascending: true })
          .limit(1);
        
        if (data && data.length > 0) {
          setSettings(data[0]);
        } else if (error) {
            console.error('Error fetching settings:', error);
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
      }
    }
    setLoading(false);
  };

  const updateSettings = async (newSettings: Partial<LeagueSettings>) => {
    if (!supabase) return;
    if (!activeWorkspace?.workspace.id) {
      throw new Error('No active workspace selected.');
    }

    try {
      const { data: existingSettings, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .eq('workspace_id', activeWorkspace.workspace.id)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const payload = {
        ...newSettings,
        workspace_id: activeWorkspace.workspace.id,
      };

      const { error } = existingSettings
        ? await supabase.from('settings').update(payload).eq('id', existingSettings.id)
        : await supabase.from('settings').insert(payload);

      if (error) throw error;

      // Update local state after successful DB update
      setSettings(prev => ({ ...prev, ...newSettings }));
    } catch (e) {
      console.error('Error updating settings:', e);
      throw e;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
