import { cn } from "@/lib/utils"
import { TriageCard } from "./triage-card"
import type { UrgencyLevel } from "./urgency-badge"

const TTS_LANG_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", gu: "gu-IN", ta: "ta-IN", mr: "mr-IN",
}

export function speakText(text: string, lang: string = "en") {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const langCode = TTS_LANG_MAP[lang] || "en-IN"
  utterance.lang = langCode
  utterance.rate = 0.9
  const voices = window.speechSynthesis.getVoices()
  const voice = voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(lang))
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

interface ChatBubbleProps {
  type: "user" | "bot" | "system"
  message?: string
  image?: string
  timestamp: string
  isLoading?: boolean
  loadingText?: string
  language?: string
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
  language,
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
        <div className="w-8 h-8 rounded-full bg-white border border-[var(--border)] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
          <img src="/logo.png" alt="" className="w-6 h-6 object-contain" />
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
                    ? "नजदीकी स्वास्थ्य सुविधा खोजने के लिए मुझे आपकी लोकेशन चाहिए।"
                    : locationPrompt.language === "mr"
                    ? "जवळची आरोग्य सुविधा शोधण्यासाठी मला तुमचे स्थान हवे आहे."
                    : locationPrompt.language === "gu"
                    ? "નજીકની આરોગ્ય સુવિધા શોધવા માટે મારે તમારું સ્થાન જોઈએ."
                    : locationPrompt.language === "ta"
                    ? "அருகிலுள்ள மருத்துவமனை கண்டுபிடிக்க உங்கள் இருப்பிடம் தேவை."
                    : "To find the nearest healthcare facility, I need your location."}
                </p>
                <button
                  onClick={locationPrompt.onShareLocation}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium cursor-pointer"
                  style={{ cursor: "pointer" }}
                >
                  {locationPrompt.language === "hi"
                    ? "📍 मेरी लोकेशन शेयर करें"
                    : locationPrompt.language === "mr"
                    ? "📍 माझे स्थान शेअर करा"
                    : locationPrompt.language === "gu"
                    ? "📍 મારું સ્થાન શેર કરો"
                    : locationPrompt.language === "ta"
                    ? "📍 என் இருப்பிடம் பகிரவும்"
                    : "📍 Share My Location"}
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

            <div className={cn(
              "px-4 pb-2 flex items-center gap-1.5",
              isUser ? "justify-end" : "justify-start"
            )}>
              <span className="text-[10px] text-[var(--muted-foreground)]">{timestamp}</span>
              {!isUser && (message || triageCard?.reason) && (
                <button
                  onClick={() => {
                    if (window.speechSynthesis?.speaking) {
                      window.speechSynthesis.cancel()
                      return
                    }
                    speakText(message || triageCard?.reason || "", language || triageCard?.language || "en")
                  }}
                  className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                  style={{ cursor: "pointer" }}
                  title="Listen"
                >
                  <SpeakerIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}
