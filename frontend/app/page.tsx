"use client"

import { useState } from "react"
import { LandingPage } from "@/components/aarogya/landing-page"
import { PublicChat } from "@/components/aarogya/public-chat"
import { ASHADashboard } from "@/components/aarogya/asha-dashboard"
import { HealthRecord } from "@/components/aarogya/health-record"
import { AdminDashboard } from "@/components/aarogya/admin-dashboard"
import { LoginScreen } from "@/components/aarogya/login-screen"
import { WhatsAppButton } from "@/components/aarogya/whatsapp-button"
import { useSession } from "@/src/lib/auth-client"

export type Screen = "landing" | "chat" | "asha" | "health-record" | "admin" | "login"
export type Language = "en" | "hi" | "gu" | "ta" | "mr"
export const languageMap = { English: "en", "हिंदी": "hi" } as const

export default function AarogyaBot() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("landing")
  const [loginRole, setLoginRole] = useState<"asha" | "admin">("asha")
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en")
  const [showHealthRecord, setShowHealthRecord] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const { data: session } = useSession()

  const handleScreenChange = (screen: Screen) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentScreen(screen)
      setIsTransitioning(false)
    }, 150)
  }

  const goToLogin = (role: "asha" | "admin") => {
    setLoginRole(role)
    handleScreenChange("login")
  }

  const isChatScreen = currentScreen === "chat" || currentScreen === "asha"

  const renderScreen = () => {
    if (showHealthRecord) {
      return (
        <HealthRecord
          onBack={() => setShowHealthRecord(false)}
          language={selectedLanguage}
        />
      )
    }

    switch (currentScreen) {
      case "landing":
        return (
          <LandingPage
            language={selectedLanguage}
            setLanguage={setSelectedLanguage}
            setScreen={handleScreenChange}
            onLoginClick={goToLogin}
          />
        )
      case "login":
        return (
          <LoginScreen
            role={loginRole}
            language={selectedLanguage}
            onSuccess={() => handleScreenChange(loginRole)}
            onBack={() => handleScreenChange("landing")}
          />
        )
      case "chat":
        return (
          <PublicChat
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            onBack={() => handleScreenChange("landing")}
            onShowHealthRecord={() => setShowHealthRecord(true)}
          />
        )
      case "asha":
        return (
          <ASHADashboard
            selectedLanguage={selectedLanguage}
            onBack={() => handleScreenChange("landing")}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workerName={(session?.user as any)?.name}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rating={(session?.user as any)?.rating}
          />
        )
      case "health-record":
        return (
          <HealthRecord
            onBack={() => handleScreenChange("landing")}
            language={selectedLanguage}
          />
        )
      case "admin":
        return (
          <AdminDashboard
            onBack={() => handleScreenChange("landing")}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <main className="flex-1">
        <div
          className={`
            h-full transition-all duration-300 ease-in-out
            ${isTransitioning ? 'opacity-0' : 'opacity-100'}
          `}
        >
          {renderScreen()}
        </div>
      </main>

      <WhatsAppButton isOnChatScreen={isChatScreen} />
    </div>
  )
}
