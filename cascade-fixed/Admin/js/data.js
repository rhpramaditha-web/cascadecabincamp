/* ============================================================
   js/data.js — State & Utilities
   ============================================================ */

// Gunakan window agar variabel 100% terbaca secara global di semua file
window.BOOKINGS = [];
window.INCOME = [];
window.EXPENSE = [];
window.ACTIVITY_LOGS = [];

function fmt(angka) {
    return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

function fmtDate(tgl) {
    if (!tgl || tgl === '-') return '—';
    const raw = String(tgl).slice(0, 10);
    const d = new Date(raw + 'T00:00:00');
    if (isNaN(d.getTime())) return String(tgl);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
    if (!name) return '?';
    return String(name).split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function stPill(status) {
    const s = status || 'Konfirmasi';
    const cl = s === 'Check-in' ? 'checkin' : s === 'Dibatalkan' ? 'cancelled' : 'pending';
    return `<span class="status-pill ${cl}">${s}</span>`;
}

function payPill(status) {
    const s = status || 'Belum';
    const lower = String(s).toLowerCase();
    let cl = 'danger';

    if (lower === 'lunas') {
        cl = 'success';
    } else if (lower.includes('kurang')) {
        cl = 'danger';
    } else if (lower.includes('dp')) {
        cl = 'warning';
    }
    return `<span style="font-size:11px;font-weight:600;color:var(--${cl})">${s}</span>`;
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    const icon = toast ? toast.querySelector('.toast-icon') : null;
    if (!toast || !msgEl) return;
    
    msgEl.textContent = msg;
    toast.style.borderColor = type === 'error' ? 'var(--red)' : 'var(--mossL)';
    if (icon) {
        icon.style.background = type === 'error' ? 'rgba(192,80,64,0.2)' : 'rgba(122,170,88,0.2)';
        icon.style.color = type === 'error' ? 'var(--red)' : 'var(--mossLL)';
        icon.textContent = type === 'error' ? '!' : '✓';
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(msg = 'Memproses data...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay && textEl) {
        textEl.textContent = msg;
        overlay.classList.add('show');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}