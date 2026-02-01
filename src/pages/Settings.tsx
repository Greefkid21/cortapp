import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Save, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    league_name: '',
    points_win: 2,
    points_draw: 1,
    points_loss: 0
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        league_name: settings.league_name,
        points_win: settings.points_win,
        points_draw: settings.points_draw,
        points_loss: settings.points_loss
      });
    }
  }, [settings]);

  // Protect route
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateSettings(formData);
      setMessage({ type: 'success', text: 'Settings updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-slate-900">League Settings</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* League Name */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">
              League Name
            </label>
            <input
              type="text"
              value={formData.league_name}
              onChange={(e) => setFormData(prev => ({ ...prev, league_name: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="e.g. cørtapp"
            />
            <p className="text-xs text-slate-500">
              This name will be displayed in the app header and browser title.
            </p>
          </div>

          <hr className="border-slate-100" />

          {/* Scoring Structure */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Scoring Structure</h3>
            <p className="text-sm text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              Changes to scoring will apply to future matches. Existing matches retain their awarded points.
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  Win
                </label>
                <input
                  type="number"
                  value={formData.points_win}
                  onChange={(e) => setFormData(prev => ({ ...prev, points_win: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  Draw
                </label>
                <input
                  type="number"
                  value={formData.points_draw}
                  onChange={(e) => setFormData(prev => ({ ...prev, points_draw: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  Loss
                </label>
                <input
                  type="number"
                  value={formData.points_loss}
                  onChange={(e) => setFormData(prev => ({ ...prev, points_loss: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-sm font-medium ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Saving...' : <><Save className="w-5 h-5" /> Save Settings</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
