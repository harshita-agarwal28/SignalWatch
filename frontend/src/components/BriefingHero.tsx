import { Building2, CalendarClock, Gauge } from 'lucide-react'
import { timeAgo } from '../utils/format'
import { usePrefersReducedMotion } from '../hooks/useMediaQuery'

interface BriefingHeroProps {
  attentionCount: number
  companySpecific: number
  volumeSpikes: number
  upcomingEventsCount: number
  lastVisit: string
}

export function BriefingHero({ attentionCount, companySpecific, volumeSpikes, upcomingEventsCount, lastVisit }: BriefingHeroProps) {
  const reduceMotion = usePrefersReducedMotion()

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber/20 bg-gradient-to-br from-surface2 to-surface p-6 shadow-amberGlow sm:p-7">
      {!reduceMotion && (
        <div className="scan-line-wrap" aria-hidden="true">
          <div className="scan-line animate-scan-line" />
        </div>
      )}
      <div className="ambient-orb -right-16 -top-16 h-56 w-56 bg-amber/20 animate-drift" aria-hidden="true" />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-xs font-medium text-amber">
          <Gauge size={13} aria-hidden="true" />
          Since last check &middot; {timeAgo(lastVisit)}
        </span>

        <h2 className="mt-3 font-display text-2xl font-semibold text-ink sm:text-[28px]">
          {attentionCount} signal{attentionCount === 1 ? '' : 's'} deserve{attentionCount === 1 ? 's' : ''} your attention
        </h2>
        <p className="mt-1.5 max-w-lg text-sm text-ink/70">
          We compared today&apos;s prices against what&apos;s typical for each company and flagged what stands out.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile icon={Building2} value={companySpecific} label="Company-specific moves" />
          <StatTile icon={Gauge} value={volumeSpikes} label="Unusual volume spikes" />
          <StatTile icon={CalendarClock} value={upcomingEventsCount} label="Upcoming events" />
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, value, label }: { icon: typeof Gauge; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-void/30 p-3.5">
      <Icon size={16} className="text-amber" aria-hidden="true" />
      <div className="mt-2 font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-[11px] leading-snug text-muted">{label}</div>
    </div>
  )
}
