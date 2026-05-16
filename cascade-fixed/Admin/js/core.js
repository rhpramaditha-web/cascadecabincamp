/* ============================================================
   js/core.js — Core Engine, SPA Routing, Auth, Modal, & Logs
   ============================================================ */

// ── BASIC HELPERS ───────────────────────────────────────────
function readField(obj, keys, fallback = '') {
    if (!obj) return fallback;
    for (const key of keys) {
        const value = obj[key];
        if (value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== 'undefined') {
            return value;
        }
    }
    return fallback;
}

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function normalizeAmount(value) {
    if (typeof value === 'number') return value;
    const cleaned = String(value ?? '0').replace(/[^0-9.-]/g, '');
    return Number(cleaned) || 0;
}

function normalizeDate(value) {
    if (!value) return '';
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return str;
}

function dateToTime(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

function fmtDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildWaLink(phone, message = '') {
    const raw = String(phone || '').replace(/[^\d]/g, '');
    if (!raw) return '#';
    const normalized = raw.startsWith('0') ? '62' + raw.slice(1) : raw;
    return `https://wa.me/${normalized}${message ? '?text=' + encodeURIComponent(message) : ''}`;
}

// ── ROLES & AUTH ────────────────────────────────────────────
const ROLE_CONFIG = {
    OWNER:   { label: 'Owner', pages: ['dashboard', 'kalender', 'booking', 'unit', 'finance', 'tamu', 'log', 'dailyReport', 'receivable', 'cancelArchive', 'monthlyReport', 'exportData', 'settings'], actions: ['all'] },
    ADMIN:   { label: 'Admin Reservasi', pages: ['dashboard', 'kalender', 'booking', 'unit', 'tamu', 'receivable', 'cancelArchive'], actions: ['booking', 'unit', 'guest', 'cancel','settings'] },
    FINANCE: { label: 'Admin Keuangan', pages: ['dashboard', 'finance', 'receivable', 'dailyReport', 'monthlyReport', 'exportData'], actions: ['finance', 'report', 'export'] },
	OPERASIONAL: {label: 'Operasional', pages: ['dashboard', 'kalender', 'booking', 'unit', 'tamu', 'receivable', 'cancelArchive', 'monthlyReport'], actions: ['booking', 'unit', 'guest', 'cancel','settings'] },
    STAFF:   { label: 'Staff Operasional', pages: ['dashboard', 'kalender', 'booking', 'unit',], actions: ['booking-view', 'unit-view',] }
};

function getCurrentRole() { return localStorage.getItem('cascade_role') || ''; }
function getCurrentRoleLabel() { return ROLE_CONFIG[getCurrentRole()]?.label || 'Belum login'; }
function isOwner() { return getCurrentRole() === 'OWNER'; }
function getCurrentAdminName() { return localStorage.getItem('cascade_admin_name') || 'Admin'; }
function setCurrentAdminName(name) { localStorage.setItem('cascade_admin_name', name || 'Admin'); }

function roleCanAccessPage(pageId) {
    const role = getCurrentRole();
    if (!role || !ROLE_CONFIG[role]) return false;
    return ROLE_CONFIG[role].pages.includes(pageId);
}

function roleCanAction(action) {
    const role = getCurrentRole();
    if (!role || !ROLE_CONFIG[role]) return false;
    const actions = ROLE_CONFIG[role].actions || [];
    return actions.includes('all') || actions.includes(action);
}

function requireAction(action, message = 'Akses ditolak untuk role ini.') {
    if (roleCanAction(action)) return true;
    showToast(message, 'error');
    return false;
}

function openRoleLogin() {
    const body = `
        <div style="display:grid;gap:14px;">
            <div style="padding:14px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;">
                <div style="font-weight:700;color:var(--txt1);font-size:16px;">Login Karyawan</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">Masukkan Nama Pengguna dan PIN Akses Anda.</div>
            </div>
            <div>
                <label class="kpi-label">Nama Pengguna</label>
                <input type="text" id="login-username" class="f-input" placeholder="Ketik nama (misal: Budi)">
            </div>
            <div>
                <label class="kpi-label">PIN Rahasia</label>
                <input type="password" id="login-pin" class="f-input" placeholder="Masukkan PIN 4 digit">
            </div>
        </div>
    `;
    openModal('Login Akses Admin', body, `<button class="btn-primary" onclick="submitRoleLogin()">Masuk</button>`);
}

function submitRoleLogin() {
    const username = document.getElementById('login-username')?.value.trim();
    const pin = document.getElementById('login-pin')?.value.trim();

    if (!username) return showToast('Nama pengguna wajib diisi', 'error');
    if (!pin) return showToast('PIN wajib diisi', 'error');

    showLoading('Memverifikasi Akun...');

    apiVerifyLogin(username, pin).then(res => {
        hideLoading();
        if (res && res.success) {
            // Jika sukses, simpan Role (OWNER/ADMIN) dan Nama Asli yang dilempar dari Google Sheets
            localStorage.setItem('cascade_role', res.role);
            localStorage.setItem('cascade_role_pin', pin);
            setCurrentAdminName(res.name);

            closeModal();
            applyRoleAccess();
            showPage('dashboard');
            
            if(typeof renderKalender === 'function') renderKalender();
            if(typeof renderUnitTable === 'function') renderUnitTable();
            setTimeout(() => { if(typeof syncDataFromSheets === 'function') syncDataFromSheets(); }, 500);
            
            showToast(`Selamat datang, ${res.name}!`);
            startAutoLogoutTimer(); // Menyalakan Timer Auto-Logout
        } else {
            showToast(res.message || 'Nama Pengguna atau PIN salah!', 'error');
        }
    });
}

function logoutRole() {
    localStorage.removeItem('cascade_role');
    localStorage.removeItem('cascade_role_pin');
    localStorage.removeItem('cascade_admin_name');
    applyRoleAccess();
    openRoleLogin();
}

// ── AUTO-LOGOUT SECURITY ────────────────────────────────────
let inactivityTimer;
const INACTIVITY_LIMIT = 30 * 60 * 1000; // Sesi berakhir otomatis dalam 30 Menit

function startAutoLogoutTimer() {
    clearTimeout(inactivityTimer);
    if (getCurrentRole()) {
        inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_LIMIT);
    }
}

function logoutDueToInactivity() {
    logoutRole(); 
    showToast('Sesi berakhir otomatis karena tidak ada aktivitas.', 'error');
}

// Reset timer setiap kali mouse gerak, ngetik, atau scroll
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, startAutoLogoutTimer);
});
document.addEventListener('DOMContentLoaded', startAutoLogoutTimer);

function applyRoleAccess() {
    const role = getCurrentRole();
    const roleLabel = document.getElementById('active-role-label');
    if (roleLabel) roleLabel.textContent = role ? `Login: ${getCurrentRoleLabel()}` : 'Belum login';

    document.querySelectorAll('.nav-item[id^="nav-"]').forEach(nav => {
        const pageId = nav.id.replace('nav-', '');
        if (!role) {
            nav.style.display = 'none';
            return;
        }
        nav.style.display = roleCanAccessPage(pageId) ? '' : 'none';
    });
}

// ── NAVIGATION (SPA) ────────────────────────────────────────
function showPage(pageId) {
    if (!getCurrentRole()) return openRoleLogin();
    if (!roleCanAccessPage(pageId)) return showToast('Anda tidak memiliki akses ke halaman ini.', 'error');

    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetPage = document.getElementById('page-' + pageId);
    const targetNav  = document.getElementById('nav-' + pageId);
    if (targetPage) targetPage.classList.add('active');
    if (targetNav)  targetNav.classList.add('active');

    const titles = {
        dashboard: ['Ringkasan', 'Pantau kondisi camp hari ini'],
        kalender: ['Kalender Reservasi', 'Jadwal ketersediaan unit dan daftar tamu'],
        booking:  ['Daftar Reservasi', 'Kelola semua pesanan masuk'],
        unit:     ['Manajemen Unit', 'Kelola unit camp, status operasional, dan ketersediaan'],
        finance:  ['Keuangan', 'Pemasukan dan pengeluaran'],
        tamu:     ['Database Tamu', 'Daftar seluruh pelanggan Cascade'],
        log:      ['Log Aktivitas', 'Riwayat perubahan data dan aksi admin'],
        dailyReport: ['Laporan Harian', 'Ringkasan operasional dan keuangan harian'],
        monthlyReport: ['Laporan Bulanan', 'Rekap performa operasional dan keuangan bulanan'],
        exportData: ['Export Data', 'Unduh data operasional dan keuangan'],
        receivable: ['Piutang', 'Daftar sisa pembayaran tamu'],
        cancelArchive: ['Arsip Pembatalan', 'Riwayat reservasi yang dibatalkan'],
        settings: ['Master Setting', 'Pengaturan tarif, libur, dan high season'],
    };

    const title = document.getElementById('topbar-title');
    const sub = document.getElementById('topbar-sub');
    if (title) title.textContent = titles[pageId]?.[0] || 'Admin';
    if (sub) sub.textContent = titles[pageId]?.[1] || '';

    // Trigger renders if functions are available
    if (pageId === 'dashboard' && typeof renderDashboardKPI === 'function') safeRun(renderDashboardKPI);
    if (pageId === 'kalender' && typeof renderKalender === 'function') safeRun(renderKalender);
    if (pageId === 'booking' && typeof renderBookingTable === 'function') safeRun(renderBookingTable);
    if (pageId === 'unit' && typeof renderUnitTable === 'function') safeRun(renderUnitTable);
    if (pageId === 'finance') {
        if (typeof renderFinance === 'function') safeRun(renderFinance);
        if (typeof renderCashReconciliationTable === 'function') safeRun(renderCashReconciliationTable);
    }
    if (pageId === 'tamu' && typeof renderTamuTable === 'function') safeRun(renderTamuTable);
    if (pageId === 'log') renderActivityLog();
    if (pageId === 'dailyReport' && typeof renderDailyReport === 'function') safeRun(renderDailyReport);
    if (pageId === 'monthlyReport' && typeof renderMonthlyReport === 'function') safeRun(renderMonthlyReport);
    if (pageId === 'exportData' && typeof renderExportDataPage === 'function') safeRun(renderExportDataPage);
    if (pageId === 'receivable' && typeof renderReceivableTable === 'function') safeRun(renderReceivableTable);
    if (pageId === 'cancelArchive' && typeof renderCancellationArchive === 'function') safeRun(renderCancellationArchive);
    if (pageId === 'settings' && typeof renderMasterSettingsPage === 'function') safeRun(renderMasterSettingsPage);
}

// ── MODAL SYSTEM ────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml = '') {
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footEl = document.getElementById('modal-footer');
    const overlay = document.getElementById('modal-overlay');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (footEl) footEl.innerHTML = footerHtml;
    if (overlay) overlay.classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('open');
}

// ── MOBILE MENU HANDLER ─────────────────────────────────────
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
}

// Menutup sidebar secara otomatis saat menu diklik di HP
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.querySelector('.sidebar-overlay');
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('show');
            }
        });
    });
});

// ── ACTIVITY LOGS ───────────────────────────────────────────
ACTIVITY_LOGS = JSON.parse(localStorage.getItem('cascade_activity_logs') || '[]');

function generateLogId() { return 'LOG-' + new Date().getTime(); }
function saveActivityLogsLocal() { localStorage.setItem('cascade_activity_logs', JSON.stringify(ACTIVITY_LOGS)); }

function addActivityLog({ modul = 'Sistem', aksi = '-', refId = '-', lama = '-', baru = '-', catatan = '-' }) {
    const generatedId = generateLogId();
    const now = new Date().toISOString();
    const currentAdmin = getCurrentAdminName();
    const currentRole = getCurrentRoleLabel(); // Mengambil Role (Owner / Admin Reservasi, dll)

    const log = {
        // Format huruf kecil untuk internal web
        id: generatedId, waktu: now, admin: currentAdmin, role: currentRole,
        modul, aksi, refId, lama: String(lama ?? '-'), baru: String(baru ?? '-'), catatan: String(catatan ?? '-'),
        
        // Format Kapital disesuaikan EXACTLY dengan header Google Sheets
        ID: generatedId,
        Waktu: now,
        Admin: currentAdmin,
        Role: currentRole,
        Modul: modul,
        Aksi: aksi,
        RefID: refId,
        DataLama: String(lama ?? '-'),
        DataBaru: String(baru ?? '-'),
        Catatan: String(catatan ?? '-')
    };

    ACTIVITY_LOGS.unshift(log);
    saveActivityLogsLocal();

    if (typeof apiSaveActivityLog === 'function') {
        apiSaveActivityLog(log).catch(() => console.warn('Gagal menyimpan log ke database online'));
    }
    if (typeof renderActivityLog === 'function') renderActivityLog();
}

function renderActivityLog() {
    const tbody = document.getElementById('log-tbody');
    if (!tbody) return;

    const q = (document.getElementById('log-search')?.value || '').toLowerCase();
    const moduleFilter = document.getElementById('log-module-filter')?.value || '';
    const dateFilter = document.getElementById('log-date-filter')?.value || '';

    let rows = [...ACTIVITY_LOGS];
    if (moduleFilter) rows = rows.filter(log => log.modul === moduleFilter);
    if (dateFilter) rows = rows.filter(log => String(log.waktu || '').slice(0, 10) === dateFilter);
    if (q) {
        rows = rows.filter(log => {
            const text = [log.waktu, log.admin, log.role, log.modul, log.aksi, log.refId, log.lama, log.baru, log.catatan].join(' ').toLowerCase();
            return text.includes(q);
        });
    }

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--txt3);">Tidak ada log aktivitas.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.slice(0, 200).map(log => `
        <tr>
            <td>${fmtDateTime(log.waktu || log.Waktu)}</td>
            <td>
                <strong>${escapeHTML(log.admin || log.Admin)}</strong><br>
                <small style="color:var(--mossL);">${escapeHTML(log.role || log.Role || '-')}</small>
            </td>
            <td>${escapeHTML(log.modul || log.Modul)}</td>
            <td><strong>${escapeHTML(log.aksi || log.Aksi)}</strong></td>
            <td style="font-family:monospace;color:var(--amber)">${escapeHTML(log.refId || log.RefID || log.RefId)}</td>
            <td>${escapeHTML(log.lama || log.DataLama)}</td>
            <td>${escapeHTML(log.baru || log.DataBaru)}</td>
            <td>${escapeHTML(log.catatan || log.Catatan)}</td>
        </tr>
    `).join('');
}

function clearActivityFilter() {
    const s = document.getElementById('log-search');
    const m = document.getElementById('log-module-filter');
    const d = document.getElementById('log-date-filter');
    if (s) s.value = '';
    if (m) m.value = '';
    if (d) d.value = '';
    renderActivityLog();
}

// ── GLOBAL REFRESHER ────────────────────────────────────────
function safeRun(fn) {
    try { fn(); } catch (err) { console.error(`Error in ${fn.name}:`, err); }
}

function refreshAllViews() {
    if(typeof syncBookingPaymentStatusesFromFinance === 'function') safeRun(syncBookingPaymentStatusesFromFinance);
    if(typeof renderDashboardKPI === 'function') safeRun(renderDashboardKPI);
    if(typeof renderBookingTable === 'function') safeRun(renderBookingTable);
    if(typeof renderTamuTable === 'function') safeRun(renderTamuTable);
    if(typeof renderKalender === 'function') safeRun(renderKalender);
    if(typeof renderFinance === 'function') safeRun(renderFinance);
    if(typeof renderUnitTable === 'function') safeRun(renderUnitTable);
    if(typeof renderActivityLog === 'function') renderActivityLog();
    if(typeof renderCashReconciliationTable === 'function') safeRun(renderCashReconciliationTable);
    if(typeof renderDailyReport === 'function') safeRun(renderDailyReport);
    if(typeof renderReceivableTable === 'function') safeRun(renderReceivableTable);
    if(typeof renderCancellationArchive === 'function') safeRun(renderCancellationArchive);
    if(typeof renderMonthlyReport === 'function') safeRun(renderMonthlyReport);
}

// ── APP INITIALIZATION ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    applyRoleAccess();
    if (!getCurrentRole()) {
        openRoleLogin();
        return;
    }
    showPage('dashboard');
    if(typeof renderKalender === 'function') renderKalender();
    if(typeof renderUnitTable === 'function') renderUnitTable();
    setTimeout(() => { if(typeof syncDataFromSheets === 'function') syncDataFromSheets(); }, 500);
});