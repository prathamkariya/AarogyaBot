"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Screen, Language } from "@/app/page"

interface LandingPageProps {
  language: Language
  setLanguage: (lang: Language) => void
  setScreen: (screen: Screen) => void
  onLoginClick: (role: "asha" | "admin") => void
}

const languages: { code: Language; label: string; active: boolean }[] = [
  { code: "en", label: "English", active: true },
  { code: "hi", label: "हिंदी", active: true },
  { code: "gu", label: "ગુજરાતી", active: true },
  { code: "mr", label: "मराठी", active: true },
  { code: "ta", label: "தமிழ்", active: true }
]

const text = {
  en: {
    subtitle: "AI-powered health triage in your language",
    helpTitle: "I need help",
    helpSub: "Check your symptoms now",
    ashaTitle: "ASHA Worker Login",
    ashaSub: "Triage patients in your community",
    adminTitle: "Admin Login",
    adminSub: "View district health insights",
    footer: "Not a substitute for professional medical advice · Powered by Llama 3.3 via Groq",
  },
  hi: {
    subtitle: "आपकी भाषा में AI-संचालित स्वास्थ्य जाँच",
    helpTitle: "मुझे मदद चाहिए",
    helpSub: "अभी अपने लक्षण जाँचें",
    ashaTitle: "आशा कार्यकर्ता लॉगिन",
    ashaSub: "अपने समुदाय में मरीज़ों की जाँच करें",
    adminTitle: "एडमिन लॉगिन",
    adminSub: "जिला स्वास्थ्य जानकारी देखें",
    footer: "यह पेशेवर चिकित्सा सलाह का विकल्प नहीं है · Llama 3.3 via Groq द्वारा संचालित",
  },
  gu: {
    subtitle: "તમારી ભાષામાં AI-આધારિત સ્વાસ્થ્ય તપાસ",
    helpTitle: "મને મદદ જોઈએ",
    helpSub: "હમણાં તમારા લક્ષણો તપાસો",
    ashaTitle: "ASHA વર્કર લૉગિન",
    ashaSub: "તમારા સમુદાયમાં દર્દીઓની તપાસ કરો",
    adminTitle: "એડમિન લૉગિન",
    adminSub: "જિલ્લા આરોગ્ય માહિતી જુઓ",
    footer: "આ વ્યાવસાયિક તબીબી સલાહનો વિકલ્પ નથી · Llama 3.3 via Groq",
  },
  ta: {
    subtitle: "உங்கள் மொழியில் AI-இயக்கப்படும் சுகாதார பரிசோதனை",
    helpTitle: "எனக்கு உதவி வேண்டும்",
    helpSub: "இப்போதே உங்கள் அறிகுறிகளை சரிபாருங்கள்",
    ashaTitle: "ASHA தொழிலாளர் உள்நுழைவு",
    ashaSub: "உங்கள் சமூகத்தில் நோயாளிகளை சரிபாருங்கள்",
    adminTitle: "நிர்வாக உள்நுழைவு",
    adminSub: "மாவட்ட சுகாதார தகவல்களை பாருங்கள்",
    footer: "இது தொழில்முறை மருத்துவ ஆலோசனைக்கு மாற்றாக அல்ல · Llama 3.3 via Groq",
  },
  mr: {
    subtitle: "तुमच्या भाषेत AI-आधारित आरोग्य तपासणी",
    helpTitle: "मला मदत हवी आहे",
    helpSub: "आत्ता तुमची लक्षणे तपासा",
    ashaTitle: "आशा कार्यकर्ता लॉगिन",
    ashaSub: "तुमच्या समुदायात रुग्णांची तपासणी करा",
    adminTitle: "एडमिन लॉगिन",
    adminSub: "जिल्हा आरोग्य माहिती पहा",
    footer: "हे व्यावसायिक वैद्यकीय सल्ल्याचा पर्याय नाही · Llama 3.3 via Groq",
  },
}

export function LandingPage({ language, setLanguage, setScreen, onLoginClick }: LandingPageProps) {
  const t = text[language] ?? text.en
  const [showDonation, setShowDonation] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-6 md:py-8">
      {/* Logo & Title */}
      <div className="text-center mb-6 md:mb-8">
        {/* Logo - 64px on mobile, 96px on desktop */}
        <img
          src="/logo.png"
          alt="AarogyaBot"
          className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-3 md:mb-4 object-contain drop-shadow-lg"
        />
        {/* Title - 28px on mobile, 40px on desktop */}
        <h1 className="text-[28px] md:text-4xl font-bold text-[var(--foreground)] mb-1 md:mb-2">AarogyaBot</h1>
        {/* Subtitle - 13px on mobile */}
        <p className="text-[13px] md:text-base text-[var(--muted-foreground)]">{t.subtitle}</p>
      </div>

      {/* Language Selector - smaller on mobile */}
      <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 mb-8 md:mb-10 max-w-xs md:max-w-none">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => {
              if (lang.active) setLanguage(lang.code as Language)
            }}
            disabled={!lang.active}
            title={lang.active ? "" : "Coming soon"}
            className={cn(
              "px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[11px] md:text-sm font-medium transition-colors cursor-pointer",
              language === lang.code
                ? "bg-[var(--primary)] text-white"
                : lang.active
                ? "bg-gray-100 text-[var(--foreground)] hover:bg-gray-200"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
            style={{ cursor: lang.active ? 'pointer' : 'not-allowed' }}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* Option Cards - compact on mobile, full on desktop */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10 px-2 md:px-0">
        {/* Card 1 - Get Help */}
        <button
          onClick={() => setScreen("chat")}
          className="flex flex-row md:flex-col items-center gap-3 md:gap-3 p-3 md:p-6 rounded-xl md:rounded-2xl bg-[var(--primary)] text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 md:hover:-translate-y-1 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <StethoscopeIcon className="w-5 h-5 md:w-8 md:h-8 text-white" />
          </div>
          <div className="text-left md:text-center">
            <h2 className="text-[15px] md:text-xl font-semibold">{t.helpTitle}</h2>
            <p className="text-[12px] md:text-sm text-white/80">{t.helpSub}</p>
          </div>
        </button>

        {/* Card 2 - ASHA Worker */}
        <button
          onClick={() => onLoginClick("asha")}
          className="flex flex-row md:flex-col items-center gap-3 md:gap-3 p-3 md:p-6 rounded-xl md:rounded-2xl bg-white border-2 border-[var(--primary)] text-[var(--foreground)] shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 md:hover:-translate-y-1 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
            <NurseIcon className="w-5 h-5 md:w-8 md:h-8 text-[var(--primary)]" />
          </div>
          <div className="text-left md:text-center">
            <h2 className="text-[15px] md:text-xl font-semibold">{t.ashaTitle}</h2>
            <p className="text-[12px] md:text-sm text-[var(--muted-foreground)]">{t.ashaSub}</p>
          </div>
        </button>

        {/* Card 3 - Admin */}
        <button
          onClick={() => onLoginClick("admin")}
          className="flex flex-row md:flex-col items-center gap-3 md:gap-3 p-3 md:p-6 rounded-xl md:rounded-2xl bg-white border-2 border-[var(--primary)] text-[var(--foreground)] shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 md:hover:-translate-y-1 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
            <ChartIcon className="w-5 h-5 md:w-8 md:h-8 text-[var(--primary)]" />
          </div>
          <div className="text-left md:text-center">
            <h2 className="text-[15px] md:text-xl font-semibold">{t.adminTitle}</h2>
            <p className="text-[12px] md:text-sm text-[var(--muted-foreground)]">{t.adminSub}</p>
          </div>
        </button>
      </div>

      {/* Donate Button */}
      <button
        onClick={() => setShowDonation(true)}
        className="mb-4 flex items-center gap-2 px-5 py-2 rounded-full border-2 border-[var(--primary)] text-[var(--primary)] text-sm font-semibold hover:bg-[var(--primary)] hover:text-white transition-colors cursor-pointer"
        style={{ cursor: "pointer" }}
      >
        <HeartIcon className="w-4 h-4" />
        Support Us
      </button>

      {/* Footer - 10px on mobile */}
      <p className="text-[10px] md:text-xs text-[var(--muted-foreground)] text-center px-4">
        {t.footer}
      </p>

      {/* Donation Modal */}
      {showDonation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDonation(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--foreground)]">Support AarogyaBot 💚</h2>
            <p className="text-sm text-[var(--muted-foreground)] text-center">
              Your donation helps us bring free AI healthcare to rural India.
            </p>
            <img
              src="/donation-qr.png"
              alt="Donation QR Code"
              className="w-52 h-52 object-contain rounded-xl border border-gray-200"
            />
            <p className="text-xs text-[var(--muted-foreground)]">Scan to donate via UPI</p>
            <button
              onClick={() => setShowDonation(false)}
              className="w-full py-2 rounded-full bg-[var(--primary)] text-white text-sm font-medium cursor-pointer"
              style={{ cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

function NurseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
      <path d="M16 8c0 3.314-2 6-4 6s-4-2.686-4-6" />
      <path d="M3 21v-1a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1" />
      <path d="M10 5h4" />
      <path d="M12 3v4" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}
