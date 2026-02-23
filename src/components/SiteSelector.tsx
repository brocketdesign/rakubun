import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe, Check } from 'lucide-react';
import type { Site } from '../stores/sitesStore';
import { cn } from '../lib/utils';

interface SiteSelectorProps {
  /** Currently selected site id (empty string = no selection / "all") */
  value: string;
  /** Callback when a site is selected */
  onChange: (siteId: string) => void;
  /** Array of sites to show */
  sites: Site[];
  /** Placeholder label when nothing is selected */
  placeholder?: string;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Optional className for the trigger button */
  className?: string;
}

function SiteFavicon({ favicon, url, size = 'default' }: { favicon?: string; url?: string; size?: 'sm' | 'default' }) {
  const [imgError, setImgError] = useState(false);
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const containerSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';

  // Check if favicon is an emoji (single char or common emoji patterns)
  const isEmoji = favicon && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(favicon);

  if (favicon && !isEmoji && !imgError) {
    // It's a URL — render as <img>
    return (
      <div className={cn(containerSize, 'rounded-lg overflow-hidden bg-rakubun-bg-secondary flex items-center justify-center shrink-0 border border-rakubun-border/50')}>
        <img
          src={favicon}
          alt=""
          className={cn(iconSize, 'object-contain')}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  if (favicon && isEmoji) {
    return (
      <div className={cn(containerSize, 'rounded-lg bg-rakubun-bg-secondary flex items-center justify-center shrink-0 border border-rakubun-border/50')}>
        <span className={size === 'sm' ? 'text-sm' : 'text-base'}>{favicon}</span>
      </div>
    );
  }

  // Fallback: try to get favicon from the site URL via Google's service
  if (url) {
    const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return (
      <div className={cn(containerSize, 'rounded-lg overflow-hidden bg-rakubun-bg-secondary flex items-center justify-center shrink-0 border border-rakubun-border/50')}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          className={cn(iconSize, 'object-contain')}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <Globe className={cn(iconSize, 'text-rakubun-text-secondary absolute')} style={{ display: 'none' }} />
      </div>
    );
  }

  // Final fallback: globe icon
  return (
    <div className={cn(containerSize, 'rounded-lg bg-rakubun-bg-secondary flex items-center justify-center shrink-0 border border-rakubun-border/50')}>
      <Globe className={cn(size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4', 'text-rakubun-text-secondary')} />
    </div>
  );
}

function extractDomain(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function SiteSelector({
  value,
  onChange,
  sites,
  placeholder = 'Select a site...',
  size = 'default',
  className,
}: SiteSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSite = sites.find((s) => s.id === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2.5 bg-rakubun-bg rounded-xl border border-rakubun-border text-left transition-all cursor-pointer',
          'hover:border-rakubun-accent/30 focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20',
          isSmall ? 'px-2.5 py-1.5' : 'px-3 py-2.5',
          open && 'ring-2 ring-rakubun-accent/20 border-rakubun-accent/30'
        )}
      >
        {selectedSite ? (
          <>
            <SiteFavicon favicon={selectedSite.favicon} url={selectedSite.url} size={size} />
            <div className="flex-1 min-w-0">
              <p className={cn(
                'font-medium text-rakubun-text truncate',
                isSmall ? 'text-xs' : 'text-sm'
              )}>
                {selectedSite.name}
              </p>
              <p className={cn(
                'text-rakubun-text-secondary truncate',
                isSmall ? 'text-[10px]' : 'text-xs'
              )}>
                {extractDomain(selectedSite.url)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className={cn(
              'rounded-lg bg-rakubun-bg-secondary flex items-center justify-center shrink-0 border border-dashed border-rakubun-border',
              isSmall ? 'w-6 h-6' : 'w-7 h-7'
            )}>
              <Globe className={cn(
                'text-rakubun-text-secondary',
                isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'
              )} />
            </div>
            <span className={cn(
              'text-rakubun-text-secondary flex-1',
              isSmall ? 'text-xs' : 'text-sm'
            )}>
              {placeholder}
            </span>
          </>
        )}
        <ChevronDown
          className={cn(
            'shrink-0 text-rakubun-text-secondary transition-transform duration-200',
            isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          'absolute z-50 mt-1.5 w-full min-w-[220px] bg-rakubun-surface rounded-xl border border-rakubun-border shadow-lg overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150'
        )}>
          {/* Option: Placeholder / "All" / "None" at the top */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                value === ''
                  ? 'bg-rakubun-accent/8 text-rakubun-accent'
                  : 'hover:bg-rakubun-bg text-rakubun-text-secondary'
              )}
            >
              <div className={cn(
                'rounded-lg flex items-center justify-center shrink-0 border border-dashed',
                isSmall ? 'w-6 h-6' : 'w-7 h-7',
                value === '' ? 'border-rakubun-accent/30 bg-rakubun-accent/5' : 'border-rakubun-border bg-rakubun-bg-secondary'
              )}>
                <Globe className={cn(
                  isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4',
                  value === '' ? 'text-rakubun-accent' : 'text-rakubun-text-secondary'
                )} />
              </div>
              <span className={cn('flex-1', isSmall ? 'text-xs' : 'text-sm')}>
                {placeholder}
              </span>
              {value === '' && (
                <Check className={cn('shrink-0 text-rakubun-accent', isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              )}
            </button>

            {/* Divider */}
            {sites.length > 0 && (
              <div className="mx-2.5 my-1 h-px bg-rakubun-border/60" />
            )}

            {/* Site List */}
            <div className="max-h-[240px] overflow-y-auto">
              {sites.map((site) => {
                const isSelected = site.id === value;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => { onChange(site.id); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors group',
                      isSelected
                        ? 'bg-rakubun-accent/8'
                        : 'hover:bg-rakubun-bg'
                    )}
                  >
                    <SiteFavicon favicon={site.favicon} url={site.url} size={size} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-medium truncate',
                        isSmall ? 'text-xs' : 'text-sm',
                        isSelected ? 'text-rakubun-accent' : 'text-rakubun-text'
                      )}>
                        {site.name || extractDomain(site.url)}
                      </p>
                      <p className={cn(
                        'truncate',
                        isSmall ? 'text-[10px]' : 'text-xs',
                        isSelected ? 'text-rakubun-accent/60' : 'text-rakubun-text-secondary'
                      )}>
                        {extractDomain(site.url)}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className={cn('shrink-0 text-rakubun-accent', isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
