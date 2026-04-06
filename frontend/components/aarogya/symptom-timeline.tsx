import { cn } from "@/lib/utils"
import { UrgencyBadge, type UrgencyLevel } from "./urgency-badge"

interface TimelineEntry {
  id: string
  date: string
  symptoms: string[]
  urgency: UrgencyLevel
  doctorSeen?: string
}

interface SymptomTimelineProps {
  entries: TimelineEntry[]
  className?: string
}

export function SymptomTimeline({ entries, className }: SymptomTimelineProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--border)]" />

      <div className="space-y-6">
        {entries.map((entry, index) => (
          <div key={entry.id} className="relative pl-10">
            {/* Timeline dot */}
            <div className={cn(
              "absolute left-2.5 w-3 h-3 rounded-full border-2 border-white",
              entry.urgency === "emergency" ? "bg-red-500" :
              entry.urgency === "clinic" ? "bg-amber-500" : "bg-green-500"
            )} />

            {/* Content */}
            <div className="bg-white rounded-lg border border-[var(--border)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-[var(--muted-foreground)]">{entry.date}</span>
                <UrgencyBadge level={entry.urgency} size="sm" />
              </div>
              <p className="text-sm text-[var(--foreground)] mb-2">
                {entry.symptoms.join(", ")}
              </p>
              {entry.doctorSeen && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Doctor: {entry.doctorSeen}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
