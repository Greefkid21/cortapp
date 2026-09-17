import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PlatformBillingConfig } from '../types';
import { Settings as SettingsIcon, Save, AlertCircle, BadgePoundSterling, CreditCard, Lock, Mail, Upload, Camera, Loader2, RefreshCw, XCircle, X as CloseIcon, Check } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../lib/imageUtils';

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const { user, isAdmin, viewerPreview, activeWorkspace, workspaceRole, platformRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canSeeBilling = !viewerPreview && (platformRole === 'platform_admin' || workspaceRole === 'owner_admin' || workspaceRole === 'admin');
  
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
  const [billingConfig, setBillingConfig] = useState<PlatformBillingConfig | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [billingActionMessage, setBillingActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [refreshingBilling, setRefreshingBilling] = useState(false);
  const [cancellingBilling, setCancellingBilling] = useState(false);

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

  useEffect(() => {
    const fetchBillingConfig = async () => {
      if (!supabase || !canSeeBilling) {
        setBillingConfig(null);
        return;
      }

      setLoadingBilling(true);
      const { data, error } = await supabase
        .from('platform_billing_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Failed to load billing config:', error);
        setBillingConfig(null);
      } else if (data) {
        setBillingConfig({
          id: data.id,
          provider: data.provider,
          monthlyPrice: Number(data.monthly_price || 0),
          currency: data.currency || 'GBP',
          supportEmail: data.support_email || undefined,
          checkoutEnabled: !!data.checkout_enabled,
          isLive: !!data.is_live,
          paypalProductId: data.paypal_product_id || undefined,
          paypalPlanId: data.paypal_plan_id || undefined,
          createdAt: data.created_at || undefined,
          updatedAt: data.updated_at || undefined,
        });
      }
      setLoadingBilling(false);
    };

    fetchBillingConfig();
  }, [canSeeBilling]);

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

  const handleRefreshBilling = useCallback(async (options?: { silent?: boolean }) => {
    if (!supabase || !activeWorkspace?.workspace.id) return false;

    if (!options?.silent) {
      setBillingActionMessage(null);
    }
    setRefreshingBilling(true);

    try {
      const { data, error } = await supabase.functions.invoke('paypal-sync-subscription', {
        body: { workspaceId: activeWorkspace.workspace.id },
      });

      if (error) {
        throw new Error(error.message || 'Failed to refresh PayPal status.');
      }

      if (!options?.silent) {
        setBillingActionMessage({ type: 'success', text: `PayPal status refreshed: ${data?.status || 'updated'}. Reload the page if you want to refresh the top banner immediately.` });
      }

      return true;
    } catch (error: any) {
      if (!options?.silent) {
        setBillingActionMessage({ type: 'error', text: error.message || 'Failed to refresh PayPal status.' });
      }
      return false;
    } finally {
      setRefreshingBilling(false);
    }
  }, [activeWorkspace?.workspace.id]);

  const handleStartPayPalCheckout = async () => {
    if (!supabase || !activeWorkspace?.workspace.id) return;

    setBillingActionMessage(null);
    setStartingCheckout(true);

    try {
      const { data, error } = await supabase.functions.invoke('paypal-create-subscription', {
        body: { workspaceId: activeWorkspace.workspace.id },
      });

      if (error) {
        throw new Error(error.message || 'Failed to start PayPal checkout.');
      }

      if (!data?.approvalUrl) {
        throw new Error('PayPal did not return an approval URL.');
      }

      window.location.href = data.approvalUrl;
    } catch (error: any) {
      setBillingActionMessage({ type: 'error', text: error.message || 'Failed to start PayPal checkout.' });
      setStartingCheckout(false);
    }
  };

  const handleCancelBilling = async () => {
    if (!supabase || !activeWorkspace?.workspace.id) return;

    const confirmed = window.confirm('Cancel this PayPal subscription? The workspace will move into a grace period so billing can be resolved.');
    if (!confirmed) return;

    setBillingActionMessage(null);
    setCancellingBilling(true);

    try {
      const { data, error } = await supabase.functions.invoke('paypal-cancel-subscription', {
        body: { workspaceId: activeWorkspace.workspace.id },
      });

      if (error) {
        throw new Error(error.message || 'Failed to cancel PayPal billing.');
      }

      setBillingActionMessage({
        type: 'success',
        text: `PayPal subscription cancelled. Workspace moved to grace period${data?.subscriptionId ? ` for subscription ${data.subscriptionId}.` : '.'}`,
      });
    } catch (error: any) {
      setBillingActionMessage({ type: 'error', text: error.message || 'Failed to cancel PayPal billing.' });
    } finally {
      setCancellingBilling(false);
    }
  };

  const billingStatus = activeWorkspace?.workspace.billingStatus;
  const priceLine = billingConfig
    ? `${billingConfig.currency} ${billingConfig.monthlyPrice.toFixed(2)} / month`
    : null;

  const billingMessage = (() => {
    switch (billingStatus) {
      case 'billing_pending':
        return billingConfig?.checkoutEnabled
          ? 'Your club is active and awaiting PayPal setup. When checkout is enabled, this workspace can move into a live subscription without changing the rest of your setup.'
          : 'Your club is active and marked as billing pending. PayPal checkout is not live yet, so you can keep setting up your league while billing automation is being connected.';
      case 'billable_active':
        return 'This workspace is marked as billable and active. Once the live PayPal flow is connected, subscription updates can be tracked here.';
      case 'grace_period':
        return 'This workspace is in a grace period. Access is still available while billing is being resolved.';
      case 'suspended':
        return 'This workspace is currently suspended for billing reasons. A platform admin will need to reactivate it.';
      case 'free_exempt':
        return activeWorkspace?.workspace.billingExemptReason || 'This workspace has been marked free or exempt by the platform admin.';
      default:
        return null;
    }
  })();

  useEffect(() => {
    const paypalState = searchParams.get('paypal');
    const workspaceParam = searchParams.get('workspace');

    if (!paypalState) return;
    if (workspaceParam && activeWorkspace?.workspace.id && workspaceParam !== activeWorkspace.workspace.id) return;

    if (paypalState === 'cancelled') {
      setBillingActionMessage({ type: 'error', text: 'PayPal checkout was cancelled before subscription approval completed.' });
      setSearchParams({});
      return;
    }

    if (paypalState === 'success') {
      handleRefreshBilling({ silent: true }).then((ok) => {
        setBillingActionMessage({
          type: ok ? 'success' : 'error',
          text: ok
            ? 'Returned from PayPal and refreshed the latest subscription state.'
            : 'Returned from PayPal, but the latest subscription state could not be confirmed yet.',
        });
        setSearchParams({});
      });
      return;
    }
  }, [activeWorkspace?.workspace.id, handleRefreshBilling, searchParams, setSearchParams]);

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

      {canSeeBilling && activeWorkspace && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <BadgePoundSterling className="w-5 h-5 text-primary" /> Club Billing
        </h3>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Status</span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
              {billingStatus ? billingStatus.replace(/_/g, ' ') : 'Unknown'}
            </span>
          </div>
          <div className="text-sm text-slate-600">{billingMessage}</div>
          {priceLine && (
            <div className="text-sm text-slate-600">
              Monthly price: <span className="font-semibold text-slate-800">{priceLine}</span>
            </div>
          )}
          {activeWorkspace.workspace.paypalSubscriptionStatus && (
            <div className="text-sm text-slate-600">
              PayPal subscription status: <span className="font-semibold text-slate-800">{activeWorkspace.workspace.paypalSubscriptionStatus.replace(/_/g, ' ')}</span>
            </div>
          )}
          {activeWorkspace.workspace.gracePeriodEndsAt && (
            <div className="text-sm text-slate-600">
              Grace period ends: <span className="font-semibold text-slate-800">{activeWorkspace.workspace.gracePeriodEndsAt.slice(0, 10)}</span>
            </div>
          )}
          {billingConfig?.supportEmail && (
            <div className="text-sm text-slate-600">
              Billing support: <span className="font-semibold text-slate-800">{billingConfig.supportEmail}</span>
            </div>
          )}
          {loadingBilling && (
            <div className="text-sm text-slate-500">Loading billing information...</div>
          )}
          {billingActionMessage && (
            <div className={`rounded-xl px-3 py-2 text-sm font-medium ${
              billingActionMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {billingActionMessage.text}
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {billingStatus === 'billing_pending' && billingConfig?.checkoutEnabled && (
              <button
                type="button"
                onClick={handleStartPayPalCheckout}
                disabled={startingCheckout}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-white font-bold hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {startingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {startingCheckout ? 'Opening PayPal...' : 'Set Up PayPal Billing'}
              </button>
            )}
            {(activeWorkspace.workspace.paypalSubscriptionId || activeWorkspace.workspace.paypalSubscriptionStatus === 'pending_approval') && (
              <button
                type="button"
                onClick={() => handleRefreshBilling()}
                disabled={refreshingBilling}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-slate-800 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {refreshingBilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {refreshingBilling ? 'Refreshing...' : 'Refresh PayPal Status'}
              </button>
            )}
            {activeWorkspace.workspace.paypalSubscriptionId && activeWorkspace.workspace.paypalSubscriptionStatus !== 'cancelled' && (
              <button
                type="button"
                onClick={handleCancelBilling}
                disabled={cancellingBilling}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-rose-700 font-bold hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                {cancellingBilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {cancellingBilling ? 'Cancelling...' : 'Cancel PayPal Billing'}
              </button>
            )}
          </div>
          {!billingConfig?.checkoutEnabled && (
            <div className="text-sm text-slate-500">
              PayPal checkout is still disabled by the platform admin, so this workspace remains active in billing pending mode for now.
            </div>
          )}
          {billingConfig && (
            <div className="text-xs text-slate-400 uppercase tracking-[0.16em]">
              PayPal mode: {billingConfig.isLive ? 'Live' : 'Sandbox'}
            </div>
          )}
        </div>
      </div>
      )}

      {isAdmin && (
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
