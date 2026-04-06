"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface HealthRecordModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: FormData) => void
}

interface FormData {
  fullName: string
  age: string
  gender: string
  phone: string
  village: string
}

export function HealthRecordModal({ isOpen, onClose, onSubmit }: HealthRecordModalProps) {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    age: "",
    gender: "",
    phone: "",
    village: ""
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Save Health Record</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--secondary)] transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--secondary)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Age
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--secondary)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Gender
              </label>
              <div className="flex gap-3 mt-2">
                {["Male", "Female", "Other"].map((g) => (
                  <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={formData.gender === g}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-4 h-4 accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">{g}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--secondary)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Village/Area
            </label>
            <input
              type="text"
              value={formData.village}
              onChange={(e) => setFormData(prev => ({ ...prev, village: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--secondary)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-semibold rounded-lg transition-colors"
          >
            Save Record
          </button>
        </form>
      </div>
    </div>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
