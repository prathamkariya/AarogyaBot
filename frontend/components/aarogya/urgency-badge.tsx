import { cn } from "@/lib/utils"

export type UrgencyLevel = "emergency" | "clinic" | "selfcare"

interface UrgencyBadgeProps {
  level: UrgencyLevel
  size?: "sm" | "md" | "lg"
  className?: string
}

const urgencyConfig = {
  emergency: {
    label: "EMERGENCY",
    emoji: "🔴",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    borderColor: "border-red-500"
  },
  clinic: {
    label: "VISIT CLINIC",
    emoji: "🟡",
    bgColor: "bg-amber-100",
    textColor: "text-amber-700",
    borderColor: "border-amber-500"
  },
  selfcare: {
    label: "SELF-CARE",
    emoji: "🟢",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    borderColor: "border-green-500"
  }
}

export function UrgencyBadge({ level, size = "md", className }: UrgencyBadgeProps) {
  const config = urgencyConfig[level]
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base font-semibold"
  }

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.bgColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  )
}
