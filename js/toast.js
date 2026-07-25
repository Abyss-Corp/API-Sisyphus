import { escapeHtml } from './dom.js';

export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
