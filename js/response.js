import { getActiveTab } from './state.js';
import { qs, qsa, escapeHtml, formatSize, getStatusClass } from './dom.js';
import { showToast } from './toast.js';

let currentSearchTerm = '';

export function showEmptyResponseState() {
    qs('#responseMetaBar').style.display = 'none';
    qs('#responseSearchBar').style.display = 'none';
    qs('#responseTabsBar').style.display = 'none';
    qs('#responseContentArea').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-satellite-dish"></i>
            <h3>No Response Yet</h3>
            <p>Send a request to see the response here, or try a live example.</p>
            <button class="btn-example" id="tryExampleBtn"><i class="fas fa-play"></i> Try Example Request</button>
        </div>`;
    const btn = qs('#tryExampleBtn');
    if (btn) btn.addEventListener('click', () => {
        const tab = getActiveTab();
        tab.url = 'https://jsonplaceholder.typicode.com/posts/1';
        tab.method = 'GET';
        const urlInput = qs('#urlInput');
        const methodSelect = qs('#methodSelect');
        if (urlInput) urlInput.value = tab.url;
        if (methodSelect) methodSelect.value = tab.method;
        qs('#sendBtn').click();
    });
}

export function renderResponseForActiveTab() {
    const tab = getActiveTab();
    if (!tab || !tab.response) { showEmptyResponseState(); return; }
    const res = tab.response;

    if (!res.ok) {
        qs('#responseMetaBar').style.display = 'flex';
        qs('#responseSearchBar').style.display = 'none';
        qs('#responseTabsBar').style.display = 'none';
        renderMetaBar(null, res.elapsed, null, res.testResults);
        qs('#responseContentArea').innerHTML = `<div class="error-state"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(res.error)}</div>`;
        return;
    }

    qs('#responseMetaBar').style.display = 'flex';
    qs('#responseTabsBar').style.display = 'flex';
    renderMetaBar(res, res.elapsed, res.size, res.testResults);
    renderActiveResponseTab();
}

function renderMetaBar(res, elapsed, size, testResults) {
    const bar = qs('#responseMetaBar');
    const passCount = (testResults || []).filter(t => t.pass).length;
    const totalTests = (testResults || []).length;
    bar.innerHTML = `
        ${res ? `<span class="status-badge ${getStatusClass(res.status)}">${res.status} ${escapeHtml(res.statusText || '')}</span>` : `<span class="status-badge status-err">Failed</span>`}
        <span class="meta-item">Time: <span>${elapsed}ms</span></span>
        ${size != null ? `<span class="meta-item">Size: <span>${formatSize(size)}</span></span>` : ''}
        ${totalTests ? `<span class="chip ${passCount === totalTests ? 'chip-pass' : 'chip-fail'}"><i class="fas fa-vial"></i> ${passCount}/${totalTests} tests passed</span>` : ''}
        <div class="response-actions">
            ${res ? `<button class="btn-action" id="copyResponseBtn"><i class="fas fa-copy"></i> Copy</button>` : ''}
        </div>`;
    const copyBtn = qs('#copyResponseBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => {
        const tab = getActiveTab();
        navigator.clipboard.writeText(tab.response.text).then(() => showToast('Response copied', 'success')).catch(() => showToast('Copy failed', 'error'));
    });
}

function renderActiveResponseTab() {
    const activeBtn = qs('#responseTabsBar .tab.active') || qs('#responseTabsBar .tab');
    const target = activeBtn ? activeBtn.dataset.resTab : 'body';
    renderResponseTabContent(target);
}

function renderResponseTabContent(target) {
    const tab = getActiveTab();
    const res = tab?.response;
    if (!res || !res.ok) return;
    const area = qs('#responseContentArea');

    if (target === 'body') {
        qs('#responseSearchBar').style.display = 'flex';
        let parsed = null;
        try { parsed = JSON.parse(res.text); } catch { /* not JSON */ }
        if (parsed !== null) {
            area.innerHTML = `<div class="json-viewer" id="jsonViewer">${highlightJson(parsed)}</div>`;
        } else {
            area.innerHTML = `<div class="raw-response" id="jsonViewer">${escapeHtml(res.text || '(empty body)')}</div>`;
        }
        applySearchHighlight();
    } else if (target === 'headers') {
        qs('#responseSearchBar').style.display = 'none';
        area.innerHTML = `<table class="headers-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>
            ${res.headers.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
        </tbody></table>`;
    } else if (target === 'raw') {
        qs('#responseSearchBar').style.display = 'none';
        area.innerHTML = `<div class="raw-response">${escapeHtml(res.text || '(empty body)')}</div>`;
    } else if (target === 'tests') {
        qs('#responseSearchBar').style.display = 'none';
        const results = res.testResults || [];
        if (!results.length) {
            area.innerHTML = `<div class="tests-empty">No tests defined for this request. Add some in the Tests tab on the left.</div>`;
        } else {
            area.innerHTML = results.map(r => `
                <div class="test-result-row">
                    <i class="fas fa-${r.pass ? 'check-circle' : 'times-circle'}" style="color:var(--${r.pass ? 'success' : 'error'})"></i>
                    <div class="tr-desc">${escapeHtml(r.label)}<div class="tr-detail">${escapeHtml(r.detail)}</div></div>
                </div>`).join('');
        }
    }
}

function highlightJson(value, indent = 0) {
    const pad = '  '.repeat(indent);
    const padIn = '  '.repeat(indent + 1);
    if (value === null) return `<span class="json-null">null</span>`;
    if (typeof value === 'boolean') return `<span class="json-boolean">${value}</span>`;
    if (typeof value === 'number') return `<span class="json-number">${value}</span>`;
    if (typeof value === 'string') return `<span class="json-string">"${escapeHtml(value)}"</span>`;
    if (Array.isArray(value)) {
        if (!value.length) return `<span class="json-bracket">[]</span>`;
        const items = value.map(v => `${padIn}${highlightJson(v, indent + 1)}`).join(',\n');
        return `<span class="json-bracket">[</span>\n${items}\n${pad}<span class="json-bracket">]</span>`;
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (!keys.length) return `<span class="json-bracket">{}</span>`;
        const items = keys.map(k => `${padIn}<span class="json-key">"${escapeHtml(k)}"</span>: ${highlightJson(value[k], indent + 1)}`).join(',\n');
        return `<span class="json-bracket">{</span>\n${items}\n${pad}<span class="json-bracket">}</span>`;
    }
    return '';
}

function applySearchHighlight() {
    const viewer = qs('#jsonViewer');
    const countEl = qs('#searchMatchCount');
    if (!viewer) return;
    if (!currentSearchTerm) {
        if (countEl) countEl.textContent = '';
        return;
    }
    const walker = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
    const term = currentSearchTerm.toLowerCase();
    let matchCount = 0;
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
        const text = node.nodeValue;
        const lower = text.toLowerCase();
        if (!lower.includes(term)) return;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let idx;
        while ((idx = lower.indexOf(term, lastIndex)) !== -1) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
            const mark = document.createElement('mark');
            mark.className = 'search-hit';
            mark.textContent = text.slice(idx, idx + term.length);
            frag.appendChild(mark);
            matchCount++;
            lastIndex = idx + term.length;
        }
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        node.parentNode.replaceChild(frag, node);
    });
    if (countEl) countEl.textContent = matchCount ? `${matchCount} match${matchCount === 1 ? '' : 'es'}` : 'No matches';
}

export function setupResponseEvents() {
    qsa('[data-res-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            qsa('[data-res-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderResponseTabContent(btn.dataset.resTab);
        });
    });
    qs('#responseSearchInput').addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        renderResponseTabContent('body');
    });
}
