import { LeagueTable } from '../components/LeagueTable';
import { Player } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

export function Home({ players }: { players: Player[] }) {
  const { user } = useAuth();
  const [fixing, setFixing] = useState(false);

  const fixPermissions = async () => {
    if (!supabase || !user) return;
    setFixing(true);
    try {
        // Attempt to self-promote (allowed by RLS 'Users can update own profile')
        const { error } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', user.id);

        if (error) {
            alert('Failed to fix permissions: ' + error.message + '\n\nPlease run the SQL script in Supabase Dashboard.');
        } else {
            alert('Permissions fixed! Reloading...');
            window.location.reload();
        }
    } catch (e) {
        alert('Error: ' + e);
    }
    setFixing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">League Standings</h2>
      </div>

      {/* Helper for user stuck in viewer mode */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-xs font-mono">
          <p><strong>Debug Info:</strong></p>
          <p>User ID: {user?.id || 'Not logged in'}</p>
          <p>Email: {user?.email || '-'}</p>
          <p>Role: {user?.role || '-'}</p>
          <p>Is Admin?: {user?.role === 'admin' ? 'Yes' : 'No'}</p>
      </div>

      {user && user.role !== 'admin' && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
              <h3 className="font-bold text-blue-800 mb-1">Admin Access Trouble?</h3>
              <p className="text-sm text-blue-600 mb-3">
                  If you are the owner but can't see Admin tools, click below to fix your permissions.
              </p>
              <button 
                  onClick={fixPermissions}
                  disabled={fixing}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                  {fixing ? 'Fixing...' : 'Grant Me Admin Access'}
              </button>
          </div>
      )}

      <LeagueTable players={players} />
    </div>
  );
}
