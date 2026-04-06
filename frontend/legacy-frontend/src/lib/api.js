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
  try {
    const res = await fetch(`${BASE_URL}/facilities?lat=${lat}&lng=${lng}&tier=${tier}`);
    if (!res.ok) throw new Error("Facilities fetch failed");
    return await res.json();
  } catch (error) {
    throw error;
  }
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
