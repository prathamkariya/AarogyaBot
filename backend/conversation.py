import json
from typing import Optional
from triage import extract_symptoms, classify, client, MODEL


FOLLOWUP_SYSTEM_PROMPT = """You are a medical triage assistant. You previously extracted symptoms from a patient and asked a follow-up question. Now the patient has responded with more details.

Given the CONVERSATION HISTORY below, extract the COMPLETE symptom picture combining all messages. Return the same JSON format as before.

Return ONLY valid JSON:
{
  "detected_language": "hi" or "en" or "mr" or "ta" or "gu",
  "symptoms": ["symptom1", "symptom2"],
  "severity_indicators": {
    "chest_pain": false,
    "breathing_difficulty": false,
    "unconsciousness": false,
    "severe_bleeding": false,
    "blood_in_stool_or_vomit": false,
    "pregnancy_complication": false,
    "high_fever_over_103": false,
    "seizures": false,
    "stroke_signs": false,
    "severe_abdominal_pain": false,
    "head_injury": false,
    "poisoning": false,
    "animal_or_snake_bite": false
  },
  "needs_followup": false,
  "followup_question": null
}

RULES:
- Combine symptoms from ALL messages in the conversation.
- Now that you have follow-up info, set needs_followup to false and classify properly.
- Only set needs_followup to true again if the response is STILL too vague to classify.
- Maximum 2 follow-up questions total. After 2 rounds, classify with what you have.

SEVERITY CLASSIFICATION GUIDANCE:
- Child under 5 with fever → set high_fever_over_103 to true (children are high risk)
- Ear pain with discharge/fluid → set severe_abdominal_pain to false but this is a clinic case, so add "ear discharge" or "ear infection" to symptoms
- Missed BP/diabetes medication with symptoms → this is a clinic case, add "missed medication" and "uncontrolled BP" or "uncontrolled diabetes" to symptoms
- Persistent vomiting (2+ days) → add "persistent vomiting" to symptoms
- Fever 3+ days → set high_fever_over_103 to true
- Any wound with pus/infection signs → add "wound infection" to symptoms

- ONLY output valid JSON, nothing else."""


class TriageSession:
    """
    Manages a multi-turn triage conversation.
    Member B will create one session per user/chat and call process_message() for each message.
    """

    def __init__(self):
        self.history = []  # list of {"role": "user"/"assistant", "content": "..."}
        self.followup_count = 0
        self.max_followups = 2
        self.result = None  # final triage result once classified
        self.is_complete = False

    def _force_classify(self, extraction: dict, language: Optional[str] = None) -> dict:
        """After max follow-ups, classify with whatever we have. Default to self_care."""
        # Re-run classify but override needs_followup to False
        extraction["needs_followup"] = False
        extraction["followup_question"] = None
        return classify(extraction, language)

    def process_message(self, user_message: str, language: Optional[str] = None) -> dict:
        """
        Process a user message. Returns triage result dict.
        If tier is "pending", the message field contains the follow-up question to ask.
        If tier is anything else, triage is complete.
        language: user-selected language — passed to classify() to ensure responses are in
                  the correct language regardless of LLM detection.
        """
        self.history.append({"role": "user", "content": user_message})

        if self.followup_count == 0:
            # First message — use standard extraction
            extraction = extract_symptoms(user_message, language)
        else:
            # Follow-up message — use conversation-aware extraction
            extraction = self._extract_with_history(language)

        result = classify(extraction, language)

        # If pending but we've hit max follow-ups, force a classification
        if result["tier"] == "pending" and self.followup_count >= self.max_followups:
            result = self._force_classify(extraction, language)

        if result["tier"] == "pending":
            self.followup_count += 1
            self.history.append({"role": "assistant", "content": result["message"]})
        else:
            self.is_complete = True
            self.result = result
            self.history.append({"role": "assistant", "content": result["message"]})

        result["turn"] = len(self.history) // 2  # which turn we're on
        result["followups_remaining"] = self.max_followups - self.followup_count
        return result

    def _extract_with_history(self, language: Optional[str] = None) -> dict:  # type: ignore
        """Re-extract symptoms using full conversation history."""
        if not client:
            from triage import _fallback_extraction
            last_user_msg = next(
                (m["content"] for m in reversed(self.history) if m["role"] == "user"), ""
            )
            return _fallback_extraction(last_user_msg, "No Groq client")

        conversation_text = "\n".join(
            f"{'Patient' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in self.history
        )

        _LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "gu": "Gujarati"}
        system_prompt = FOLLOWUP_SYSTEM_PROMPT
        if language and language in _LANG_NAMES:
            lang_name = _LANG_NAMES[language]
            system_prompt = FOLLOWUP_SYSTEM_PROMPT + f"\n\nNOTE: The user has selected {lang_name}. Set detected_language to \"{language}\" and write any followup_question in {lang_name}."

        import time
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"CONVERSATION HISTORY:\n{conversation_text}"},
                    ],
                    temperature=0.1,
                    max_tokens=512,
                )

                content = response.choices[0].message.content
                if content is None:
                    raise ValueError("LLM returned no content")
                raw = content.strip()
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3].strip()
                if raw.startswith("json"):
                    raw = raw[4:].strip()

                return json.loads(raw)

            except Exception as e:
                error_str = str(e)
                if "429" in error_str and attempt < max_retries:
                    time.sleep(2)
                    continue
                print(f"_extract_with_history error (attempt {attempt+1}): {e}")
                # Fall back to re-extracting just the latest user message
                if attempt == max_retries:
                    from triage import _fallback_extraction
                    last_user_msg = next(
                        (m["content"] for m in reversed(self.history) if m["role"] == "user"), ""
                    )
                    return _fallback_extraction(last_user_msg, error_str)


# Quick test — simulates a multi-turn conversation
if __name__ == "__main__":
    print("=== Test 1: Multi-turn headache ===")
    session = TriageSession()

    r1 = session.process_message("I have a headache")
    print(f"Turn 1: tier={r1['tier']}")
    print(f"  Bot asks: {r1['message']}")

    r2 = session.process_message("Since yesterday, it's mild, comes and goes")
    print(f"Turn 2: tier={r2['tier']}")
    print(f"  Response: {r2['message']}")

    print(f"\n=== Test 2: Hindi emergency (single turn) ===")
    session2 = TriageSession()
    r = session2.process_message("मुझे सीने में बहुत तेज दर्द है")
    print(f"Turn 1: tier={r['tier']}")
    print(f"  Response: {r['message']}")

    print(f"\n=== Test 3: Vague Hindi, then clarify ===")
    session3 = TriageSession()
    r1 = session3.process_message("tabiyat kharab hai")
    print(f"Turn 1: tier={r1['tier']}")
    print(f"  Bot asks: {r1['message']}")

    r2 = session3.process_message("kal se pet mein dard hai, ulti bhi ho rahi hai")
    print(f"Turn 2: tier={r2['tier']}")
    print(f"  Response: {r2['message']}")