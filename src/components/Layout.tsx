import { Outlet, Link, useLocation } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { Trophy, History, Calendar, Users, Lock, LogOut, Shield, Archive, Settings, MoreHorizontal, X, FileText, Medal, Plane, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useChat } from '../context/ChatContext';
import { Logo } from './Logo';

export function Layout() {
  const location = useLocation();
  const { user, isAdmin, actualIsAdmin, viewerPreview, buildPath, logout, loading } = useAuth();
  const { settings } = useSettings();
  const { messages, getUnreadCount } = useChat();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Calculate total unread messages across all matches
  // Using a Set to get unique match IDs, then summing unread counts
  const totalUnread = useMemo(() => {
      const uniqueMatchIds = Array.from(new Set(messages.map(m => m.matchId)));
      return uniqueMatchIds.reduce((sum, id) => sum + getUnreadCount(id), 0);
  }, [messages, getUnreadCount]);

  // Update page title dynamically
  useEffect(() => {
    if (settings?.league_name) {
      document.title = `${settings.league_name} - Padel League`;
    }
  }, [settings?.league_name]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  const navItems = [
    ...(user ? [
        { path: buildPath('/'), label: 'League', icon: Trophy },
        { path: buildPath('/competitions'), label: 'Comps', icon: Medal },
        { path: buildPath('/fixtures'), label: 'Fixtures', icon: Calendar },
        { path: buildPath('/holidays'), label: 'Holidays', icon: Plane },
        { path: buildPath('/rules'), label: 'Rules', icon: FileText },
        { path: buildPath('/settings'), label: 'Settings', icon: Settings },
    ] : []),
    ...(isAdmin ? [
        { path: '/viewer', label: 'Viewer', icon: Eye },
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
    <div className="min-h-screen bg-background font-sans text-slate-900 pb-20">
      <header className="bg-primary border-b border-white/10 sticky top-0 z-10 safe-top shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Logo className="h-8 sm:h-9 w-auto text-accent flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white truncate">
                {settings?.league_name || 'cørtapp'}
              </h1>
              {viewerPreview && (
                <div className="text-[10px] uppercase tracking-[0.18em] text-accent/80 font-black">
                  Viewer Preview
                </div>
              )}
            </div>
          </div>
          
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              {viewerPreview && actualIsAdmin && (
                <Link
                  to="/"
                  className="px-3 py-2 text-xs sm:text-sm font-bold text-accent hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Return to Admin View"
                >
                  Admin View
                </Link>
              )}
              {!isAdmin && (
                <Link 
                  to={buildPath('/settings')}
                  className="p-2 text-white/60 hover:text-accent hover:bg-white/5 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              )}
              <button 
                onClick={logout}
                className="p-2 text-white/60 hover:text-accent hover:bg-white/5 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
             <div className="flex gap-2">
                 <Link 
                  to="/login"
                  className="p-2 text-white/60 hover:text-accent hover:bg-white/5 rounded-lg transition-colors"
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
                className="fixed inset-0 bg-black/40 z-20 backdrop-blur-sm"
                onClick={() => setShowMoreMenu(false)}
            />
            <div className="fixed bottom-24 right-4 bg-primary rounded-2xl shadow-xl border border-white/10 p-2 min-w-[180px] flex flex-col gap-1 z-30 animate-in slide-in-from-bottom-5 fade-in duration-200">
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
                                    ? "bg-accent text-black font-medium" 
                                    : "text-white/80 hover:bg-white/5"
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
      <nav className="fixed bottom-0 left-0 right-0 bg-primary border-t border-white/10 px-2 py-2 pb-safe z-20 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.8)]">
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
                    ? "text-accent font-medium" 
                    : "text-white/45 hover:text-white/80"
                )}
              >
                {isFixtures && totalUnread > 0 && (
                  <span className="absolute top-1 right-3 bg-accent text-black text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-primary z-10 font-bold">
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
                    ? "text-accent font-medium" 
                    : "text-white/45 hover:text-white/80"
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
