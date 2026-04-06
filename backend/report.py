import random
import string
import re
from datetime import datetime, timezone
from fpdf import FPDF

# ── Constants ──────────────────────────────────────────────

TIER_LABEL = {
    "emergency": "EMERGENCY",
    "clinic":    "CLINIC VISIT REQUIRED",
    "self_care": "SELF-CARE AT HOME",
}

TIER_COLOR = {
    "emergency": (220, 38, 38),
    "clinic":    (217, 119, 6),
    "self_care": (5, 150, 105),
}

PRIMARY    = (37, 99, 235)
TEXT_DARK  = (30, 30, 30)
TEXT_GREY  = (100, 100, 100)
TEXT_LIGHT = (160, 160, 160)
BG_LIGHT   = (245, 247, 250)
DIVIDER    = (220, 220, 220)


def _new_report_id() -> str:
    return "RPT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=7))


def _clean(text: str) -> str:
    """
    Strip/replace characters outside Latin-1 that Helvetica can't render.
    Keeps ASCII + Latin Extended. Replaces common Unicode punctuation with ASCII.
    """
    replacements = {
        '\u2014': '-', '\u2013': '-',   # em-dash, en-dash
        '\u2022': '-', '\u25CF': '-',   # bullets
        '\u2018': "'", '\u2019': "'",   # curly single quotes
        '\u201C': '"', '\u201D': '"',   # curly double quotes
        '\u2026': '...',                # ellipsis
        '\u00B7': '-',                  # middle dot
    }
    for ch, rep in replacements.items():
        text = text.replace(ch, rep)
    # Remove anything outside Latin-1 range (covers Devanagari, emoji, etc.)
    text = re.sub(r'[^\x00-\xFF]', '', text)
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _section_header(pdf: FPDF, title: str):
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*TEXT_DARK)
    pdf.set_fill_color(*BG_LIGHT)
    pdf.cell(0, 8, f"  {title}", ln=1, fill=True)  # type: ignore
    pdf.ln(1)


def _divider(pdf: FPDF):
    pdf.set_draw_color(*DIVIDER)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)


def build_report(data: dict):
    """
    Build a PDF medical report.

    Args:
        data: dict with keys:
            session_id, symptoms, tier, language,
            message, facilities, condition_name (optional)

    Returns:
        (report_id: str, pdf_bytes: bytes)
    """
    report_id     = _new_report_id()
    session_id    = data.get("session_id", "unknown")
    symptoms      = data.get("symptoms", [])
    tier          = data.get("tier", "self_care")
    message       = data.get("message", "")
    facilities    = data.get("facilities", [])
    condition     = data.get("condition_name", "")
    timestamp     = datetime.now(timezone.utc).strftime("%d %B %Y  |  %I:%M %p UTC")

    tier_label = TIER_LABEL.get(tier, tier.replace("_", " ").upper())
    tier_r, tier_g, tier_b = TIER_COLOR.get(tier, (5, 150, 105))

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(12, 12, 12)

    # ── Top header bar ─────────────────────────────────────
    pdf.set_fill_color(*PRIMARY)
    pdf.rect(0, 0, 220, 26, "F")

    pdf.set_font("Helvetica", "B", 17)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(12, 5)
    pdf.cell(0, 9, "AarogyaBot  |  AI Health Triage Report", ln=1)  # type: ignore

    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(12, 16)
    pdf.cell(0, 6, "Powered by Llama 3.3 via Groq  |  Not a substitute for professional medical advice", ln=1)  # type: ignore

    pdf.set_y(32)

    # ── Report meta row ────────────────────────────────────
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*TEXT_GREY)
    pdf.cell(65, 6, f"Report ID:  {report_id}", ln=0)  # type: ignore
    pdf.cell(80, 6, f"Generated:  {timestamp}", ln=0)  # type: ignore
    pdf.cell(0,  6, f"Session:  {session_id[:10].upper()}...", ln=1)  # type: ignore

    pdf.ln(3)
    _divider(pdf)

    # ── Triage classification ──────────────────────────────
    _section_header(pdf, "Triage Classification")

    pdf.set_fill_color(tier_r, tier_g, tier_b)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(90, 11, f"   {tier_label}", ln=1, fill=True)  # type: ignore
    pdf.ln(4)

    # ── Condition (image triage only) ──────────────────────
    if condition and condition not in ("", "Unclear"):
        _section_header(pdf, "Identified Condition")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(*TEXT_DARK)
        pdf.cell(0, 7, condition, ln=1)  # type: ignore
        pdf.ln(3)

    # ── Symptoms ───────────────────────────────────────────
    if symptoms:
        _section_header(pdf, "Reported Symptoms")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEXT_DARK)
        for s in symptoms:
            label = s.replace("_", " ").title()
            pdf.cell(8, 6, "", ln=0)  # type: ignore
            pdf.cell(0, 6, f"-  {label}", ln=1)  # type: ignore
        pdf.ln(3)

    # ── Recommendation ─────────────────────────────────────
    if message:
        _section_header(pdf, "Recommendation")
        clean_msg = _clean(message)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEXT_GREY)
        pdf.multi_cell(0, 6, clean_msg)
        pdf.ln(3)

    # ── Nearest facilities ─────────────────────────────────
    if facilities:
        _section_header(pdf, "Nearest Healthcare Facilities")
        pdf.set_font("Helvetica", "", 10)
        for fac in facilities[:3]:
            name  = fac.get("name", "Unknown")
            ftype = fac.get("type", "")
            dist  = fac.get("road_km", fac.get("distance", "?"))
            phone = fac.get("phone", "N/A")
            hours = fac.get("open_hours", "")

            pdf.set_text_color(*PRIMARY)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, f"{name}  ({ftype})", ln=1)  # type: ignore

            pdf.set_text_color(*TEXT_GREY)
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(10, 5, "", ln=0)  # type: ignore
            details = f"Distance: {dist} km   |   Phone: {phone}"
            if hours:
                details += f"   |   Hours: {hours}"
            pdf.cell(0, 5, details, ln=1)  # type: ignore
            pdf.ln(2)
        pdf.ln(2)

    # ── Emergency helplines ────────────────────────────────
    _section_header(pdf, "Emergency Helplines")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(0, 7, "Ambulance: 108     Emergency: 112     Health Helpline: 104", ln=1)  # type: ignore
    pdf.ln(4)

    # ── Footer disclaimer ──────────────────────────────────
    _divider(pdf)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*TEXT_LIGHT)
    pdf.multi_cell(
        0, 5,
        "DISCLAIMER: This report is generated by an AI triage assistant for informational purposes only. "
        "It is NOT a medical diagnosis and does NOT replace the advice of a qualified doctor or healthcare professional. "
        "In case of emergency, call 108 immediately."
    )

    return report_id, bytes(pdf.output())
