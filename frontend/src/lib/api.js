const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export function getSessionId() {
  if (typeof window === "undefined") return "server_session";
  if (!sessionStorage.getItem("aarogya_session")) {
    sessionStorage.setItem("aarogya_session", crypto.randomUUID());
  }
  return sessionStorage.getItem("aarogya_session");
}

export async function sendMessage(message, language = "en", sessionId, image = null) {
  try {
    const res = await fetch(`${BASE_URL}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId || getSessionId(),
        message,
        language,
        ...(image && { image }),
      }),
    });
    if (!res.ok) throw new Error("Triage failed");
    return await res.json();
  } catch (error) {
    throw error;
  }
}

export async function resetSession(sessionId) {
  try {
    const resolvedSessionId = sessionId || getSessionId();
    const res = await fetch(`${BASE_URL}/triage/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: resolvedSessionId }),
    });
    if (!sessionId && typeof window !== "undefined") {
      sessionStorage.removeItem("aarogya_session");
    }
    return await res.json();
  } catch (error) {
    if (!sessionId && typeof window !== "undefined") {
      sessionStorage.removeItem("aarogya_session");
    }
    throw error;
  }
}

export async function getNearestFacilities(lat, lng, tier = "clinic") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${BASE_URL}/facilities?lat=${lat}&lng=${lng}&tier=${tier}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("Facilities fetch failed");
    return await res.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

export async function transcribeAudio(audioBase64, language = "en") {
  const res = await fetch(`${BASE_URL}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: audioBase64, language }),
  });
  if (!res.ok) throw new Error("Transcription failed");
  return await res.json(); // { text, language }
}

export async function generateReport(data) {
  const res = await fetch(`${BASE_URL}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: getSessionId(), ...data }),
  });
  if (!res.ok) throw new Error("Report generation failed");
  return await res.json(); // { report_id, pdf_base64, filename }
}
