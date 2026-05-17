/* ============================================================
   js/role.js — Role, Login & Permission Manager
   ============================================================ */

const ROLE_CONFIG = {
    OWNER: {
        label: 'Owner',
        pin: '2803',
        pages: [
            'dashboard',
            'kalender',
            'booking',
            'unit',
            'finance',
            'tamu',
            'log',
            'dailyReport',
            'receivable',
            'cancelArchive',
            'monthlyReport',
            'exportData',
            'settings'
        ],
        actions: ['all']
    },

    ADMIN: {
        label: 'Admin Reservasi',
        pin: '2222',
        pages: [
            'dashboard',
            'kalender',
            'booking',
            'unit',
            'tamu',
            'receivable',
            'cancelArchive'
        ],
        actions: ['booking', 'unit', 'guest', 'cancel']
    },

    FINANCE: {
        label: 'Admin Keuangan',
        pin: '3333',
        pages: [
            'dashboard',
            'finance',
            'receivable',
            'dailyReport',
            'monthlyReport',
            'exportData'
        ],
        actions: ['finance', 'report', 'export']
    },

    STAFF: {
        label: 'Staff Operasional',
        pin: '4444',
        pages: [
            'dashboard',
            'kalender',
            'booking',
            'unit',
            'tamu'
        ],
        actions: ['booking-view', 'unit-view', 'guest-view']
    }
};

function getCurrentRole() {
    return localStorage.getItem('cascade_role') || '';
}

function getCurrentRoleLabel() {
    const role = getCurrentRole();
    return ROLE_CONFIG[role]?.label || 'Belum login';
}

function isOwner() {
    return getCurrentRole() === 'OWNER';
}

function roleCanAccessPage(pageId) {
    const role = getCurrentRole();

    if (!role || !ROLE_CONFIG[role]) return false;

    const pages = ROLE_CONFIG[role].pages || [];

    return pages.includes('*') || pages.includes(pageId);
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
                <div style="font-weight:700;color:var(--txt1);font-size:16px;">Login Admin</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">
                    Pilih role dan masukkan PIN untuk masuk ke sistem.
                </div>
            </div>

            <div>
                <label class="kpi-label">Role</label>
                <select id="login-role" class="f-input">
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin Reservasi</option>
                    <option value="FINANCE">Admin Keuangan</option>
                    <option value="STAFF">Staff Operasional</option>
                </select>
            </div>

            <div>
                <label class="kpi-label">PIN</label>
                <input type="password" id="login-pin" class="f-input" placeholder="Masukkan PIN">
            </div>

            <div style="font-size:12px;color:var(--txt3);line-height:1.6;">
                Gunakan PIN akses yang sudah diberikan oleh Owner. Jangan membagikan PIN kepada pihak yang tidak berwenang.
            </div>
        </div>
    `;

    const foot = `
        <button class="btn-primary" onclick="submitRoleLogin()">Masuk</button>
    `;

    openModal('Login Akses Admin', body, foot);
}

function submitRoleLogin() {
    const role = document.getElementById('login-role')?.value || '';
    const pin = document.getElementById('login-pin')?.value || '';

    if (!ROLE_CONFIG[role]) {
        showToast('Role tidak valid', 'error');
        return;
    }

    if (pin !== ROLE_CONFIG[role].pin) {
        showToast('PIN salah', 'error');
        return;
    }

    localStorage.setItem('cascade_role', role);
    localStorage.setItem('cascade_role_pin', pin);
    localStorage.setItem('cascade_admin_name', ROLE_CONFIG[role].label);

    closeModal();

    if (typeof applyRoleAccess === 'function') applyRoleAccess();
    if (typeof showPage === 'function') showPage('dashboard');
    if (typeof renderKalender === 'function') renderKalender();
    if (typeof renderUnitTable === 'function') renderUnitTable();
    if (typeof syncDataFromSheets === 'function') setTimeout(syncDataFromSheets, 500);

    showToast(`Login sebagai ${ROLE_CONFIG[role].label}`);
}

function logoutRole() {
    localStorage.removeItem('cascade_role');
    localStorage.removeItem('cascade_role_pin');
    localStorage.removeItem('cascade_admin_name');

    if (typeof applyRoleAccess === 'function') applyRoleAccess();

    openRoleLogin();
}

function applyRoleAccess() {
    const role = getCurrentRole();

    const roleLabel = document.getElementById('active-role-label');

    if (roleLabel) {
        roleLabel.textContent = role ? `Login: ${getCurrentRoleLabel()}` : 'Belum login';
    }

    document.querySelectorAll('.nav-item[id^="nav-"]').forEach(nav => {
        const pageId = nav.id.replace('nav-', '');

        if (!role) {
            nav.style.display = 'none';
            return;
        }

        nav.style.display = roleCanAccessPage(pageId) ? '' : 'none';
    });
}