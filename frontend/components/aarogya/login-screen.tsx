"use client"

import { useState } from "react"
import { signIn } from "@/src/lib/auth-client"
import type { Language } from "@/app/page"

interface LoginScreenProps {
  role: "asha" | "admin"
  language?: Language
  onSuccess: () => void
  onBack: () => void
}

const copy = {
  asha: {
    title: "ASHA Worker Login",
    subtitle: "Triage patients in your community",
    demoEmail: "asha@demo.com",
    demoPassword: "asha1234",
    demoLabel: "ASHA Demo Account",
  },
  admin: {
    title: "Admin Login",
    subtitle: "View district health insights",
    demoEmail: "admin@demo.com",
    demoPassword: "admin1234",
    demoLabel: "Admin Demo Account",
  },
}

export function LoginScreen({ role, onSuccess, onBack }: LoginScreenProps) {
  const c = copy[role]
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = await signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message || "Invalid credentials")
      } else {
        // Verify role matches
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userRole = (result.data?.user as any)?.role
        if (userRole && userRole !== role) {
          setError(`This account is not authorized as ${role}.`)
          return
        }
        onSuccess()
      }
    } catch {
      setError("Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setEmail(c.demoEmail)
    setPassword(c.demoPassword)
    setError("")
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        style={{ cursor: "pointer" }}
      >
        <ArrowLeftIcon className="w-5 h-5" />
      </button>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-lg">
            {role === "asha" ? (
              <NurseIcon className="w-8 h-8 text-white" />
            ) : (
              <ChartIcon className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{c.title}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{c.subtitle}</p>
        </div>

        {/* Demo credentials hint */}
        <button
          type="button"
          onClick={fillDemo}
          className="w-full mb-4 p-3 rounded-xl border-2 border-dashed border-[var(--primary)]/40 bg-[var(--primary)]/5 text-left hover:bg-[var(--primary)]/10 transition-colors cursor-pointer"
          style={{ cursor: "pointer" }}
        >
          <p className="text-xs font-semibold text-[var(--primary)] mb-1">Demo · {c.demoLabel}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{c.demoEmail} · {c.demoPassword}</p>
          <p className="text-[10px] text-[var(--primary)]/60 mt-1">Tap to fill automatically</p>
        </button>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            style={{ cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function NurseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
