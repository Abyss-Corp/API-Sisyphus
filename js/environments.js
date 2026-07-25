import { state, createEnvironment, persistEnvironments } from './state.js';
import { qs, escapeHtml, genId } from './dom.js';
import { renderKvRows } from './kvrows.js';
import { showToast } from './toast.js';

let editingEnvId = null;

export function renderEnvNavSelect() {
    const sel = qs('#envNavSelect');
    sel.innerHTML = `<option value="">No Environment</option>` +
        state.environments.map(e => `<option value="${e.id}" ${e.id === state.activeEnvironmentId ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('');
}

function objToRows(obj) {
    const rows = Object.entries(obj || {}).map(([key, value]) => ({ key, value, enabled: true }));
    if (!rows.length) rows.push({ key: '', value: '', enabled: true });
    return rows;
}

function rowsToObj(rows) {
    const obj = {};
    rows.forEach(r => { if (r.key.trim()) obj[r.key.trim()] = r.value; });
    return obj;
}

export function openEnvModal() {
    if (!editingEnvId && state.environments.length) editingEnvId = state.environments[0].id;
    qs('#envModalOverlay').classList.remove('hidden');
    renderEnvModal();
}

export function closeEnvModal() {
    qs('#envModalOverlay').classList.add('hidden');
}

function renderEnvModal() {
    const listEl = qs('#envModalList');
    const editorEl = qs('#envModalEditor');

    if (!state.environments.length) {
        listEl.innerHTML = `<div class="collections-empty-all">No environments yet.</div>`;
        editorEl.innerHTML = '';
        return;
    }

    listEl.innerHTML = state.environments.map(e => `
        <div class="list-row ${e.id === editingEnvId ? 'active' : ''}" data-env-id="${e.id}">
            <span class="list-row-name">${escapeHtml(e.name)}</span>
            <div class="list-row-actions">
                <button data-action="rename" title="Rename"><i class="fas fa-pen"></i></button>
                <button data-action="duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
                <button data-action="delete" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    listEl.querySelectorAll('.list-row').forEach(row => {
        const id = row.dataset.envId;
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            editingEnvId = id;
            renderEnvModal();
        });
        row.querySelector('[data-action="rename"]').addEventListener('click', () => renameEnvironment(id));
        row.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateEnvironment(id));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteEnvironment(id));
    });

    const env = state.environments.find(e => e.id === editingEnvId);
    if (!env) { editorEl.innerHTML = ''; return; }

    editorEl.innerHTML = `
        <div class="field-label" style="margin-bottom:8px;">Variables for "${escapeHtml(env.name)}"</div>
        <div id="envVarRows"></div>
        <button class="btn-add" id="envVarAddBtn"><i class="fas fa-plus"></i> Add Variable</button>
    `;
    const rows = objToRows(env.variables);
    const container = qs('#envVarRows');
    const rerender = () => {
        env.variables = rowsToObj(rows);
        persistEnvironments();
    };
    renderKvRows(container, rows, rerender, { keyPlaceholder: 'KEY', valuePlaceholder: 'value' });
    qs('#envVarAddBtn').addEventListener('click', () => {
        rows.push({ key: '', value: '', enabled: true });
        renderKvRows(container, rows, rerender, { keyPlaceholder: 'KEY', valuePlaceholder: 'value' });
    });
}

export function addEnvironment() {
    const name = prompt('Environment name:', `Environment ${state.environments.length + 1}`);
    if (!name || !name.trim()) return;
    const env = createEnvironment(name.trim());
    state.environments.push(env);
    editingEnvId = env.id;
    persistEnvironments();
    renderEnvModal();
    renderEnvNavSelect();
    showToast(`Created environment "${env.name}"`, 'success');
}

function renameEnvironment(id) {
    const env = state.environments.find(e => e.id === id);
    if (!env) return;
    const name = prompt('Rename environment:', env.name);
    if (!name || !name.trim()) return;
    env.name = name.trim();
    persistEnvironments();
    renderEnvModal();
    renderEnvNavSelect();
}

function duplicateEnvironment(id) {
    const env = state.environments.find(e => e.id === id);
    if (!env) return;
    const copy = { id: genId('env'), name: `${env.name} Copy`, variables: { ...env.variables } };
    state.environments.push(copy);
    editingEnvId = copy.id;
    persistEnvironments();
    renderEnvModal();
    renderEnvNavSelect();
    showToast(`Duplicated as "${copy.name}"`, 'success');
}

function deleteEnvironment(id) {
    const env = state.environments.find(e => e.id === id);
    if (!env) return;
    if (!confirm(`Delete environment "${env.name}"? This can't be undone.`)) return;
    state.environments = state.environments.filter(e => e.id !== id);
    if (state.activeEnvironmentId === id) state.activeEnvironmentId = null;
    if (editingEnvId === id) editingEnvId = state.environments[0]?.id || null;
    persistEnvironments();
    renderEnvModal();
    renderEnvNavSelect();
    showToast(`Deleted "${env.name}"`, 'success');
}

export function setupEnvironmentEvents() {
    qs('#envNavSelect').addEventListener('change', (e) => {
        state.activeEnvironmentId = e.target.value || null;
        persistEnvironments();
    });
    qs('#manageEnvBtn').addEventListener('click', openEnvModal);
    qs('#envModalCloseBtn').addEventListener('click', closeEnvModal);
    qs('#envModalDoneBtn').addEventListener('click', closeEnvModal);
    qs('#envModalAddBtn').addEventListener('click', addEnvironment);
    qs('#envModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'envModalOverlay') closeEnvModal(); });
}
