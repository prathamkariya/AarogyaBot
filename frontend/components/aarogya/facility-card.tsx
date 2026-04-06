import { cn } from "@/lib/utils"

interface FacilityCardProps {
  name: string
  type: "Hospital" | "PHC" | "CHC"
  distance: string
  phone: string
  lat?: number
  lng?: number
  className?: string
}

const typeColors = {
  Hospital: "bg-green-100 text-green-700",
  PHC: "bg-blue-100 text-blue-700",
  CHC: "bg-amber-100 text-amber-700"
}

export function FacilityCard({ name, type, distance, phone, lat, lng, className }: FacilityCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-lg border border-[var(--border)] p-3 shadow-sm",
      className
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-semibold text-[var(--foreground)] text-sm">{name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              typeColors[type]
            )}>
              {type}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">{distance}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-2">{phone}</p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (lat != null && lng != null) {
              window.open(`https://maps.google.com/?q=${lat},${lng}`, "_blank")
            }
          }}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-md text-xs font-medium text-[var(--foreground)] transition-colors"
        >
          <MapPinIcon className="w-3 h-3" />
          Directions
        </button>
        <button
          onClick={() => {
            window.location.href = `tel:${phone}`
          }}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-md text-xs font-medium text-[var(--foreground)] transition-colors"
        >
          <PhoneIcon className="w-3 h-3" />
          Call
        </button>
      </div>
    </div>
  )
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}
