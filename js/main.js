import { loadState } from './state.js';
import { qs } from './dom.js';
import { renderTabBar, renderRequestPane, setupTabEvents, createTabFromParsedCurl } from './tabs.js';
import { renderResponseForActiveTab, setupResponseEvents } from './response.js';
import { renderCollections, setupCollectionEvents } from './collections.js';
import { renderHistory, setupHistoryEvents } from './history.js';
import { renderEnvNavSelect, setupEnvironmentEvents } from './environments.js';
import { parseCurl } from './curl.js';

function setupCurlImportModal() {
    const overlay = qs('#curlModalOverlay');
    const textarea = qs('#curlInput');
    const errorEl = qs('#curlModalError');

    function open() { overlay.classList.remove('hidden'); errorEl.classList.remove('visible'); textarea.value = ''; textarea.focus(); }
    function close() { overlay.classList.add('hidden'); }

    qs('#importCurlBtn').addEventListener('click', open);
    qs('#curlModalCloseBtn').addEventListener('click', close);
    qs('#curlModalCancelBtn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target.id === 'curlModalOverlay') close(); });

    qs('#curlModalImportBtn').addEventListener('click', () => {
        try {
            const parsed = parseCurl(textarea.value);
            createTabFromParsedCurl(parsed);
            close();
        } catch (e) {
            errorEl.textContent = e.message;
            errorEl.classList.add('visible');
        }
    });
}

function setupSidebarCollapse() {
    qs('#colHeader').addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        qs('#colHeader').classList.toggle('collapsed');
        qs('#colContent').classList.toggle('collapsed');
    });
}

function init() {
    loadState();

    renderTabBar();
    renderRequestPane();
    renderResponseForActiveTab();
    renderCollections();
    renderHistory();
    renderEnvNavSelect();

    setupTabEvents();
    setupResponseEvents();
    setupCollectionEvents();
    setupHistoryEvents();
    setupEnvironmentEvents();
    setupCurlImportModal();
    setupSidebarCollapse();
}

document.addEventListener('DOMContentLoaded', init);
