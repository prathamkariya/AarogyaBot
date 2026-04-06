"use client"

import { useState, useEffect } from "react"

// ── Hardcoded demo credentials ────────────────────────────
const DEMO_USERS: Record<string, { password: string; role: string; name: string; rating?: number }> = {
  "asha@demo.com":  { password: "asha1234",  role: "asha",  name: "ASHA Demo",  rating: 4.2 },
  "admin@demo.com": { password: "admin1234", role: "admin", name: "Admin Demo" },
}

const SESSION_KEY = "aarogya_auth_session"

type SessionUser = { email: string; role: string; name: string; rating?: number }

// ── signIn ────────────────────────────────────────────────
export async function signIn(
  _method: "email",
  { email, password }: { email: string; password: string }
): Promise<{ data: { user: SessionUser } | null; error: { message: string } | null }> {
  const user = DEMO_USERS[email.toLowerCase().trim()]
  if (!user || user.password !== password) {
    return { data: null, error: { message: "Invalid credentials" } }
  }
  const sessionUser: SessionUser = { email, role: user.role, name: user.name, rating: user.rating }
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
    window.dispatchEvent(new Event("aarogya-session-update"))
  }
  return { data: { user: sessionUser }, error: null }
}

// Overload so existing call sites work: signIn.email({ email, password })
signIn.email = (body: { email: string; password: string }) => signIn("email", body)

// ── signOut ───────────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY)
    window.dispatchEvent(new Event("aarogya-session-update"))
  }
}

// ── useSession ────────────────────────────────────────────
export function useSession(): {
  data: { user: SessionUser } | null
  isPending: boolean
} {
  const [data, setData] = useState<{ user: SessionUser } | null>(null)
  const [isPending, setIsPending] = useState(true)

  useEffect(() => {
    const read = () => {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        try { setData({ user: JSON.parse(stored) }) } catch { setData(null) }
      } else {
        setData(null)
      }
      setIsPending(false)
    }
    read()
    window.addEventListener("aarogya-session-update", read)
    return () => window.removeEventListener("aarogya-session-update", read)
  }, [])

  return { data, isPending }
}

export const authClient = { signIn, signOut, useSession }
