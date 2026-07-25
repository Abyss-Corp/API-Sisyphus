import { state, createCollection, tabToSavedRequest, persistCollections, getActiveTab } from './state.js';
import { qs, qsa, escapeHtml, genId, onOutsideClick } from './dom.js';
import { showToast } from './toast.js';
import { openRequestInTab, refreshActiveTabDirtyState } from './tabs.js';

export function renderCollections() {
    const container = qs('#collectionsList');
    if (!state.collections.length) {
        container.innerHTML = `<div class="collections-empty-all">No collections yet. Save a request to get started.</div>`;
        return;
    }
    container.innerHTML = state.collections.map(col => `
        <div class="collection-group" data-col-id="${col.id}">
            <div class="collection-header ${col.expanded ? 'open' : ''}">
                <i class="fas fa-chevron-right c-chevron"></i>
                <span class="c-name">${escapeHtml(col.name)}</span>
                <span class="c-count">${col.requests.length}</span>
                <button class="c-menu-btn" title="More"><i class="fas fa-ellipsis-h"></i></button>
            </div>
            <div class="collection-items ${col.expanded ? 'open' : ''}">
                ${col.requests.length ? col.requests.map(req => `
                    <div class="collection-item" data-req-id="${req.id}">
                        <span class="method-badge ${req.method.toLowerCase()}">${req.method}</span>
                        <span class="ci-name">${escapeHtml(req.name)}</span>
                        <button class="ci-menu-btn" title="More"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                `).join('') : `<div class="collection-empty">Empty</div>`}
            </div>
        </div>
    `).join('');

    qsa('.collection-group', container).forEach(group => {
        const colId = group.dataset.colId;
        const col = state.collections.find(c => c.id === colId);
        const header = qs('.collection-header', group);
        header.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            col.expanded = !col.expanded;
            persistCollections();
            renderCollections();
        });
        qs('.c-menu-btn', header).addEventListener('click', (e) => {
            e.stopPropagation();
            openCtxMenu(e.currentTarget, [
                { label: 'Rename', icon: 'fa-pen', action: () => renameCollection(colId) },
                { label: 'Export JSON', icon: 'fa-download', action: () => exportCollection(colId) },
                { label: 'Delete', icon: 'fa-trash', danger: true, action: () => deleteCollection(colId) },
            ]);
        });

        qsa('.collection-item', group).forEach(item => {
            const reqId = item.dataset.reqId;
            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                openRequestInTab(colId, reqId);
            });
            qs('.ci-menu-btn', item).addEventListener('click', (e) => {
                e.stopPropagation();
                openCtxMenu(e.currentTarget, [
                    { label: 'Rename', icon: 'fa-pen', action: () => renameRequest(colId, reqId) },
                    { label: 'Duplicate', icon: 'fa-copy', action: () => duplicateRequest(colId, reqId) },
                    { label: 'Delete', icon: 'fa-trash', danger: true, action: () => deleteRequest(colId, reqId) },
                ]);
            });
        });
    });
}

function openCtxMenu(anchorEl, items) {
    qsa('.ctx-menu').forEach(m => m.remove());
    const rect = anchorEl.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 180)}px`;
    menu.innerHTML = items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}"><i class="fas ${it.icon}"></i> ${escapeHtml(it.label)}</button>`).join('');
    document.body.appendChild(menu);
    items.forEach((it, i) => menu.querySelector(`[data-i="${i}"]`).addEventListener('click', () => { it.action(); menu.remove(); }));
    onOutsideClick(menu, () => menu.remove());
}

export function newCollection() {
    const name = prompt('Collection name:', 'My Collection');
    if (!name || !name.trim()) return;
    const col = createCollection(name.trim());
    col.expanded = true;
    state.collections.push(col);
    persistCollections();
    renderCollections();
    showToast(`Created "${col.name}"`, 'success');
}

function renameCollection(colId) {
    const col = state.collections.find(c => c.id === colId);
    if (!col) return;
    const name = prompt('Rename collection:', col.name);
    if (!name || !name.trim()) return;
    col.name = name.trim();
    persistCollections();
    renderCollections();
}

function deleteCollection(colId) {
    const col = state.collections.find(c => c.id === colId);
    if (!col) return;
    if (!confirm(`Delete collection "${col.name}" and all ${col.requests.length} saved request(s)?`)) return;
    state.collections = state.collections.filter(c => c.id !== colId);
    persistCollections();
    renderCollections();
    refreshActiveTabDirtyState();
    showToast(`Deleted "${col.name}"`, 'success');
}

function renameRequest(colId, reqId) {
    const col = state.collections.find(c => c.id === colId);
    const req = col?.requests.find(r => r.id === reqId);
    if (!req) return;
    const name = prompt('Rename request:', req.name);
    if (!name || !name.trim()) return;
    req.name = name.trim();
    persistCollections();
    renderCollections();
}

function duplicateRequest(colId, reqId) {
    const col = state.collections.find(c => c.id === colId);
    const req = col?.requests.find(r => r.id === reqId);
    if (!req) return;
    const copy = { ...JSON.parse(JSON.stringify(req)), id: genId('req'), name: `${req.name} Copy` };
    col.requests.push(copy);
    persistCollections();
    renderCollections();
}

function deleteRequest(colId, reqId) {
    const col = state.collections.find(c => c.id === colId);
    if (!col) return;
    col.requests = col.requests.filter(r => r.id !== reqId);
    persistCollections();
    renderCollections();
    refreshActiveTabDirtyState();
}

function exportCollection(colId) {
    const col = state.collections.find(c => c.id === colId);
    if (!col) return;
    const payload = { schemaVersion: '1.0', exportedFrom: 'API Sisyphus', name: col.name, requests: col.requests };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${col.name.replace(/[^a-z0-9\-_]+/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${col.name}"`, 'success');
}

export function importCollectionFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result));
            if (!data.name || !Array.isArray(data.requests)) throw new Error('Missing "name" or "requests" array.');
            const col = createCollection(data.name);
            col.expanded = true;
            col.requests = data.requests.map(r => ({
                id: genId('req'),
                name: r.name || 'Untitled',
                method: r.method || 'GET',
                url: r.url || '',
                params: r.params || [{ key: '', value: '', enabled: true }],
                headers: r.headers || [{ key: '', value: '', enabled: true }],
                auth: r.auth || { type: 'none' },
                body: r.body || { type: 'none' },
                tests: r.tests || [],
            }));
            state.collections.push(col);
            persistCollections();
            renderCollections();
            showToast(`Imported "${col.name}" (${col.requests.length} requests)`, 'success');
        } catch (e) {
            showToast(`Import failed: ${e.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

/* ---------------- Save current tab modal ---------------- */

export function openSaveModal() {
    const tab = getActiveTab();
    if (!tab) return;
    if (!tab.url.trim()) { showToast('Enter a URL before saving', 'error'); return; }

    qs('#saveModalOverlay').classList.remove('hidden');
    const nameInput = qs('#saveModalName');
    const colSelect = qs('#saveModalCollection');
    nameInput.value = tab.name || '';
    colSelect.innerHTML = state.collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') +
        `<option value="__new__">+ New Collection\u2026</option>`;
    if (tab.savedRef) colSelect.value = tab.savedRef.collectionId;
    else if (!state.collections.length) colSelect.value = '__new__';
    nameInput.focus();
}

export function closeSaveModal() {
    qs('#saveModalOverlay').classList.add('hidden');
}

export function confirmSave() {
    const tab = getActiveTab();
    if (!tab) return;
    const name = qs('#saveModalName').value.trim();
    if (!name) { showToast('Enter a name', 'error'); return; }
    let colId = qs('#saveModalCollection').value;

    if (colId === '__new__') {
        const newName = prompt('New collection name:', 'My Collection');
        if (!newName || !newName.trim()) return;
        const col = createCollection(newName.trim());
        col.expanded = true;
        state.collections.push(col);
        colId = col.id;
    }

    const col = state.collections.find(c => c.id === colId);
    if (!col) return;

    if (tab.savedRef && tab.savedRef.collectionId === colId && col.requests.some(r => r.id === tab.savedRef.requestId)) {
        const req = col.requests.find(r => r.id === tab.savedRef.requestId);
        Object.assign(req, tabToSavedRequest(tab, name), { id: req.id });
    } else {
        const req = tabToSavedRequest(tab, name);
        col.requests.push(req);
        tab.savedRef = { collectionId: colId, requestId: req.id };
    }

    tab.name = name;
    tab.dirty = false;
    persistCollections();
    renderCollections();
    refreshActiveTabDirtyState();
    closeSaveModal();
    showToast(`Saved to "${col.name}"`, 'success');
}

export function setupCollectionEvents() {
    qs('#newCollectionBtn').addEventListener('click', newCollection);
    qs('#importCollectionInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importCollectionFile(file);
        e.target.value = '';
    });
    qs('#importCollectionBtn').addEventListener('click', () => qs('#importCollectionInput').click());

    qs('#saveModalCloseBtn').addEventListener('click', closeSaveModal);
    qs('#saveModalCancelBtn').addEventListener('click', closeSaveModal);
    qs('#saveModalConfirmBtn').addEventListener('click', confirmSave);
    qs('#saveModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'saveModalOverlay') closeSaveModal(); });
}
