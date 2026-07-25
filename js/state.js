import { genId } from './dom.js';
import { loadJSON, saveJSON } from './storage.js';

export const state = {
    tabs: [],
    activeTabId: null,
    environments: [],
    activeEnvironmentId: null,
    collections: [],
    history: [],
};

export function createTab(overrides = {}) {
    return {
        id: genId('tab'),
        name: null, // null = derive from method+url; string = user/collection-provided name
        savedRef: null, // { collectionId, requestId } when this tab mirrors a saved request
        method: 'GET',
        url: '',
        params: [{ key: '', value: '', enabled: true }],
        headers: [{ key: '', value: '', enabled: true }],
        auth: { type: 'none' },
        body: { type: 'none' },
        tests: [],
        timeoutMs: 30000,
        dirty: false,
        response: null,
        ...overrides,
    };
}

export function createEnvironment(name) {
    return { id: genId('env'), name, variables: {} };
}

export function createCollection(name) {
    return { id: genId('col'), name, requests: [] };
}

export function tabToSavedRequest(tab, name) {
    return {
        id: genId('req'),
        name,
        method: tab.method,
        url: tab.url,
        params: tab.params,
        headers: tab.headers,
        auth: tab.auth,
        body: tab.body,
        tests: tab.tests,
    };
}

export function getActiveTab() {
    return state.tabs.find(t => t.id === state.activeTabId) || null;
}

export function getActiveEnvironment() {
    return state.environments.find(e => e.id === state.activeEnvironmentId) || null;
}

export function tabDisplayName(tab) {
    if (tab.name) return tab.name;
    if (!tab.url) return 'New Request';
    try {
        const resolved = tab.url.replace(/\{\{[^}]+\}\}/g, '');
        const u = new URL(resolved.startsWith('http') ? resolved : 'http://' + resolved);
        return (u.pathname === '/' ? u.hostname : u.pathname.split('/').filter(Boolean).pop() || u.hostname);
    } catch {
        return tab.url;
    }
}

/* ---------------- persistence ---------------- */

export function loadState() {
    state.environments = loadJSON('environments', []);
    state.activeEnvironmentId = loadJSON('activeEnvironmentId', null);
    state.collections = loadJSON('collections', []);
    state.history = loadJSON('history', []);

    const persistedTabs = loadJSON('tabs', null);
    const persistedActive = loadJSON('activeTabId', null);
    if (persistedTabs && persistedTabs.length) {
        state.tabs = persistedTabs.map(t => ({ ...createTab(), ...t, response: t.response || null }));
        state.activeTabId = persistedActive && state.tabs.some(t => t.id === persistedActive)
            ? persistedActive
            : state.tabs[0].id;
    } else {
        const first = createTab();
        state.tabs = [first];
        state.activeTabId = first.id;
    }

    if (state.activeEnvironmentId && !state.environments.some(e => e.id === state.activeEnvironmentId)) {
        state.activeEnvironmentId = null;
    }
}

export function persistTabs() {
    // strip runtime-only fields (AbortController instances) before serializing
    const serializable = state.tabs.map(({ _abort, ...rest }) => rest);
    saveJSON('tabs', serializable);
    saveJSON('activeTabId', state.activeTabId);
}

export function persistEnvironments() {
    saveJSON('environments', state.environments);
    saveJSON('activeEnvironmentId', state.activeEnvironmentId);
}

export function persistCollections() {
    saveJSON('collections', state.collections);
}

export function persistHistory() {
    saveJSON('history', state.history);
}
