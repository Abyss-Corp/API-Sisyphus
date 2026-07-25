export function createTest(type = 'status') {
    const base = { id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` };
    if (type === 'status') return { ...base, type, op: 'equals', value: '200' };
    if (type === 'time') return { ...base, type, op: 'lessThan', value: '1000' };
    if (type === 'header') return { ...base, type, name: '', op: 'exists', value: '' };
    if (type === 'bodyContains') return { ...base, type, value: '' };
    if (type === 'jsonPath') return { ...base, type, path: '', op: 'equals', value: '' };
    return { ...base, type: 'status', op: 'equals', value: '200' };
}

function getByPath(obj, path) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let cur = obj;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    return cur;
}

/**
 * Evaluates each test against a resolved response object:
 * { status, elapsed, headers: [[k,v]], text }
 * Returns [{ id, pass, label, detail }]
 */
export function runAssertions(testDefs, response) {
    if (!response || !response.ok) {
        return (testDefs || []).map(t => ({
            id: t.id, pass: false, label: describeTest(t),
            detail: response?.error ? `Request failed: ${response.error}` : 'No response to test.',
        }));
    }

    let parsedJson;
    let jsonError = null;
    try { parsedJson = JSON.parse(response.text); } catch (e) { jsonError = e; }

    return (testDefs || []).map(t => {
        const label = describeTest(t);
        try {
            if (t.type === 'status') {
                const target = Number(t.value);
                const actual = response.status;
                const pass = t.op === 'equals' ? actual === target
                    : t.op === 'lessThan' ? actual < target
                    : t.op === 'greaterThan' ? actual > target : false;
                return { id: t.id, pass, label, detail: `Actual status: ${actual}` };
            }
            if (t.type === 'time') {
                const target = Number(t.value);
                const pass = response.elapsed < target;
                return { id: t.id, pass, label, detail: `Actual time: ${response.elapsed}ms` };
            }
            if (t.type === 'header') {
                const found = response.headers.find(([k]) => k.toLowerCase() === (t.name || '').toLowerCase());
                if (t.op === 'exists') return { id: t.id, pass: !!found, label, detail: found ? `Found: ${found[1]}` : 'Header not present' };
                if (!found) return { id: t.id, pass: false, label, detail: 'Header not present' };
                const pass = t.op === 'equals' ? found[1] === t.value : found[1].includes(t.value);
                return { id: t.id, pass, label, detail: `Actual: ${found[1]}` };
            }
            if (t.type === 'bodyContains') {
                const pass = response.text.includes(t.value);
                return { id: t.id, pass, label, detail: pass ? 'Match found' : 'Not found in response body' };
            }
            if (t.type === 'jsonPath') {
                if (jsonError) return { id: t.id, pass: false, label, detail: 'Response is not valid JSON' };
                const actual = getByPath(parsedJson, t.path);
                if (t.op === 'exists') return { id: t.id, pass: actual !== undefined, label, detail: actual !== undefined ? `Found: ${JSON.stringify(actual)}` : 'Path not found' };
                const pass = String(actual) === String(t.value);
                return { id: t.id, pass, label, detail: `Actual: ${actual === undefined ? 'undefined' : JSON.stringify(actual)}` };
            }
            return { id: t.id, pass: false, label, detail: 'Unknown test type' };
        } catch (e) {
            return { id: t.id, pass: false, label, detail: `Error evaluating test: ${e.message}` };
        }
    });
}

export function describeTest(t) {
    if (t.type === 'status') return `Status ${opSymbol(t.op)} ${t.value}`;
    if (t.type === 'time') return `Response time < ${t.value}ms`;
    if (t.type === 'header') return `Header "${t.name}" ${t.op === 'exists' ? 'exists' : t.op === 'equals' ? `= "${t.value}"` : `contains "${t.value}"`}`;
    if (t.type === 'bodyContains') return `Body contains "${t.value}"`;
    if (t.type === 'jsonPath') return `${t.path} ${t.op === 'exists' ? 'exists' : `= "${t.value}"`}`;
    return 'Test';
}

function opSymbol(op) {
    return op === 'equals' ? '==' : op === 'lessThan' ? '<' : op === 'greaterThan' ? '>' : op;
}
