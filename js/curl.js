/**
 * Tokenizes a shell-like command line, respecting single quotes (literal),
 * double quotes (backslash-escapes \" \\ \$ \` allowed), and backslash
 * escapes outside quotes. Good enough for the vast majority of curl
 * commands copied from a browser's "Copy as cURL" or written by hand.
 */
function tokenize(cmd) {
    const tokens = [];
    let cur = '';
    let i = 0;
    let inSingle = false, inDouble = false;
    let started = false;

    while (i < cmd.length) {
        const ch = cmd[i];
        if (inSingle) {
            if (ch === "'") { inSingle = false; } else { cur += ch; }
        } else if (inDouble) {
            if (ch === '"') { inDouble = false; }
            else if (ch === '\\' && i + 1 < cmd.length && '"\\$`'.includes(cmd[i + 1])) { cur += cmd[i + 1]; i++; }
            else { cur += ch; }
        } else {
            if (ch === "'") { inSingle = true; started = true; }
            else if (ch === '"') { inDouble = true; started = true; }
            else if (ch === '\\' && i + 1 < cmd.length) { cur += cmd[i + 1]; i++; started = true; }
            else if (/\s/.test(ch)) { if (started) { tokens.push(cur); cur = ''; started = false; } }
            else if (ch === '\n' || ch === '\r') { /* line continuations */ }
            else { cur += ch; started = true; }
        }
        i++;
    }
    if (started) tokens.push(cur);
    return tokens.filter(t => t !== '\\' && t !== '');
}

const VALUE_FLAGS = new Set([
    '-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary',
    '--data-urlencode', '-u', '--user', '-F', '--form', '-b', '--cookie', '--url',
    '-A', '--user-agent', '-e', '--referer',
]);

export function parseCurl(input) {
    const cmd = input.trim().replace(/\\\r?\n/g, ' ');
    if (!cmd) throw new Error('Paste a curl command first.');
    const tokens = tokenize(cmd);
    if (tokens[0] === 'curl') tokens.shift();
    if (tokens.length === 0) throw new Error('Could not find a curl command in that input.');

    let method = null;
    let url = null;
    const headers = [];
    const dataParts = [];
    const formFields = [];
    let isForm = false;
    let user = null;
    let isGet = false;

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const next = () => tokens[++i];

        if (t === '-X' || t === '--request') { method = next().toUpperCase(); }
        else if (t === '-H' || t === '--header') {
            const h = next();
            const idx = h.indexOf(':');
            if (idx > -1) headers.push({ key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim(), enabled: true });
        }
        else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') { dataParts.push(next()); }
        else if (t === '--data-urlencode') { dataParts.push(next()); }
        else if (t === '-F' || t === '--form') {
            isForm = true;
            const f = next();
            const idx = f.indexOf('=');
            if (idx > -1) formFields.push({ key: f.slice(0, idx), value: f.slice(idx + 1), enabled: true });
        }
        else if (t === '-u' || t === '--user') { user = next(); }
        else if (t === '-b' || t === '--cookie') { headers.push({ key: 'Cookie', value: next(), enabled: true }); }
        else if (t === '--url') { url = next(); }
        else if (t === '-A' || t === '--user-agent') { headers.push({ key: 'User-Agent', value: next(), enabled: true }); }
        else if (t === '-e' || t === '--referer') { headers.push({ key: 'Referer', value: next(), enabled: true }); }
        else if (t === '-G' || t === '--get') { isGet = true; }
        else if (VALUE_FLAGS.has(t)) { next(); } // known flag we don't otherwise handle, skip its value
        else if (t.startsWith('-')) { /* boolean flag like -s, -L, -k, --compressed: ignore */ }
        else if (!url) { url = t; }
    }

    if (!url) throw new Error('No URL found in that curl command.');

    const params = [{ key: '', value: '', enabled: true }];
    if (isGet && dataParts.length) {
        try {
            const u = new URL(url.startsWith('http') ? url : 'http://' + url);
            dataParts.join('&').split('&').forEach(pair => {
                const [k, v = ''] = pair.split('=');
                if (k) u.searchParams.append(decodeURIComponent(k), decodeURIComponent(v));
            });
            url = u.toString();
        } catch { /* leave url as-is if it doesn't parse */ }
    }

    let body = { type: 'none' };
    if (isForm && formFields.length) {
        formFields.push({ key: '', value: '', enabled: true });
        body = { type: 'form', fields: formFields };
    } else if (dataParts.length && !isGet) {
        const joined = dataParts.join('&');
        const looksJson = joined.trim().startsWith('{') || joined.trim().startsWith('[');
        body = { type: looksJson ? 'json' : 'raw', content: joined };
        if (!method) method = 'POST';
    }

    let auth = { type: 'none' };
    if (user) {
        const [username, password = ''] = user.split(':');
        auth = { type: 'basic', username, password };
    }
    const bearerHeaderIdx = headers.findIndex(h => /^authorization$/i.test(h.key) && /^bearer\s+/i.test(h.value));
    if (bearerHeaderIdx > -1 && auth.type === 'none') {
        auth = { type: 'bearer', token: headers[bearerHeaderIdx].value.replace(/^bearer\s+/i, '') };
        headers.splice(bearerHeaderIdx, 1);
    }

    if (headers.length === 0) headers.push({ key: '', value: '', enabled: true });
    else headers.push({ key: '', value: '', enabled: true });

    return {
        method: method || (dataParts.length ? 'POST' : 'GET'),
        url,
        params,
        headers,
        auth,
        body,
    };
}

function shQuote(str) {
    return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

/**
 * Builds a copy-pasteable curl command from a fully-resolved request
 * (env vars already substituted — this should be runnable as-is).
 */
export function toCurl({ method, url, headers, bodyText, contentType, formFields, authHeaderAdded }) {
    const lines = [`curl -X ${method} ${shQuote(url)}`];
    const hdrs = { ...headers };
    if (contentType && !Object.keys(hdrs).some(k => k.toLowerCase() === 'content-type')) {
        hdrs['Content-Type'] = contentType;
    }
    Object.entries(hdrs).forEach(([k, v]) => lines.push(`  -H ${shQuote(`${k}: ${v}`)}`));
    if (formFields && formFields.length) {
        formFields.forEach(f => lines.push(`  -F ${shQuote(`${f.key}=${f.value}`)}`));
    } else if (bodyText) {
        lines.push(`  -d ${shQuote(bodyText)}`);
    }
    return lines.join(' \\\n');
}
