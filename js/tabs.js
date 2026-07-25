import { state, createTab, getActiveTab, tabDisplayName, persistTabs } from './state.js';
import { qs, qsa, escapeHtml } from './dom.js';
import { renderKvRows } from './kvrows.js';
import { showToast } from './toast.js';
import { sendRequest, cancelRequest, resolveRequest } from './request.js';
import { createTest, runAssertions } from './tests.js';
import { renderResponseForActiveTab } from './response.js';
import { toCurl } from './curl.js';

/* ---------------- tab bar ---------------- */

export function renderTabBar() {
    const bar = qs('#tabBar');
    const buttons = state.tabs.map(tab => {
        const active = tab.id === state.activeTabId;
        const name = tabDisplayName(tab);
        const showDirty = tab.dirty && tab.savedRef;
        return `
        <div class="req-tab ${active ? 'active' : ''} ${showDirty ? 'dirty' : ''}" data-tab-id="${tab.id}" title="${escapeHtml(name)}">
            ${tab._abort ? '<div class="t-spinner"></div>' : `<span class="t-method" style="color:var(--method-${tab.method.toLowerCase()})">${tab.method}</span>`}
            <span class="t-name">${escapeHtml(name)}</span>
            <span class="t-dirty"></span>
            <button class="t-close" data-close="${tab.id}"><i class="fas fa-times"></i></button>
        </div>`;
    }).join('');
    bar.innerHTML = buttons;

    qsa('.req-tab', bar).forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.t-close')) return;
            switchTab(el.dataset.tabId);
        });
    });
    qsa('.t-close', bar).forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); closeTab(btn.dataset.close); });
    });
}

export function newTab(overrides = {}) {
    const tab = createTab(overrides);
    state.tabs.push(tab);
    switchTab(tab.id);
    return tab;
}

export function closeTab(id) {
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = state.tabs[idx];
    if (tab._abort) cancelRequest(tab);
    state.tabs.splice(idx, 1);

    if (state.tabs.length === 0) {
        const fresh = createTab();
        state.tabs.push(fresh);
        state.activeTabId = fresh.id;
    } else if (state.activeTabId === id) {
        const next = state.tabs[Math.max(0, idx - 1)];
        state.activeTabId = next.id;
    }
    persistTabs();
    renderTabBar();
    renderRequestPane();
    renderResponseForActiveTab();
}

export function switchTab(id) {
    if (!state.tabs.some(t => t.id === id)) return;
    state.activeTabId = id;
    persistTabs();
    renderTabBar();
    renderRequestPane();
    renderResponseForActiveTab();
}

export function refreshActiveTabDirtyState() {
    // called after a collection/request is deleted elsewhere, in case the active tab pointed at it
    const tab = getActiveTab();
    if (!tab || !tab.savedRef) return;
    const col = state.collections.find(c => c.id === tab.savedRef.collectionId);
    const req = col?.requests.find(r => r.id === tab.savedRef.requestId);
    if (!req) tab.savedRef = null;
    renderTabBar();
}

export function openRequestInTab(collectionId, requestId) {
    const existing = state.tabs.find(t => t.savedRef && t.savedRef.collectionId === collectionId && t.savedRef.requestId === requestId);
    if (existing) { switchTab(existing.id); return; }
    const col = state.collections.find(c => c.id === collectionId);
    const req = col?.requests.find(r => r.id === requestId);
    if (!req) return;
    newTab({
        name: req.name,
        savedRef: { collectionId, requestId },
        method: req.method,
        url: req.url,
        params: JSON.parse(JSON.stringify(req.params)),
        headers: JSON.parse(JSON.stringify(req.headers)),
        auth: JSON.parse(JSON.stringify(req.auth)),
        body: JSON.parse(JSON.stringify(req.body)),
        tests: JSON.parse(JSON.stringify(req.tests || [])),
    });
}

export function openHistoryEntryInTab(index) {
    const entry = state.history[index];
    if (!entry) return;
    const s = entry.snapshot || {};
    newTab({
        method: s.method || entry.method,
        url: s.url || entry.url,
        params: s.params ? JSON.parse(JSON.stringify(s.params)) : [{ key: '', value: '', enabled: true }],
        headers: s.headers ? JSON.parse(JSON.stringify(s.headers)) : [{ key: '', value: '', enabled: true }],
        auth: s.auth ? JSON.parse(JSON.stringify(s.auth)) : { type: 'none' },
        body: s.body ? JSON.parse(JSON.stringify(s.body)) : { type: 'none' },
        tests: s.tests ? JSON.parse(JSON.stringify(s.tests)) : [],
    });
    showToast('Loaded from history', 'success');
}

export function createTabFromParsedCurl(parsed) {
    newTab({ ...parsed });
    showToast('Imported from cURL', 'success');
}

function markDirty() {
    const tab = getActiveTab();
    if (!tab) return;
    tab.dirty = true;
    persistTabs();
    renderTabBar();
}

/* ---------------- request pane ---------------- */

export function renderRequestPane() {
    const tab = getActiveTab();
    if (!tab) return;
    qs('#methodSelect').value = tab.method;
    qs('#urlInput').value = tab.url;
    loadMethodColor();
    renderParamsTab(tab);
    renderHeadersTab(tab);
    renderAuthTab(tab);
    renderBodyTab(tab);
    renderTestsTab(tab);
    updateCancelButtonVisibility();
}

function loadMethodColor() {
    const tab = getActiveTab();
    if (!tab) return;
    const sel = qs('#methodSelect');
    const method = tab.method.toLowerCase();
    sel.style.color = `var(--method-${method})`;
    const colors = { get: 'rgba(63,185,80,0.1)', post: 'rgba(240,136,62,0.1)', put: 'rgba(0,217,255,0.1)', patch: 'rgba(163,113,247,0.1)', delete: 'rgba(248,81,73,0.1)', head: 'rgba(139,148,158,0.1)', options: 'rgba(88,166,255,0.1)' };
    sel.style.backgroundColor = colors[method] || 'var(--bg-elevated)';
}

function renderParamsTab(tab) {
    renderKvRows(qs('#paramsRows'), tab.params, () => { markDirty(); }, {});
}

function renderHeadersTab(tab) {
    renderKvRows(qs('#headersRows'), tab.headers, () => { markDirty(); }, {});
}

function renderAuthTab(tab) {
    const sel = qs('#authTypeSelect');
    sel.value = tab.auth?.type || 'none';
    const fields = qs('#authFields');
    const type = sel.value;
    fields.innerHTML = '';
    if (type === 'bearer') {
        fields.innerHTML = `<div class="field-group"><label class="field-label">Token</label><input type="text" class="field-input" id="bearerToken" placeholder="your-token-here or {{token}}"></div>`;
        qs('#bearerToken').value = tab.auth.token || '';
        qs('#bearerToken').addEventListener('input', (e) => { tab.auth.token = e.target.value; markDirty(); });
    } else if (type === 'basic') {
        fields.innerHTML = `<div class="field-group"><label class="field-label">Username</label><input type="text" class="field-input" id="basicUsername"></div><div class="field-group"><label class="field-label">Password</label><input type="password" class="field-input" id="basicPassword"></div>`;
        qs('#basicUsername').value = tab.auth.username || '';
        qs('#basicPassword').value = tab.auth.password || '';
        qs('#basicUsername').addEventListener('input', (e) => { tab.auth.username = e.target.value; markDirty(); });
        qs('#basicPassword').addEventListener('input', (e) => { tab.auth.password = e.target.value; markDirty(); });
    } else if (type === 'apikey') {
        fields.innerHTML = `<div class="field-group"><label class="field-label">Key Name</label><input type="text" class="field-input" id="apiKeyName" placeholder="X-API-Key"></div><div class="field-group"><label class="field-label">Key Value</label><input type="text" class="field-input" id="apiKeyValue"></div><div class="field-group"><label class="field-label">Location</label><select class="field-select" id="apiKeyLocation"><option value="header">Header</option><option value="query">Query Param</option></select></div>`;
        qs('#apiKeyName').value = tab.auth.keyName || '';
        qs('#apiKeyValue').value = tab.auth.keyValue || '';
        qs('#apiKeyLocation').value = tab.auth.location || 'header';
        qs('#apiKeyName').addEventListener('input', (e) => { tab.auth.keyName = e.target.value; markDirty(); });
        qs('#apiKeyValue').addEventListener('input', (e) => { tab.auth.keyValue = e.target.value; markDirty(); });
        qs('#apiKeyLocation').addEventListener('change', (e) => { tab.auth.location = e.target.value; markDirty(); });
    }
    sel.onchange = () => { tab.auth = { type: sel.value }; renderAuthTab(tab); markDirty(); };
}

function renderBodyTab(tab) {
    const sel = qs('#bodyTypeSelect');
    tab.body = tab.body || { type: 'none' };
    sel.value = tab.body.type;
    const content = qs('#bodyContent');
    content.innerHTML = '';

    if (tab.body.type === 'none') {
        content.innerHTML = '<div class="empty-state" style="min-height:180px;"><i class="fas fa-ban"></i><h3>No Body</h3></div>';
    } else if (tab.body.type === 'json' || tab.body.type === 'raw') {
        content.innerHTML = `
            ${tab.body.type === 'json' ? '<button class="btn-format" id="formatJsonBtn"><i class="fas fa-align-left"></i> Format JSON</button><div class="body-json-error" id="bodyJsonError"></div>' : ''}
            <textarea class="body-textarea" id="bodyTextarea" placeholder="${tab.body.type === 'json' ? '{\"key\": \"value\"}' : 'Raw body content\u2026'}"></textarea>`;
        const ta = qs('#bodyTextarea');
        ta.value = tab.body.content || '';
        ta.addEventListener('input', () => {
            tab.body.content = ta.value;
            markDirty();
            if (tab.body.type === 'json') validateJsonBody(ta);
        });
        if (tab.body.type === 'json') {
            validateJsonBody(ta);
            qs('#formatJsonBtn').addEventListener('click', () => {
                try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); tab.body.content = ta.value; markDirty(); validateJsonBody(ta); showToast('JSON formatted', 'success'); }
                catch { showToast('Invalid JSON', 'error'); }
            });
        }
    } else if (tab.body.type === 'form') {
        tab.body.fields = tab.body.fields || [{ key: '', value: '', enabled: true }];
        const rowsContainer = document.createElement('div');
        rowsContainer.id = 'formRows';
        content.appendChild(rowsContainer);
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Field';
        content.appendChild(addBtn);
        renderKvRows(rowsContainer, tab.body.fields, () => markDirty(), { keyPlaceholder: 'Key', valuePlaceholder: 'Value' });
        addBtn.addEventListener('click', () => {
            tab.body.fields.push({ key: '', value: '', enabled: true });
            renderKvRows(rowsContainer, tab.body.fields, () => markDirty(), {});
        });
    }
    sel.onchange = () => { tab.body = { type: sel.value }; renderBodyTab(tab); markDirty(); };
}

function validateJsonBody(textarea) {
    const errEl = qs('#bodyJsonError');
    if (!errEl) return;
    const val = textarea.value.trim();
    if (!val) { errEl.classList.remove('visible'); textarea.classList.remove('invalid'); return; }
    try { JSON.parse(val); errEl.classList.remove('visible'); textarea.classList.remove('invalid'); }
    catch (e) { errEl.textContent = `Invalid JSON: ${e.message}`; errEl.classList.add('visible'); textarea.classList.add('invalid'); }
}

function renderTestsTab(tab) {
    tab.tests = tab.tests || [];
    const container = qs('#testsRows');
    if (!tab.tests.length) {
        container.innerHTML = '<div class="tests-empty">No tests yet. Add one to automatically check the response after each send.</div>';
    } else {
        container.innerHTML = tab.tests.map(t => testRowHtml(t)).join('');
        tab.tests.forEach(t => wireTestRow(tab, t));
    }
    qs('#reqTabTests .tab-count')?.remove();
}

function testRowHtml(t) {
    const lastResult = t._lastResult;
    return `
    <div class="test-row" data-test-id="${t.id}">
        <select class="t-type">
            <option value="status" ${t.type === 'status' ? 'selected' : ''}>Status code</option>
            <option value="time" ${t.type === 'time' ? 'selected' : ''}>Response time</option>
            <option value="header" ${t.type === 'header' ? 'selected' : ''}>Header</option>
            <option value="bodyContains" ${t.type === 'bodyContains' ? 'selected' : ''}>Body contains</option>
            <option value="jsonPath" ${t.type === 'jsonPath' ? 'selected' : ''}>JSON path</option>
        </select>
        ${testFieldsHtml(t)}
        <span class="t-result">${lastResult ? `<span class="chip ${lastResult.pass ? 'chip-pass' : 'chip-fail'}"><i class="fas fa-${lastResult.pass ? 'check' : 'times'}"></i> ${lastResult.pass ? 'Pass' : 'Fail'}</span>` : '<span class="chip chip-neutral">Not run</span>'}</span>
        <button class="btn-icon" title="Remove"><i class="fas fa-times"></i></button>
    </div>`;
}

function testFieldsHtml(t) {
    if (t.type === 'status') return `
        <select class="t-op"><option value="equals" ${t.op === 'equals' ? 'selected' : ''}>equals</option><option value="lessThan" ${t.op === 'lessThan' ? 'selected' : ''}>less than</option><option value="greaterThan" ${t.op === 'greaterThan' ? 'selected' : ''}>greater than</option></select>
        <input type="text" class="t-value" style="width:70px" value="${escapeHtml(t.value)}" placeholder="200">`;
    if (t.type === 'time') return `<span style="font-family:var(--font-mono);font-size:11.5px;color:var(--text-muted);">less than</span><input type="text" class="t-value" style="width:70px" value="${escapeHtml(t.value)}" placeholder="1000">ms`;
    if (t.type === 'header') return `
        <input type="text" class="t-name" style="width:120px" value="${escapeHtml(t.name)}" placeholder="Header name">
        <select class="t-op"><option value="exists" ${t.op === 'exists' ? 'selected' : ''}>exists</option><option value="equals" ${t.op === 'equals' ? 'selected' : ''}>equals</option><option value="contains" ${t.op === 'contains' ? 'selected' : ''}>contains</option></select>
        ${t.op !== 'exists' ? `<input type="text" class="t-value" value="${escapeHtml(t.value)}" placeholder="value">` : ''}`;
    if (t.type === 'bodyContains') return `<input type="text" class="t-value" style="min-width:160px" value="${escapeHtml(t.value)}" placeholder="text to find in response body">`;
    if (t.type === 'jsonPath') return `
        <input type="text" class="t-path" style="width:140px" value="${escapeHtml(t.path)}" placeholder="data.items[0].id">
        <select class="t-op"><option value="exists" ${t.op === 'exists' ? 'selected' : ''}>exists</option><option value="equals" ${t.op === 'equals' ? 'selected' : ''}>equals</option></select>
        ${t.op !== 'exists' ? `<input type="text" class="t-value" value="${escapeHtml(t.value)}" placeholder="expected value">` : ''}`;
    return '';
}

function wireTestRow(tab, t) {
    const row = qs(`.test-row[data-test-id="${t.id}"]`);
    if (!row) return;
    row.querySelector('.t-type').addEventListener('change', (e) => {
        Object.assign(t, createTest(e.target.value), { id: t.id });
        renderTestsTab(tab);
        markDirty();
    });
    row.querySelector('.t-op')?.addEventListener('change', (e) => { t.op = e.target.value; renderTestsTab(tab); markDirty(); });
    row.querySelector('.t-value')?.addEventListener('input', (e) => { t.value = e.target.value; markDirty(); });
    row.querySelector('.t-name')?.addEventListener('input', (e) => { t.name = e.target.value; markDirty(); });
    row.querySelector('.t-path')?.addEventListener('input', (e) => { t.path = e.target.value; markDirty(); });
    row.querySelector('.btn-icon').addEventListener('click', () => {
        tab.tests = tab.tests.filter(x => x.id !== t.id);
        renderTestsTab(tab);
        markDirty();
    });
}

/* ---------------- sending ---------------- */

function updateCancelButtonVisibility() {
    const tab = getActiveTab();
    const cancelBtn = qs('#cancelBtn');
    const sendBtn = qs('#sendBtn');
    const loading = !!tab?._abort;
    cancelBtn.classList.toggle('visible', loading);
    sendBtn.disabled = loading;
    sendBtn.classList.toggle('loading', loading);
}

export async function sendActiveRequest() {
    const tab = getActiveTab();
    if (!tab) return;
    if (!tab.url.trim()) { showToast('Please enter a URL', 'error'); return; }

    renderTabBar();
    updateCancelButtonVisibility();

    const result = await sendRequest(tab, {
        onDone: () => { renderTabBar(); updateCancelButtonVisibility(); },
    });

    if (result.ok) {
        const response = { ok: true, status: result.status, statusText: result.statusText, headers: result.headers, text: result.text, size: result.size, elapsed: result.elapsed, contentType: result.contentType };
        const testResults = runAssertions(tab.tests, response);
        testResults.forEach(r => { const t = tab.tests.find(x => x.id === r.id); if (t) t._lastResult = r; });
        tab.response = { ...response, testResults };
        import('./history.js').then(({ addToHistory }) => addToHistory(tab, result.status, result.elapsed));
    } else {
        if (result.cancelled) { showToast('Request cancelled', 'info'); }
        const testResults = runAssertions(tab.tests, result);
        testResults.forEach(r => { const t = tab.tests.find(x => x.id === r.id); if (t) t._lastResult = r; });
        tab.response = { ok: false, error: result.error, elapsed: result.elapsed, testResults };
        if (!result.cancelled) import('./history.js').then(({ addToHistory }) => addToHistory(tab, 'ERR', result.elapsed));
    }
    persistTabs();
    renderTestsTab(tab);
    renderResponseForActiveTab();
}

export function cancelActiveRequest() {
    const tab = getActiveTab();
    if (tab) cancelRequest(tab);
}

export function copyActiveRequestAsCurl() {
    const tab = getActiveTab();
    if (!tab) return;
    if (!tab.url.trim()) { showToast('Enter a URL first', 'error'); return; }
    const { url, method, headers, bodyData } = resolveRequest(tab);
    const curl = toCurl({
        method, url, headers,
        bodyText: bodyData && bodyData.contentType ? bodyData.body : (bodyData && typeof bodyData.body === 'string' ? bodyData.body : null),
        contentType: bodyData?.contentType,
        formFields: bodyData?.formFieldsForCurl,
    });
    navigator.clipboard.writeText(curl).then(() => showToast('Copied as cURL', 'success')).catch(() => showToast('Failed to copy', 'error'));
}

/* ---------------- wiring ---------------- */

export function setupTabEvents() {
    qs('#newTabBtn').addEventListener('click', () => newTab());
    qs('#methodSelect').addEventListener('change', (e) => {
        const tab = getActiveTab();
        tab.method = e.target.value;
        loadMethodColor();
        markDirty();
    });
    qs('#urlInput').addEventListener('input', (e) => {
        const tab = getActiveTab();
        tab.url = e.target.value;
        markDirty();
    });
    qs('#sendBtn').addEventListener('click', sendActiveRequest);
    qs('#cancelBtn').addEventListener('click', cancelActiveRequest);
    qs('#copyCurlBtn').addEventListener('click', copyActiveRequestAsCurl);
    qs('#addParamBtn').addEventListener('click', () => {
        const tab = getActiveTab();
        tab.params.push({ key: '', value: '', enabled: true });
        renderParamsTab(tab);
        markDirty();
    });
    qs('#addHeaderBtn').addEventListener('click', () => {
        const tab = getActiveTab();
        tab.headers.push({ key: '', value: '', enabled: true });
        renderHeadersTab(tab);
        markDirty();
    });
    qs('#addTestBtn').addEventListener('click', () => {
        const tab = getActiveTab();
        tab.tests.push(createTest('status'));
        renderTestsTab(tab);
        markDirty();
    });

    qsa('[data-req-tab]').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            const target = tabBtn.dataset.reqTab;
            qsa('[data-req-tab]').forEach(t => t.classList.remove('active'));
            tabBtn.classList.add('active');
            qsa('.req-tab-content').forEach(c => c.style.display = c.dataset.reqTab === target ? 'block' : 'none');
        });
    });

    document.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key === 'Enter') { if (e.target.tagName !== 'TEXTAREA') sendActiveRequest(); }
        else if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); newTab(); }
        else if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); const t = getActiveTab(); if (t) closeTab(t.id); }
        else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); import('./collections.js').then(({ openSaveModal }) => openSaveModal()); }
    });

    qs('#saveRequestBtn').addEventListener('click', () => { import('./collections.js').then(({ openSaveModal }) => openSaveModal()); });
}
