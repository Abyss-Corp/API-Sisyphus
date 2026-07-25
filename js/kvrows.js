import { escapeHtml } from './dom.js';

/**
 * Renders an editable list of {key, value, enabled} rows into `container`,
 * mutating `rows` in place as the user types, and always keeping one
 * trailing blank row available. Calls `onChange()` after every edit.
 *
 * Only the initial render rebuilds all rows; typing in the trailing row
 * appends a single new row element instead of re-rendering everything,
 * so focus is never stolen mid-keystroke.
 */
export function renderKvRows(container, rows, onChange, opts = {}) {
    if (!rows.length) rows.push({ key: '', value: '', enabled: true });
    container.innerHTML = '';
    rows.forEach((row, i) => container.appendChild(buildRowEl(container, rows, row, i, onChange, opts)));
}

function buildRowEl(container, rows, row, index, onChange, opts) {
    const { withCheckbox = true, keyPlaceholder = 'Key', valuePlaceholder = 'Value' } = opts;
    const el = document.createElement('div');
    el.className = 'kv-row' + (row.enabled === false ? ' disabled' : '');
    el.innerHTML = `
        ${withCheckbox ? `<input type="checkbox" ${row.enabled !== false ? 'checked' : ''} title="Enabled">` : ''}
        <input type="text" placeholder="${keyPlaceholder}" value="${escapeHtml(row.key)}" class="kv-key">
        <input type="text" placeholder="${valuePlaceholder}" value="${escapeHtml(row.value)}" class="kv-value">
        <button class="btn-icon" title="Remove"><i class="fas fa-times"></i></button>
    `;
    const checkbox = withCheckbox ? el.querySelector('input[type="checkbox"]') : null;
    const keyInput = el.querySelector('.kv-key');
    const valueInput = el.querySelector('.kv-value');
    const removeBtn = el.querySelector('.btn-icon');

    function maybeAppendTrailingRow() {
        const isLastRow = rows[rows.length - 1] === row;
        if (!isLastRow) return;
        if (row.key.trim() || row.value.trim()) {
            const newRow = { key: '', value: '', enabled: true };
            rows.push(newRow);
            container.appendChild(buildRowEl(container, rows, newRow, rows.length - 1, onChange, opts));
        }
    }

    keyInput.addEventListener('input', () => { row.key = keyInput.value; onChange(); maybeAppendTrailingRow(); });
    valueInput.addEventListener('input', () => { row.value = valueInput.value; onChange(); maybeAppendTrailingRow(); });
    if (checkbox) checkbox.addEventListener('change', () => { row.enabled = checkbox.checked; el.classList.toggle('disabled', !checkbox.checked); onChange(); });
    removeBtn.addEventListener('click', () => {
        const idx = rows.indexOf(row);
        if (idx > -1) rows.splice(idx, 1);
        if (rows.length === 0) rows.push({ key: '', value: '', enabled: true });
        onChange();
        renderKvRows(container, rows, onChange, opts); // full rebuild is fine here — user just clicked a button, not mid-type
    });

    return el;
}
