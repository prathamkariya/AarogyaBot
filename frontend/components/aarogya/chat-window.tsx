"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChatBubble } from "./chat-bubble"
import type { UrgencyLevel } from "./urgency-badge"

export interface Message {
  id: string
  type: "user" | "bot" | "system"
  message?: string
  image?: string
  timestamp: string
  isLoading?: boolean
  loadingText?: string
  triageCard?: {
    level: UrgencyLevel
    reason: string
    nextSteps: string
    careSteps?: string[]
    language?: string
    facilities?: Array<{
      name: string
      type: "Hospital" | "PHC" | "CHC"
      distance: string
      phone: string
      lat?: number
      lng?: number
    }>
  }
  locationPrompt?: {
    tier: "emergency" | "clinic"
    language?: string
    onShareLocation: () => void
  }
  buttons?: Array<{
    label: string
    onClick: () => void
  }>
  savePrompt?: boolean
}

interface ChatWindowProps {
  messages: Message[]
  className?: string
  language?: string
  onCreateAccount?: () => void
}

export function ChatWindow({ messages, className, language, onCreateAccount }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto p-4 bg-[var(--chat-bg)]",
        // WhatsApp-style pattern background
        "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI0U1RERENSIvPgo8Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSIxIiBmaWxsPSIjRDVDREM1IiBmaWxsLW9wYWNpdHk9IjAuMyIvPgo8L3N2Zz4=')]",
        className
      )}
    >
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          type={msg.type}
          message={msg.message}
          image={msg.image}
          timestamp={msg.timestamp}
          isLoading={msg.isLoading}
          loadingText={msg.loadingText}
          triageCard={msg.triageCard}
          locationPrompt={msg.locationPrompt}
          buttons={msg.buttons}
          savePrompt={msg.savePrompt}
          onCreateAccount={onCreateAccount}
          language={language}
        />
      ))}
    </div>
  )
}
