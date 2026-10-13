import { useMemo, useState } from 'react';
import { ArrowRight, Building2, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function WorkspaceOnboarding() {
  const { user, createWorkspace, logout, refreshWorkspaceAccess } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [error, setError] = useState('');
  const [accessMessage, setAccessMessage] = useState('');

  const suggestedSlug = useMemo(() => slugify(customSlug || workspaceName), [customSlug, workspaceName]);

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
    setCheckingAccess(true);
    const workspaceCount = await refreshWorkspaceAccess();
    setCheckingAccess(false);

    if (workspaceCount === 0) {
      setAccessMessage('No league access was found for this email yet. If you are joining an existing league, ask the league admin to invite this exact email address first.');
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
              {user?.email ? `Signed in as ${user.email}.` : 'You are signed in.'} If you are joining an existing league, the admin needs to invite this email address. If you are setting up a brand new club, you can create a workspace below.
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Joining an existing league
              </div>
              <div>Ask the league admin to invite this exact email address from the admin users page.</div>
              <div>Once they do, tap the button below and your league access will be picked up automatically.</div>
              <button
                type="button"
                onClick={handleRefreshAccess}
                disabled={checkingAccess}
                className="w-full bg-primary text-white py-3 rounded-xl font-black hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${checkingAccess ? 'animate-spin' : ''}`} />
                {checkingAccess ? 'Checking League Access...' : 'I Have Been Invited'}
              </button>
              {accessMessage && (
                <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-xl font-medium">
                  {accessMessage}
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
