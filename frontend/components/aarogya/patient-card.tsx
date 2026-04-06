import { cn } from "@/lib/utils"
import { UrgencyBadge, type UrgencyLevel } from "./urgency-badge"

interface PatientCardProps {
  name: string
  age: number
  gender: "M" | "F"
  urgency: UrgencyLevel
  symptoms: string[]
  duration: string
  medicines?: string[]
  doctorReferral?: string
  date: string
  showActions?: boolean
  className?: string
}

export function PatientCard({
  name,
  age,
  gender,
  urgency,
  symptoms,
  duration,
  medicines,
  doctorReferral,
  date,
  showActions = true,
  className
}: PatientCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-xl border border-[var(--border)] border-t-4 border-t-[var(--primary)] shadow-sm overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold text-lg">
            {name.charAt(0)}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--foreground)]">{name}</h3>
            <p className="text-sm text-[var(--muted-foreground)]">{age}{gender}</p>
          </div>
          <UrgencyBadge level={urgency} size="lg" />
        </div>
      </div>

      {/* Details */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-1">Symptoms</h4>
          <p className="text-sm text-[var(--foreground)]">{symptoms.join(", ")}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-1">Duration</h4>
          <p className="text-sm text-[var(--foreground)]">{duration}</p>
        </div>
        {medicines && medicines.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-1">Medicines Suggested</h4>
            <p className="text-sm text-[var(--foreground)]">{medicines.join(", ")}</p>
          </div>
        )}
        {doctorReferral && (
          <div>
            <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-1">Doctor Referral</h4>
            <p className="text-sm text-[var(--foreground)]">{doctorReferral}</p>
          </div>
        )}
        <div className="col-span-2">
          <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-1">Date</h4>
          <p className="text-sm text-[var(--foreground)]">{date}</p>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-4 bg-[var(--secondary)]/50 border-t border-[var(--border)] flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-lg font-medium text-sm transition-colors">
            <ShareIcon className="w-4 h-4" />
            Share with Doctor
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-[var(--border)] text-[var(--foreground)] rounded-lg font-medium text-sm transition-colors">
            <PrintIcon className="w-4 h-4" />
            Print Card
          </button>
        </div>
      )}
    </div>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}
