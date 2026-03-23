"""
ResumeIQ - AI Resume Screening Application
Backend: Flask + Groq API

File: app.py
"""

import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import AI logic
from ai_engine import (
    suggest_roles,
    analyze_resume,
    analyze_resume_hr,
    extract_text_from_file
)

# ─────────────────────────────────────────
# App Configuration
# ─────────────────────────────────────────
app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
MAX_FILE_SIZE_MB = 5

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ─────────────────────────────────────────
# Routes — Basic
# ─────────────────────────────────────────

@app.route("/")
def home():
    return "ResumeIQ backend is live 🚀"


@app.route("/api/health", methods=["GET"])
def health_check():
    api_key_set = bool(os.environ.get("GROQ_API_KEY"))
    return jsonify({
        "status": "ok",
        "api_key_configured": api_key_set,
        "message": "ResumeIQ backend is running"
    })


# ─────────────────────────────────────────
# API: Suggest Roles
# ─────────────────────────────────────────

@app.route("/api/suggest-roles", methods=["POST"])
def api_suggest_roles():
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


# ─────────────────────────────────────────
# API: Analyze Candidate
# ─────────────────────────────────────────

@app.route("/api/analyze-candidate", methods=["POST"])
def api_analyze_candidate():
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
        if os.path.exists(filepath):
            os.remove(filepath)


# ─────────────────────────────────────────
# API: Analyze HR Batch
# ─────────────────────────────────────────

@app.route("/api/analyze-hr", methods=["POST"])
def api_analyze_hr():
    files = request.files.getlist("files[]")
    role = request.form.get("role", "").strip()
    threshold = int(request.form.get("threshold", 0))

    if not files or all(f.filename == "" for f in files):
        return jsonify({"error": "No files uploaded"}), 400

    if not role:
        return jsonify({"error": "No target role specified"}), 400

    results = []
    saved_paths = []

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(filepath)
            saved_paths.append((filename, filepath))

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

    results.sort(key=lambda x: x.get("score", 0), reverse=True)

    return jsonify({
        "results": results,
        "threshold": threshold,
        "role": role,
        "total": len(results)
    })


# ─────────────────────────────────────────
# Run (Render Compatible)
# ─────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  ResumeIQ — AI Resume Screening")
    print("=" * 50)

    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
