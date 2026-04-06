import { cn } from "@/lib/utils"
import { UrgencyBadge, type UrgencyLevel } from "./urgency-badge"
import { FacilityCard } from "./facility-card"

interface TriageCardProps {
  level: UrgencyLevel
  reason: string
  nextSteps: string
  careSteps?: string[]
  language?: string
  facilities?: Array<{
    name: string
    type: "Hospital" | "PHC" | "CHC"
    distance: string
    phone: string
    lat?: number
    lng?: number
  }>
  className?: string
}

const levelConfig = {
  emergency: {
    borderColor: "border-l-red-500",
    buttonBg: "bg-red-500 hover:bg-red-600",
    buttonText: { en: "Call 108 Now", hi: "108 पर कॉल करें" }
  },
  clinic: {
    borderColor: "border-l-amber-500",
    buttonBg: "bg-amber-500 hover:bg-amber-600",
    buttonText: { en: "Get Directions", hi: "दिशा-निर्देश पाएं" }
  },
  selfcare: {
    borderColor: "border-l-green-500",
    buttonBg: "bg-green-500 hover:bg-green-600",
    buttonText: { en: "", hi: "" }
  }
}

export function TriageCard({
  level,
  reason,
  nextSteps,
  careSteps,
  language,
  facilities,
  className
}: TriageCardProps) {
  const config = levelConfig[level]
  const lang = language === "hi" ? "hi" : "en"

  return (
    <div className={cn(
      "bg-white rounded-lg border border-[var(--border)] border-l-4 shadow-sm overflow-hidden",
      config.borderColor,
      className
    )}>
      <div className="p-4">
        <UrgencyBadge level={level} size="md" className="mb-3" />
        
        <p className="font-semibold text-[var(--foreground)] mb-2 whitespace-pre-wrap">{reason}</p>
        {nextSteps ? <p className="text-sm text-[var(--muted-foreground)] mb-4">{nextSteps}</p> : null}

        {level === "selfcare" && careSteps && (
          <ol className="list-decimal list-inside space-y-1 mb-4">
            {careSteps.map((step, i) => (
              <li key={i} className="text-sm text-[var(--foreground)]">{step}</li>
            ))}
          </ol>
        )}

        {facilities && facilities.length > 0 && (
          <div className="space-y-2 mb-4">
            {facilities.map((facility, i) => (
              <FacilityCard key={i} {...facility} />
            ))}
          </div>
        )}

        {level !== "selfcare" && (
          <button
            onClick={() => {
              if (level === "emergency") window.location.href = "tel:108"
            }}
            className={cn(
            "w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-colors",
            config.buttonBg
          )}>
            {level === "emergency" ? (
              <>
                <PhoneIcon className="w-5 h-5" />
                {config.buttonText[lang]}
              </>
            ) : (
              <>
                <MapPinIcon className="w-5 h-5" />
                {config.buttonText[lang]}
              </>
            )}
          </button>
        )}

        {level === "selfcare" && (
          <p className="text-xs text-[var(--muted-foreground)] italic">
            {lang === "hi"
              ? "अगर लक्षण बिगड़ें तो तुरंत नजदीकी स्वास्थ्य केंद्र जाएं।"
              : "If symptoms worsen, please visit a healthcare facility immediately."}
          </p>
        )}
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
