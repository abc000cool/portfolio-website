import { portfolio } from '../../data/portfolio'

interface MissionBriefingProps {
  open: boolean
  onClose: () => void
}

export function MissionBriefing({ open, onClose }: MissionBriefingProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/70"
      style={{ zIndex: 'var(--z-easter-egg)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="max-w-lg w-full p-8 bg-[var(--color-space-mid)] border-2 border-[var(--color-cockpit-amber)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-4 right-4 font-mono text-xs text-red-500 border border-red-500 px-2 py-1 rotate-12 opacity-70"
          aria-hidden="true"
        >
          CLASSIFIED
        </div>
        <h2 id="briefing-title" className="text-xl text-[var(--color-cockpit-amber)] mb-4">
          Mission Briefing
        </h2>
        <p className="font-mono text-sm text-[var(--color-text-muted)] leading-relaxed">
          {portfolio.missionBriefing}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 px-4 py-2 font-mono text-xs uppercase border border-[var(--color-phosphor)] text-[var(--color-phosphor)] bg-transparent cursor-pointer hover:bg-[var(--color-phosphor)] hover:text-[var(--color-deep-space)] transition-colors"
        >
          Acknowledge
        </button>
      </div>
    </div>
  )
}
