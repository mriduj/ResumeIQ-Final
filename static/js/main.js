/**
 * ResumeIQ — Frontend JavaScript
 * File: static/js/main.js
 *
 * This file handles everything on the browser side:
 *   - Tab switching
 *   - File upload handling
 *   - Calling the Flask backend API endpoints
 *   - Rendering AI results to the DOM
 *
 * All AI logic lives in the Python backend (ai_engine.py).
 * This file only calls those endpoints and displays what comes back.
 */

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────

// Store selected files for each panel
const selectedFiles = {
  c:  null,         // candidate: single file
  hr: []            // hr: multiple files
};

// Dropdown state per panel prefix ('c' or 'hr')
const dd = {
  c:  { open: false, items: [], hl: -1, debounce: null, closeTimer: null },
  hr: { open: false, items: [], hl: -1, debounce: null, closeTimer: null }
};

// Popular roles shown before user types anything
const POPULAR_ROLES = [
  'Software Engineer', 'Data Scientist', 'Product Manager', 'Nurse',
  'Teacher', 'Accountant', 'Graphic Designer', 'Makeup Artist',
  'Chef', 'Lawyer', 'Flight Attendant', 'Freelancer',
  'Photographer', 'Social Media Manager', 'HR Manager', 'Project Engineer'
];

// Base URL for all API calls — relative path works on any host (local or Render)
const API = '/api';


// ─────────────────────────────────────────
// Tab Switching
// ─────────────────────────────────────────

function switchTab(tab, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab + '-panel').classList.add('active');
  btn.classList.add('active');
}


// ─────────────────────────────────────────
// File Handling
// ─────────────────────────────────────────

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, prefix) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f =>
    /\.(pdf|docx|txt)$/i.test(f.name)
  );
  if (!files.length) return alert('Please drop PDF, DOCX, or TXT files only.');
  applyFiles(files, prefix);
}

function handleFileSelect(e, prefix) {
  applyFiles(Array.from(e.target.files), prefix);
}

function applyFiles(files, prefix) {
  if (prefix === 'c') {
    // Candidate: only one file
    selectedFiles.c = files[0];
    document.getElementById('c-file-badge').style.display = 'inline-flex';
    document.getElementById('c-file-name-text').textContent = files[0].name;
  } else {
    // HR: multiple files, avoid duplicates
    files.forEach(f => {
      if (!selectedFiles.hr.find(x => x.name === f.name)) {
        selectedFiles.hr.push(f);
      }
    });
    renderBatchList();
  }
}

function renderBatchList() {
  document.getElementById('hr-batch-list').innerHTML = selectedFiles.hr.map((f, i) => `
    <div class="batch-item">
      <span>📄 ${f.name}</span>
      <div style="display:flex;align-items:center;gap:.5rem">
        <span>${(f.size / 1024).toFixed(0)} KB</span>
        <button class="remove-btn" onclick="removeFile(${i})">✕</button>
      </div>
    </div>`).join('');
}

function removeFile(i) {
  selectedFiles.hr.splice(i, 1);
  renderBatchList();
}


// ─────────────────────────────────────────
// AI Role Suggestion Dropdown
// ─────────────────────────────────────────

/**
 * Called every time the user types in the role input.
 * Debounces before calling the backend so we don't fire on every keystroke.
 */
function onRoleType(prefix) {
  const q = document.getElementById(prefix + '-role-search').value.trim();
  clearTimeout(dd[prefix].debounce);

  if (!q) {
    showPopularChips(prefix);
    return;
  }

  // Show loading dots immediately to give instant feedback
  showDDLoading(prefix);

  // Wait 450ms after the user stops typing, then call AI
  dd[prefix].debounce = setTimeout(() => fetchSuggestions(prefix), 450);
}

function onRoleFocus(prefix) {
  clearTimeout(dd[prefix].closeTimer);
  const q = document.getElementById(prefix + '-role-search').value.trim();
  if (!q) showPopularChips(prefix);
  else if (dd[prefix].items.length) renderItems(prefix, dd[prefix].items);
}

function onRoleBlur(prefix) {
  // Delay close so clicks on dropdown options still register
  dd[prefix].closeTimer = setTimeout(() => closeDropdown(prefix), 220);
}

function onRoleKey(e, prefix) {
  if (!dd[prefix].open) return;
  const state = dd[prefix];

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.hl = Math.min(state.hl + 1, state.items.length - 1);
    renderItems(prefix, state.items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.hl = Math.max(state.hl - 1, 0);
    renderItems(prefix, state.items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.hl >= 0 && state.items[state.hl]) {
      confirmRole(prefix, state.items[state.hl].title);
    } else {
      // If nothing highlighted, use the typed text directly
      const typed = document.getElementById(prefix + '-role-search').value.trim();
      if (typed) confirmRole(prefix, typed);
    }
  } else if (e.key === 'Escape') {
    closeDropdown(prefix);
  }
}

/**
 * Opens the dropdown and shows popular role chips.
 * This is what appears before the user types anything.
 */
function showPopularChips(prefix) {
  openDropdown(prefix);
  document.getElementById(prefix + '-dd').innerHTML = `
    <div class="dd-header">⚡ Popular Roles — click to select</div>
    <div class="dd-chip-row">
      ${POPULAR_ROLES.map(r =>
        `<span class="dd-chip" onmousedown="confirmRole('${prefix}','${r}')">${r}</span>`
      ).join('')}
    </div>
    <div class="dd-section">💡 Or type any role — Claude AI will suggest matches</div>`;
}

function showDDLoading(prefix) {
  openDropdown(prefix);
  document.getElementById(prefix + '-dd').innerHTML = `
    <div class="dd-header">🤖 Claude AI is thinking...</div>
    <div class="dd-loading">
      <div class="dot-pulse"><span></span><span></span><span></span></div>
      <div style="margin-top:0.6rem;font-size:0.8rem;color:var(--muted)">Finding the best matching roles...</div>
    </div>`;
}

/**
 * Calls the Flask backend /api/suggest-roles endpoint.
 * The backend calls Claude AI and returns 8 relevant job titles.
 */
async function fetchSuggestions(prefix) {
  const q = document.getElementById(prefix + '-role-search').value.trim();
  if (!q) { showPopularChips(prefix); return; }

  // Show loading state on the button
  const btn = document.getElementById(prefix + '-suggest-btn');
  btn.classList.add('loading');
  btn.disabled = true;
  showDDLoading(prefix);

  try {
    const response = await fetch(`${API}/suggest-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error);

    dd[prefix].items = data.suggestions;
    dd[prefix].hl = -1;
    renderItems(prefix, data.suggestions);

  } catch (err) {
    console.error('Suggestion error:', err);
    // Graceful fallback: let user use what they typed
    document.getElementById(prefix + '-dd').innerHTML = `
      <div class="dd-header">🔍 Use this role</div>
      <div class="dd-option" onmousedown="confirmRole('${prefix}','${q.replace(/'/g,"&apos;")}')">
        <span class="opt-name">${q}</span>
        <span class="opt-domain">Custom / typed</span>
      </div>`;
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/**
 * Renders the AI-suggested roles as clickable options in the dropdown.
 */
function renderItems(prefix, items) {
  if (!items || !items.length) {
    document.getElementById(prefix + '-dd').innerHTML =
      `<div style="padding:1rem;color:var(--muted);font-size:0.85rem;text-align:center">No suggestions — press Enter to use your typed role.</div>`;
    return;
  }

  const q = document.getElementById(prefix + '-role-search').value.trim();
  const state = dd[prefix];

  // Level label color
  const levelColor = (lvl) =>
    lvl === 'Senior' ? 'color:#ffd700' : lvl === 'Entry' ? 'color:#43e97b' : 'color:var(--muted)';

  let html = `<div class="dd-header">🤖 AI Suggestions for "${q}"</div>
    <div class="dd-section">Select a role, or press Enter to use your exact text</div>`;

  items.forEach((item, idx) => {
    const hlClass = state.hl === idx ? 'hl' : '';
    html += `
      <div class="dd-option ${hlClass}" onmousedown="confirmRole('${prefix}','${item.title.replace(/'/g,"&apos;")}')">
        <div>
          <span class="opt-name">${item.title}</span>
          <span class="opt-domain"> · ${item.domain}</span>
        </div>
        <span class="opt-level" style="${levelColor(item.level)}">${item.level}</span>
      </div>`;
  });

  // Also show the exact typed text as an option at the bottom
  html += `
    <div class="dd-section" style="border-top:1px solid var(--border);margin-top:0.25rem">Use exact input</div>
    <div class="dd-option" onmousedown="confirmRole('${prefix}','${q.replace(/'/g,"&apos;")}')">
      <span class="opt-name" style="font-style:italic;color:var(--muted)">"${q}"</span>
      <span class="opt-domain">Custom / exact</span>
    </div>`;

  document.getElementById(prefix + '-dd').innerHTML = html;
  openDropdown(prefix);
}

function openDropdown(prefix) {
  document.getElementById(prefix + '-dd').classList.add('open');
  document.getElementById(prefix + '-role-search').classList.add('dd-open');
  dd[prefix].open = true;
}

function closeDropdown(prefix) {
  document.getElementById(prefix + '-dd').classList.remove('open');
  document.getElementById(prefix + '-role-search').classList.remove('dd-open');
  dd[prefix].open = false;
  dd[prefix].hl = -1;
}

/**
 * Called when user clicks a role from the dropdown, or presses Enter.
 * Stores the role value and shows the confirmation badge.
 */
function confirmRole(prefix, role) {
  clearTimeout(dd[prefix].closeTimer);
  document.getElementById(prefix + '-role-val').value = role;
  document.getElementById(prefix + '-selected-text').textContent = role;
  document.getElementById(prefix + '-selected-role').style.display = 'flex';

  // Hide the input area, show the badge
  const inputArea = document.getElementById(prefix === 'c' ? 'c-role-input-area' : 'hr-role-input-area');
  if (inputArea) inputArea.style.display = 'none';
  else document.getElementById(prefix + '-role-wrap').style.display = 'none'; // HR fallback

  closeDropdown(prefix);
}

/**
 * Resets the role selection so the user can pick a different role.
 */
function changeRole(prefix) {
  document.getElementById(prefix + '-role-val').value = '';
  document.getElementById(prefix + '-selected-role').style.display = 'none';
  document.getElementById(prefix + '-role-search').value = '';
  dd[prefix].items = [];

  const inputArea = document.getElementById(prefix === 'c' ? 'c-role-input-area' : null);
  if (inputArea) inputArea.style.display = 'block';
  else document.getElementById(prefix + '-role-wrap').style.display = 'block';

  document.getElementById(prefix + '-role-search').focus();
}


// ─────────────────────────────────────────
// Candidate Analysis
// ─────────────────────────────────────────

/**
 * Sends the resume file and role to the Flask backend.
 * The backend extracts the text, calls Claude, and returns the full analysis.
 */
async function analyzeCandidate() {
  const role = document.getElementById('c-role-val').value.trim();

  if (!selectedFiles.c) return alert('Please upload your resume first.');
  if (!role)            return alert('Please select or type a target role.');

  // UI: show loading, hide previous results
  document.getElementById('c-analyze-btn').disabled = true;
  document.getElementById('c-results').classList.remove('show');
  document.getElementById('c-loading').classList.add('show');

  // Rotate through informative loading messages
  const steps = [
    `Extracting text from your resume...`,
    `Understanding what "${role}" requires...`,
    `Calculating your match score...`,
    `Building your improvement roadmap...`
  ];
  let si = 0;
  const stepInterval = setInterval(() => {
    si = (si + 1) % steps.length;
    document.getElementById('c-loading-step').textContent = steps[si];
  }, 1800);

  try {
    // Build multipart form data to send file + role
    const formData = new FormData();
    formData.append('file', selectedFiles.c);
    formData.append('role', role);

    const response = await fetch(`${API}/analyze-candidate`, {
      method: 'POST',
      body: formData   // No Content-Type header — browser sets it with boundary
    });

    const result = await response.json();

    if (result.error) throw new Error(result.error);

    clearInterval(stepInterval);
    renderCandidateResults(result, role);

  } catch (err) {
    clearInterval(stepInterval);
    console.error(err);
    alert('Analysis failed. Please try again.\n\n' + err.message);
  } finally {
    document.getElementById('c-loading').classList.remove('show');
    document.getElementById('c-analyze-btn').disabled = false;
  }
}

/**
 * Takes the JSON from the backend and renders it visually.
 * Handles two states: No Match (score < 20) and Normal.
 */
function renderCandidateResults(r, role) {
  const score = Math.min(100, Math.max(0, r.score));
  const isNoMatch = r.no_match === true || score < 20;

  document.getElementById('c-no-match').style.display       = isNoMatch ? 'block' : 'none';
  document.getElementById('c-normal-results').style.display = isNoMatch ? 'none'  : 'block';

  if (isNoMatch) {
    // ── No Match State ──
    document.getElementById('c-nm-score').textContent = score + '% Match';
    document.getElementById('c-nm-desc').textContent  = r.verdict_text || 'Your skills don\'t align with this role yet. Here\'s your path forward.';

    const alts = r.alternative_roles || [];
    if (alts.length) {
      document.getElementById('c-alt-roles-wrap').style.display = 'block';
      document.getElementById('c-alt-roles').innerHTML = alts.map(alt =>
        `<span class="alt-role-pill" onclick="quickAnalyze('${alt.replace(/'/g,"\\'")}')">✦ ${alt}</span>`
      ).join('');
    }

    document.getElementById('c-nm-skills').innerHTML = `
      <div class="skill-card" style="grid-column:1/-1">
        <div class="skill-card-header">
          <span class="skill-card-title">Skills You Need To Develop</span>
          <span class="skill-tag tag-missing">✗ ${r.missing_skills?.length || 0}</span>
        </div>
        <ul class="skill-list">
          ${(r.missing_skills || []).map(s => `<li class="skill-pill pill-missing">${s}</li>`).join('')}
        </ul>
      </div>`;

    document.getElementById('c-nm-suggestions').innerHTML = buildSuggestions(r.suggestions);

  } else {
    // ── Normal Results ──
    const color = score >= 75 ? '#43e97b' : score >= 50 ? '#6c63ff' : score >= 30 ? '#ffd700' : '#ff6584';
    const circ = 408;

    const prog = document.getElementById('c-ring-prog');
    prog.style.stroke = color;
    prog.style.strokeDashoffset = circ;
    // Animate ring after a short delay so the transition is visible
    setTimeout(() => { prog.style.strokeDashoffset = circ - (score / 100) * circ; }, 100);

    document.getElementById('c-score-number').textContent = score + '%';
    document.getElementById('c-score-number').style.color = color;
    document.getElementById('c-verdict-title').textContent = r.verdict_title;
    document.getElementById('c-verdict-text').textContent  = r.verdict_text;

    document.getElementById('c-skills-grid').innerHTML = `
      <div class="skill-card">
        <div class="skill-card-header">
          <span class="skill-card-title">Matched Skills</span>
          <span class="skill-tag tag-match">✓ ${r.matched_skills?.length || 0}</span>
        </div>
        <ul class="skill-list">
          ${(r.matched_skills || []).map(s => `<li class="skill-pill pill-match">${s}</li>`).join('')}
        </ul>
      </div>
      <div class="skill-card">
        <div class="skill-card-header">
          <span class="skill-card-title">Partial Match</span>
          <span class="skill-tag tag-partial">~ ${r.partial_skills?.length || 0}</span>
        </div>
        <ul class="skill-list">
          ${(r.partial_skills || []).map(s => `<li class="skill-pill pill-partial">${s}</li>`).join('')}
        </ul>
      </div>
      <div class="skill-card" style="grid-column:1/-1">
        <div class="skill-card-header">
          <span class="skill-card-title">Missing Skills</span>
          <span class="skill-tag tag-missing">✗ ${r.missing_skills?.length || 0}</span>
        </div>
        <ul class="skill-list">
          ${(r.missing_skills || []).map(s => `<li class="skill-pill pill-missing">${s}</li>`).join('')}
        </ul>
      </div>`;

    document.getElementById('c-suggestions').innerHTML = buildSuggestions(r.suggestions);
  }

  document.getElementById('c-results').classList.add('show');
  document.getElementById('c-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Helper: build suggestion cards HTML from an array of suggestion objects */
function buildSuggestions(suggestions) {
  return (suggestions || []).map(s => `
    <div class="suggestion-item">
      <div class="sug-icon">${s.icon}</div>
      <div class="sug-text">
        <h4>${s.title}</h4>
        <p>${s.detail}</p>
      </div>
    </div>`).join('');
}

/**
 * Click an alternative role pill → auto-select that role and re-analyze.
 */
function quickAnalyze(role) {
  confirmRole('c', role);
  document.getElementById('c-results').classList.remove('show');
  analyzeCandidate();
}


// ─────────────────────────────────────────
// HR Batch Analysis
// ─────────────────────────────────────────

/**
 * Sends all selected files + the role to the Flask backend in one request.
 * Backend processes each file, calls Claude, and returns ranked results.
 */
async function analyzeHR() {
  const role      = document.getElementById('hr-role-val').value.trim();
  const threshold = parseInt(document.getElementById('hr-threshold').value) || 0;

  if (!selectedFiles.hr.length) return alert('Please upload at least one resume.');
  if (!role)                    return alert('Please select a target role.');

  document.getElementById('hr-analyze-btn').disabled = true;
  document.getElementById('hr-results').classList.remove('show');
  document.getElementById('hr-loading').classList.add('show');
  document.getElementById('hr-loading-step').textContent = `Sending ${selectedFiles.hr.length} resume(s) to AI...`;

  try {
    const formData = new FormData();
    formData.append('role', role);
    formData.append('threshold', threshold);
    selectedFiles.hr.forEach(f => formData.append('files[]', f));

    const response = await fetch(`${API}/analyze-hr`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error);

    renderHRResults(data.results, threshold);
    document.getElementById('hr-results').classList.add('show');
    document.getElementById('hr-results').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    alert('Screening failed. Please try again.\n\n' + err.message);
  } finally {
    document.getElementById('hr-loading').classList.remove('show');
    document.getElementById('hr-analyze-btn').disabled = false;
  }
}

/**
 * Renders the HR results table from the backend response.
 */
function renderHRResults(results, threshold) {
  document.getElementById('hr-tbody').innerHTML = results.map((r, i) => {
    const score   = r.score || 0;
    const noMatch = r.no_match || score < 20;
    const color   = noMatch    ? '#ff3333'  :
                    score >= 75 ? '#43e97b'  :
                    score >= 55 ? '#a78bfa'  :
                    score >= 35 ? '#ffd700'  : '#ff6584';

    const [badgeClass, badgeLabel] =
      noMatch    ? ['badge-none',      '🚫 No Match']  :
      score >= 75 ? ['badge-excellent', '★ Excellent']  :
      score >= 55 ? ['badge-good',      '✦ Good']       :
      score >= 35 ? ['badge-fair',      '~ Fair']        :
                    ['badge-weak',      '▽ Weak'];

    const belowThreshold = threshold && score < threshold
      ? `<span style="color:var(--accent2);font-size:0.7rem;display:block;margin-top:0.1rem">Below ${threshold}% threshold</span>`
      : '';

    return `
      <tr style="${noMatch ? 'opacity:0.6' : ''}">
        <td style="font-family:'Syne',sans-serif;font-weight:700;color:var(--muted)">${i + 1}</td>
        <td>
          <div style="font-weight:500">${r.name.replace(/\.[^.]+$/, '')}</div>
          <div style="color:var(--muted);font-size:0.75rem;margin-top:0.1rem">${r.summary || ''}</div>
        </td>
        <td>
          <div class="score-bar-wrap">
            <div class="score-bar-bg">
              <div class="score-bar-fill" style="width:${score}%;background:${color}"></div>
            </div>
            <span class="score-pct" style="color:${color}">${score}%</span>
          </div>
          ${belowThreshold}
        </td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td style="color:var(--accent3);font-size:0.8rem">
          ${noMatch ? '<span style="color:#ff4444;font-size:0.78rem">No relevant skills found</span>' : (r.strengths || []).slice(0, 2).join(', ')}
        </td>
        <td style="color:var(--accent2);font-size:0.8rem">
          ${(r.gaps || []).slice(0, 2).join(', ')}
        </td>
      </tr>`;
  }).join('');
}
