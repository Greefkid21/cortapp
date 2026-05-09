import { SVGProps } from 'react';
import { useSettings } from '../context/SettingsContext';

export function Logo(props: SVGProps<SVGSVGElement>) {
  const { settings } = useSettings();

  if (settings?.logo_url) {
    return (
      <div className="flex items-center gap-3">
        <img 
          src={settings.logo_url} 
          alt="League Logo" 
          className="h-8 w-auto object-contain"
        />
        <span className="font-black text-xl tracking-tighter text-slate-900">
          {settings.league_name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      </svg>
      <span className="font-black text-xl tracking-tighter text-slate-900">
        {settings?.league_name || 'cørtapp'}
      </span>
    </div>
  );
}
