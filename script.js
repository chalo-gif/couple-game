// script.js - drives all pages (index.html, setup.html, quiz.html, result.html)

/*
  Flow:
  - index.html: simple owner login (password "game"), then go to setup.html
  - setup.html: owner types up to 10 questions and answers, generates a shareable link
      -> link is quiz.html?data=BASE64(JSON)
  - quiz.html: partner opens link, answers questions, submits
      -> redirect to result.html?data=BASE64(JSON-with-owner-and-player)
  - result.html: parses data, calculates matches, shows percentage + message
*/

/* ---------- Utilities ---------- */
function $(sel){ return document.querySelector(sel) }
function $all(sel){ return Array.from(document.querySelectorAll(sel)) }

// basic base64 encode/decode for JSON (URL-safe)
function encodeData(obj){
  try {
    const json = JSON.stringify(obj);
    return btoa(encodeURIComponent(json));
  } catch(e){ return '' }
}
function decodeData(str){
  try {
    const json = decodeURIComponent(atob(str));
    return JSON.parse(json);
  } catch(e){ return null }
}

// normalize answers for comparison
function normAnswer(s){
  if (s === undefined || s === null) return '';
  return String(s).trim().toLowerCase();
}

/* ---------- index.html (login) ---------- */
(function initIndex(){
  if (!document.getElementById('loginBtn')) return;

  const loginBtn = $('#loginBtn');
  loginBtn.addEventListener('click', ()=>{
    const pwd = $('#password').value || '';
    const ownerName = ($('#ownerName').value || 'Charles').trim() || 'Charles';
    if (pwd === 'game'){
      // allow go to setup, pass owner name in query
      const q = new URLSearchParams();
      q.set('owner', ownerName);
      window.location.href = 'setup.html?' + q.toString();
    } else {
      alert('Wrong password. (Hint: password is "game")');
    }
  });
})();

/* ---------- setup.html ---------- */
(function initSetup(){
  if (!document.getElementById('qaList')) return;

  // populate 10 question rows
  const qaList = $('#qaList');
  function makeRow(i, q='', a=''){
    const div = document.createElement('div');
    div.className = 'qa-row';
    div.innerHTML = `
      <div class="qa-index">${i+1}</div>
      <div class="q"><input placeholder="Question ${i+1}" data-qindex="${i}" value="${escapeHtml(q)}"></div>
      <div class="a"><input placeholder="Answer ${i+1}" data-aindex="${i}" value="${escapeHtml(a)}"></div>
    `;
    return div;
  }

  // load owner from query if present
  const params = new URLSearchParams(location.search);
  const ownerName = params.get('owner') || 'Charles';
  $('#qaList').innerHTML = '';
  for (let i=0;i<10;i++){
    qaList.appendChild(makeRow(i));
  }

  // saved quizzes area
  const savedList = $('#savedList');

  // helpers to read form values
  function readQAs(){
    const rows = $all('.qa-row');
    const arr = [];
    rows.forEach((r, idx)=>{
      const q = r.querySelector('[data-qindex]').value || '';
      const a = r.querySelector('[data-aindex]').value || '';
      if (q.trim() !== '') arr.push({q: q.trim(), a: a.trim()});
    });
    return arr;
  }

  // generate link
  $('#generateLink').addEventListener('click', ()=>{
    const pairs = readQAs();
    if (pairs.length === 0) { alert('Please add at least one question.'); return; }

    // store owner & timestamp
    const payload = {
      owner: ownerName,
      created: new Date().toISOString(),
      pairs
    };
    const code = encodeData(payload);
    const url = location.origin + location.pathname.replace(/setup\.html$/,'quiz.html') + '?data=' + encodeURIComponent(code);

    // display link
    $('#linkBox').classList.remove('hidden');
    $('#shareLink').value = url;

    // save locally as convenience
    saveLocalQuiz(payload);
    renderSaved();
  });

  // clear all inputs
  $('#clearBtn').addEventListener('click', ()=>{
    if (!confirm('Clear all fields?')) return;
    $all('.qa-row [data-qindex]').forEach(i=>i.value='');
    $all('.qa-row [data-aindex]').forEach(i=>i.value='');
    $('#linkBox').classList.add('hidden');
  });

  // copy link
  $('#copyLink').addEventListener('click', ()=>{
    const t = $('#shareLink');
    t.select();
    t.setSelectionRange(0, t.value.length);
    document.execCommand('copy');
    alert('Link copied to clipboard — share it with your partner!');
  });

  // preview quiz (owner wants to see quiz as partner)
  $('#previewQuiz').addEventListener('click', ()=>{
    const link = $('#shareLink').value;
    if (!link) return alert('Generate a link first.');
    window.open(link, '_blank');
  });

  // localStorage helpers for saved quizzes
  const STORAGE_KEY = 'couple_quizzes_v1';
  function loadLocalQuizzes(){
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch(e){ return [] }
  }
  function saveLocalQuiz(payload){
    const arr = loadLocalQuizzes();
    // add ID
    payload.id = 'q_' + Date.now();
    arr.unshift(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0,10)));
  }
  function renderSaved(){
    const arr = loadLocalQuizzes();
    savedList.innerHTML = '';
    if (!arr.length) { savedList.innerHTML = '<p class="muted">No saved quizzes yet.</p>'; return; }
    arr.forEach(item=>{
      const el = document.createElement('div');
      el.className = 'saved-item';
      el.innerHTML = `<div>
          <div class="meta"><strong>${escapeHtml(item.owner)}</strong> — ${new Date(item.created).toLocaleString()}</div>
          <div class="muted">${item.pairs.length} question(s)</div>
        </div>
        <div>
          <button class="btn" data-load="${encodeData(item)}">Use</button>
          <button class="btn ghost" data-delete="${item.id}">Delete</button>
        </div>`;
      savedList.appendChild(el);
    });

    // attach events
    $all('[data-load]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const payload = decodeData(btn.getAttribute('data-load'));
        if (!payload) return alert('Failed to load.');
        // populate fields
        $all('.qa-row').forEach((row, idx)=>{
          const qInput = row.querySelector('[data-qindex]');
          const aInput = row.querySelector('[data-aindex]');
          const p = payload.pairs[idx];
          qInput.value = p ? p.q : '';
          aInput.value = p ? p.a : '';
        });
      });
    });
    $all('[data-delete]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (!confirm('Delete this saved quiz?')) return;
        const id = btn.getAttribute('data-delete');
        let arr = loadLocalQuizzes();
        arr = arr.filter(x=>x.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        renderSaved();
      });
    });
  }

  // initial render saved
  renderSaved();

  // utility: escape for input value
  function escapeHtml(s){
    if (!s) return '';
    return s.replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }
})();

/* ---------- quiz.html ---------- */
(function initQuiz(){
  if (!document.getElementById('quizArea')) return;

  const params = new URLSearchParams(location.search);
  const code = params.get('data');
  if (!code) {
    $('#quizArea').innerHTML = '<p class="muted">No quiz data found. Please open the link the owner gave you.</p>';
    $('#quizControls').classList.add('hidden');
    return;
  }

  const payload = decodeData(code);
  if (!payload || !payload.pairs || !payload.pairs.length) {
    $('#quizArea').innerHTML = '<p class="muted">Quiz data is invalid or corrupted.</p>';
    $('#quizControls').classList.add('hidden');
    return;
  }

  // show owner name and small note
  const owner = payload.owner || 'Owner';

  const area = $('#quizArea');
  area.innerHTML = `<div class="muted">Quiz created by <strong>${escapeHtml(owner)}</strong>. Answer the questions below to see how well you match!</div>`;

  // build question cards
  payload.pairs.forEach((p, idx)=>{
    const c = document.createElement('div');
    c.className = 'question-card';
    c.innerHTML = `<h4>Q${idx+1}. ${escapeHtml(p.q)}</h4>
      <input data-ansindex="${idx}" placeholder="Type your answer here">`;
    area.appendChild(c);
  });

  // handle submit
  $('#submitBtn').addEventListener('click', ()=>{
    // read partner answers
    const inputs = $all('[data-ansindex]');
    const partner = { answers: [] };
    inputs.forEach(inp => partner.answers.push(inp.value || ''));

    // create combined payload including owner answers and partner answers
    const resultPayload = {
      owner: payload.owner,
      created: payload.created,
      pairs: payload.pairs,
      partner: {
        submitted: new Date().toISOString(),
        answers: partner.answers
      }
    };

    // encode and redirect to result.html
    const codeOut = encodeData(resultPayload);
    window.location.href = 'result.html?data=' + encodeURIComponent(codeOut);
  });

  // restart functionality (clear fields)
  $('#restartBtn').addEventListener('click', ()=>{
    $all('[data-ansindex]').forEach(i=> i.value = '');
  });

  // small helper to escape html when inserting owner name
  function escapeHtml(s){
    if (!s) return '';
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }
})();

/* ---------- result.html ---------- */
(function initResult(){
  if (!document.getElementById('scoreCircle')) return;

  const params = new URLSearchParams(location.search);
  const code = params.get('data');
  if (!code) {
    $('#resultSummary').innerText = 'No result data found.';
    return;
  }
  const payload = decodeData(code);
  if (!payload) {
    $('#resultSummary').innerText = 'Invalid result data.';
    return;
  }

  // compute score: count exact matches (normalized)
  const pairs = payload.pairs || [];
  const partnerAnswers = (payload.partner && payload.partner.answers) || [];
  let matches = 0;
  for (let i=0;i<pairs.length;i++){
    const ownerA = normAnswer(pairs[i].a || '');
    const partnerA = normAnswer(partnerAnswers[i] || '');
    if (!ownerA && !partnerA) continue; // both empty
    if (ownerA === partnerA) matches++;
  }

  const total = pairs.length || 1;
  const percent = Math.round((matches / total) * 100);
  $('#scoreCircle').innerText = percent + '%';

  // message logic
  let message = '';
  if (percent >= 90) message = '🔥 Perfect match! You two are in sync.';
  else if (percent >= 70) message = '💕 Great match! Lots in common.';
  else if (percent >= 50) message = '🙂 Not bad — room to learn more about each other.';
  else message = '🤔 Keep talking — every relationship grows with time.';

  $('#resultTitle').innerText = `${payload.partner && payload.partner.name ? payload.partner.name : 'Result'}`;
  $('#resultSummary').innerHTML = `<strong>${payload.owner || 'Your partner'}</strong>'s quiz — ${matches} / ${total} matched. <br>${message}`;

  // play again — redirect back to quiz if data exists (re-use same data)
  $('#playAgain').addEventListener('click', ()=>{
    // allow partner to try again on same quiz
    const codeOut = encodeData(payload);
    window.location.href = 'quiz.html?data=' + encodeURIComponent(codeOut);
  });

  // helper functions
  function normAnswer(s){ return (s||'').toString().trim().toLowerCase(); }
})();

/* ---------- end script ---------- */
