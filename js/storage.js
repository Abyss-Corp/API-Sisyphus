const PREFIX = 'sisyphus_';

export function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
    } catch (e) {
        console.warn(`[storage] failed to load "${key}", using fallback`, e);
        return fallback;
    }
}

export function saveJSON(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`[storage] failed to save "${key}"`, e);
        return false;
    }
}
