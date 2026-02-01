import { Outlet, Link, useLocation } from 'react-router-dom';
import { Trophy, History, Calendar, Users, Lock, LogOut, Shield, Archive, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Logo } from './Logo';

export function Layout() {
  const location = useLocation();
  const { isAdmin, logout, loading } = useAuth();
  const { settings } = useSettings();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navItems = [
    { path: '/', label: 'League', icon: Trophy },
    { path: '/fixtures', label: 'Fixtures', icon: Calendar },
    ...(isAdmin ? [
        // { path: '/add-match', label: 'Entry', icon: PlusCircle }, // Hidden as per request
        { path: '/users', label: 'Admin', icon: Shield },
        { path: '/seasons', label: 'Seasons', icon: Archive },
        { path: '/settings', label: 'Settings', icon: Settings },
        { path: '/players', label: 'Players', icon: Users },
        { path: '/history', label: 'History', icon: History },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <Logo className="w-8 h-8 text-slate-900" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {settings?.league_name || 'cørtapp'}
            </h1>
          </div>
          
          {isAdmin ? (
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout Admin"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <Link 
              to="/login"
              className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors"
              title="Admin Login"
            >
              <Lock className="w-5 h-5" />
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 pb-24 max-w-3xl">
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile / Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center max-w-3xl mx-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors duration-200",
                  isActive 
                    ? "text-primary font-medium" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "fill-current/10")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
