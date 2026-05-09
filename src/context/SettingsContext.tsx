import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .single();
        
        if (data) {
          setSettings(data);
        } else if (error) {
            // If table doesn't exist or is empty, we might get an error. 
            // We just stick to defaults.
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

    try {
      // Use upsert instead of update to handle case where record doesn't exist
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 0, // Always use ID 0 for the single settings row
          ...newSettings
        });

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
