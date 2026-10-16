import { useState, useRef, useEffect } from 'react';
import { getTermDefinition } from '../data/terminology';

interface TermInfoProps {
  term: string;
  className?: string;
  iconClassName?: string;
  position?: 'top' | 'bottom' | 'auto';
}

export function TermInfo({
  term,
  className = '',
  iconClassName = '',
  position = 'top',
}: TermInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const def = getTermDefinition(term);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!def) return null;

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center text-left ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={`Explanation for ${def.term}`}
        aria-expanded={isOpen}
        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] font-mono font-bold leading-none transition-colors border cursor-pointer ml-1 select-none focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
          isOpen
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
            : 'bg-slate-800/80 text-slate-400 hover:text-cyan-300 border-slate-700/80 hover:border-cyan-500/50'
        } ${iconClassName}`}
      >
        ⓘ
      </button>

      {/* Floating Progressive Disclosure Tooltip */}
      {isOpen && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-50 w-64 sm:w-72 p-3 rounded-lg border border-slate-700 bg-[#070d19] text-slate-200 text-xs shadow-2xl backdrop-blur-md transition-all font-sans normal-case tracking-normal ${
            position === 'bottom'
              ? 'top-full mt-2 left-1/2 -translate-x-1/2'
              : 'bottom-full mb-2 left-1/2 -translate-x-1/2'
          }`}
        >
          {/* Header */}
          <span className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 block">
            <span className="font-bold text-white tracking-tight font-sans text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              {def.term}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
              {def.category}
            </span>
          </span>

          {/* Primary Citizen-Friendly Explanation */}
          <span className="text-[11px] leading-relaxed text-slate-300 block font-normal">
            {def.shortDefinition}
          </span>

          {/* Contextual Note */}
          {def.citizenFriendlyNote && (
            <span className="text-[10px] leading-tight text-slate-400 block pt-1.5 mt-1.5 border-t border-slate-800/60 font-mono">
              💡 {def.citizenFriendlyNote}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
