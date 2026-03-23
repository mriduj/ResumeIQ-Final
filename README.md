# ResumeIQ — AI Resume Screening App
### AIML Class Project

---

## Project Structure

```
resumeiq/
│
├── app.py              ← Flask server (routing, API endpoints)
├── ai_engine.py        ← All AI logic (Claude API calls)
├── requirements.txt    ← Python dependencies
│
├── templates/
│   └── index.html      ← Main HTML page (served by Flask)
│
└── static/
    ├── css/
    │   └── styles.css  ← All styling
    └── js/
        └── main.js     ← Frontend logic (calls Flask API)
```

---

## How It Works (for your professor)

```
User (Browser)
    │
    │  Types a job role
    ▼
main.js  ──── POST /api/suggest-roles ────►  app.py
                                                │
                                                ▼
                                          ai_engine.py
                                          suggest_roles()
                                                │
                                          Claude AI API
                                                │
                                          Returns 8 role suggestions
                                                │
              JSON response ◄──────────────────┘
    │
    │  Uploads resume + picks role
    ▼
main.js  ──── POST /api/analyze-candidate ►  app.py
                                                │
                                                ▼
                                          ai_engine.py
                                          extract_text_from_file()  ← PDF/DOCX/TXT
                                          analyze_resume()
                                                │
                                          Claude AI API
                                                │
                                          Returns score, skills, suggestions
                                                │
              JSON response ◄──────────────────┘
    │
    ▼
main.js renders results to the DOM
```

---

## AI Features (where Claude is used)

| Feature | Function | What Claude does |
|---|---|---|
| Role Suggestions | `suggest_roles()` | Reads the typed query and generates 8 contextually relevant job titles from any domain |
| Resume Analysis | `analyze_resume()` | Reads the resume text and role, scores the match 0-100, identifies matched/missing skills, suggests improvements |
| HR Batch Screening | `analyze_resume_hr()` | Same as above but lighter, designed for fast batch processing |

---

## Setup & Run

### 1. Get an Anthropic API key
Sign up at https://console.anthropic.com and create an API key.

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set your API key
```bash
# Mac/Linux
export ANTHROPIC_API_KEY="your-key-here"

# Windows CMD
set ANTHROPIC_API_KEY=your-key-here

# Windows PowerShell
$env:ANTHROPIC_API_KEY="your-key-here"
```

### 4. Run the Flask server
```bash
python app.py
```

### 5. Open in browser
Go to: **http://localhost:5000**

---

## Technologies Used

| Layer | Technology | Purpose |
|---|---|---|
| AI | Anthropic Claude API | Role suggestion + resume analysis |
| Backend | Python + Flask | REST API server |
| Text Extraction | pdfplumber + python-docx | Extract text from uploaded resumes |
| Frontend | HTML + CSS | User interface |
| Frontend Logic | Vanilla JavaScript | API calls, DOM rendering |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Serves the main HTML page |
| POST | `/api/suggest-roles` | Returns AI-generated role suggestions |
| POST | `/api/analyze-candidate` | Full resume analysis for a candidate |
| POST | `/api/analyze-hr` | Batch resume screening for HR |
| GET | `/api/health` | Health check |
