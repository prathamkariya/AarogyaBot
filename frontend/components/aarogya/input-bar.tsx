"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Language } from "@/app/page"
import { transcribeAudio } from "@/src/lib/api"

interface InputBarProps {
  onSend: (message: string, image?: string) => void
  placeholder?: string
  confidenceBadge?: {
    confidence: number
    level: "emergency" | "clinic" | "selfcare"
  }
  className?: string
  language?: Language
  isLoading?: boolean
  maxLength?: number
  onEmptySubmit?: () => void
}

const levelColors = {
  emergency: "bg-red-100 text-red-700",
  clinic: "bg-amber-100 text-amber-700",
  selfcare: "bg-green-100 text-green-700"
}

export function InputBar({
  onSend,
  placeholder,
  confidenceBadge,
  className,
  language = "en",
  isLoading = false,
  maxLength = 500,
  onEmptySubmit
}: InputBarProps) {
  const [message, setMessage] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isShake, setIsShake] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const languageRef = useRef(language)
  languageRef.current = language

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Pick a supported mime type — Chrome uses webm/opus, Safari uses mp4/aac
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4"

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Release the mic
        stream.getTracks().forEach(t => t.stop())

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        if (audioBlob.size < 1000) {
          toast.info("Recording too short. Hold the mic button and speak, then tap to stop.")
          return
        }

        // Convert to base64 and send to backend
        setIsTranscribing(true)
        try {
          const base64 = await blobToBase64(audioBlob)
          const result = await transcribeAudio(base64, languageRef.current)
          if (result.text) {
            setMessage(result.text)
          } else {
            toast.info("No speech detected. Try speaking louder or closer to the mic.")
          }
        } catch {
          toast.error("Transcription failed. Please check your connection and try again.")
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      toast.error("Microphone access denied. Please allow mic access in your browser settings.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const handleMicClick = () => {
    if (isTranscribing) return
    if (isRecording) {
      stopRecording()
    } else {
      void startRecording()
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      setPendingImage(base64)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleSend = () => {
    if (!message.trim() && !pendingImage) {
      setIsShake(true)
      onEmptySubmit?.()
      setTimeout(() => setIsShake(false), 250)
      return
    }
    onSend(message.trim(), pendingImage ?? undefined)
    setMessage("")
    setPendingImage(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={cn("bg-white border-t border-[var(--border)]", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageChange}
      />

      {/* Image preview */}
      {pendingImage && (
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="relative inline-block">
            <img
              src={`data:image/jpeg;base64,${pendingImage}`}
              alt="preview"
              className="h-16 w-16 object-cover rounded-lg border border-[var(--border)]"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 text-white rounded-full text-[10px] flex items-center justify-center"
              style={{ cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">Image ready to send</span>
        </div>
      )}

      {/* Recording / Transcribing Indicator */}
      {(isRecording || isTranscribing) && (
        <div className="flex justify-center py-2">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border",
            isTranscribing
              ? "bg-blue-50 border-blue-200"
              : "bg-red-50 border-red-200"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isTranscribing ? "bg-blue-500" : "bg-red-500"
            )} />
            <span className={cn(
              "text-xs font-medium",
              isTranscribing ? "text-blue-600" : "text-red-600"
            )}>
              {isTranscribing ? "Transcribing..." : "Recording... tap to stop"}
            </span>
          </div>
        </div>
      )}

      {/* Confidence Badge */}
      {isFocused && confidenceBadge && !isRecording && (
        <div className="px-4 pt-2">
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            levelColors[confidenceBadge.level]
          )}>
            {confidenceBadge.confidence}% confidence · {confidenceBadge.level === "selfcare" ? "Self-care" : confidenceBadge.level === "clinic" ? "Clinic" : "Emergency"}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 p-3">
        {/* Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={isLoading || isTranscribing}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer",
            isRecording
              ? "bg-red-500 animate-pulse-mic"
              : isTranscribing
              ? "bg-blue-400 cursor-wait"
              : isLoading
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-[var(--primary)] hover:bg-[var(--primary)]/90"
          )}
          style={{ cursor: isLoading || isTranscribing ? "not-allowed" : "pointer" }}
        >
          <MicIcon className="w-5 h-5 text-white" />
        </button>

        {/* Camera Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
            pendingImage ? "bg-green-500" : isLoading ? "bg-gray-300 cursor-not-allowed" : "bg-[var(--primary)] hover:bg-[var(--primary)]/90 cursor-pointer"
          )}
          style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
        >
          <CameraIcon className="w-5 h-5 text-white" />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          placeholder={isRecording ? "Listening... speak now" : isTranscribing ? "Transcribing your voice..." : (placeholder || "Type your symptoms...")}
          className={cn(
            "flex-1 px-4 py-2.5 bg-[var(--secondary)] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20",
            isRecording
              ? "placeholder:text-red-500 placeholder:italic"
              : isTranscribing
              ? "placeholder:text-blue-500 placeholder:italic"
              : "placeholder:text-[var(--muted-foreground)]",
            isShake && "animate-input-shake"
          )}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isLoading}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
            isLoading ? "bg-gray-300 cursor-not-allowed" : "bg-[var(--primary)] hover:bg-[var(--primary)]/90 cursor-pointer"
          )}
          style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
        >
          <SendIcon className="w-5 h-5 text-white" />
        </button>
      </div>
      {message.length > 400 && (
        <div className="px-4 pb-2 text-right text-xs text-[var(--muted-foreground)]">
          {message.length}/{maxLength}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse-mic {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .animate-pulse-mic {
          animation: pulse-mic 0.8s ease-in-out infinite;
        }
        @keyframes input-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        .animate-input-shake {
          animation: input-shake 0.2s ease-in-out;
        }
      `}</style>
    </div>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4zm0-8.4a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
    </svg>
  )
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}
