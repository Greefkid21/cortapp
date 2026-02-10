import { Outlet, Link, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Trophy, History, Calendar, Users, Lock, LogOut, Shield, Archive, Settings, MoreHorizontal, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useChat } from '../context/ChatContext';
import { Logo } from './Logo';

export function Layout() {
  const location = useLocation();
  const { user, isAdmin, logout, loading } = useAuth();
  const { settings } = useSettings();
  const { messages, getUnreadCount } = useChat();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Calculate total unread messages across all matches
  // Using a Set to get unique match IDs, then summing unread counts
  const totalUnread = useMemo(() => {
      const uniqueMatchIds = Array.from(new Set(messages.map(m => m.matchId)));
      return uniqueMatchIds.reduce((sum, id) => sum + getUnreadCount(id), 0);
  }, [messages, getUnreadCount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navItems = [
    ...(user ? [
        { path: '/', label: 'League', icon: Trophy },
        { path: '/fixtures', label: 'Fixtures', icon: Calendar },
        { path: '/settings', label: 'Settings', icon: Settings },
    ] : []),
    ...(isAdmin ? [
        { path: '/users', label: 'Admin', icon: Shield },
        { path: '/players', label: 'Players', icon: Users },
        { path: '/history', label: 'History', icon: History },
        { path: '/seasons', label: 'Seasons', icon: Archive },
    ] : []),
  ];

  // Mobile navigation logic
  // If we have more than 5 items, we show 4 items + "More" button
  const MAX_VISIBLE_ITEMS = 4;
  const needsMoreMenu = navItems.length > 5;
  
  const visibleItems = needsMoreMenu ? navItems.slice(0, MAX_VISIBLE_ITEMS) : navItems;
  const hiddenItems = needsMoreMenu ? navItems.slice(MAX_VISIBLE_ITEMS) : [];
  
  const isMoreActive = hiddenItems.some(item => item.path === location.pathname);

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
          
          {user && !isAdmin && (
            <Link 
              to="/settings"
              className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
          {user ? (
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
             <div className="flex gap-2">
                 <Link 
                  to="/login"
                  className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors"
                  title="Login"
                >
                  <Lock className="w-5 h-5" />
                </Link>
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 pb-24 max-w-3xl">
        <Outlet />
      </main>

      {/* More Menu Overlay */}
      {showMoreMenu && (
        <>
            <div 
                className="fixed inset-0 bg-black/20 z-20 backdrop-blur-sm"
                onClick={() => setShowMoreMenu(false)}
            />
            <div className="fixed bottom-24 right-4 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 min-w-[180px] flex flex-col gap-1 z-30 animate-in slide-in-from-bottom-5 fade-in duration-200">
                {hiddenItems.map(({ path, label, icon: Icon }) => {
                    const isActive = location.pathname === path;
                    return (
                        <Link
                            key={path}
                            to={path}
                            onClick={() => setShowMoreMenu(false)}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-xl transition-colors",
                                isActive 
                                    ? "bg-primary/10 text-primary font-medium" 
                                    : "text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-sm">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </>
      )}

      {/* Bottom Navigation for Mobile / Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center max-w-3xl mx-auto">
          {visibleItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            const isFixtures = path === '/fixtures';
            
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setShowMoreMenu(false)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors duration-200 relative min-w-[60px]",
                  isActive 
                    ? "text-primary font-medium" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {isFixtures && totalUnread > 0 && (
                  <span className="absolute top-1 right-3 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white z-10">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
                <Icon className={cn("w-6 h-6", isActive && "fill-current/10")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs truncate max-w-[70px]">{label}</span>
              </Link>
            );
          })}

          {needsMoreMenu && (
            <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors duration-200 relative min-w-[60px]",
                  (isMoreActive || showMoreMenu)
                    ? "text-primary font-medium" 
                    : "text-slate-400 hover:text-slate-600"
                )}
            >
                {showMoreMenu ? (
                    <X className="w-6 h-6" strokeWidth={2.5} />
                ) : (
                    <MoreHorizontal className="w-6 h-6" strokeWidth={isMoreActive ? 2.5 : 2} />
                )}
                <span className="text-xs">More</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
