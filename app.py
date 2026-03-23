"""
ResumeIQ - AI Resume Screening Application
Backend: Flask + Anthropic Claude API

File: app.py
Purpose: Main Flask server — handles routing, file uploads, and AI endpoints
"""

import os
import json
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import our AI logic module
from ai_engine import (
    suggest_roles,
    analyze_resume,
    analyze_resume_hr,
    extract_text_from_file
)

# ─────────────────────────────────────────
# App Configuration
# ─────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)  # Allow frontend JS to call the API

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
MAX_FILE_SIZE_MB = 5

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024  # 5MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    """Check if uploaded file has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ─────────────────────────────────────────
# Routes — Pages
# ─────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


# ─────────────────────────────────────────
# Routes — API Endpoints
# ─────────────────────────────────────────

@app.route("/api/suggest-roles", methods=["POST"])
def api_suggest_roles():
    """
    AI-powered role suggestion endpoint.

    Accepts: { "query": "makeup artist" }
    Returns: { "suggestions": [{"title": "...", "domain": "...", "level": "..."}, ...] }

    Uses Claude AI to generate contextual job role suggestions
    based on what the user is typing.
    """
    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' field"}), 400

    query = data["query"].strip()
    if not query:
        return jsonify({"suggestions": []}), 200

    try:
        suggestions = suggest_roles(query)
        return jsonify({"suggestions": suggestions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze-candidate", methods=["POST"])
def api_analyze_candidate():
    """
    Resume analysis for candidates.

    Accepts: multipart form with:
        - file: the resume file (PDF/DOCX/TXT)
        - role: target job role string

    Returns: full AI analysis JSON including match score,
             matched/missing skills, and improvement suggestions.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    role = request.form.get("role", "").strip()

    if not file.filename:
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF, DOCX, and TXT files are supported"}), 400
    if not role:
        return jsonify({"error": "No target role specified"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    try:
        resume_text = extract_text_from_file(filepath)
        result = analyze_resume(resume_text, role)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up uploaded file after processing
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route("/api/analyze-hr", methods=["POST"])
def api_analyze_hr():
    """
    Batch resume analysis for HR screening.

    Accepts: multipart form with:
        - files[]: one or more resume files
        - role: target job role string
        - threshold (optional): minimum match % to pass

    Returns: list of candidate results sorted by match score.
    """
    files = request.files.getlist("files[]")
    role = request.form.get("role", "").strip()
    threshold = int(request.form.get("threshold", 0))

    if not files or all(f.filename == "" for f in files):
        return jsonify({"error": "No files uploaded"}), 400
    if not role:
        return jsonify({"error": "No target role specified"}), 400

    results = []
    saved_paths = []

    # Save all files first
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(filepath)
            saved_paths.append((filename, filepath))

    # Analyze each resume
    for filename, filepath in saved_paths:
        try:
            resume_text = extract_text_from_file(filepath)
            result = analyze_resume_hr(resume_text, role, filename)
            results.append(result)
        except Exception as e:
            results.append({
                "name": filename,
                "score": 0,
                "no_match": True,
                "strengths": [],
                "gaps": ["Analysis failed"],
                "summary": f"Error: {str(e)}"
            })
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

    # Sort by score descending
    results.sort(key=lambda x: x.get("score", 0), reverse=True)

    return jsonify({
        "results": results,
        "threshold": threshold,
        "role": role,
        "total": len(results)
    })


@app.route("/api/health", methods=["GET"])
def health_check():
    """Simple health check — confirms server and API key are configured."""
    api_key_set = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return jsonify({
        "status": "ok",
        "api_key_configured": api_key_set,
        "message": "ResumeIQ backend is running"
    })


# ─────────────────────────────────────────
# Run
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  ResumeIQ — AI Resume Screening")
    print("=" * 50)

    port = int(os.environ.get("PORT", 10000))  # Use Render's PORT
    app.run(host="0.0.0.0", port=port)
