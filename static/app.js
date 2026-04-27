const API = '/query';

const messagesWrap = document.getElementById('chat-messages');
const userInput    = document.getElementById('user-input');
const sendBtn      = document.getElementById('send-btn');
const clearBtn     = document.getElementById('clear-chat');
const sourcesList  = document.getElementById('sources-list');

let isLoading = false;

/* ── History storage ── */
const HISTORY_KEY = 'aqyl_chat_history';

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}

function saveSession(question, answer, sources) {
    const sessions = loadHistory();
    sessions.unshift({
        id: Date.now(),
        date: new Date().toLocaleString('ru-RU'),
        question,
        answer,
        sources
    });
    if (sessions.length > 50) sessions.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    updateHistoryBadge();
}

function updateHistoryBadge() {
    const badge = document.getElementById('history-badge');
    const count = loadHistory().length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const sessions = loadHistory();
    if (sessions.length === 0) {
        list.innerHTML = `<div class="empty-page"><i class="fas fa-clock-rotate-left"></i><p>История пуста</p><span>Ваши консультации будут сохраняться здесь</span></div>`;
        return;
    }
    list.innerHTML = sessions.map(s => `
        <div class="history-item">
            <div class="history-meta"><i class="fas fa-clock"></i> ${s.date}</div>
            <div class="history-q"><strong>Вопрос:</strong> ${escapeHtml(s.question)}</div>
            <div class="history-a">${formatAnswer(s.answer)}</div>
            ${s.sources && s.sources.length ? `<div class="history-sources">${s.sources.map(src => `<span class="source-tag"><i class="fas fa-file-lines"></i>${src}</span>`).join('')}</div>` : ''}
        </div>
    `).join('');
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Navigation ── */
function switchView(view) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(el => {
        el.classList.toggle('active', el.id === 'view-' + view);
    });

    const titleEl = document.getElementById('header-title');
    const subEl   = document.getElementById('header-sub');
    const clearChatBtn = document.getElementById('clear-chat');
    const clearHistBtn = document.getElementById('clear-history-btn');

    if (view === 'chat') {
        titleEl.textContent = 'Интеллектуальный помощник';
        subEl.textContent   = 'Эксперт по страховому законодательству РК';
        clearChatBtn.style.display = '';
        clearHistBtn.style.display = 'none';
    } else if (view === 'knowledge') {
        titleEl.textContent = 'База знаний';
        subEl.textContent   = 'Нормативные акты РК';
        clearChatBtn.style.display = 'none';
        clearHistBtn.style.display = 'none';
    } else if (view === 'history') {
        titleEl.textContent = 'История консультаций';
        subEl.textContent   = 'Сохранённые сессии';
        clearChatBtn.style.display = 'none';
        clearHistBtn.style.display = '';
        renderHistory();
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        switchView(item.dataset.view);
    });
});

document.getElementById('clear-history-btn').addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    updateHistoryBadge();
    renderHistory();
});

updateHistoryBadge();

/* ── Markdown lite renderer ── */
function renderMarkdown(text) {
    return text
        // Bold **text**
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic *text*
        .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        // ### Headings
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr>')
        // Numbered list  1. item
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Bullet list  - item  or  * item
        .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, (m) => {
            // already wrapped? skip
            return '<ul>' + m + '</ul>';
        })
        // Code `inline`
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Paragraph breaks (double newline)
        .replace(/\n\n+/g, '</p><p>')
        // Single newline → <br>
        .replace(/\n/g, '<br>');
}

function formatAnswer(raw) {
    const html = renderMarkdown(raw);
    // wrap everything in <p> if not already block element
    if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<hr')) {
        return '<p>' + html + '</p>';
    }
    return html;
}

/* ── Add message row ── */
function addMessage(content, role) {
    // Hide welcome block on first message
    const welcome = messagesWrap.querySelector('.welcome-block');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = role === 'user' ? 'Вы' : 'Aqyl AI';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (role === 'user') {
        bubble.textContent = content;
    } else {
        bubble.innerHTML = formatAnswer(content);
    }

    row.appendChild(label);
    row.appendChild(bubble);
    messagesWrap.appendChild(row);
    scrollBottom();
    return row;
}

/* ── Typing indicator ── */
function addTyping() {
    const welcome = messagesWrap.querySelector('.welcome-block');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = 'msg-row bot';
    row.id = 'typing-indicator';

    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = 'Aqyl AI';

    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    row.appendChild(label);
    row.appendChild(dots);
    messagesWrap.appendChild(row);
    scrollBottom();
}

function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

/* ── Sources ── */
function showSources(sources) {
    if (!sources || sources.length === 0) {
        sourcesList.innerHTML = '<p class="empty-msg">Источники не найдены</p>';
        return;
    }
    sourcesList.innerHTML = sources.map(s =>
        `<div class="source-tag"><i class="fas fa-file-lines"></i>${s}</div>`
    ).join('');
}

/* ── Send ── */
async function sendMessage() {
    const q = userInput.value.trim();
    if (!q || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    userInput.value = '';
    autoResize();

    addMessage(q, 'user');
    addTyping();

    try {
        const res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q })
        });

        const data = await res.json();
        removeTyping();

        if (!res.ok) {
            addMessage('⚠️ Ошибка сервера: ' + (data.detail || res.status), 'bot');
        } else {
            addMessage(data.answer, 'bot');
            showSources(data.sources);
            saveSession(q, data.answer, data.sources);
        }
    } catch (err) {
        removeTyping();
        addMessage('⚠️ Не удалось подключиться к серверу. Убедитесь, что он запущен.', 'bot');
        console.error(err);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

/* ── Auto-resize textarea ── */
function autoResize() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
}

function scrollBottom() {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
}

/* ── Events ── */
sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

userInput.addEventListener('input', autoResize);

clearBtn.addEventListener('click', () => {
    messagesWrap.innerHTML = '';
    sourcesList.innerHTML = '<p class="empty-msg">Источники появятся после запроса</p>';

    // restore welcome
    const wb = document.createElement('div');
    wb.className = 'welcome-block';
    wb.innerHTML = `
        <div class="welcome-icon"><i class="fas fa-scale-balanced"></i></div>
        <h3>Чем могу помочь?</h3>
        <p>Задайте вопрос по страховому законодательству Казахстана.</p>
    `;
    messagesWrap.appendChild(wb);
});

/* ── Quick buttons & chips ── */
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-q]');
    if (!btn) return;
    userInput.value = btn.dataset.q;
    autoResize();
    sendMessage();
});
