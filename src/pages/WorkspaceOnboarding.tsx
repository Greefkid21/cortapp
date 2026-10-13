import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JoinableWorkspace } from '../types';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function WorkspaceOnboarding() {
  const { user, createWorkspace, logout, refreshWorkspaceAccess, listJoinableWorkspaces, joinWorkspace } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [leagueSearch, setLeagueSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [joiningWorkspaceId, setJoiningWorkspaceId] = useState<string | null>(null);
  const [loadingJoinableLeagues, setLoadingJoinableLeagues] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [error, setError] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [joinableLeagues, setJoinableLeagues] = useState<JoinableWorkspace[]>([]);

  const suggestedSlug = useMemo(() => slugify(customSlug || workspaceName), [customSlug, workspaceName]);

  useEffect(() => {
    let active = true;

    const loadJoinableLeagues = async () => {
      setLoadingJoinableLeagues(true);
      const leagues = await listJoinableWorkspaces(leagueSearch);
      if (active) {
        setJoinableLeagues(leagues);
        setLoadingJoinableLeagues(false);
      }
    };

    loadJoinableLeagues();

    return () => {
      active = false;
    };
  }, [leagueSearch, user?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      setError('Please enter your club or league name.');
      return;
    }

    setSubmitting(true);
    const result = await createWorkspace(trimmedName, suggestedSlug || undefined);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Failed to create your league workspace.');
    }
  };

  const handleRefreshAccess = async () => {
    setError('');
    setAccessMessage('');
    setJoinMessage('');
    setCheckingAccess(true);
    const workspaceCount = await refreshWorkspaceAccess();
    setCheckingAccess(false);

    if (workspaceCount === 0) {
      setAccessMessage('No league access was found for this account yet. You can still search for a self-serve league below, or ask the league admin to invite this exact email address.');
    }
  };

  const handleJoinLeague = async (league: JoinableWorkspace) => {
    setError('');
    setAccessMessage('');
    setJoinMessage('');
    setJoiningWorkspaceId(league.id);

    const result = await joinWorkspace(league.id);
    setJoiningWorkspaceId(null);

    if (!result.success) {
      setJoinMessage(result.error || 'Failed to join this league.');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] bg-primary p-1 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)]">
        <div className="bg-white p-8 rounded-[24px] border border-black/5">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-accent text-black flex items-center justify-center shadow-[0_10px_20px_-12px_rgba(0,0,0,0.5)] mb-4">
              <Users className="w-8 h-8" />
            </div>
            <div className="brand-kicker mb-3">League Access</div>
            <h1 className="text-2xl font-black text-slate-950">No League Access Found Yet</h1>
            <p className="text-slate-500 mt-2 max-w-md">
              {user?.email ? `Signed in as ${user.email}.` : 'You are signed in.'} If you are joining an existing league, either search for it below or ask the admin to invite this email address. If you are setting up a brand new club, you can create a workspace below.
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Joining an existing league
              </div>
              <div>Choose the league you want to join below, or ask the league admin to invite this exact email address from the admin users page.</div>
              <div>Invites still work as before, but they are no longer the only way in.</div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Find Your League</label>
                <input
                  type="text"
                  value={leagueSearch}
                  onChange={(event) => setLeagueSearch(event.target.value)}
                  placeholder="Search by league name, identifier, or league number"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium"
                />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {loadingJoinableLeagues ? (
                  <div className="text-sm text-slate-500">Loading leagues...</div>
                ) : joinableLeagues.length > 0 ? (
                  joinableLeagues.map((league) => (
                    <div key={league.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{league.name}</div>
                        <div className="text-xs text-slate-500">
                          Identifier: <span className="font-semibold text-slate-700">{league.slug}</span> | League #{league.leagueNumber}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinLeague(league)}
                        disabled={joiningWorkspaceId === league.id}
                        className="shrink-0 bg-accent text-black px-3 py-2 rounded-lg font-black hover:bg-[#f4dc00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {joiningWorkspaceId === league.id ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    No joinable leagues matched that search yet.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleRefreshAccess}
                disabled={checkingAccess}
                className="w-full bg-primary text-white py-3 rounded-xl font-black hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${checkingAccess ? 'animate-spin' : ''}`} />
                {checkingAccess ? 'Checking League Access...' : 'Refresh League Access'}
              </button>
              {accessMessage && (
                <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-xl font-medium">
                  {accessMessage}
                </div>
              )}
              {joinMessage && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium">
                  {joinMessage}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Creating a brand new club instead?
              </div>
              <div>Only do this if you are setting up a new league, not joining an existing one.</div>
              <button
                type="button"
                onClick={() => setShowCreateWorkspace((value) => !value)}
                className="inline-flex items-center gap-2 text-primary font-bold hover:text-teal-700"
              >
                {showCreateWorkspace ? 'Hide league creation' : 'Create a new private league'}
                <ArrowRight className={`w-4 h-4 transition-transform ${showCreateWorkspace ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {showCreateWorkspace && (
              <form onSubmit={handleSubmit} className="space-y-5 border-t border-slate-100 pt-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Club or League Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Example: Riverside Padel League"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Workspace Slug</label>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(event) => setCustomSlug(event.target.value)}
                    placeholder="Optional custom slug"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Suggested URL key: <span className="font-semibold text-slate-600">{suggestedSlug || 'your-league-name'}</span>
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    What happens next
                  </div>
                  <div>Your private workspace is created.</div>
                  <div>You become the owner admin automatically.</div>
                  <div>Your workspace gets its own settings and first season.</div>
                  <div>Billing starts in a pending state so you can set up the club before PayPal is switched on.</div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !workspaceName.trim()}
                  className="w-full bg-accent text-black py-3 rounded-xl font-black hover:bg-[#f4dc00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating Workspace...' : 'Create My League Workspace'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => logout()}
              className="w-full text-slate-500 text-sm font-bold hover:text-slate-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
