"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { UrgencyBadge, type UrgencyLevel } from "./urgency-badge"

interface Patient {
  id: string
  name: string
  age: number
  gender: "M" | "F"
  urgency: UrgencyLevel
  lastSymptom: string
  date: string
}

interface PatientSidebarProps {
  patients: Patient[]
  activePatientId: string | null
  onSelectPatient: (id: string) => void
  onAddPatient: () => void
  className?: string
}

export function PatientSidebar({ 
  patients, 
  activePatientId, 
  onSelectPatient, 
  onAddPatient,
  className 
}: PatientSidebarProps) {
  const [search, setSearch] = useState("")

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={cn("flex flex-col h-full bg-white border-r border-[var(--border)]", className)}>
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[var(--foreground)] text-lg">My Patients</h2>
          <button 
            onClick={onAddPatient}
            className="w-8 h-8 rounded-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 flex items-center justify-center text-white transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--secondary)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          />
        </div>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPatients.map((patient) => (
          <button
            key={patient.id}
            onClick={() => onSelectPatient(patient.id)}
            className={cn(
              "w-full p-4 text-left border-b border-[var(--border)] hover:bg-[var(--secondary)]/50 transition-colors",
              activePatientId === patient.id && "border-l-4 border-l-[var(--primary)] bg-[var(--secondary)]/50"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-[var(--foreground)]">{patient.name}</h3>
              <UrgencyBadge level={patient.urgency} size="sm" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-1">
              {patient.age}{patient.gender}
            </p>
            <p className="text-sm text-[var(--muted-foreground)] truncate">{patient.lastSymptom}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{patient.date}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}
