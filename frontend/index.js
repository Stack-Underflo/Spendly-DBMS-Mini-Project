// frontend/index.js
const API = '/api';
const API_BASE_URL = 'https://spendly-dbms-mini-project.onrender.com/api';
const res = await fetch(`${API_BASE_URL}${endpoint}`, { ... });
let chatHistory = [];
let deleteTargetId = null;
let isSignUpMode = false;
let currentSessionToken = null;

// ─── CURRENCY LOGIC CONFIG ───
function formatRupee(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

// ─── INTERACTIVE NETWORK UTILITY ───
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { 
    method, 
    headers: { 'Content-Type': 'application/json' } 
  };
  
  const token = localStorage.getItem('spendly_token');
  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  
  if (res.status === 401 && token) {
    localStorage.clear();
    showToast("Session closed out. Reverting.", true);
    checkSession();
    return { success: false, message: "Unauthorized" };
  }
  
  return res.json();
}

// ─── ACCOUNT ROUTINE FLOW INTERCEPTORS ───
function toggleProfileDropdown(event) {
  event.stopPropagation();
  document.getElementById('profile-popover').classList.toggle('show');
}

// Close profile popover when clicking anywhere outside
document.addEventListener('click', () => {
  const popover = document.getElementById('profile-popover');
  if (popover) popover.classList.remove('show');
});

function openAuthModal() {
  // If a token exists, don't open the login form (let them use the log out menu instead)
  if (localStorage.getItem('spendly_token')) return; 
  
  document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const userGroup = document.getElementById('username-group');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleText = document.getElementById('auth-toggle-text');
  const toggleLink = document.getElementById('auth-toggle-link');

  if (isSignUpMode) {
    title.textContent = 'Create Profile';
    subtitle.textContent = 'Register an individual account matrix index below';
    userGroup.style.display = 'block';
    submitBtn.textContent = 'Register Account';
    toggleText.textContent = 'Existing user profiles?';
    toggleLink.textContent = 'Sign In';
  } else {
    title.textContent = 'Sign In Required';
    subtitle.textContent = 'Provide secure key verification coordinates below';
    userGroup.style.display = 'none';
    submitBtn.textContent = 'Sign In';
    toggleText.textContent = "Don't have an account yet?";
    toggleLink.textContent = 'Create account';
  }
}

async function handleAuthSubmit() {
  const identifier = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value.trim();

  if (!identifier || !password || (isSignUpMode && !username)) {
    showToast("Please supply all necessary input attributes.", true);
    return;
  }

  const endpoint = isSignUpMode ? '/auth/signup' : '/auth/login';
  
  const payload = isSignUpMode 
    ? { username, email: identifier, password } 
    : { identifier, password };

  const res = await apiFetch(endpoint, 'POST', payload);
  if (res.success) {
    if (isSignUpMode) {
      showToast("Account committed! Flipping parameters to login view.");
      toggleAuthMode();
    } else {
      localStorage.setItem('spendly_token', res.token);
      localStorage.setItem('spendly_user', res.username);
      localStorage.setItem('spendly_email', res.email);
      
      showToast(`Welcome back, ${res.username}!`);
      closeAuthModal();
      checkSession();
      switchView('dashboard');
    }
  } else {
    showToast(res.message || "Credential matching failed", true);
  }
}

function logout() {
  localStorage.clear();
  showToast("Logged out from system index parameters.");
  checkSession();
  switchView('dashboard'); // This resets the view cleanly to the public area
}

function checkSession() {
  const token = localStorage.getItem('spendly_token');
  currentSessionToken = token;

  const name = localStorage.getItem('spendly_user');
  const email = localStorage.getItem('spendly_email');

  const avatar = document.getElementById('user-avatar');
  const nameDisplay = document.getElementById('user-name');
  const emailDisplay = document.getElementById('user-email');
  
  const authActionBtn = document.getElementById('auth-action-btn');
  const logoutActionBtn = document.getElementById('logout-action-btn');

  if (token && name) {
    avatar.textContent = name.charAt(0);
    avatar.style.background = 'var(--accent2)';
    nameDisplay.textContent = name;
    emailDisplay.textContent = email || 'Authenticated User';
    
    authActionBtn.style.display = 'none';
    logoutActionBtn.style.display = 'flex';
  } else {
    // ─── TOUCH UP: CLEAR SIGN-IN CALL TO ACTION FOR GUESTS ───
    avatar.textContent = '?';
    avatar.style.background = 'var(--accent)';
    nameDisplay.textContent = 'Sign In / Sign Up';
    emailDisplay.textContent = 'Access your personal expense matrix';
    
    authActionBtn.style.display = 'flex';
    logoutActionBtn.style.display = 'none';
    
    const recentList = document.getElementById('recent-list');
    if (recentList) recentList.innerHTML = '<p class="empty-state">No transaction indexes tracked yet.</p>';
    
    const expensesList = document.getElementById('expenses-list');
    if (expensesList) expensesList.innerHTML = '<p class="empty-state">No tracking files recorded in this sector.</p>';
    
    document.getElementById('stat-total').textContent = '₹0.00';
    document.getElementById('stat-count').textContent = '0 transactions';
    document.getElementById('stat-monthly').textContent = '₹0.00';
    document.getElementById('stat-monthly-count').textContent = '0 this month';
    document.getElementById('stat-top-cat').textContent = '—';
    document.getElementById('stat-top-amount').textContent = '₹0.00';
    if (document.getElementById('category-chart')) {
      document.getElementById('category-chart').innerHTML = '<p class="muted">No current tracking indexes allocated.</p>';
    }
  }
}

function switchView(viewName) {
  const token = localStorage.getItem('spendly_token');
  
  // ─── AUTH GUARD: Intercept guests trying to access secure panels ───
  if (!token && (viewName === 'add' || viewName === 'ai')) {
    showToast("Please sign in to access this matrix section.", true);
    openAuthModal();
    return; // Halt execution so the view layout doesn't change
  }

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  const btn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (btn) btn.classList.add('active');
  
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');
  
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'expenses') loadExpenses();
}

// ─── MOVEMENT INTERPRETER ROUTINES ───
async function loadDashboard() {
  const contextToken = currentSessionToken; 

  try {
    const [statsRes, listRes] = await Promise.all([
      apiFetch('/expenses/stats'),
      apiFetch('/expenses?limit=5')
    ]);

    if (String(contextToken) !== String(currentSessionToken)) return;

    if (statsRes.success) {
      const s = statsRes.data;
      document.getElementById('stat-total').textContent = formatRupee(s.allTime.total);
      document.getElementById('stat-count').textContent = `${s.allTime.count} transactions`;
      document.getElementById('stat-monthly').textContent = formatRupee(s.monthly.total);
      document.getElementById('stat-monthly-count').textContent = `${s.monthly.count} this month`;
      
      if (s.byCategory && s.byCategory.length > 0) {
        document.getElementById('stat-top-cat').textContent = s.byCategory[0]._id;
        document.getElementById('stat-top-amount').textContent = formatRupee(s.byCategory[0].total);
        renderChart(s.byCategory);
      } else {
        document.getElementById('stat-top-cat').textContent = '—';
        document.getElementById('stat-top-amount').textContent = formatRupee(0);
        document.getElementById('category-chart').innerHTML = '<p class="muted">No current tracking indexes allocated.</p>';
      }
    }

    const container = document.getElementById('recent-list');
    if (listRes.success && listRes.data.length > 0) {
      container.innerHTML = listRes.data.map(e => `
        <div class="mini-item">
          <div>
            <div class="mini-title">${escHtml(e.title)}</div>
            <div class="small text3">${e.category} • ${e.date.split('T')[0]}</div>
          </div>
          <div class="mini-amount">${formatRupee(e.amount)}</div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="empty-state">No transaction indexes tracked yet.</p>';
    }
  } catch (e) {
    console.error("Dashboard link exception handled cleanly.", e);
  }
}

async function loadExpenses() {
  const contextToken = currentSessionToken; 
  const cat = document.getElementById('filter-category').value;
  const path = cat ? `/expenses?category=${encodeURIComponent(cat)}` : '/expenses';
  const list = document.getElementById('expenses-list');
  
  const res = await apiFetch(path);
  
  if (String(contextToken) !== String(currentSessionToken)) return;

  if (res.success && res.data && res.data.length > 0) {
    list.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Notes</th><th style="text-align:right">Actions</th></tr>
        </thead>
        <tbody>
          ${res.data.map(e => `
            <tr>
              <td>${e.date.split('T')[0]}</td>
              <td style="font-weight:500; color:var(--text);">${escHtml(e.title)}</td>
              <td><span class="tag">${e.category}</span></td>
              <td style="font-weight:600; color:var(--accent2);">${formatRupee(e.amount)}</td>
              <td class="text3 small">${escHtml(e.notes || '—')}</td>
              <td style="text-align:right">
                <button class="btn-icon delete-btn" onclick="openDeleteModal('${e._id}')">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } else {
    list.innerHTML = '<p class="empty-state">No tracking files recorded in this sector.</p>';
  }
}

// frontend/index.js

async function saveExpense() {
  const title = document.getElementById('exp-title').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-category').value;
  const date = document.getElementById('exp-date').value;
  const notes = document.getElementById('exp-notes').value.trim();

  if (!title || isNaN(amount) || !category || !date) {
    showToast('All standard metrics inputs must be provided.', true);
    return;
  }

  // FIXED: Using apiFetch ensures your Bearer Token is passed in the headers
  const res = await apiFetch('/expenses', 'POST', { title, amount, category, date, notes });
  
  if (res.success) {
    showToast('Expense configuration added.');
    document.getElementById('exp-title').value = '';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-category').value = '';
    document.getElementById('exp-notes').value = '';
    if (document.getElementById('ai-suggestion')) {
      document.getElementById('ai-suggestion').style.display = 'none';
    }
    switchView('dashboard');
  } else {
    showToast(res.message || 'Unauthorized action', true);
  }
}

function openDeleteModal(id) {
  if (!localStorage.getItem('spendly_token')) {
     openAuthModal();
     return;
  }
  deleteTargetId = id;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal-confirm').onclick = executeDelete;
}

function closeModal() {
  deleteTargetId = null;
  document.getElementById('modal').style.display = 'none';
}

async function executeDelete() {
  const res = await apiFetch(`/expenses/${deleteTargetId}`, 'DELETE');
  if (res.success) {
    showToast('Record extracted.');
    closeModal();
    loadExpenses();
  } else {
    showToast(res.message, true);
  }
}

// ─── AI ACCESS CORES ───
async function autoCategory() {
  const title = document.getElementById('exp-title').value.trim();
  if (!title) return showToast('Supply context text arrays first.', true);
  
  const box = document.getElementById('ai-suggestion');
  box.style.display = 'block';
  box.textContent = 'Consulting context arrays...';

  const res = await apiFetch('/ai/categorize', 'POST', { title });
  if (res.success) {
    box.innerHTML = `AI Match: <strong>${res.category}</strong> <a href="#" onclick="applyCat('${res.category}'); return false;">Apply</a>`;
  } else {
    box.style.display = 'none';
  }
}

function applyCat(cat) {
  document.getElementById('exp-category').value = cat;
  document.getElementById('ai-suggestion').style.display = 'none';
}

async function runAnalysis() {
  const out = document.getElementById('ai-output');
  out.innerHTML = 'Compiling analytics structures...';
  const res = await apiFetch('/ai/analyze', 'POST');
  out.innerHTML = res.success ? formatMarkdown(res.analysis) : `<p class="red">${res.message}</p>`;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML += `<div class="chat-msg user-msg">${escHtml(msg)}</div>`;
  msgs.innerHTML += `<div class="chat-msg ai-msg" id="typing">Thinking...</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  chatHistory.push({ role: 'user', content: msg });

  const res = await apiFetch('/ai/chat', 'POST', { message: msg, history: chatHistory.slice(-6) });
  document.getElementById('typing').remove();
  
  if (res.success) {
    chatHistory.push({ role: 'assistant', content: res.reply });
    msgs.innerHTML += `<div class="chat-msg ai-msg">${formatMarkdown(res.reply)}</div>`;
  } else {
    msgs.innerHTML += `<div class="chat-msg ai-msg">Execution tracking failed.</div>`;
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function renderChart(byCat) {
  const container = document.getElementById('category-chart');
  const max = Math.max(...byCat.map(c => c.total));
  container.innerHTML = byCat.map(c => {
    const pct = max > 0 ? (c.total / max) * 100 : 0;
    return `
      <div class="chart-row">
        <div class="chart-label">${c._id}</div>
        <div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${pct}%"></div></div>
        <div class="chart-value">${formatRupee(c.total)}</div>
      </div>`;
  }).join('');
}

function showToast(m, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.className = `toast show${isErr ? ' error' : ''}`;
  setTimeout(() => t.className = 'toast', 3000);
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMarkdown(t) {
  return t
    .replace(/\*\*(.*?)\*\"/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

// ─── INITIAL CORES ACTIVATION ───
document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.onclick = () => switchView(btn.dataset.view);
});

checkSession();
loadDashboard();
