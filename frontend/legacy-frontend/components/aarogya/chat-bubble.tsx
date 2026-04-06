import { cn } from "@/lib/utils"
import { TriageCard } from "./triage-card"
import type { UrgencyLevel } from "./urgency-badge"

interface ChatBubbleProps {
  type: "user" | "bot" | "system"
  message?: string
  image?: string
  timestamp: string
  isLoading?: boolean
  loadingText?: string
  triageCard?: {
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
  }
  locationPrompt?: {
    tier: "emergency" | "clinic"
    language?: string
    onShareLocation: () => void
  }
  buttons?: Array<{
    label: string
    onClick: () => void
  }>
  savePrompt?: boolean
  onCreateAccount?: () => void
  className?: string
}

export function ChatBubble({
  type,
  message,
  image,
  timestamp,
  isLoading,
  loadingText,
  triageCard,
  locationPrompt,
  buttons,
  savePrompt,
  onCreateAccount,
  className
}: ChatBubbleProps) {
  const isUser = type === "user"
  const isSystem = type === "system"

  if (isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs">{message}</span>
      </div>
    )
  }
  
  return (
    <div className={cn(
      "flex items-end gap-2 mb-3",
      isUser ? "justify-end" : "justify-start",
      className
    )}>
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
          <CrossIcon className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Bubble */}
      <div className={cn(
        "max-w-[80%] md:max-w-[70%] shadow-sm",
        isUser 
          ? "bg-[var(--user-bubble)] rounded-2xl rounded-br-md" 
          : "bg-[var(--bot-bubble)] rounded-2xl rounded-bl-md"
      )}>
        {isLoading ? (
          <div className="px-4 py-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse animation-delay-150" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse animation-delay-300" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{loadingText || "Analyzing symptoms..."}</p>
          </div>
        ) : (
          <>
            {image && (
              <img
                src={`data:image/jpeg;base64,${image}`}
                alt="sent"
                className="rounded-xl rounded-br-none w-48 object-cover"
              />
            )}
            {message && (
              <p className="px-4 py-2 text-[var(--foreground)] text-sm leading-relaxed">
                {message}
              </p>
            )}

            {triageCard && (
              <div className="p-2">
                <TriageCard {...triageCard} />
              </div>
            )}

            {locationPrompt && (
              <div className="px-4 pb-3">
                <p className="text-sm text-[var(--foreground)] mb-2">
                  {locationPrompt.language === "hi"
                    ? "नजदीकी स्वास्थ्य सुविधा खोजने के लिए मुझे आपकी लोकेशन चाहिए। कृपया लोकेशन एक्सेस दें।"
                    : "To find the nearest healthcare facility, I need your location. Please allow location access."}
                </p>
                <button
                  onClick={locationPrompt.onShareLocation}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium cursor-pointer"
                  style={{ cursor: "pointer" }}
                >
                  {locationPrompt.language === "hi" ? "📍 मेरी लोकेशन शेयर करें" : "📍 Share My Location"}
                </button>
              </div>
            )}

            {buttons && buttons.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {buttons.map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.onClick}
                    className="px-3 py-1.5 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-full text-sm font-medium text-[var(--foreground)] transition-colors cursor-pointer"
                    style={{ cursor: 'pointer' }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}

            {/* Save prompt with create account link */}
            {savePrompt && onCreateAccount && (
              <div className="px-4 pb-2">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Want to save your history for next time?{" "}
                  <button 
                    onClick={onCreateAccount}
                    className="text-[var(--primary)] underline hover:no-underline cursor-pointer"
                    style={{ cursor: 'pointer' }}
                  >
                    Create a free account
                  </button>
                </p>
              </div>
            )}

            <p className={cn(
              "px-4 pb-2 text-[10px] text-[var(--muted-foreground)]",
              isUser ? "text-right" : "text-left"
            )}>
              {timestamp}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM17 13H13V17H11V13H7V11H11V7H13V11H17V13Z" />
    </svg>
  )
}
