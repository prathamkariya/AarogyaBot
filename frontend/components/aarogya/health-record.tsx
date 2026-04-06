"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { UrgencyBadge } from "./urgency-badge"
import { SymptomTimeline } from "./symptom-timeline"
import type { Language } from "@/app/page"

interface HealthRecordProps {
  onBack: () => void
  language: Language
}

const dummyPatient = {
  name: "Sunita Devi",
  age: 42,
  gender: "F",
  currentUrgency: "clinic" as const,
  lastVisit: "March 21, 2026",
  totalVisits: 8
}

const dummyTimeline = [
  {
    id: "1",
    date: "March 21, 2026",
    symptoms: ["Fever", "Weakness", "Body ache"],
    urgency: "clinic" as const,
    doctorSeen: "Dr. Sharma, Civil Hospital"
  },
  {
    id: "2",
    date: "February 15, 2026",
    symptoms: ["Cold", "Cough"],
    urgency: "selfcare" as const
  },
  {
    id: "3",
    date: "January 8, 2026",
    symptoms: ["Stomach pain", "Nausea"],
    urgency: "clinic" as const,
    doctorSeen: "Dr. Gupta, PHC Odhav"
  },
  {
    id: "4",
    date: "December 20, 2025",
    symptoms: ["High fever", "Chills", "Severe headache"],
    urgency: "emergency" as const,
    doctorSeen: "Emergency - LG Hospital"
  }
]

const dummyMedicines = ["Paracetamol", "ORS", "Vitamin C", "Calcium Tablets"]

const dummyDoctors = [
  { name: "Dr. Sharma", specialty: "General Medicine", date: "Mar 21, 2026", facility: "Civil Hospital" },
  { name: "Dr. Gupta", specialty: "General Medicine", date: "Jan 8, 2026", facility: "PHC Odhav" },
  { name: "Dr. Emergency", specialty: "Emergency Care", date: "Dec 20, 2025", facility: "LG Hospital" }
]

export function HealthRecord({ onBack }: HealthRecordProps) {
  const [isPrivate, setIsPrivate] = useState(true)

  return (
    <div className="min-h-screen bg-[var(--background)] py-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Patient Header */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-bold text-2xl">
                {dummyPatient.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--foreground)]">{dummyPatient.name}</h1>
                <p className="text-[var(--muted-foreground)]">{dummyPatient.age}{dummyPatient.gender}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                isPrivate 
                  ? "bg-gray-100 text-gray-700" 
                  : "bg-green-100 text-green-700"
              )}
            >
              {isPrivate ? "Private" : "Shared"}
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--muted-foreground)] uppercase mb-1">Current Status</p>
              <UrgencyBadge level={dummyPatient.currentUrgency} size="md" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] uppercase mb-1">Last Visit</p>
              <p className="text-sm font-medium text-[var(--foreground)]">{dummyPatient.lastVisit}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] uppercase mb-1">Total Visits</p>
              <p className="text-sm font-medium text-[var(--foreground)]">{dummyPatient.totalVisits}</p>
            </div>
          </div>
        </div>

        {/* Symptom Timeline */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Symptom Timeline</h2>
          <SymptomTimeline entries={dummyTimeline} />
        </div>

        {/* Medicines */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Medicines</h2>
          <div className="flex flex-wrap gap-2">
            {dummyMedicines.map((med, i) => (
              <span 
                key={i}
                className="px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm font-medium"
              >
                {med}
              </span>
            ))}
          </div>
        </div>

        {/* Doctors Visited */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Doctors Visited</h2>
          <div className="space-y-3">
            {dummyDoctors.map((doc, i) => (
              <div key={i} className="flex items-start justify-between p-3 bg-[var(--secondary)]/50 rounded-lg">
                <div>
                  <p className="font-medium text-[var(--foreground)]">{doc.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{doc.specialty}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{doc.facility}</p>
                </div>
                <span className="text-sm text-[var(--muted-foreground)]">{doc.date}</span>
              </div>
            ))}
          </div>
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
