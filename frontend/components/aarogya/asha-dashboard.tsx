"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChatWindow, type Message } from "./chat-window"
import { InputBar } from "./input-bar"
import { UrgencyBadge } from "./urgency-badge"
import type { Language } from "@/app/page"
import type { UrgencyLevel } from "./urgency-badge"
import { getNearestFacilities, resetSession, sendMessage } from "@/src/lib/api"
import { signOut } from "@/src/lib/auth-client"
import { speakText } from "./chat-bubble"

interface ASHADashboardProps {
  selectedLanguage: Language
  onBack: () => void
  workerName?: string
  rating?: number
}

interface Patient {
  id: string
  name: string
  age: number
  gender: "M" | "F"
  urgency: UrgencyLevel
  lastSymptom: string
  date: string
  dateValue: Date
  symptoms: string[]
  duration: string
  medicines?: string[]
  doctorReferral?: string
}

const dummyPatients: Patient[] = [
  {
    id: "1",
    name: "Sunita Devi",
    age: 42,
    gender: "F",
    urgency: "clinic",
    lastSymptom: "Fever, weakness, body ache",
    date: "Today, 10:30 AM",
    dateValue: new Date(),
    symptoms: ["Fever", "Weakness", "Body ache"],
    duration: "3 days",
    medicines: ["Paracetamol", "ORS"],
    doctorReferral: "Dr. Sharma, Civil Hospital"
  },
  {
    id: "2",
    name: "Ramesh Kumar",
    age: 58,
    gender: "M",
    urgency: "emergency",
    lastSymptom: "Chest pain, difficulty breathing",
    date: "Today, 9:15 AM",
    dateValue: new Date(),
    symptoms: ["Chest pain", "Difficulty breathing"],
    duration: "2 hours",
    doctorReferral: "Emergency - Civil Hospital"
  },
  {
    id: "3",
    name: "Priya Patel",
    age: 28,
    gender: "F",
    urgency: "selfcare",
    lastSymptom: "Mild cold, runny nose",
    date: "Yesterday",
    dateValue: new Date(Date.now() - 86400000),
    symptoms: ["Cold", "Runny nose"],
    duration: "2 days",
    medicines: ["Rest", "Warm water"]
  },
  {
    id: "4",
    name: "Mohan Singh",
    age: 65,
    gender: "M",
    urgency: "clinic",
    lastSymptom: "Joint pain, swelling",
    date: "Mar 18, 2026",
    dateValue: new Date("2026-03-18"),
    symptoms: ["Joint pain", "Swelling"],
    duration: "1 week",
    medicines: ["Pain relief"],
    doctorReferral: "Dr. Gupta, PHC"
  },
  {
    id: "5",
    name: "Kamla Bai",
    age: 55,
    gender: "F",
    urgency: "clinic",
    lastSymptom: "Dizziness, headache",
    date: "Mar 17, 2026",
    dateValue: new Date("2026-03-17"),
    symptoms: ["Dizziness", "Headache"],
    duration: "5 days",
    medicines: ["BP medication"],
    doctorReferral: "Dr. Shah, LG Hospital"
  }
]

type FilterType = "all" | UrgencyLevel
type SortType = "urgency" | "recent" | "name"

const urgencyPriority: Record<UrgencyLevel, number> = {
  emergency: 0,
  clinic: 1,
  selfcare: 2
}

const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

export function ASHADashboard({ onBack, selectedLanguage, workerName, rating }: ASHADashboardProps) {
  const [patients, setPatients] = useState<Patient[]>(dummyPatients)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientMessages, setPatientMessages] = useState<Record<string, Message[]>>({})
  const [loadingByPatient, setLoadingByPatient] = useState<Record<string, boolean>>({})
  const [serverError, setServerError] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [slideDirection, setSlideDirection] = useState<"in" | "out">("in")
  const [filter, setFilter] = useState<FilterType>("all")
  const [sort, setSort] = useState<SortType>("urgency")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [newName, setNewName] = useState("")
  const [newAge, setNewAge] = useState("")
  const [newGender, setNewGender] = useState<"M" | "F">("M")

  const previousLanguage = useRef<Language>(selectedLanguage)
  const languageNameMap: Record<Language, string> = { en: "English", hi: "Hindi" }

  const getSessionForPatient = (patientId: string) => `asha_${patientId}`
  const getMessages = (patientId: string) =>
    patientMessages[patientId] || [{ id: `greet-${patientId}`, type: "bot", message: "Please share the patient's symptoms.", timestamp: now() }]

  const updatePatientMessages = (patientId: string, updater: (prev: Message[]) => Message[]) => {
    setPatientMessages((prev) => ({ ...prev, [patientId]: updater(prev[patientId] || getMessages(patientId)) }))
  }

  const handleAddPatient = () => {
    if (!newName.trim() || !newAge) return
    const id = `p_${Date.now()}`
    const newPatient: Patient = {
      id,
      name: newName.trim(),
      age: parseInt(newAge),
      gender: newGender,
      urgency: "selfcare",
      lastSymptom: "New patient",
      date: "Just now",
      dateValue: new Date(),
      symptoms: [],
      duration: "-",
    }
    setPatients(prev => [newPatient, ...prev])
    setNewName("")
    setNewAge("")
    setNewGender("M")
    setShowAddPatient(false)
  }

  const filteredAndSortedPatients = useMemo(() => {
    let list = patients.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lastSymptom.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (filter !== "all") {
      list = list.filter(p => p.urgency === filter)
    }

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "urgency":
          return urgencyPriority[a.urgency] - urgencyPriority[b.urgency]
        case "recent":
          return b.dateValue.getTime() - a.dateValue.getTime()
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return list
  }, [patients, searchQuery, filter, sort])

  const handleSelectPatient = (patient: Patient) => {
    setSlideDirection("in")
    setIsTransitioning(true)
    setTimeout(() => {
      setSelectedPatient(patient)
      setIsTransitioning(false)
    }, 50)
  }

  const handleBackToList = () => {
    setSlideDirection("out")
    setIsTransitioning(true)
    setTimeout(() => {
      setSelectedPatient(null)
      setIsTransitioning(false)
    }, 300)
  }

  const fetchFacilities = async (patientId: string, tier: "emergency" | "clinic", lat: number, lng: number) => {
    const loadingId = `fac-load-${Date.now()}`
    updatePatientMessages(patientId, (prev) => [...prev, { id: loadingId, type: "bot", timestamp: "", isLoading: true, loadingText: "Finding nearest facilities..." }])
    try {
      const facilities = await getNearestFacilities(lat, lng, tier)
      updatePatientMessages(patientId, (prev) => prev.filter((m) => m.id !== loadingId))
      updatePatientMessages(patientId, (prev) => [...prev, { id: `fac-${Date.now()}`, type: "bot", timestamp: now(), triageCard: { level: tier, reason: "Nearby facilities", nextSteps: "Choose a facility below.", facilities: facilities.map((f: { name: string; type: "Hospital" | "PHC" | "CHC"; road_km: number; phone: string; lat: number; lng: number }) => ({ name: f.name, type: f.type, distance: `${f.road_km} km`, phone: f.phone, lat: f.lat, lng: f.lng })) } }])
    } catch {
      updatePatientMessages(patientId, (prev) => prev.filter((m) => m.id !== loadingId))
    }
  }

  const shareLocation = async (patientId: string, tier: "emergency" | "clinic") => {
    if (!navigator.geolocation) {
      await fetchFacilities(patientId, tier, 23.03, 72.58)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await fetchFacilities(patientId, tier, position.coords.latitude, position.coords.longitude)
      },
      async () => {
        updatePatientMessages(patientId, (prev) => [...prev, { id: `geo-${Date.now()}`, type: "bot", timestamp: now(), message: "Location access denied. Here are some nearby facilities based on your approximate area." }])
        await fetchFacilities(patientId, tier, 23.03, 72.58)
      }
    )
  }

  const handleSend = async (text: string) => {
    if (!selectedPatient || loadingByPatient[selectedPatient.id]) return
    const patientId = selectedPatient.id
    updatePatientMessages(patientId, (prev) => [...prev, { id: `u-${Date.now()}`, type: "user", message: text, timestamp: now() }])
    const loadingId = `load-${Date.now()}`
    updatePatientMessages(patientId, (prev) => [...prev, { id: loadingId, type: "bot", timestamp: "", isLoading: true }])
    setLoadingByPatient((prev) => ({ ...prev, [patientId]: true }))
    try {
      const response = await sendMessage(text, selectedLanguage, getSessionForPatient(patientId))
      setServerError(false)
      updatePatientMessages(patientId, (prev) => prev.filter((m) => m.id !== loadingId))
      const tier = response?.tier as "emergency" | "clinic" | "selfcare" | undefined
      if (!tier) {
        const botText = response?.reply || ""
        updatePatientMessages(patientId, (prev) => [...prev, { id: `b-${Date.now()}`, type: "bot", message: botText, timestamp: now() }])
        speakText(botText, selectedLanguage)
      } else {
        const triageReason = response?.reply || response?.reason || ""
        updatePatientMessages(patientId, (prev) => [...prev, { id: `t-${Date.now()}`, type: "bot", timestamp: now(), triageCard: { level: tier, reason: triageReason, nextSteps: response?.next_steps || "", careSteps: tier === "selfcare" ? String(response?.next_steps || "").split(".").map((s: string) => s.trim()).filter(Boolean) : undefined } }])
        speakText(triageReason, selectedLanguage)
        if (tier === "emergency" || tier === "clinic") {
          if (!navigator.geolocation) {
            void fetchFacilities(patientId, tier, 23.03, 72.58)
          } else {
            updatePatientMessages(patientId, (prev) => [...prev, { id: `lp-${Date.now()}`, type: "bot", timestamp: now(), locationPrompt: { tier, onShareLocation: () => { void shareLocation(patientId, tier) } } }])
          }
        }
      }
    } catch {
      setServerError(true)
      updatePatientMessages(patientId, (prev) => prev.filter((m) => m.id !== loadingId))
      updatePatientMessages(patientId, (prev) => [...prev, { id: `e-${Date.now()}`, type: "bot", message: "Something went wrong. Please check your connection and try again.", timestamp: now() }])
    } finally {
      setLoadingByPatient((prev) => ({ ...prev, [patientId]: false }))
    }
  }

  const handlePatientNewChat = async () => {
    if (!selectedPatient) return
    const patientId = selectedPatient.id
    try {
      await resetSession(getSessionForPatient(patientId))
      setServerError(false)
    } catch {
      setServerError(true)
    }
    setPatientMessages((prev) => ({ ...prev, [patientId]: [{ id: `greet-${Date.now()}`, type: "bot", message: "Please share the patient's symptoms.", timestamp: now() }] }))
  }

  useEffect(() => {
    if (selectedPatient && previousLanguage.current !== selectedLanguage) {
      updatePatientMessages(selectedPatient.id, (prev) => [
        ...prev,
        { id: `lang-${Date.now()}`, type: "system", message: `Language switched to ${languageNameMap[selectedLanguage]}`, timestamp: "" }
      ])
      previousLanguage.current = selectedLanguage
    }
  }, [selectedLanguage, selectedPatient])

  // Patient Chat View (full screen takeover)
  if (selectedPatient) {
    return (
      <div 
        className={cn(
          "h-screen flex flex-col transition-transform duration-300 ease-out",
          isTransitioning && slideDirection === "in" && "translate-x-full",
          isTransitioning && slideDirection === "out" && "translate-x-full",
          !isTransitioning && "translate-x-0"
        )}
      >
        {/* Chat Header */}
        <div className="bg-[var(--primary)] px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackToList} 
              className="text-white p-1 cursor-pointer hover:bg-white/10 rounded-full transition-colors"
              style={{ cursor: 'pointer' }}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
              {selectedPatient.name.charAt(0)}
            </div>
            <h1 className="text-white font-semibold text-base">{selectedPatient.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handlePatientNewChat()}
              className="text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 cursor-pointer"
              style={{ cursor: "pointer" }}
            >
              New Chat
            </button>
            <UrgencyBadge level={selectedPatient.urgency} size="sm" />
          </div>
        </div>
        {serverError && (
          <div className="bg-red-100 text-red-700 px-3 py-2 text-sm flex items-center justify-between">
            <span>Unable to connect to server. Please try again.</span>
            <button onClick={() => void handlePatientNewChat()} className="underline text-red-800 cursor-pointer" style={{ cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {/* Chat Window */}
        <ChatWindow messages={getMessages(selectedPatient.id)} className="flex-1" language={selectedLanguage} />

        {/* Input Bar */}
        <InputBar 
          onSend={handleSend}
          placeholder="Enter patient symptoms..."
          language={selectedLanguage}
          isLoading={Boolean(loadingByPatient[selectedPatient.id])}
        />
      </div>
    )
  }

  // Patient List View (default)
  return (
    <div 
      className={cn(
        "h-screen flex flex-col bg-white transition-transform duration-300 ease-out",
        isTransitioning && slideDirection === "out" && "-translate-x-1/4 opacity-50"
      )}
    >
      {/* Header */}
      <div className="bg-[var(--primary)] px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="text-white p-1 cursor-pointer hover:bg-white/10 rounded-full transition-colors"
            style={{ cursor: 'pointer' }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-base">My Patients</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddPatient(true)}
            className="w-8 h-8 rounded-full bg-[var(--primary-light)] flex items-center justify-center cursor-pointer hover:bg-[#20c55e] transition-colors"
            style={{ cursor: 'pointer' }}
          >
            <PlusIcon className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => signOut().then(onBack)}
            className="text-white/80 hover:text-white text-xs flex items-center gap-1"
            style={{ cursor: 'pointer' }}
          >
            <SignOutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddPatient && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowAddPatient(false)}>
          <div
            className="bg-white w-full max-w-md rounded-t-2xl p-6 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">Add New Patient</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Patient name"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Age</label>
                  <input
                    type="number"
                    value={newAge}
                    onChange={e => setNewAge(e.target.value)}
                    placeholder="Age"
                    min={1} max={120}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Gender</label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value as "M" | "F")}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 bg-white"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddPatient(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--muted-foreground)] cursor-pointer"
                style={{ cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPatient}
                disabled={!newName.trim() || !newAge}
                className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
                style={{ cursor: !newName.trim() || !newAge ? 'not-allowed' : 'pointer' }}
              >
                Add Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Rating Banner */}
      {rating !== undefined && (
        <div className="bg-white border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Welcome back</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{workerName ?? "ASHA Worker"}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon
                  key={star}
                  filled={star <= Math.floor(rating)}
                  half={star === Math.ceil(rating) && rating % 1 >= 0.25}
                />
              ))}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{rating.toFixed(1)} / 5.0</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-3 py-2 bg-white border-b border-[var(--border)]">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--secondary)] rounded-lg border-none outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          />
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="px-3 py-2 bg-white border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-2">
          {/* Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                filter === "all" 
                  ? "bg-gray-700 text-white" 
                  : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--border)]"
              )}
              style={{ cursor: 'pointer' }}
            >
              All
            </button>
            <button
              onClick={() => setFilter("emergency")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                filter === "emergency" 
                  ? "bg-red-500 text-white" 
                  : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-red-100"
              )}
              style={{ cursor: 'pointer' }}
            >
              Emergency
            </button>
            <button
              onClick={() => setFilter("clinic")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                filter === "clinic" 
                  ? "bg-amber-500 text-white" 
                  : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-amber-100"
              )}
              style={{ cursor: 'pointer' }}
            >
              Clinic
            </button>
            <button
              onClick={() => setFilter("selfcare")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                filter === "selfcare" 
                  ? "bg-green-500 text-white" 
                  : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-green-100"
              )}
              style={{ cursor: 'pointer' }}
            >
              Self-care
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              style={{ cursor: 'pointer' }}
            >
              <span className="whitespace-nowrap">
                Sort: {sort === "urgency" ? "Most Urgent" : sort === "recent" ? "Most Recent" : "Name A-Z"}
              </span>
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>

            {showSortDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[var(--border)] z-20 min-w-[140px]">
                  <button
                    onClick={() => { setSort("urgency"); setShowSortDropdown(false) }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[var(--secondary)] transition-colors cursor-pointer",
                      sort === "urgency" && "text-[var(--primary)]"
                    )}
                    style={{ cursor: 'pointer' }}
                  >
                    Most Urgent
                    {sort === "urgency" && <CheckIcon className="w-3.5 h-3.5 text-[var(--primary)]" />}
                  </button>
                  <button
                    onClick={() => { setSort("recent"); setShowSortDropdown(false) }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[var(--secondary)] transition-colors cursor-pointer",
                      sort === "recent" && "text-[var(--primary)]"
                    )}
                    style={{ cursor: 'pointer' }}
                  >
                    Most Recent
                    {sort === "recent" && <CheckIcon className="w-3.5 h-3.5 text-[var(--primary)]" />}
                  </button>
                  <button
                    onClick={() => { setSort("name"); setShowSortDropdown(false) }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[var(--secondary)] transition-colors cursor-pointer",
                      sort === "name" && "text-[var(--primary)]"
                    )}
                    style={{ cursor: 'pointer' }}
                  >
                    Name A-Z
                    {sort === "name" && <CheckIcon className="w-3.5 h-3.5 text-[var(--primary)]" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Patient Count */}
        <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5">
          {filteredAndSortedPatients.length} patient{filteredAndSortedPatients.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedPatients.map((patient) => (
          <button
            key={patient.id}
            onClick={() => handleSelectPatient(patient)}
            className="w-full px-4 py-3 flex items-center gap-3 border-b border-[var(--border)] hover:bg-[var(--secondary)]/50 transition-colors cursor-pointer text-left"
            style={{ cursor: 'pointer' }}
          >
            <div className="w-11 h-11 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold flex-shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[var(--foreground)] text-sm">{patient.name}</span>
                <UrgencyBadge level={patient.urgency} size="sm" />
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {patient.age}{patient.gender === "F" ? "F" : "M"} · {patient.lastSymptom}
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]/70">{patient.date}</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-[var(--muted-foreground)] flex-shrink-0" />
          </button>
        ))}

        {filteredAndSortedPatients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[var(--muted-foreground)] text-sm">No patients found</p>
            <p className="text-[var(--muted-foreground)] text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
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

function StarIcon({ filled, half }: { filled: boolean; half: boolean }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      {half ? (
        <>
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#E5E7EB" />
            </linearGradient>
          </defs>
          <path fill="url(#half)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </>
      ) : (
        <path
          fill={filled ? "#F59E0B" : "#E5E7EB"}
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      )}
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

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
