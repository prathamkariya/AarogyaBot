"use client"

import { useState, useEffect } from "react"
import { DashboardStatCard } from "./dashboard-stat-card"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { signOut } from "@/src/lib/auth-client"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

interface AdminDashboardProps {
  onBack: () => void
}

interface StatsData {
  total_triages_today: number
  emergencies_today: number
  urgency_distribution: { name: string; value: number; color: string }[]
  top_symptoms: { name: string; count: number }[]
  recent_emergencies: { id: string; symptom: string; time: string; language: string }[]
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  const fetchStats = async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${BASE_URL}/stats`, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      setStats(data)
      setError(null)
      setLastUpdated(new Date())
      setSecondsAgo(0)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg.includes("abort") ? "Request timed out — backend may be sleeping" : msg)
    } finally {
      setLoading(false)
    }
  }

  // Poll every 15s
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Live "X seconds ago" counter
  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  const urgencyData = stats?.urgency_distribution ?? []
  const symptomData = stats?.top_symptoms ?? []
  const recentEmergencies = stats?.recent_emergencies ?? []

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Fixed Header */}
      <div className="bg-[var(--primary)] px-3 py-2.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-white p-1 cursor-pointer hover:bg-white/10 rounded-full transition-colors"
            style={{ cursor: "pointer" }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-base">District Health Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); fetchStats() }}
            className="text-white/80 hover:text-white text-xs flex items-center gap-1"
            style={{ cursor: "pointer" }}
          >
            <RefreshIcon className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => signOut().then(onBack)}
            className="text-white/80 hover:text-white text-xs flex items-center gap-1"
            style={{ cursor: "pointer" }}
          >
            <SignOutIcon className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Subtitle / error bar */}
      <div className="bg-white border-b border-[var(--border)] px-3 py-1.5 flex items-center justify-between">
        <p className="text-xs text-[var(--muted-foreground)]">Live data · auto-refresh 15s</p>
        {error ? (
          <p className="text-xs text-red-500 flex items-center gap-1">
            ⚠ {error}
          </p>
        ) : lastUpdated ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Updated {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
          </p>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4 px-3 md:px-4">
        <div className="max-w-7xl mx-auto">

          {loading && !stats ? (
            <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm">
              Loading live data...
            </div>
          ) : error && !stats ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-sm text-red-500 text-center max-w-xs">{error}</p>
              <button
                onClick={() => { setLoading(true); fetchStats() }}
                className="px-4 py-2 rounded-full bg-[var(--primary)] text-white text-sm cursor-pointer"
                style={{ cursor: "pointer" }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                <DashboardStatCard
                  label="Total Triages Today"
                  value={stats?.total_triages_today ?? 0}
                />
                <DashboardStatCard
                  label="Emergencies Today"
                  value={stats?.emergencies_today ?? 0}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                {/* Urgency Distribution */}
                <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 shadow-sm">
                  <h2 className="font-semibold text-[var(--foreground)] mb-4 text-sm md:text-base">Urgency Distribution</h2>
                  {urgencyData.every(d => d.value === 0) ? (
                    <div className="h-48 flex items-center justify-center text-sm text-[var(--muted-foreground)]">No data yet today</div>
                  ) : (
                    <>
                      <div className="h-48 md:h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={urgencyData.filter(d => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, value }) => `${name} (${value})`}
                              labelLine={false}
                            >
                              {urgencyData.filter(d => d.value > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 md:gap-6 mt-3 md:mt-4">
                        {urgencyData.map((item) => (
                          <div key={item.name} className="flex items-center gap-1.5 md:gap-2">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-xs md:text-sm text-[var(--muted-foreground)]">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Top Symptoms */}
                <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 shadow-sm">
                  <h2 className="font-semibold text-[var(--foreground)] mb-4 text-sm md:text-base">Top Symptoms Today</h2>
                  {symptomData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm text-[var(--muted-foreground)]">No data yet today</div>
                  ) : (
                    <div className="h-48 md:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={symptomData} layout="vertical" margin={{ left: 10 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#075E54" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Emergencies */}
              <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 shadow-sm mb-20">
                <h2 className="font-semibold text-[var(--foreground)] mb-4 text-sm md:text-base">Recent Emergencies Today</h2>
                {recentEmergencies.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">No emergencies recorded today.</p>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    {recentEmergencies.map((emergency, i) => (
                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-2.5 md:p-3 bg-[var(--secondary)]/30 rounded-lg">
                        <div className="flex-1">
                          <span className="text-xs md:text-sm font-medium text-[var(--foreground)]">Case #{emergency.id}</span>
                          <p className="text-xs md:text-sm text-[var(--muted-foreground)]">{emergency.symptom}</p>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm">
                          <span className="text-[var(--muted-foreground)]">{emergency.time}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                            Emergency
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  )
}
