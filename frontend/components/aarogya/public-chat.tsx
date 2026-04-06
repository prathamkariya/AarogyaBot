"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChatWindow, type Message } from "./chat-window"
import { InputBar } from "./input-bar"
import { speakText } from "./chat-bubble"
import type { Language } from "@/app/page"
import { toast } from "sonner"
import { generateReport, getNearestFacilities, resetSession, sendMessage } from "@/src/lib/api"

interface PublicChatProps {
  selectedLanguage: Language
  setSelectedLanguage: (lang: Language) => void
  onBack: () => void
  onShowHealthRecord: () => void
}

const languages: { code: Language; label: string; active: boolean; name: string }[] = [
  { code: "en", label: "English", active: true, name: "English" },
  { code: "hi", label: "हिंदी", active: true, name: "Hindi" },
  { code: "gu", label: "ગુજરાતી", active: true, name: "Gujarati" },
  { code: "mr", label: "मराठी", active: true, name: "Marathi" },
  { code: "ta", label: "தமிழ்", active: true, name: "Tamil" }
]

const languageNameMap: Record<Language, string> = { en: "English", hi: "Hindi", gu: "Gujarati", ta: "Tamil", mr: "Marathi" }
const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
const greeting = (lang: Language) => {
  if (lang === "hi") return "नमस्ते! मैं AarogyaBot हूं। आप अपने लक्षण बताएं — हिंदी या English में."
  if (lang === "gu") return "નમસ્તે! હું AarogyaBot છું. તમારા લક્ષણો ગુજરાતી અથવા English માં જણાવો."
  if (lang === "ta") return "வணக்கம்! நான் AarogyaBot. உங்கள் அறிகுறிகளை தமிழ் அல்லது English இல் சொல்லுங்கள்."
  if (lang === "mr") return "नमस्कार! मी AarogyaBot आहे. तुमची लक्षणे मराठी किंवा English मध्ये सांगा."
  return "Hello! I am AarogyaBot. Tell me your symptoms in English or Hindi."
}

export function PublicChat({ selectedLanguage, setSelectedLanguage, onBack }: PublicChatProps) {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup")
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ name: "", phone: "", password: "" })

  const handleOpenAuthModal = () => {
    setAuthMode("signup")
    setShowAuthModal(true)
  }

  const handleSaveYes = () => {
    setAuthMode("signup")
    setShowAuthModal(true)
  }

  const [messages, setMessages] = useState<Message[]>([{ id: "greet-1", type: "bot", message: greeting(selectedLanguage), timestamp: now() }])
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [hasTriageResult, setHasTriageResult] = useState(false)
  const previousLanguage = useRef<Language>(selectedLanguage)
  const lastTriageRef = useRef<{ tier: string; symptoms: string[]; message: string; condition_name?: string; facilities?: object[] } | null>(null)
  const lastFacilitiesRef = useRef<object[]>([])

  const fetchFacilities = async (tier: "emergency" | "clinic", lat: number, lng: number) => {
    const loadingId = `fac-load-${Date.now()}`
    setMessages((prev) => [...prev, { id: loadingId, type: "bot", timestamp: "", isLoading: true, loadingText: "Finding nearest facilities..." }])
    try {
      const facilities = await getNearestFacilities(lat, lng, tier)
      setMessages((prev) => prev.filter((m) => m.id !== loadingId))
      lastFacilitiesRef.current = facilities
      setMessages((prev) => [
        ...prev,
        {
          id: `fac-${Date.now()}`,
          type: "bot",
          timestamp: now(),
          triageCard: {
            level: tier,
            reason: tier === "emergency" ? "Nearby emergency options" : "Nearby clinics",
            nextSteps: "Choose a facility below.",
            facilities: facilities.map((f: { name: string; type: "Hospital" | "PHC" | "CHC"; road_km: number; phone: string; lat: number; lng: number }) => ({
              name: f.name,
              type: f.type,
              distance: `${f.road_km} km`,
              phone: f.phone,
              lat: f.lat,
              lng: f.lng
            }))
          }
        }
      ])
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== loadingId))
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, type: "bot", timestamp: now(), message: "Unable to fetch nearby facilities right now." }])
    }
  }

  const handleShareLocation = async (tier: "emergency" | "clinic") => {
    if (!navigator.geolocation) {
      await fetchFacilities(tier, 23.03, 72.58)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        await fetchFacilities(tier, latitude, longitude)
      },
      async (error) => {
        const msg =
          error.code === error.TIMEOUT
            ? "Location request timed out. Showing facilities for your approximate area."
            : error.code === error.POSITION_UNAVAILABLE
            ? "Location unavailable on this device. Showing facilities for your approximate area."
            : "Location access denied. Showing facilities for your approximate area."
        setMessages((prev) => [...prev, { id: `geo-fallback-${Date.now()}`, type: "bot", timestamp: now(), message: msg }])
        await fetchFacilities(tier, 23.03, 72.58)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  const handleSend = async (text: string, image?: string) => {
    if (!text.trim() && !image || isLoading) return
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, type: "user", message: text || "📷 Image sent", image, timestamp: now() }])
    const loadingId = `load-${Date.now()}`
    setMessages((prev) => [...prev, { id: loadingId, type: "bot", timestamp: "", isLoading: true, loadingText: image ? "Analyzing image..." : undefined }])
    setIsLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (sendMessage as any)(text, selectedLanguage, undefined, image ?? null)
      setServerError(false)
      setMessages((prev) => prev.filter((m) => m.id !== loadingId))
      const detectedLang = (response?.language || selectedLanguage) as Language
      if (detectedLang !== selectedLanguage) {
        setSelectedLanguage(detectedLang)
      }
      const rawTier = response?.tier as string | undefined
      const tier = rawTier === "self_care" ? "selfcare" : rawTier === "pending" || !rawTier ? undefined : rawTier as "emergency" | "clinic" | "selfcare"

      // Store for report generation
      if (tier && rawTier !== "pending") {
        lastTriageRef.current = {
          tier: rawTier!,
          symptoms: response?.symptoms ?? [],
          message: response?.message ?? "",
          condition_name: response?.condition_name ?? "",
        }
        lastFacilitiesRef.current = []
        setHasTriageResult(true)
      }

      if (image) {
        // Image flow: show explanation text → tier card → location prompt
        if (response?.message) {
          setMessages((prev) => [...prev, { id: `b-${Date.now()}`, type: "bot", message: response.message, timestamp: now() }])
          speakText(response.message, detectedLang)
        }
        if (tier) {
          setMessages((prev) => [...prev, {
            id: `t-${Date.now()}`,
            type: "bot",
            timestamp: now(),
            triageCard: { level: tier, reason: "", nextSteps: "", language: detectedLang }
          }])
          if (tier === "clinic" || tier === "emergency") {
            if (!navigator.geolocation) {
              void fetchFacilities(tier, 23.03, 72.58)
            } else {
              setMessages((prev) => [...prev, { id: `lp-${Date.now()}`, type: "bot", timestamp: now(), locationPrompt: { tier, language: detectedLang, onShareLocation: () => { void handleShareLocation(tier) } } }])
            }
          }
        }
      } else if (!tier) {
        const botText = response?.message || response?.reply || ""
        setMessages((prev) => [...prev, { id: `b-${Date.now()}`, type: "bot", message: botText, timestamp: now() }])
        speakText(botText, detectedLang)
      } else {
        const triageReason = response?.message || ""
        setMessages((prev) => [
          ...prev,
          {
            id: `t-${Date.now()}`,
            type: "bot",
            timestamp: now(),
            triageCard: {
              level: tier,
              reason: triageReason,
              nextSteps: "",
              language: detectedLang,
            }
          }
        ])
        speakText(triageReason, detectedLang)
        if (tier === "clinic" || tier === "emergency") {
          if (!navigator.geolocation) {
            void fetchFacilities(tier, 23.03, 72.58)
          } else {
            setMessages((prev) => [...prev, { id: `lp-${Date.now()}`, type: "bot", timestamp: now(), locationPrompt: { tier, language: detectedLang, onShareLocation: () => { void handleShareLocation(tier) } } }])
          }
        }
      }
    } catch {
      setServerError(true)
      setMessages((prev) => prev.filter((m) => m.id !== loadingId))
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, type: "bot", message: "Something went wrong. Please check your connection and try again.", timestamp: now() }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!lastTriageRef.current || isGeneratingReport) return
    setIsGeneratingReport(true)
    try {
      const data = await generateReport({
        ...lastTriageRef.current,
        facilities: lastFacilitiesRef.current,
      })
      const link = document.createElement("a")
      link.href = `data:application/pdf;base64,${data.pdf_base64}`
      link.download = data.filename
      link.click()
    } catch {
      toast.error("Could not generate report. Please try again.")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleNewChat = async () => {
    try {
      await resetSession()
      setServerError(false)
    } catch {
      setServerError(true)
    }
    lastTriageRef.current = null
    lastFacilitiesRef.current = []
    setHasTriageResult(false)
    setMessages([{ id: `greet-${Date.now()}`, type: "bot", message: greeting(selectedLanguage), timestamp: now() }])
  }

  useEffect(() => {
    void handleNewChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (previousLanguage.current !== selectedLanguage) {
      setMessages((prev) => [...prev, { id: `lang-${Date.now()}`, type: "system", message: `Language switched to ${languageNameMap[selectedLanguage]}`, timestamp: "" }])
      previousLanguage.current = selectedLanguage
    }
  }, [selectedLanguage])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowAuthModal(false)
    setFormData({ name: "", phone: "", password: "" })
    toast.success(authMode === "signup" ? "Account created! Your records will be saved" : "Signed in successfully!")
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header - Pure WhatsApp style */}
      <div className="bg-[var(--primary)] px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="text-white p-1 cursor-pointer hover:bg-white/10 rounded-full transition-colors"
            style={{ cursor: 'pointer' }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-base">AarogyaBot</h1>
        </div>
        <div className="flex items-center gap-1">
          {hasTriageResult && (
            <button
              onClick={() => void handleDownloadReport()}
              disabled={isGeneratingReport}
              className="text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 cursor-pointer flex items-center gap-1 disabled:opacity-60"
              style={{ cursor: isGeneratingReport ? "wait" : "pointer" }}
            >
              <DownloadIcon className="w-3 h-3" />
              {isGeneratingReport ? "..." : "Report"}
            </button>
          )}
          <button
            onClick={() => void handleNewChat()}
            className="text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 cursor-pointer"
            style={{ cursor: "pointer" }}
          >
            New Chat
          </button>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                if (lang.active) setSelectedLanguage(lang.code as Language)
              }}
              disabled={!lang.active}
              title={lang.active ? "" : "Coming soon"}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                selectedLanguage === lang.code
                  ? "bg-white text-[var(--primary)]"
                  : lang.active
                  ? "bg-white/20 text-white hover:bg-white/30"
                  : "bg-white/10 text-white/60 cursor-not-allowed"
              )}
              style={{ cursor: lang.active ? "pointer" : "not-allowed" }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
      {serverError && (
        <div className="bg-red-100 text-red-700 px-3 py-2 text-sm flex items-center justify-between">
          <span>Unable to connect to server. Please try again.</span>
          <button onClick={() => void handleNewChat()} className="underline text-red-800 cursor-pointer" style={{ cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* Chat Window - Full screen WhatsApp tan background */}
      <ChatWindow
        messages={messages}
        className="flex-1"
        language={selectedLanguage}
        onCreateAccount={handleOpenAuthModal}
      />

      {/* Input Bar - Fixed bottom */}
      <InputBar 
        onSend={handleSend}
        placeholder="अपने लक्षण लिखें / Type your symptoms..."
        language={selectedLanguage}
        isLoading={isLoading}
      />

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div>
                <h2 className="font-bold text-lg text-[var(--foreground)]">
                  {authMode === "signup" ? "Create your AarogyaBot account" : "Sign in to AarogyaBot"}
                </h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {authMode === "signup" ? "Save your health history and access it anytime" : "Access your saved health records"}
                </p>
              </div>
              <button 
                onClick={() => setShowAuthModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[var(--secondary)] flex items-center justify-center cursor-pointer"
                style={{ cursor: 'pointer' }}
              >
                <XIcon className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-4 space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2.5 bg-[var(--secondary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2.5 bg-[var(--secondary)] border-r border-[var(--border)] rounded-l-lg text-sm text-[var(--muted-foreground)]">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    className="flex-1 px-3 py-2.5 bg-[var(--secondary)] rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    className="w-full px-3 py-2.5 pr-10 bg-[var(--secondary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] cursor-pointer"
                    style={{ cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                style={{ cursor: 'pointer' }}
              >
                {authMode === "signup" ? "Create Account" : "Sign In"}
              </button>

              <p className="text-center text-sm text-[var(--muted-foreground)]">
                {authMode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button 
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="text-[var(--primary)] font-medium hover:underline cursor-pointer"
                      style={{ cursor: 'pointer' }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    {"Don't have an account?"}{" "}
                    <button 
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className="text-[var(--primary)] font-medium hover:underline cursor-pointer"
                      style={{ cursor: 'pointer' }}
                    >
                      Create one
                    </button>
                  </>
                )}
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
