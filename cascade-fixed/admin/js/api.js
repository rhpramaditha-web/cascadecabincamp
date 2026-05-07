/* ============================================================
   js/api.js — Google Sheets Communicator
   Tugas: Mengirim dan menarik data dari backend Google
   ============================================================ */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyHrE_ifhyMoj87u7OiSDxIRA5zmFR7B-PsF3M3e-oHQEaiYckE81S7ZRdV1_vhpgC0/exec';

function fetchAPI(action, payload = {}) {
    if (!SCRIPT_URL) {
        showToast('URL Google Sheets belum diatur!', 'error');
        return Promise.reject('No URL');
    }

    const data = { action, ...payload };

    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
    .then(res => res.text())
    .then(text => {
        try { return JSON.parse(text); } 
        catch(e) { return { success: true, message: 'Disimpan (Format balasan diabaikan)' }; }
    })
    .catch(err => {
        console.error('API Error:', err);
        return { success: false, message: 'Gagal jaringan' };
    });
}

// ── FUNGSI UTAMA ──
function syncDataFromSheets() {
    showToast('Membaca data dari satelit...');
    
    Promise.all([
        fetchAPI('get_bookings'),
        fetchAPI('get_income'),
        fetchAPI('get_expense')
    ]).then(res => {
        const [bk, inc, exp] = res;
        let count = 0;

        // Tarik dan bersihkan baris kosong (filter id !== '')
        if (bk.success && bk.data) {
            BOOKINGS = bk.data.filter(b => b && b.id && String(b.id).trim() !== '');
            count += BOOKINGS.length;
        }
        if (inc.success && inc.data) {
            INCOME = inc.data.filter(i => i && i.id && String(i.id).trim() !== '');
        }
        if (exp.success && exp.data) {
            EXPENSE = exp.data.filter(e => e && e.id && String(e.id).trim() !== '');
        }

        showToast(`Sinkronisasi sukses! (${count} reservasi dimuat)`);
        
        // Panggil fungsi render di app.js untuk memperbarui layar
        if (typeof refreshAllViews === 'function') refreshAllViews();
        
    }).catch(err => {
        showToast('Gagal menarik data', 'error');
    });
}

// ── FUNGSI AKSI ──
function apiSaveBooking(booking)   { return fetchAPI('add_booking', { booking }); }
function apiDeleteBooking(id)      { return fetchAPI('delete_booking', { id }); }
function apiUpdateBooking(id, upd) { return fetchAPI('update_booking', { id, updates: upd }); }

// Tambahkan 2 baris ini di bawah apiDeleteBooking atau di paling bawah file api.js
function apiSaveIncome(transaction)  { return fetchAPI('add_income', { transaction }); }
function apiSaveExpense(transaction) { return fetchAPI('add_expense', { transaction }); }