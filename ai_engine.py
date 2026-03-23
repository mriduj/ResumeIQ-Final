"""
ResumeIQ - AI Engine (Groq Version)
File: ai_engine.py
"""

import os
import json
from groq import Groq
import pdfplumber
import docx

# Setup — free key from https://console.groq.com
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# llama-3.3-70b is free, very fast, and highly capable
MODEL = "llama-3.3-70b-versatile"


def ask_groq(prompt: str) -> str:
    """Send prompt to Groq, strip markdown fences, return clean text."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return text


def extract_text_from_file(filepath: str) -> str:
    """Extract plain text from PDF, DOCX, or TXT resume file."""
    ext = filepath.rsplit(".", 1)[-1].lower()

    if ext == "txt":
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    elif ext == "pdf":
        text_parts = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts) if text_parts else "[No text extracted from PDF]"

    elif ext == "docx":
        doc = docx.Document(filepath)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs) if paragraphs else "[No text extracted from DOCX]"

    return f"[Unsupported file type: {ext}]"


def suggest_roles(query: str) -> list:
    """
    AI Feature 1: Role Suggestion
    Groq reads the typed query and returns 8 relevant job roles
    from any domain — powers the live autocomplete dropdown.
    """
    prompt = f"""A user is searching for a job role: "{query}"

Return exactly 8 job role suggestions that best match this query.
Cover any domain: tech, medicine, law, arts, beauty, trades, hospitality, etc.

Each item must have:
- "title": exact professional job title
- "domain": industry (e.g. "Healthcare", "Technology", "Beauty")
- "level": one of "Entry", "Mid", "Senior", or "Any"

Return ONLY a raw JSON array, no explanation, no markdown:
[{{"title": "...", "domain": "...", "level": "..."}}, ...]"""

    raw = ask_groq(prompt)
    return json.loads(raw)


def analyze_resume(resume_text: str, role: str) -> dict:
    """
    AI Feature 2: Full Candidate Resume Analysis
    Groq scores the resume 0-100, identifies matched/missing skills,
    and gives 5 specific improvement suggestions.

    Scoring:
      0-19  = No match (no_match: true)
      20-44 = Weak
      45-64 = Partial
      65-79 = Good
      80-100 = Strong
    """
    prompt = f"""You are an expert resume screener across ALL professional domains.

Analyze this resume for the role: "{role}"

RESUME:
---
{resume_text[:6000]}
---

SCORING:
- 0-19: Zero relevant skills → no_match: true
- 20-44: Weak — major gaps
- 45-64: Partial — significant gaps
- 65-79: Good — minor gaps
- 80-100: Strong match

Return ONLY raw JSON, no markdown, no extra text:
{{
  "score": <0-100>,
  "no_match": <true if score 0-19, else false>,
  "verdict_title": "<5 words max>",
  "verdict_text": "<2-3 sentences about fit for {role}>",
  "matched_skills": ["skill1", "skill2", "skill3"],
  "partial_skills": ["skill1", "skill2"],
  "missing_skills": ["gap1", "gap2", "gap3", "gap4", "gap5"],
  "alternative_roles": ["better role 1", "better role 2", "better role 3"],
  "suggestions": [
    {{"icon": "📚", "title": "title", "detail": "specific advice for {role}"}},
    {{"icon": "🛠️", "title": "title", "detail": "project or portfolio advice"}},
    {{"icon": "📜", "title": "title", "detail": "course or certification to pursue"}},
    {{"icon": "🤝", "title": "title", "detail": "networking or experience advice"}},
    {{"icon": "💡", "title": "title", "detail": "foundational knowledge to build"}}
  ]
}}"""

    raw = ask_groq(prompt)
    return json.loads(raw)


def analyze_resume_hr(resume_text: str, role: str, filename: str) -> dict:
    """
    AI Feature 3: HR Batch Screening
    Lighter and faster — designed for screening multiple resumes at once.
    Returns score, top 3 strengths, top 3 gaps, one-sentence summary.
    """
    prompt = f"""You are an expert HR screener. Evaluate this resume for: "{role}"

RESUME:
---
{resume_text[:5000]}
---

If ZERO relevant skills for "{role}", set score 0-10 and no_match: true.

Return ONLY raw JSON, no markdown:
{{
  "score": <0-100>,
  "no_match": <true if score 0-19, else false>,
  "strengths": ["strength1", "strength2", "strength3"],
  "gaps": ["gap1", "gap2", "gap3"],
  "summary": "<one sentence about fit for {role}>"
}}"""

    raw = ask_groq(prompt)
    result = json.loads(raw)
    result["name"] = filename
    return result