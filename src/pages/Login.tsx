import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Wand2 } from 'lucide-react';

export function Login() {
  const [mode, setMode] = useState<'password' | 'magic-link' | 'signup'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, signup, loginWithMagicLink } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'signup') {
      if (!email || !password) {
        setError('Please enter both email and password');
        return;
      }
      const result = await signup(email, password);
      if (result.success) {
        setSuccess('Account created! Logging you in...');
        // Auto login after signup?
        // Actually Supabase usually logs in automatically after signup if email confirmation is disabled.
        // If email confirmation is enabled, they need to check email.
        // Let's try to login or just wait for session change.
        // But for better UX, let's just say "Account created!" and let AuthContext handle session update if it happens.
        // If Supabase is set to require email verification, they won't be logged in.
        // For this project, I assume default might be verification required?
        // Let's assume they might need to verify.
        setSuccess('Account created! Please check your email to verify your account, or try logging in.');
        
        // Try to login immediately just in case verification is off
        const loginSuccess = await login(email, password);
        if (loginSuccess) {
             navigate('/');
        }
      } else {
        setError(result.error || 'Failed to sign up');
      }
    } else if (mode === 'password') {
      // Support legacy "admin123" input in the password field if email is empty
      if (!email && password === 'admin123') {
          if (await login('admin123')) {
              navigate('/');
              return;
          }
      }

      if (await login(email, password)) {
        navigate('/');
      } else {
        setError('Invalid email or password');
      }
    } else {
      // Magic Link
      if (!email) {
        setError('Please enter your email');
        return;
      }
      const sent = await loginWithMagicLink(email);
      if (sent) {
        setSuccess('Check your email for the login link!');
      } else {
        setError('Failed to send magic link. Please try again.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Access cørtapp</h1>
          <p className="text-slate-500 text-center mt-2">
            Enter your credentials to manage the league
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setMode('password'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              mode === 'password' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic-link'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              mode === 'magic-link' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
            <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium"
                autoFocus
                />
            </div>
          </div>

          {mode !== 'magic-link' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
              <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium"
                  />
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="text-green-600 text-sm text-center font-medium bg-green-50 p-2 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {mode === 'password' ? 'Login' : 'Send Magic Link'}
            {mode === 'magic-link' && <Wand2 className="w-4 h-4" />}
          </button>
          
          {mode === 'password' && (
            <div className="text-center">
                <p className="text-xs text-slate-400">
                    Default Admin: admin@cortapp.com / (any pass)
                </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
