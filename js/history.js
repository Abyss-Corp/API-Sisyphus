import { state, persistHistory } from './state.js';
import { qs, escapeHtml, truncateUrl, timeAgo } from './dom.js';
import { openHistoryEntryInTab } from './tabs.js';

const MAX_HISTORY = 100;

export function addToHistory(tab, status, elapsed) {
    state.history.push({
        method: tab.method,
        url: tab.url,
        status,
        elapsed,
        timestamp: Date.now(),
        snapshot: {
            method: tab.method, url: tab.url, params: tab.params, headers: tab.headers,
            auth: tab.auth, body: tab.body, tests: tab.tests,
        },
    });
    if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
    persistHistory();
    renderHistory();
}

export function renderHistory() {
    const listEl = qs('#historyList');
    const clearBtn = qs('#clearHistoryBtn');
    if (!state.history.length) {
        listEl.innerHTML = '<div class="history-empty">No requests yet</div>';
        clearBtn.style.display = 'none';
        return;
    }
    clearBtn.style.display = 'block';
    const reversed = [...state.history].reverse();
    listEl.innerHTML = reversed.map((entry, i) => {
        const actualIndex = state.history.length - 1 - i;
        const elapsedText = entry.elapsed != null ? `${entry.elapsed}ms` : '';
        const statusText = entry.status === 'ERR' ? 'ERR' : entry.status;
        return `
            <div class="history-item" data-index="${actualIndex}">
                <div class="history-item-header"><span class="method-badge ${entry.method.toLowerCase()}">${entry.method}</span></div>
                <div class="history-url">${escapeHtml(truncateUrl(entry.url))}</div>
                <div class="history-meta"><span>${statusText}</span><span>${elapsedText}</span><span>${timeAgo(entry.timestamp)}</span></div>
            </div>`;
    }).join('');
    listEl.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => openHistoryEntryInTab(Number(item.dataset.index)));
    });
}

export function clearHistory() {
    if (!state.history.length) return;
    if (!confirm('Clear all history? This cannot be undone.')) return;
    state.history = [];
    persistHistory();
    renderHistory();
}

export function setupHistoryEvents() {
    qs('#clearHistoryBtn').addEventListener('click', clearHistory);
    qs('#histHeader').addEventListener('click', function () {
        this.classList.toggle('collapsed');
        qs('#histContent').classList.toggle('collapsed');
    });
}
