export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

export function genId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function truncateUrl(url, max = 42) {
    if (!url) return '';
    return url.length > max ? url.slice(0, max - 1) + '\u2026' : url;
}

export function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KB`;
}

export function getStatusClass(status) {
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    if (status >= 500) return 'status-5xx';
    return 'status-err';
}

/** Close any open context menu / dropdown when clicking elsewhere. */
export function onOutsideClick(el, handler) {
    function listener(e) {
        if (!el.contains(e.target)) { handler(); document.removeEventListener('mousedown', listener); }
    }
    setTimeout(() => document.addEventListener('mousedown', listener), 0);
}
