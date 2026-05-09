import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Save, AlertCircle, Lock, Mail, Upload, Camera, Loader2, X as CloseIcon, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../lib/imageUtils';

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    league_name: '',
    points_win: 2,
    points_draw: 1,
    points_loss: 0,
    logo_url: '',
    logo_height: 32
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        league_name: settings.league_name,
        points_win: settings.points_win,
        points_draw: settings.points_draw,
        points_loss: settings.points_loss,
        logo_url: settings.logo_url || '',
        logo_height: settings.logo_height || 32
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
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      setMessage({ type: 'error', text: `Failed to update settings: ${error.message || 'Unknown error'}` });
    } finally {
      setSaving(false);
    }
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result?.toString() || null);
      });
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    
    try {
      setUploadingLogo(true);
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      if (!croppedImage) throw new Error('Could not crop image');

      const fileName = `league-logo-${Date.now()}.png`;
      const filePath = `${fileName}`;
      
      if (!supabase) throw new Error('Supabase not configured');

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImage);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
            throw new Error('Storage bucket "avatars" not found. Please go to Supabase -> Storage and create a public bucket named "avatars".');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      setImageToCrop(null);
      setMessage({ type: 'success', text: 'Logo cropped and uploaded! Save settings to apply.' });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setMessage({ type: 'error', text: 'Error: ' + error.message });
    } finally {
      setUploadingLogo(false);
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
            
            {/* Logo Upload Section */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">League Logo</label>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="League Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Upload className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 w-fit">
                    {uploadingLogo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    {formData.logo_url ? 'Change Logo' : 'Upload Logo'}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleLogoSelect}
                      disabled={uploadingLogo}
                    />
                  </label>
                  {formData.logo_url && (
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                      className="text-xs text-red-500 font-bold hover:underline w-fit"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">Your logo will be displayed alongside the league name in the navigation bar.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">League Name</label>
              <input
                type="text"
                value={formData.league_name}
                onChange={(e) => setFormData({ ...formData, league_name: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Logo Height (px)</label>
              <input
                type="number"
                value={formData.logo_height}
                onChange={(e) => setFormData({ ...formData, logo_height: parseInt(e.target.value) || 0 })}
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

      {/* Image Crop Modal */}
      {imageToCrop && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-xl text-slate-900">Crop Logo</h3>
              <button 
                onClick={() => setImageToCrop(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <CloseIcon className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            
            <div className="relative flex-1 bg-slate-900">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={undefined} // Allow any aspect ratio for logo
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Zoom</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setImageToCrop(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={uploadingLogo}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  {uploadingLogo ? 'Processing...' : 'Confirm Crop'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
