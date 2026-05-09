import { SVGProps } from 'react';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';

export function Logo(props: SVGProps<SVGSVGElement>) {
  const { settings } = useSettings();

  if (settings?.logo_url) {
    const height = settings.logo_height || 32;
    return (
      <img 
        src={settings.logo_url} 
        alt="Logo" 
        className={cn("w-auto object-contain", props.className)}
        style={{ height: `${height}px` }}
      />
    );
  }

  return (
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
  );
}
