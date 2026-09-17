import { Link } from 'react-router-dom';
import { Building2, CalendarRange, CreditCard, ShieldCheck, Sparkles, Users } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Your League Format, Ready To Use',
    description: 'Run the same recurring padel league format used by Cort Club, with players, divisions, fixtures, results, holidays, and standings already built in.',
  },
  {
    icon: CalendarRange,
    title: 'Smart Fixture Generation',
    description: 'Generate season fixtures with partner rotation, opponent variety, A/B/C ability balancing, byes when needed, and fairness reporting.',
  },
  {
    icon: ShieldCheck,
    title: 'Private Club Workspace',
    description: 'Each paying club gets its own isolated workspace, so players, settings, seasons, and fixtures stay private to that club.',
  },
  {
    icon: CreditCard,
    title: 'Monthly Service Model',
    description: 'Club owners get a managed platform with admin access, invite-only users, and a create-first, pay-after setup flow while PayPal billing is connected.',
  },
];

const steps = [
  'Create your admin account',
  'Set up your private club workspace',
  'Keep the workspace active while billing is pending',
  'Add your players and choose divisions',
  'Record A/B/C player ratings and availability',
  'Generate fixtures and manage the league all season',
];

export function ForClubs() {
  return (
    <div className="min-h-screen bg-background text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div className="brand-panel p-6 sm:p-8">
          <div className="brand-kicker mb-4">For Clubs</div>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <h1 className="brand-heading text-4xl sm:text-5xl max-w-3xl">
                Launch your own private padel league using the Cort Club format
              </h1>
              <p className="brand-subtle mt-4 max-w-2xl text-base sm:text-lg">
                Give your club a ready-made league platform with player management, fair fixture generation, results, standings, holidays, and admin controls.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-black font-black hover:bg-[#f4dc00] transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Admin Account
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/80 text-slate-900 border border-slate-200 font-bold hover:bg-white transition-colors"
                >
                  See How It Works
                </a>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">What You Get</div>
                  <div className="text-xl font-black text-slate-900">Private League Workspace</div>
                </div>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div>Owner admin access for the person who sets up the league</div>
                <div>Invite-only access for players and helpers</div>
                <div>Separate players, fixtures, seasons, settings, holidays, and chat for each club</div>
                <div>Monthly service model with billing pending support until PayPal is live</div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900">{title}</h2>
              <p className="text-sm text-slate-600 mt-2">{description}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="mt-8 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="brand-kicker mb-3">How It Works</div>
          <h2 className="text-3xl font-black text-slate-900">Simple setup for club owners</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">{step}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 bg-primary rounded-3xl p-6 sm:p-8 text-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
          <div className="max-w-3xl">
            <div className="brand-kicker text-accent mb-3">Admin Guide</div>
            <h2 className="text-3xl font-black">What club admins can manage</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-white/80">
              <div>Create seasons and choose division counts</div>
              <div>Add players and assign A/B/C ability ratings</div>
              <div>Generate and review fixtures across the season</div>
              <div>Track holidays and weekly availability</div>
              <div>Record scores and update standings</div>
              <div>Invite viewers and helper admins into the club workspace</div>
            </div>
            <div className="mt-6">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-black font-black hover:bg-[#f4dc00] transition-colors"
              >
                Start Your League Setup
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
