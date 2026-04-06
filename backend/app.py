from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import base64, io
import os, math, requests as req
from dotenv import load_dotenv
import json
import csv
from flasgger import Swagger
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

load_dotenv()

# ── Firebase init (safe — works with or without key) ───────
_firebase_key = os.getenv("FIREBASE_KEY")
db = None
if _firebase_key:
    try:
        cred = credentials.Certificate(json.loads(_firebase_key))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase initialized successfully")
    except Exception as e:
        print(f"Firebase init failed: {e}")
elif os.path.exists("firebase-key.json"):
    try:
        cred = credentials.Certificate("firebase-key.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase initialized from file")
    except Exception as e:
        print(f"Firebase file init failed: {e}")
else:
    print("Firebase not configured — running without Firestore")

# ── Google Cloud Speech-to-Text init ──────────────────────
_gcloud_key = os.getenv("GOOGLE_CLOUD_CREDENTIALS")
speech_client = None
if _gcloud_key:
    try:
        from google.cloud import speech
        from google.oauth2 import service_account
        _gcloud_info = json.loads(_gcloud_key)
        _gcloud_creds = service_account.Credentials.from_service_account_info(_gcloud_info)
        speech_client = speech.SpeechClient(credentials=_gcloud_creds)  # type: ignore
        print("Google Cloud Speech initialized successfully")
    except Exception as e:
        print(f"Google Cloud Speech init failed: {e}")
else:
    print("Google Cloud Speech not configured — voice transcription disabled")

# ── App setup ──────────────────────────────────────────────
app = Flask(__name__)
Swagger(app)
CORS(app)

from llm_service import LLMService
service = LLMService()

# ── Facilities ─────────────────────────────────────────────
def load_facilities(path="backend/clinics_allstates_v2.csv"):
    facilities = []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                facilities.append({
                    "name":          row["name"],
                    "type":          row["type"],
                    "lat":           float(row["lat"]),
                    "lng":           float(row["lng"]),
                    "phone":         row["phone"],
                    "district":      row["district"],
                    "state":         row["state"],
                    "open_hours":    row["open_hours"],
                    "has_emergency": row["has_emergency"] == "True",
                    "maps_url":      row["maps_url"],
                })
    except Exception as e:
        print(f"CSV load failed: {e}")
    return facilities

FACILITIES = load_facilities()

def haversine_km(lat1, lng1, lat2, lng2):
    R    = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a    = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return round(R * 2 * math.asin(math.sqrt(a)), 1)

# ── Routes ─────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "backend is alive", "firebase": db is not None})

@app.route("/triage", methods=["POST"])
def triage():
    """
    Triage symptoms
    ---
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            session_id:
              type: string
              example: test123
            message:
              type: string
              example: chest pain difficulty breathing
            language:
              type: string
              example: en
    responses:
      200:
        description: Triage result
    """
    body       = request.get_json()
    session_id = body.get("session_id", "default")
    message    = body.get("message", "")
    language   = body.get("language", "en")
    image_b64  = body.get("image")

    if not message and not image_b64:
        return jsonify({"error": "message or image is required"}), 400

    if image_b64:
        from triage import analyze_image, classify
        extraction = analyze_image(image_b64, language)
        extraction["needs_followup"] = False  # always classify images, never leave as pending
        result = classify(extraction)
        result["visual_description"] = extraction.get("visual_description", "")
        result["condition_name"] = extraction.get("condition_name", "")
        result["is_complete"] = True

        # Replace generic tier message with LLM's specific explanation + recommendation
        condition = extraction.get("condition_name", "")
        explanation = extraction.get("explanation", "")
        recommendation = extraction.get("recommendation", "")
        if explanation:
            header = f"🔍 {condition}\n\n" if condition and condition != "Unclear" else "🔍 Image Analysis\n\n"
            result["message"] = f"{header}{explanation}\n\n{recommendation}"
    else:
        result = service.handle_message(session_id, message, language)

    # Log to Firestore only if available
    if db and result.get("tier") != "pending":
        try:
            db.collection("triages").add({
                "session_id": session_id,
                "message":    message,
                "language":   language,
                "tier":       result.get("tier"),
                "symptoms":   result.get("symptoms", []),
                "confidence": result.get("confidence", 0.0),
                "timestamp":  datetime.now(timezone.utc),
            })
        except Exception as e:
            print(f"Firestore log failed: {e}")

    return jsonify(result)

@app.route("/triage/reset", methods=["POST"])
def reset():
    body       = request.get_json()
    session_id = body.get("session_id", "default")
    service.reset_session(session_id)
    return jsonify({"status": "ok"})

@app.route("/facilities", methods=["GET"])
def facilities():
    try:
        lat  = float(request.args.get("lat", 23.03))
        lng  = float(request.args.get("lng", 72.58))
        tier = request.args.get("tier", "clinic")
    except:
        lat, lng, tier = 23.03, 72.58, "clinic"

    pool = FACILITIES
    if tier == "emergency":
        pool = sorted(FACILITIES, key=lambda x: 0 if x["type"] == "Hospital" else 1)

    results = []
    for f in pool:
        entry            = f.copy()
        entry["road_km"] = haversine_km(lat, lng, f["lat"], f["lng"])
        results.append(entry)

    return jsonify(sorted(results, key=lambda x: x["road_km"])[:3])

@app.route("/stats", methods=["GET"])
def stats():
    if not db:
        return jsonify({
            "total_triages_today": 0,
            "emergencies_today": 0,
            "urgency_distribution": [
                {"name": "Emergency", "value": 0, "color": "#EF4444"},
                {"name": "Clinic",    "value": 0, "color": "#F59E0B"},
                {"name": "Self-care", "value": 0, "color": "#10B981"},
            ],
            "top_symptoms": [],
            "recent_emergencies": [],
            "note": "Firebase not configured"
        })

    from datetime import timedelta
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        docs = db.collection("triages").where("timestamp", ">=", since).stream()

        total = 0
        tier_counts = {"emergency": 0, "clinic": 0, "self_care": 0}
        symptom_counts = {}
        recent_emergencies = []

        for doc in docs:
            d = doc.to_dict()
            if d is None:
                continue
            total += 1
            tier = d.get("tier", "")
            if tier in tier_counts:
                tier_counts[tier] += 1
            for s in d.get("symptoms", []):
                symptom_counts[s] = symptom_counts.get(s, 0) + 1
            if tier == "emergency":
                ts = d.get("timestamp")
                recent_emergencies.append({
                    "id":       doc.id[:6].upper(),
                    "symptom":  ", ".join(d.get("symptoms", [])) or "Unknown",
                    "time":     ts.strftime("%I:%M %p") if ts else "—",
                    "language": d.get("language", "en"),
                })

        top_symptoms = sorted(symptom_counts.items(), key=lambda x: x[1], reverse=True)[:5]

        return jsonify({
            "total_triages_today": total,
            "emergencies_today": tier_counts["emergency"],
            "urgency_distribution": [
                {"name": "Emergency", "value": tier_counts["emergency"], "color": "#EF4444"},
                {"name": "Clinic",    "value": tier_counts["clinic"],    "color": "#F59E0B"},
                {"name": "Self-care", "value": tier_counts["self_care"], "color": "#10B981"},
            ],
            "top_symptoms": [{"name": s.replace("_", " ").title(), "count": c} for s, c in top_symptoms],
            "recent_emergencies": recent_emergencies[-5:][::-1],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/report", methods=["POST"])
def report():
    """
    Generate a downloadable PDF medical report for a completed triage session.
    Accepts the triage result data and returns a base64-encoded PDF.
    """
    from report import build_report
    body = request.get_json()

    if not body:
        return jsonify({"error": "request body required"}), 400

    required = ["tier", "symptoms"]
    if not all(k in body for k in required):
        return jsonify({"error": f"missing required fields: {required}"}), 400

    try:
        report_id, pdf_bytes = build_report(body)

        # Save report reference to Firestore if available
        if db:
            try:
                db.collection("reports").add({
                    "report_id":  report_id,
                    "session_id": body.get("session_id", "unknown"),
                    "tier":       body.get("tier"),
                    "symptoms":   body.get("symptoms", []),
                    "timestamp":  datetime.now(timezone.utc),
                })
            except Exception as e:
                print(f"Firestore report log failed: {e}")

        return jsonify({
            "report_id": report_id,
            "pdf_base64": base64.b64encode(pdf_bytes).decode("utf-8"),
            "filename": f"AarogyaBot_{report_id}.pdf",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


SPEECH_LANG_MAP = {
    "en": "en-IN", "hi": "hi-IN", "gu": "gu-IN", "ta": "ta-IN", "mr": "mr-IN",
}

@app.route("/transcribe", methods=["POST"])
def transcribe():
    if not speech_client:
        return jsonify({"error": "Speech transcription not configured"}), 503

    body = request.get_json()
    audio_b64 = body.get("audio")
    language = body.get("language", "en")

    if not audio_b64:
        return jsonify({"error": "audio is required"}), 400

    try:
        from google.cloud import speech
        audio_bytes = base64.b64decode(audio_b64)
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000,
            language_code=SPEECH_LANG_MAP.get(language, "en-IN"),
            enable_automatic_punctuation=True,
        )
        response = speech_client.recognize(config=config, audio=audio)
        transcript = " ".join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        )
        return jsonify({"text": transcript, "language": language})
    except Exception as e:
        print(f"Transcription failed: {e}")
        return jsonify({"error": "Transcription failed"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)
