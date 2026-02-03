import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Save, AlertCircle, Lock, Mail } from 'lucide-react';
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
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
    // We now allow non-admins for account settings
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setProfileMessage(null);

    try {
        const updates: { email?: string; password?: string } = {};
        if (newEmail) updates.email = newEmail;
        if (newPassword) updates.password = newPassword;

        if (Object.keys(updates).length === 0) return;

        const { error } = await supabase.auth.updateUser(updates);

        if (error) throw error;

        setProfileMessage({ type: 'success', text: 'Profile updated! Check your email if you changed it.' });
        setNewEmail('');
        setNewPassword('');
    } catch (error: any) {
        setProfileMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-slate-900">League Settings</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" /> Account Settings
        </h3>
        
        <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Change Email</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder={user?.email || 'New Email'}
                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Change Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
            </div>

            {profileMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                    profileMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                    {profileMessage.text}
                </div>
            )}

            <button
                type="submit"
                disabled={!newEmail && !newPassword}
                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Update Profile
            </button>
        </form>
      </div>

      {user?.role === 'admin' && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
             <SettingsIcon className="w-5 h-5" /> League Rules
        </h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">General</h3>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">League Name</label>
              <input
                type="text"
                value={formData.league_name}
                onChange={(e) => setFormData({ ...formData, league_name: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">Scoring System</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Win</label>
                <input
                  type="number"
                  value={formData.points_win}
                  onChange={(e) => setFormData({ ...formData, points_win: parseInt(e.target.value) || 0 })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Draw</label>
                <input
                  type="number"
                  value={formData.points_draw}
                  onChange={(e) => setFormData({ ...formData, points_draw: parseInt(e.target.value) || 0 })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Loss</label>
                <input
                  type="number"
                  value={formData.points_loss}
                  onChange={(e) => setFormData({ ...formData, points_loss: parseInt(e.target.value) || 0 })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.type === 'error' && <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
      )}
    </div>
  );
}
