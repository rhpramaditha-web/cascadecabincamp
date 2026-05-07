/* ============================================================
   js/data.js — State & Utilities
   Tugas: Menyimpan data sementara dan fungsi format dasar
   ============================================================ */

// -- WADAH DATA (Akan diisi otomatis oleh api.js) --
let BOOKINGS = [];
let INCOME = [];
let EXPENSE = [];

// -- FUNGSI FORMATTER --
function fmt(angka) {
    return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

function fmtDate(tgl) {
    if (!tgl || tgl === '-') return '—';
    const d = new Date(tgl + 'T00:00:00');
    if (isNaN(d.getTime())) return tgl;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function stPill(status) {
    const cl = status === 'Check-in' ? 'checkin' : status === 'Dibatalkan' ? 'cancelled' : 'pending';
    return `<span class="status-pill ${cl}">${status}</span>`;
}

function payPill(status) {
    const cl = status === 'Lunas' ? 'success' : status === 'DP 50%' ? 'warning' : 'danger';
    return `<span style="font-size:11px;font-weight:600;color:var(--${cl})">${status}</span>`;
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    const icon = toast.querySelector('.toast-icon');
    
    if (!toast || !msgEl) return;
    
    msgEl.textContent = msg;
    toast.style.borderColor = type === 'error' ? 'var(--red)' : 'var(--mossL)';
    icon.style.background = type === 'error' ? 'rgba(192,80,64,0.2)' : 'rgba(122,170,88,0.2)';
    icon.style.color = type === 'error' ? 'var(--red)' : 'var(--mossLL)';
    icon.textContent = type === 'error' ? '?' : '?';
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}