import os
import json
import csv as csv_module
from typing import Optional
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=_key) if _key else None
MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# ---- Load symptoms dataset ----
def _load_dataset():
    # Load new CSV first (has ta/gu columns for S061-S090), then base CSV.
    # Deduplicate by symptom_id — first seen wins, so new CSV data takes precedence.
    seen_ids = set()
    rows = []
    for fname in ("symptoms_v3_with_ta_gu.csv", "symptoms_final.csv"):
        path = os.path.join(os.path.dirname(__file__), fname)
        try:
            with open(path, newline="", encoding="utf-8") as f:
                reader = csv_module.DictReader(f)
                for row in reader:
                    sid = row.get("symptom_id", "")
                    if sid and sid in seen_ids:
                        continue  # skip duplicate — new CSV already loaded this
                    seen_ids.add(sid)
                    rows.append(row)
        except Exception as e:
            print(f"Dataset load failed ({fname}): {e}")
    return rows

SYMPTOM_DATASET = _load_dataset()

# Build keyword → (tier, symptom_en) lookup — covers English, Tamil, Gujarati keywords
DATASET_KEYWORD_MAP = []  # list of (keyword, tier, symptom_en)
# Self-care text lookup by symptom_en
DATASET_SELF_CARE_MAP = {}  # {symptom_en: {lang: text}}
for _row in SYMPTOM_DATASET:
    _tier = _row.get("triage_tier", "self-care")
    _symptom_en = _row.get("symptom_en", "")
    if _symptom_en:
        DATASET_SELF_CARE_MAP[_symptom_en] = {
            "en": _row.get("self_care_text_en", ""),
            "hi": _row.get("self_care_text_hi", ""),
            "ta": _row.get("self_care_text_ta", ""),
            "gu": _row.get("self_care_text_gu", ""),
        }
    for _field in ("keywords", "keywords_ta", "keywords_gu"):
        for _kw in _row.get(_field, "").split(","):
            _kw = _kw.strip().lower()
            if _kw:
                DATASET_KEYWORD_MAP.append((_kw, _tier, _symptom_en))

# Build concise symptom reference for LLM prompt
def _build_symptom_reference():
    emergency_symptoms = [r["symptom_en"] for r in SYMPTOM_DATASET if r["triage_tier"] == "emergency"]
    clinic_symptoms = [r["symptom_en"] for r in SYMPTOM_DATASET if r["triage_tier"] == "clinic"]
    self_care_symptoms = [r["symptom_en"] for r in SYMPTOM_DATASET if r["triage_tier"] == "self-care"]
    total = len(emergency_symptoms) + len(clinic_symptoms) + len(self_care_symptoms)
    lines = [
        f"SYMPTOM TIER REFERENCE ({total} conditions):",
        f"EMERGENCY ({len(emergency_symptoms)}): {', '.join(emergency_symptoms)}",
        f"CLINIC ({len(clinic_symptoms)}): {', '.join(clinic_symptoms)}",
        f"SELF-CARE ({len(self_care_symptoms)}): {', '.join(self_care_symptoms)}",
    ]
    return "\n".join(lines)

_SYMPTOM_REFERENCE = _build_symptom_reference()

SYSTEM_PROMPT = f"""You are a medical triage assistant used by ASHA workers in rural India. Your job is to extract symptoms from the patient's message and classify urgency. You do NOT diagnose. You extract and classify.

The patient may speak in Hindi, English, Marathi, Tamil, Gujarati, or a mix. Always understand the input regardless of language.

{_SYMPTOM_REFERENCE}

STEP 1: Extract symptoms from the user's message. Normalize them to standard medical terms in English.

STEP 2: Determine the language the user is speaking.

STEP 3: Return a JSON response in this EXACT format (no other text, no markdown, just raw JSON):
{{
  "detected_language": "hi" or "en" or "mr" or "ta" or "gu",
  "symptoms": ["symptom1", "symptom2"],
  "severity_indicators": {{
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
  }},
  "needs_followup": true or false,
  "followup_question": "a short, warm follow-up question in the SAME language as the user, or null if not needed"
}}

RULES:
- If the message is vague (e.g. "I feel sick", "tabiyat kharab hai"), set needs_followup to true and ask a clarifying question.
- If ANY severity indicator is true, set needs_followup to false (emergency, no time for questions).
- The followup_question MUST be in the SAME language the user spoke in. If user speaks Hindi, ask in Hindi script. If Tamil, respond in Tamil. If Gujarati, respond in Gujarati. If Hinglish, respond in Hinglish.
- Be conservative: if unsure, flag for followup rather than guessing.
- Follow-up questions should sound like a caring triage nurse. Ask about: duration ("kab se hai?"), severity ("kitna tez dard hai?"), associated symptoms ("bukhar bhi hai kya?"), or age ("kya ye bachhe ke liye hai?").
- Ask only ONE clear question at a time, not multiple. Keep it short (under 20 words).
- "seizures" includes: daura padna, mirgi, fits, jhatke, body shaking uncontrollably. Always flag true for these.
- "animal_or_snake_bite" includes: saanp/snake bite, kutta/dog bite, bichhu/scorpion sting. Always flag true.
- "severe_bleeding" means heavy external bleeding from a wound that won't stop. NOT blood in stool/vomit.
- "blood_in_stool_or_vomit" is for blood appearing in potty/dast/vomit — this is serious but NOT the same as severe_bleeding.
- "pregnancy_complication" is for any pain/bleeding/problem during pregnancy.
- ONLY output valid JSON, nothing else."""


def _parse_llm_json(raw: str) -> dict:
    """Parse JSON from LLM response, stripping markdown fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3].strip()
    if raw.startswith("json"):
        raw = raw[4:].strip()
    return json.loads(raw)


_LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "gu": "Gujarati"}

def extract_symptoms(user_message: str, language: Optional[str] = None) -> dict:
    """Call LLM to extract symptoms and severity indicators from user message."""
    import time

    if not client:
        return _fallback_extraction(user_message, "No Groq client")

    system_prompt = SYSTEM_PROMPT
    if language and language in _LANG_NAMES:
        lang_name = _LANG_NAMES[language]
        system_prompt = SYSTEM_PROMPT + f"\n\nNOTE: The user has selected {lang_name} as their language. Set detected_language to \"{language}\" and write the followup_question in {lang_name}."

    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                max_tokens=512,
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("LLM returned no content")
            return _parse_llm_json(content)

        except Exception as e:
            error_str = str(e)

            # Rate limit — wait and retry once
            if "429" in error_str and attempt < max_retries:
                time.sleep(2)
                continue

            # JSON parse error — retry once
            if isinstance(e, json.JSONDecodeError) and attempt < max_retries:
                continue

            # All retries exhausted or unrecoverable error — return fallback
            return _fallback_extraction(user_message, error_str)

    # This should never be reached, but for type checker
    return _fallback_extraction(user_message, "Unexpected error")


def _fallback_extraction(user_message: str, error: str) -> dict:
    """
    Fallback when LLM is unavailable. Uses dataset keyword matching on the raw message.
    This ensures the app never crashes — it degrades gracefully.
    """
    msg = user_message.lower()
    is_tamil = any('\u0B80' <= c <= '\u0BFF' for c in user_message)
    is_gujarati = any('\u0A80' <= c <= '\u0AFF' for c in user_message)
    is_hindi = any('\u0900' <= c <= '\u097F' for c in user_message)
    lang = "ta" if is_tamil else "gu" if is_gujarati else "hi" if is_hindi else "en"
    blank_indicators = {k: False for k in [
        "chest_pain", "breathing_difficulty", "unconsciousness",
        "severe_bleeding", "blood_in_stool_or_vomit", "pregnancy_complication",
        "high_fever_over_103", "seizures", "stroke_signs",
        "severe_abdominal_pain", "head_injury", "poisoning", "animal_or_snake_bite",
    ]}

    # Map dataset symptom names to severity indicator keys
    _symptom_to_indicator = {
        "chest pain": "chest_pain",
        "difficulty breathing": "breathing_difficulty",
        "unconsciousness": "unconsciousness",
        "severe bleeding": "severe_bleeding",
        "diarrhea with blood": "blood_in_stool_or_vomit",
        "pregnancy warning signs": "pregnancy_complication",
        "high fever": "high_fever_over_103",
        "seizure": "seizures",
        "stroke symptoms": "stroke_signs",
        "severe stomach pain": "severe_abdominal_pain",
        "head injury": "head_injury",
        "poisoning": "poisoning",
        "animal bite": "animal_or_snake_bite",
    }

    # Try dataset keywords — longest match first for precision
    sorted_keywords = sorted(DATASET_KEYWORD_MAP, key=lambda x: len(x[0]), reverse=True)
    for kw, tier, symptom_en in sorted_keywords:
        if kw in msg:
            indicators = dict(blank_indicators)
            indicator_key = _symptom_to_indicator.get(symptom_en)
            if indicator_key:
                indicators[indicator_key] = True
            return {
                "detected_language": lang,
                "symptoms": [symptom_en],
                "severity_indicators": indicators,
                "needs_followup": tier not in ("emergency", "clinic"),
                "followup_question": None,
            }

    # No match — ask follow-up
    followup_map = {
        "ta": "மன்னிக்கவும், இணைப்பில் சிக்கல் உள்ளது. உங்கள் அறிகுறிகளை விவரமாக சொல்லுங்கள்.",
        "gu": "માફ કરો, જોડાણ ખરાબ છે. કૃપા કરી વધ માહitee આpao.",
        "hi": "माफ़ करें, कनेक्शन में दिक्कत है। कृपया अपने लक्षण विस्तार से बताएं।",
        "en": "Sorry, I'm having trouble connecting. Can you describe your symptoms in more detail?",
    }
    return {
        "detected_language": lang,
        "symptoms": ["unknown — LLM unavailable"],
        "severity_indicators": blank_indicators,
        "needs_followup": True,
        "followup_question": followup_map.get(lang, followup_map["en"]),
    }


def analyze_image(image_base64: str, language: str = "en") -> dict:
    """Use llama-4-scout vision model to analyze a medical image."""
    blank_indicators = {k: False for k in [
        "chest_pain", "breathing_difficulty", "unconsciousness",
        "severe_bleeding", "blood_in_stool_or_vomit", "pregnancy_complication",
        "high_fever_over_103", "seizures", "stroke_signs",
        "severe_abdominal_pain", "head_injury", "poisoning", "animal_or_snake_bite",
    ]}

    if not client:
        return {
            "detected_language": language,
            "symptoms": [],
            "severity_indicators": {k: False for k in blank_indicators},
            "needs_followup": True,
            "followup_question": "Unable to analyze image without API key. Please describe your symptoms.",
            "visual_description": "",
            "condition_name": "",
            "explanation": "",
            "recommendation": "",
        }

    lang_note = "Respond with followup_question in Hindi." if language == "hi" else "Respond with followup_question in English."
    prompt = f"""You are a medical assistant helping ASHA workers in rural India. Analyze this image carefully.

Return a JSON in this EXACT format (no markdown, raw JSON only):
{{
  "detected_language": "{language}",
  "condition_name": "Most likely condition name (e.g. 'Contact Dermatitis', 'Infected Wound', 'Burns - Second Degree'). Say 'Unclear' if image is too blurry.",
  "explanation": "2-3 sentences in {language} explaining what you see in the image, what condition it likely is, and why. Be specific but simple enough for a rural health worker.",
  "recommendation": "1-2 sentences in {language} on what the patient should do right now (home care, see a doctor, go to ER, etc.).",
  "symptoms": ["symptom1", "symptom2"],
  "visual_description": "one clinical sentence describing what is visible",
  "severity_indicators": {{
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
  }},
  "needs_followup": true or false,
  "followup_question": "short clarifying question in {language} or null"
}}
ONLY output valid JSON. No extra text."""

    try:
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                    {"type": "text", "text": prompt}
                ]
            }],
            temperature=0.1,
            max_tokens=512,
        )
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("LLM returned no content")
        return _parse_llm_json(content)
    except Exception:
        fallback_q = "मैं छवि को स्पष्ट रूप से नहीं देख पाया। क्या आप लक्षण बता सकते हैं?" if language == "hi" else "I couldn't analyze the image clearly. Can you describe what you see?"
        return {
            "detected_language": language,
            "symptoms": [],
            "visual_description": "Image analysis failed",
            "severity_indicators": {k: False for k in [
                "chest_pain", "breathing_difficulty", "unconsciousness", "severe_bleeding",
                "blood_in_stool_or_vomit", "pregnancy_complication", "high_fever_over_103",
                "seizures", "stroke_signs", "severe_abdominal_pain", "head_injury", "poisoning", "animal_or_snake_bite"
            ]},
            "needs_followup": True,
            "followup_question": fallback_q,
        }


# ---- RULE ENGINE ----
# The LLM extracts, but RULES decide the tier. This is critical for healthcare.

EMERGENCY_INDICATORS = [
    "chest_pain",
    "breathing_difficulty",
    "unconsciousness",
    "severe_bleeding",
    "seizures",
    "stroke_signs",
    "head_injury",
    "poisoning",
    "animal_or_snake_bite",
]

CLINIC_INDICATORS = [
    "high_fever_over_103",
    "severe_abdominal_pain",
    "blood_in_stool_or_vomit",
    "pregnancy_complication",
]

# Symptom keywords that push toward clinic even if no severity indicator flagged
# Built from dataset: all clinic-tier symptom names + key keywords
CLINIC_SYMPTOM_KEYWORDS = list({
    r["symptom_en"].lower()
    for r in SYMPTOM_DATASET
    if r["triage_tier"] == "clinic"
} | {
    kw for kw, tier, _ in DATASET_KEYWORD_MAP
    if tier == "clinic" and len(kw) > 5  # skip very short keywords to avoid false positives
})

SELF_CARE_GUIDANCE = {
    "en": {
        "headache": "🟢 Self-care at home:\n• Rest in a dark, quiet room\n• Drink plenty of water\n• Take paracetamol (500mg) if needed\n• Avoid screen time\n\n⚠️ Visit a doctor if: headache lasts more than 2 days, is very severe, or comes with vision changes.",
        "cold": "🟢 Self-care at home:\n• Rest well and sleep enough\n• Drink warm fluids — water, soup, chai\n• Do steam inhalation 2-3 times a day\n• Gargle with warm salt water for sore throat\n\n⚠️ Visit a doctor if: fever goes above 103°F, or cold lasts more than 5 days.",
        "cough": "🟢 Self-care at home:\n• Drink warm water with honey and tulsi\n• Avoid cold drinks and fried food\n• Do steam inhalation\n• Keep throat covered in cold weather\n\n⚠️ Visit a doctor if: cough lasts more than 1 week, you cough up blood, or have trouble breathing.",
        "body_pain": "🟢 Self-care at home:\n• Rest the affected area\n• Apply warm compress for 15-20 minutes\n• Take paracetamol (500mg) if needed\n• Gentle stretching may help\n\n⚠️ Visit a doctor if: pain is severe, lasts more than 3 days, or comes with swelling/redness.",
        "mild_fever": "🟢 Self-care at home:\n• Rest and avoid heavy work\n• Drink lots of water and ORS\n• Take paracetamol (500mg) every 6 hours if needed\n• Use a wet cloth on forehead to cool down\n\n⚠️ Visit a doctor if: fever goes above 103°F, lasts more than 3 days, or comes with rash/stiff neck.",
        "stomach_ache": "🟢 Self-care at home:\n• Eat light — khichdi, dal, rice\n• Drink plenty of water and ORS\n• Avoid spicy, oily, and heavy food\n• Rest and avoid lying down right after eating\n\n⚠️ Visit a doctor if: pain is very sharp, lasts more than 2 days, or comes with blood in stool/vomit.",
        "diarrhea": "🟢 Self-care at home:\n• Drink ORS after every loose motion\n• Eat light food — banana, rice, curd\n• Avoid milk, spicy food, and outside food\n• Wash hands with soap frequently\n\n⚠️ Visit a doctor if: diarrhea lasts more than 2 days, there is blood, or signs of dehydration (dry mouth, no urine).",
        "skin_rash": "🟢 Self-care at home:\n• Keep the area clean and dry\n• Avoid scratching\n• Apply calamine lotion if itchy\n• Wear loose cotton clothes\n\n⚠️ Visit a doctor if: rash spreads quickly, has pus, comes with fever, or does not improve in 3 days.",
        "eye_irritation": "🟢 Self-care at home:\n• Wash eyes gently with clean water\n• Do not rub your eyes\n• Avoid dust and screen time\n• Use clean towel, do not share\n\n⚠️ Visit a doctor if: redness/pain increases, vision is blurry, or discharge is thick/yellow.",
        "default": "🟢 Self-care at home:\n• Rest well and stay hydrated\n• Eat light, nutritious food\n• Monitor your symptoms carefully\n\n⚠️ Visit your nearest health center if symptoms worsen or do not improve within 2-3 days.",
    },
    "hi": {
        "headache": "🟢 घर पर देखभाल:\n• अंधेरे, शांत कमरे में आराम करें\n• खूब पानी पिएं\n• जरूरत हो तो पैरासिटामोल (500mg) लें\n• स्क्रीन से दूर रहें\n\n⚠️ डॉक्टर को दिखाएं अगर: सिरदर्द 2 दिन से ज्यादा रहे, बहुत तेज हो, या आंखों में धुंधलापन आए।",
        "cold": "🟢 घर पर देखभाल:\n• अच्छे से आराम करें\n• गर्म पानी, सूप, चाय पिएं\n• दिन में 2-3 बार भाप लें\n• गले में खराश हो तो गर्म नमक पानी से गरारे करें\n\n⚠️ डॉक्टर को दिखाएं अगर: बुखार 103°F से ज्यादा हो, या सर्दी 5 दिन से ज्यादा रहे।",
        "cough": "🟢 घर पर देखभाल:\n• शहद और तुलसी वाला गर्म पानी पिएं\n• ठंडे पेय और तला हुआ खाना बंद करें\n• भाप लें\n• ठंड में गला ढक कर रखें\n\n⚠️ डॉक्टर को दिखाएं अगर: खांसी 1 हफ्ते से ज्यादा रहे, खून आए, या सांस लेने में तकलीफ हो।",
        "body_pain": "🟢 घर पर देखभाल:\n• दर्द वाली जगह को आराम दें\n• 15-20 मिनट गर्म सेंक करें\n• जरूरत हो तो पैरासिटामोल (500mg) लें\n• हल्की स्ट्रेचिंग से आराम मिल सकता है\n\n⚠️ डॉक्टर को दिखाएं अगर: दर्द बहुत तेज हो, 3 दिन से ज्यादा रहे, या सूजन/लालिमा हो।",
        "mild_fever": "🟢 घर पर देखभाल:\n• आराम करें, भारी काम न करें\n• खूब पानी और ORS पिएं\n• जरूरत हो तो हर 6 घंटे में पैरासिटामोल (500mg) लें\n• माथे पर गीला कपड़ा रखें\n\n⚠️ डॉक्टर को दिखाएं अगर: बुखार 103°F से ज्यादा हो, 3 दिन से ज्यादा रहे, या चकत्ते/गर्दन में अकड़न हो।",
        "stomach_ache": "🟢 घर पर देखभाल:\n• हल्का खाएं — खिचड़ी, दाल, चावल\n• खूब पानी और ORS पिएं\n• मसालेदार, तला हुआ, भारी खाना बंद करें\n• खाने के तुरंत बाद न लेटें\n\n⚠️ डॉक्टर को दिखाएं अगर: दर्द बहुत तेज हो, 2 दिन से ज्यादा रहे, या मल/उल्टी में खून आए।",
        "diarrhea": "🟢 घर पर देखभाल:\n• हर दस्त के बाद ORS पिएं\n• हल्का खाएं — केला, चावल, दही\n• दूध, मसालेदार और बाहर का खाना बंद करें\n• साबुन से बार-बार हाथ धोएं\n\n⚠️ डॉक्टर को दिखाएं अगर: दस्त 2 दिन से ज्यादा रहे, खून आए, या पानी की कमी के लक्षण हों (मुंह सूखना, पेशाब न आना)।",
        "skin_rash": "🟢 घर पर देखभाल:\n• जगह को साफ और सूखा रखें\n• खुजलाएं नहीं\n• खुजली हो तो कैलामाइन लोशन लगाएं\n• ढीले सूती कपड़े पहनें\n\n⚠️ डॉक्टर को दिखाएं अगर: चकत्ते तेजी से फैलें, पस आए, बुखार हो, या 3 दिन में सुधार न हो।",
        "eye_irritation": "🟢 घर पर देखभाल:\n• साफ पानी से आंखें धोएं\n• आंखें न रगड़ें\n• धूल और स्क्रीन से बचें\n• साफ तौलिया इस्तेमाल करें, शेयर न करें\n\n⚠️ डॉक्टर को दिखाएं अगर: लालिमा/दर्द बढ़े, धुंधला दिखे, या गाढ़ा पीला पानी आए।",
        "default": "🟢 घर पर देखभाल:\n• अच्छे से आराम करें और पानी पीते रहें\n• हल्का, पौष्टिक खाना खाएं\n• लक्षणों पर नज़र रखें\n\n⚠️ 2-3 दिन में सुधार न हो या तबीयत बिगड़े तो नजदीकी स्वास्थ्य केंद्र जाएं।",
    },
}

EMERGENCY_RESPONSE = {
    "en": "🚨 EMERGENCY — This needs IMMEDIATE attention!\n\n• Go to the nearest hospital RIGHT NOW\n• Call 108 (Ambulance) or 112 (Emergency)\n• Do NOT wait — every minute matters\n• If possible, have someone drive you\n\nNearest hospitals will be shown below.",
    "hi": "🚨 आपातकाल — इसे तुरंत ध्यान देने की जरूरत है!\n\n• अभी नजदीकी अस्पताल जाएं\n• 108 (एम्बुलेंस) या 112 (आपातकालीन) पर कॉल करें\n• इंतज़ार न करें — हर मिनट मायने रखता है\n• अगर हो सके तो कोई साथ ले जाए\n\nनजदीकी अस्पताल नीचे दिखाए जाएंगे।",
    "ta": "🚨 அவசரநிலை — உடனடியாக கவனிக்க வேண்டும்!\n\n• இப்போதே அருகிலுள்ள மருத்துவமனைக்கு செல்லுங்கள்\n• 108 (ஆம்புலன்ஸ்) அல்லது 112 (அவசரகால) அழைக்கவும்\n• காத்திருக்காதீர்கள் — ஒவ்வொரு நிமிடமும் முக்கியம்\n• யாரோடாவது போங்கள்\n\nஅருகிலுள்ள மருத்துவமனைகள் கீழே காட்டப்படும்.",
    "gu": "🚨 આપત્કાળ — તુરંત ધ્યાન આપવું જરૂરી!\n\n• હમણાં જ નજીકની હૉસ્પિટલ જા\n• 108 (એમ્બ્યુલન્સ) અથવા 112 (ઇમર્જન્સી) કૉલ કર\n• રાહ ન જો — દરેક મિનિટ મહત્ત્વની છે\n• કોઈ સાથ હોય તો leje jao\n\nNajiki hospital niche dekhase.",
    "mr": "🚨 आणीबाणी — याला तातडीने लक्ष देणे आवश्यक आहे!\n\n• आत्ताच जवळच्या रुग्णालयात जा\n• 108 (रुग्णवाहिका) किंवा 112 (आणीबाणी) वर कॉल करा\n• थांबू नका — प्रत्येक मिनिट महत्त्वाचा आहे\n• शक्य असेल तर कोणाला सोबत घ्या\n\nजवळची रुग्णालये खाली दाखवली जातील.",
}

CLINIC_RESPONSE = {
    "en": "🟡 You should visit a clinic or PHC.\n\n• This needs medical attention, but it is not an emergency\n• Try to visit within the next few hours\n• Bring any medicines you are currently taking\n• If symptoms suddenly worsen, call 108 immediately\n\nNearest clinics will be shown below.",
    "hi": "🟡 आपको क्लिनिक या PHC जाना चाहिए।\n\n• इसे डॉक्टर को दिखाना जरूरी है, लेकिन यह आपातकाल नहीं है\n• अगले कुछ घंटों में जाने की कोशिश करें\n• जो भी दवाई ले रहे हैं साथ ले जाएं\n• अगर अचानक तबीयत बिगड़े तो तुरंत 108 पर कॉल करें\n\nनजदीकी क्लिनिक नीचे दिखाए जाएंगे।",
    "ta": "🟡 நீங்கள் ஒரு கிளினிக் அல்லது PHC க்கு செல்ல வேண்டும்.\n\n• இதற்கு மருத்துவ கவனிப்பு தேவை, ஆனால் இது அவசரநிலை இல்லை\n• அடுத்த சில மணி நேரங்களில் செல்ல முயற்சிக்கவும்\n• எடுக்கும் மருந்துகளை எடுத்துச் செல்லுங்கள்\n• திடீரென்று மோசமானால் உடனே 108 அழைக்கவும்\n\nஅருகிலுள்ள கிளினிக்கள் கீழே காட்டப்படும்.",
    "gu": "🟡 ક્લિનિક અથવા PHC જ.\n\n• ડૉક્ટરને મળવું જરૂરી, પણ આ ઈમર્જન્સી નથ\n• આગળ ચ-ચ kalakomama javo\n• Davai saath lejo\n• Achanak kharab thay to 108 call karo\n\nNajiki clinic niche dekhase.",
    "mr": "🟡 तुम्ही दवाखाना किंवा PHC ला भेट द्यावी.\n\n• याला वैद्यकीय लक्ष आवश्यक आहे, पण ही आणीबाणी नाही\n• पुढील काही तासांत जाण्याचा प्रयत्न करा\n• सध्या घेत असलेल्या औषधांची यादी सोबत घ्या\n• लक्षणे अचानक बिघडल्यास लगेच 108 वर कॉल करा\n\nजवळचे दवाखाने खाली दाखवले जातील.",
}


def classify(extraction: dict, language: Optional[str] = None) -> dict:
    """
    Rule-based classification. Takes LLM extraction, returns triage result.
    The LLM NEVER decides the tier — rules do.
    language: user-selected language from the frontend (overrides LLM detection for responses).
    """
    severity = extraction.get("severity_indicators", {})
    symptoms = extraction.get("symptoms", [])
    # Prefer user-selected language; fall back to LLM-detected
    lang = language or extraction.get("detected_language", "en")
    if lang not in ("en", "hi", "mr", "ta", "gu"):
        lang = "en"  # fallback for unsupported language codes

    # TIER 1: Emergency — any emergency indicator is true
    for indicator in EMERGENCY_INDICATORS:
        if severity.get(indicator, False):
            return {
                "tier": "emergency",
                "confidence": 0.95,
                "message": EMERGENCY_RESPONSE.get(lang, EMERGENCY_RESPONSE["en"]),
                "next_steps": ["call_108", "go_to_hospital"],
                "symptoms": symptoms,
                "language": lang,
                "needs_followup": False,
                "followup_question": None,
            }

    # TIER 2: Clinic — clinic indicators or keyword match
    for indicator in CLINIC_INDICATORS:
        if severity.get(indicator, False):
            return {
                "tier": "clinic",
                "confidence": 0.85,
                "message": CLINIC_RESPONSE.get(lang, CLINIC_RESPONSE["en"]),
                "next_steps": ["visit_clinic", "show_nearby_facilities"],
                "symptoms": symptoms,
                "language": lang,
                "needs_followup": False,
                "followup_question": None,
            }

    # Check symptom keywords for clinic tier
    symptoms_lower = " ".join(symptoms).lower()
    for keyword in CLINIC_SYMPTOM_KEYWORDS:
        if keyword in symptoms_lower:
            return {
                "tier": "clinic",
                "confidence": 0.75,
                "message": CLINIC_RESPONSE.get(lang, CLINIC_RESPONSE["en"]),
                "next_steps": ["visit_clinic", "show_nearby_facilities"],
                "symptoms": symptoms,
                "language": lang,
                "needs_followup": False,
                "followup_question": None,
            }

    # Check if LLM wants to ask a follow-up before classifying
    if extraction.get("needs_followup", False):
        return {
            "tier": "pending",
            "confidence": 0.0,
            "message": extraction.get("followup_question", "Can you tell me more about your symptoms?"),
            "next_steps": ["awaiting_more_info"],
            "symptoms": symptoms,
            "language": lang,
            "needs_followup": True,
            "followup_question": extraction.get("followup_question"),
        }

    # TIER 3: Self-care
    guidance = _get_self_care_guidance(symptoms, lang)
    return {
        "tier": "self_care",
        "confidence": 0.80,
        "message": guidance,
        "next_steps": ["self_care", "monitor_symptoms"],
        "symptoms": symptoms,
        "language": lang,
        "needs_followup": False,
        "followup_question": None,
    }


def _get_self_care_guidance(symptoms: list, lang: str) -> str:
    """Match symptoms to self-care guidance text, preferring dataset text."""
    symptom_text = " ".join(symptoms).lower()

    prefix_map = {
        "hi": "🟢 घर पर देखभाल:\n",
        "ta": "🟢 வீட்டில் பராமரிப்பு:\n",
        "gu": "🟢 ઘરે ઉપchaar:\n",
    }

    # Try dataset match first (self-care tier rows with guidance text)
    for row in SYMPTOM_DATASET:
        if row["triage_tier"] != "self-care":
            continue
        # Marathi falls back to Hindi (shared Devanagari script); others fall back to English
        fallback = "self_care_text_hi" if lang == "mr" else "self_care_text_en"
        self_care_text = row.get(f"self_care_text_{lang}") or row.get(fallback, "") or row.get("self_care_text_en", "")
        if not self_care_text:
            continue
        # Match by symptom name or keywords
        row_keywords = [row["symptom_en"].lower()] + [
            k.strip().lower() for k in row.get("keywords", "").split(",") if k.strip()
        ]
        for kw in row_keywords:
            if kw and kw in symptom_text:
                prefix = prefix_map.get(lang, "🟢 Self-care at home:\n")
                return prefix + self_care_text

    # Fall back to hardcoded guidance; Marathi uses Hindi (shared script), others use English
    fallback_lang = "hi" if lang == "mr" else "en"
    guidance_map = SELF_CARE_GUIDANCE.get(lang, SELF_CARE_GUIDANCE.get(fallback_lang, SELF_CARE_GUIDANCE["en"]))
    keyword_map = [
        ("headache", ["headache", "head pain", "sir dard", "migraine"]),
        ("cold", ["cold", "sardi", "runny nose", "nasal congestion", "sneezing"]),
        ("cough", ["cough", "khansi", "sore throat", "gala kharab"]),
        ("body_pain", ["body pain", "badan dard", "muscle pain", "joint pain", "back pain", "kamar dard"]),
        ("mild_fever", ["fever", "bukhar", "temperature", "chills"]),
        ("stomach_ache", ["stomach", "pet dard", "abdomen", "nausea", "acidity", "gas", "bloating"]),
        ("diarrhea", ["diarrhea", "loose motion", "dast", "watery stool"]),
        ("skin_rash", ["rash", "itching", "khujli", "skin", "allergy", "hives"]),
        ("eye_irritation", ["eye", "aankh", "redness", "irritation", "watery eyes"]),
    ]
    for key, keywords in keyword_map:
        for kw in keywords:
            if kw in symptom_text:
                return guidance_map[key]

    return guidance_map["default"]


def triage(user_message: str) -> dict:
    """
    Main entry point. Takes raw user message, returns triage result.
    This is what Member B will call from the Flask /triage endpoint.
    """
    extraction = extract_symptoms(user_message)
    result = classify(extraction)
    result["raw_extraction"] = extraction
    return result


# Quick test
if __name__ == "__main__":
    test_cases = [
        "I have a headache and slight fever",
        "मुझे सीने में दर्द है",
        "mujhe bahut tez bukhar hai aur sans lene mein taklif ho rahi hai",
        "I have a cold and runny nose",
        "tabiyat kharab hai",
    ]

    for msg in test_cases:
        print(f"\n{'='*60}")
        print(f"INPUT: {msg}")
        print(f"{'='*60}")
        result = triage(msg)
        print(json.dumps(result, indent=2, ensure_ascii=False))
