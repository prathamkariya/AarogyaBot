import { cn } from "@/lib/utils"

interface DashboardStatCardProps {
  label: string
  value: string | number
  trend?: {
    direction: "up" | "down"
    value: string
  }
  className?: string
}

export function DashboardStatCard({ label, value, trend, className }: DashboardStatCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-xl border border-[var(--border)] p-5 shadow-sm",
      className
    )}>
      <p className="text-sm text-[var(--muted-foreground)] mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-[var(--foreground)]">{value}</span>
        {trend && (
          <div className={cn(
            "flex items-center gap-0.5 text-sm font-medium",
            trend.direction === "up" ? "text-green-600" : "text-red-600"
          )}>
            {trend.direction === "up" ? (
              <ArrowUpIcon className="w-4 h-4" />
            ) : (
              <ArrowDownIcon className="w-4 h-4" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
