/* ============================================================
   js/api.js — Google Sheets Communicator
   ============================================================ */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzx0gBYYZSmV2vM3VyG3UWsRSCt2peOsX5vNzMSOToP7yaEHQdDFCIw-mV5ZHmocauK/exec';

function fetchAPI(action, payload = {}) {
    if (!SCRIPT_URL) {
        showToast('URL Google Sheets belum diatur!', 'error');
        return Promise.reject('No URL');
    }

    const data = {
        action,
        role: localStorage.getItem('cascade_role') || '',
        rolePin: localStorage.getItem('cascade_role_pin') || '',
        adminName: localStorage.getItem('cascade_admin_name') || '',
        ...payload
    };

    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
    })
    .then(res => res.text())
    .then(text => {
        try { return JSON.parse(text); } 
        catch (e) { return { success: false, message: 'Balasan Apps Script bukan JSON', raw: text }; }
    })
    .catch(err => {
        return { success: false, message: 'Gagal jaringan', error: String(err) };
    });
}

function _rowId(row) {
    return String((row && (row.id || row.ID || row.Id || row.kode || row.Kode)) || '').trim();
}

// Parameter loadAll = false by default (Berarti hanya ambil data 2 bulan terakhir yang ringan)
function syncDataFromSheets(loadAll = false) {
    if (loadAll) {
        showLoading('Menarik Arsip Seluruh Data dari Awal...');
    } else {
        showLoading('Sinkronisasi database cepat...');
    }

    // Melempar perintah ke Google Sheets
    Promise.all([
        fetchAPI('get_bookings', { loadAll }),
        fetchAPI('get_income', { loadAll }),
        fetchAPI('get_expense', { loadAll }),
        fetchAPI('get_cash_reconciliations', { loadAll }),
        fetchAPI('get_logs', { loadAll })
    ])
    .then(res => {
        hideLoading();
        const [bk, inc, exp, recon, logs] = res;
        let count = 0;

        if (bk.success && Array.isArray(bk.data)) {
            window.BOOKINGS = bk.data.filter(b => b && _rowId(b));
            count += window.BOOKINGS.length;
        }
        if (inc.success && Array.isArray(inc.data)) {
            window.INCOME = inc.data.filter(i => i && _rowId(i));
        }
        if (exp.success && Array.isArray(exp.data)) {
            window.EXPENSE = exp.data.filter(e => e && _rowId(e));
        }
        if (recon.success && Array.isArray(recon.data)) {
            window.CASH_RECONCILIATIONS = recon.data.filter(r => r && _rowId(r));
            localStorage.setItem('cascade_cash_reconciliations', JSON.stringify(window.CASH_RECONCILIATIONS));
        }
        if (logs && logs.success && Array.isArray(logs.data)) {
            window.ACTIVITY_LOGS = logs.data.filter(l => l && _rowId(l));
            localStorage.setItem('cascade_activity_logs', JSON.stringify(window.ACTIVITY_LOGS));
        }

        if (loadAll) {
            showToast(`Sukses! ${count} Arsip Lama berhasil ditarik.`);
        } else {
            showToast(`Sinkronisasi sukses! (${count} reservasi dimuat)`);
        }

        if (typeof refreshAllViews === 'function') refreshAllViews();
    })
    .catch(err => {
        hideLoading();
        console.error(err);
        showToast('Gagal menarik data', 'error');
    });
}

function apiSaveBooking(booking) { return fetchAPI('add_booking', { booking }); }
function apiDeleteBooking(id) { return fetchAPI('delete_booking', { id }); }
function apiUpdateBooking(id, updates) { return fetchAPI('update_booking', { id, updates }); }
function apiSaveIncome(transaction) { return fetchAPI('add_income', { transaction }); }
function apiSaveExpense(transaction) { return fetchAPI('add_expense', { transaction }); }
function apiGetCashReconciliations() { return fetchAPI('get_cash_reconciliations'); }
function apiSaveCashReconciliation(data) { return fetchAPI('saveCashReconciliation', { data }); }
function apiSaveActivityLog(log) { return fetchAPI('add_log', { log }); }

// Memanggil Login Check ke Backend
function apiVerifyLogin(username, pin) {
    const data = {
        action: 'verify_login',
        adminName: username,
        rolePin: pin
    };

    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
    })
    .then(res => res.text())
    .then(text => JSON.parse(text))
    .catch(err => {
        console.error(err);
        return { success: false, message: 'Gagal menghubungi server' };
    });
}

// Mengonversi File menjadi Base64 lalu menembakkannya ke Google Drive
function apiUploadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            fetchAPI('upload_image', {
                base64: base64String,
                mimeType: file.type,
                filename: file.name
            }).then(resolve).catch(reject);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}