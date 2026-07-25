import { state, getActiveEnvironment } from './state.js';

export function resolveEnvVars(str) {
    if (!str) return str;
    const env = getActiveEnvironment();
    const vars = env ? env.variables : {};
    return String(str).replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmed = key.trim();
        return Object.prototype.hasOwnProperty.call(vars, trimmed) ? vars[trimmed] : match;
    });
}

export function buildHeaders(tab) {
    const headers = {};
    tab.headers.forEach(h => {
        if (h.enabled === false) return;
        const key = (h.key || '').trim();
        if (key) headers[key] = resolveEnvVars(h.value);
    });
    return headers;
}

export function buildAuthHeaders(tab) {
    const type = tab.auth?.type || 'none';
    const headers = {};
    if (type === 'bearer') {
        const token = tab.auth.token || '';
        if (token) headers['Authorization'] = `Bearer ${resolveEnvVars(token)}`;
    } else if (type === 'basic') {
        const username = tab.auth.username || '';
        const password = tab.auth.password || '';
        if (username) headers['Authorization'] = `Basic ${btoa(`${resolveEnvVars(username)}:${resolveEnvVars(password)}`)}`;
    } else if (type === 'apikey') {
        const { keyName = '', keyValue = '', location = 'header' } = tab.auth;
        if (keyName && keyValue && location === 'header') headers[keyName] = resolveEnvVars(keyValue);
    }
    return headers;
}

export function buildUrl(tab) {
    let url = resolveEnvVars(tab.url.trim());
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;

    const enabledParams = (tab.params || []).filter(p => p.enabled !== false && p.key.trim());
    if (enabledParams.length > 0) {
        const urlObj = new URL(url);
        enabledParams.forEach(p => urlObj.searchParams.append(p.key.trim(), resolveEnvVars(p.value)));
        url = urlObj.toString();
    }

    if (tab.auth?.type === 'apikey' && tab.auth.location === 'query') {
        const { keyName = '', keyValue = '' } = tab.auth;
        if (keyName && keyValue) {
            const urlObj = new URL(url);
            urlObj.searchParams.append(keyName, resolveEnvVars(keyValue));
            url = urlObj.toString();
        }
    }
    return url;
}

/** Returns { body, contentType, formFieldsForCurl } or null for no body. */
export function buildBody(tab) {
    const type = tab.body?.type || 'none';
    if (type === 'none') return null;

    if (type === 'json' || type === 'raw') {
        const content = tab.body.content || '';
        if (!content.trim()) return null;
        return { body: resolveEnvVars(content), contentType: type === 'json' ? 'application/json' : 'text/plain', formFieldsForCurl: null };
    }

    if (type === 'form') {
        const fields = (tab.body.fields || []).filter(f => f.enabled !== false && f.key.trim());
        if (!fields.length) return null;
        const formData = new FormData();
        const forCurl = [];
        fields.forEach(f => {
            if (f.isFile && f.fileObject) {
                formData.append(f.key, f.fileObject, f.fileName || 'file');
            } else {
                const value = resolveEnvVars(f.value);
                formData.append(f.key, value);
                forCurl.push({ key: f.key, value });
            }
        });
        return { body: formData, contentType: null, formFieldsForCurl: forCurl };
    }
    return null;
}

/** Fully resolved request description, used by both sendRequest and cURL export. */
export function resolveRequest(tab) {
    const url = buildUrl(tab);
    const headers = { ...buildHeaders(tab), ...buildAuthHeaders(tab) };
    const bodyData = (tab.method !== 'GET' && tab.method !== 'HEAD') ? buildBody(tab) : null;
    return { url, method: tab.method, headers, bodyData };
}

export async function sendRequest(tab, { onStart, onDone } = {}) {
    const { url, method, headers, bodyData } = resolveRequest(tab);
    if (!url) throw new Error('EMPTY_URL');

    const controller = new AbortController();
    tab._abort = controller;
    const timeoutMs = tab.timeoutMs || 30000;
    const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort('timeout'), timeoutMs) : null;

    if (onStart) onStart();
    const startTime = performance.now();
    try {
        const options = { method, headers: { ...headers }, signal: controller.signal };
        if (bodyData) {
            options.body = bodyData.body;
            if (bodyData.contentType) options.headers['Content-Type'] = bodyData.contentType;
        }
        const response = await fetch(url, options);
        const elapsed = Math.round(performance.now() - startTime);
        const blob = await response.blob();
        const size = blob.size;
        const text = await blob.text();
        const headerPairs = [];
        response.headers.forEach((v, k) => headerPairs.push([k, v]));
        return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            headers: headerPairs,
            text,
            size,
            elapsed,
            contentType: response.headers.get('content-type') || '',
        };
    } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        const wasTimeout = controller.signal.aborted && controller.signal.reason === 'timeout';
        const wasCancelled = controller.signal.aborted && controller.signal.reason !== 'timeout';
        return {
            ok: false,
            error: wasTimeout ? `Timed out after ${timeoutMs}ms` : wasCancelled ? 'Request cancelled' : (err.message || 'Network error'),
            cancelled: wasCancelled,
            elapsed,
        };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        tab._abort = null;
        if (onDone) onDone();
    }
}

export function cancelRequest(tab) {
    if (tab._abort) tab._abort.abort('cancelled');
}
