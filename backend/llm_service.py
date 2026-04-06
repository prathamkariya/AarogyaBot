"""
LLM Service — Integration interface for Member B (Flask API).

Usage in Flask:
    from llm_service import LLMService

    service = LLMService()

    # In your /triage route:
    result = service.handle_message(session_id, user_message)
    return jsonify(result)

    # In your /triage/reset route (new chat):
    service.reset_session(session_id)
"""

from conversation import TriageSession
from typing import Optional


class LLMService:
    """
    Manages triage sessions per user. Thread-safe for Flask use.
    Member B: create ONE instance of this at app startup, reuse it across requests.
    """

    def __init__(self):
        self._sessions: dict[str, TriageSession] = {}

    def handle_message(self, session_id: str, user_message: str, language: Optional[str] = None) -> dict:
        """
        Main entry point. Call this from your /triage POST route.

        Args:
            session_id: unique ID per user/chat (e.g. Firebase UID, or a UUID you generate)
            user_message: raw text from the user
            language: user-selected language code ("en", "hi", "mr", "ta", "gu")

        Returns dict with:
            tier          — "emergency" | "clinic" | "self_care" | "pending"
            message       — text to display to the user
            needs_followup — True if bot is asking a follow-up question
            symptoms      — list of extracted symptoms
            language      — "en" | "hi" | "mr" | "ta" | "gu"
            confidence    — float 0.0–1.0
            next_steps    — list of action strings
            is_complete   — True when triage is done (not pending)
        """
        session = self._get_or_create_session(session_id)
        result = session.process_message(user_message, language)

        return {
            "tier": result["tier"],
            "message": result["message"],
            "needs_followup": result.get("needs_followup", False),
            "followup_question": result.get("followup_question"),
            "symptoms": result.get("symptoms", []),
            "language": result.get("language", "en"),
            "confidence": result.get("confidence", 0.0),
            "next_steps": result.get("next_steps", []),
            "is_complete": session.is_complete,
        }

    def reset_session(self, session_id: str) -> None:
        """Call this when user starts a new chat."""
        self._sessions.pop(session_id, None)

    def _get_or_create_session(self, session_id: str) -> TriageSession:
        if session_id not in self._sessions:
            self._sessions[session_id] = TriageSession()
        return self._sessions[session_id]


# --- For Member B: exact Flask route example ---
#
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from llm_service import LLMService
#
# app = Flask(__name__)
# CORS(app)
# service = LLMService()
#
# @app.route("/triage", methods=["POST"])
# def triage():
#     body = request.get_json()
#     session_id = body.get("session_id", "default")
#     message = body.get("message", "")
#     if not message:
#         return jsonify({"error": "message is required"}), 400
#     result = service.handle_message(session_id, message)
#     return jsonify(result)
#
# @app.route("/triage/reset", methods=["POST"])
# def reset():
#     body = request.get_json()
#     session_id = body.get("session_id", "default")
#     service.reset_session(session_id)
#     return jsonify({"status": "ok"})
