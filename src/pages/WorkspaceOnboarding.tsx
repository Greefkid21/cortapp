import { useMemo, useState } from 'react';
import { Building2, Sparkles } from 'lucide-react';
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
  const { user, createWorkspace, logout } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] bg-primary p-1 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)]">
        <div className="bg-white p-8 rounded-[24px] border border-black/5">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-accent text-black flex items-center justify-center shadow-[0_10px_20px_-12px_rgba(0,0,0,0.5)] mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="brand-kicker mb-3">League Setup</div>
            <h1 className="text-2xl font-black text-slate-950">Create Your Private League Workspace</h1>
            <p className="text-slate-500 mt-2 max-w-md">
              {user?.email ? `Signed in as ${user.email}.` : 'You are signed in.'} Create your club workspace and you will become the owner admin automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                <Sparkles className="w-4 h-4 text-primary" />
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

            <button
              type="button"
              onClick={() => logout()}
              className="w-full text-slate-500 text-sm font-bold hover:text-slate-800"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
