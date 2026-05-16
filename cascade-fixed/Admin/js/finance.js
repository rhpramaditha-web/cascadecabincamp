/* ============================================================
   js/finance.js — Keuangan, Cash Adjust, Tutup Kas, & Voucher
   ============================================================ */

const FINANCE_CATEGORIES = {
    income: ['Titipan Uang Jaminan', 'Saldo Awal / Koreksi Kas', 'Booking Penginapan', 'Add-on / Extra Service', 'Sewa Area / Venue', 'F&B / Penjualan Makanan', 'Merchandise', 'Refund Vendor / Reimburse', 'Lainnya'],
    expense: ['Pengembalian Uang Jaminan', 'Saldo Awal / Koreksi Kas','Refund / Pembatalan Booking', 'Operasional Harian', 'Gaji / Honor Staff', 'Housekeeping & Laundry', 'Maintenance & Perbaikan', 'F&B / Belanja Dapur', 'Utilitas: Listrik, Air, Internet', 'Marketing & Iklan', 'Transportasi & Logistik', 'Perlengkapan Tamu', 'Pajak / Admin Bank', 'Lainnya']
};

function normalizeFinanceTx(tx, fallbackType = 'income') {
    const rawType = String(readField(tx, ['tipe', 'Tipe', 'type', 'Type'], fallbackType === 'expense' ? 'out' : 'in')).toLowerCase();
    const normalizedType = ['out', 'expense', 'keluar', 'pengeluaran', 'exp'].includes(rawType) ? 'expense' : 'income';
    return {
        ...tx,
        id: readField(tx, ['id', 'ID', 'Id'], '-'),
        tanggal: normalizeDate(readField(tx, ['tanggal', 'tgl', 'Tgl', 'Tanggal', 'date', 'Date'], '')),
        keterangan: readField(tx, ['keterangan', 'ket', 'Ket', 'Keterangan', 'description', 'Description'], '-'),
        kategori: readField(tx, ['kategori', 'kat', 'Kat', 'Kategori', 'category', 'Category'], '-'),
        metode: readField(tx, ['metode', 'Metode', 'paymentMethod'], '-'),
        dariKe: readField(tx, ['dariKe', 'DariKe', 'Dari/Ke', 'darike'], '-'),
        jumlah: normalizeAmount(readField(tx, ['jumlah', 'jml', 'Jml', 'Jumlah', 'amount', 'Amount'], 0)),
        tipe: normalizedType,
        catatan: readField(tx, ['catatan', 'Catatan', 'note', 'Note'], '')
    };
}

function renderFinance() {
    const tbody = document.getElementById('finance-tbody');
    if (!tbody) return;
    const incomeRows = INCOME.map(i => normalizeFinanceTx(i, 'income'));
    const expenseRows = EXPENSE.map(e => normalizeFinanceTx(e, 'expense'));
    const totalIncome = incomeRows.reduce((sum, i) => sum + i.jumlah, 0);
    const totalExpense = expenseRows.reduce((sum, e) => sum + e.jumlah, 0);
    
    if (document.getElementById('fin-in')) document.getElementById('fin-in').textContent = fmt(totalIncome);
    if (document.getElementById('fin-out')) document.getElementById('fin-out').textContent = fmt(totalExpense);
    if (document.getElementById('fin-saldo')) document.getElementById('fin-saldo').textContent = fmt(totalIncome - totalExpense);

    const all = [...incomeRows, ...expenseRows].sort((a, b) => dateToTime(b.tanggal) - dateToTime(a.tanggal));
    if (!all.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada transaksi keuangan.</td></tr>';
        return;
    }
    
    tbody.innerHTML = all.slice(0, 50).map(t => {
        const isExpense = t.tipe === 'expense';
        const voucherBtn = isExpense
            ? `<button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="printExpenseVoucher('${escapeHTML(t.id)}')">Voucher</button>`
            : `<span style="color:var(--txt3);font-size:11px;">-</span>`;

        return `
            <tr>
                <td style="font-family:monospace;color:var(--mossL)">${escapeHTML(t.id)}</td>
                <td>
                    <strong>${escapeHTML(t.keterangan)}</strong>
                    ${t.catatan ? `<br><small>${escapeHTML(t.catatan)}</small>` : ''}
                </td>
                <td>${fmtDate(t.tanggal)}</td>
                <td>${escapeHTML(t.kategori || '-')}</td>
                <td>${isExpense ? '📤 Keluar' : '📥 Masuk'}</td>
                <td style="text-align:right;font-weight:600;color:${isExpense ? 'var(--red)' : 'var(--mossLL)'}">
                    ${isExpense ? '-' : '+'} ${fmt(t.jumlah)}
                </td>
                <td>${voucherBtn}</td>
            </tr>
        `;
    }).join('');
}

function openFinanceAdd() {
    if (typeof requireAction === 'function' && !requireAction('finance', 'Role ini tidak boleh mencatat transaksi keuangan.')) return;
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="kpi-label">Keterangan *</label><input type="text" id="fin-desc" class="f-input" placeholder="Contoh: Booking Forest Tent"></div>
            <div><label class="kpi-label">Tanggal *</label><input type="date" id="fin-date" value="${today}" class="f-input"></div>
            <div><label class="kpi-label">Tipe Transaksi *</label><select id="fin-type" class="f-input" onchange="updateCategoryOptions()"><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select></div>
            <div><label class="kpi-label">Kategori *</label><select id="fin-cat" class="f-input"></select></div>
            <div><label class="kpi-label">Metode</label><select id="fin-method" class="f-input"><option>Transfer Bank</option><option>QRIS</option><option>Tunai</option><option>EDC / Kartu</option><option>OTA / Marketplace</option><option>Lainnya</option></select></div>
            <div><label class="kpi-label">Dari / Ke</label><input type="text" id="fin-fromto" class="f-input" placeholder="Contoh: Tamu / Vendor / Staff"></div>
            <div style="grid-column:span 2"><label class="kpi-label">Jumlah (Rp) *</label><input type="number" id="fin-amount" class="f-input" placeholder="0" min="0"></div>
            <div style="grid-column:span 2"><label class="kpi-label">Catatan</label><textarea id="fin-note" class="f-input" placeholder="Catatan tambahan, opsional"></textarea></div>
        </div>`;
    openModal('Catat Transaksi Keuangan', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitFinanceAdd()">Simpan Transaksi</button>`);
    updateCategoryOptions();
}

function updateCategoryOptions() {
    const type = document.getElementById('fin-type')?.value || 'income';
    const cat = document.getElementById('fin-cat');
    if (!cat) return;
    cat.innerHTML = (FINANCE_CATEGORIES[type] || []).map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
}

function generateFinanceId(transactionType, transactionDateString) {
    const prefix = transactionType === 'expense' ? 'EXP' : 'INC';
    const parts = String(transactionDateString || '').split('-');
    if (parts.length !== 3) return `${prefix}-${Date.now().toString().slice(-6)}`;
    const idPrefix = `${prefix}-${parts[1]}${parts[2]}-`;
    const rows = transactionType === 'expense' ? EXPENSE : INCOME;
    const existing = rows.map(tx => String(readField(tx, ['id', 'ID', 'Id'], '')).trim()).filter(id => id.startsWith(idPrefix)).map(id => parseInt(id.slice(idPrefix.length), 10)).filter(Number.isFinite);
    return `${idPrefix}${String(existing.length ? Math.max(...existing) + 1 : 1).padStart(3, '0')}`;
}

function submitFinanceAdd() {
    const desc = document.getElementById('fin-desc').value.trim();
    const date = document.getElementById('fin-date').value;
    const cat = document.getElementById('fin-cat').value.trim() || '-';
    const type = document.getElementById('fin-type').value;
    const method = document.getElementById('fin-method').value.trim() || '-';
    const fromTo = document.getElementById('fin-fromto').value.trim() || '-';
    const note = document.getElementById('fin-note').value.trim();
    const amount = parseInt(document.getElementById('fin-amount').value, 10) || 0;
    
    if (!desc || !date || amount <= 0) return showToast('Keterangan, tanggal, dan jumlah wajib diisi!', 'error');
    
    const id = generateFinanceId(type, date);
    const typeCode = type === 'income' ? 'in' : 'out';
    const newTx = { 
        id, ID:id, tanggal:date, tgl:date, Tgl:date, 
        keterangan:desc, ket:desc, Ket:desc, 
        kategori:cat, kat:cat, Kat:cat, 
        metode:method, Metode:method, 
        jumlah:amount, jml:amount, Jml:amount, 
        dariKe:fromTo, DariKe:fromTo, 
        tipe:typeCode, Tipe:typeCode, 
        catatan:note, Catatan:note, 
        timestamp:new Date().toISOString() 
    };

    if (type === 'income') {
        INCOME.unshift(newTx);
        if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Keuangan', aksi: 'Tambah Pemasukan', refId: id, lama: '-', baru: fmt(amount), catatan: desc });
        if (typeof apiSaveIncome === 'function') apiSaveIncome(newTx).then(res => { res.success ? showToast(`Pemasukan ${id} berhasil dicatat!`) : showToast('Gagal menyimpan data', 'error'); });
    } else {
        EXPENSE.unshift(newTx);
        if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Keuangan', aksi: 'Tambah Pengeluaran', refId: id, lama: '-', baru: fmt(amount), catatan: desc });
        if (typeof apiSaveExpense === 'function') apiSaveExpense(newTx).then(res => { res.success ? showToast(`Pengeluaran ${id} berhasil dicatat!`) : showToast('Gagal menyimpan data', 'error'); });
    }
    
    if(typeof refreshAllViews === 'function') refreshAllViews();
    closeModal();
}

function getCurrentCashBalance() {
    const income = INCOME.map(i => normalizeFinanceTx(i, 'income')).reduce((s, i) => s + i.jumlah, 0);
    const expense = EXPENSE.map(e => normalizeFinanceTx(e, 'expense')).reduce((s, e) => s + e.jumlah, 0);
    return income - expense;
}

function openCashAdjust() {
    if (typeof requireAction === 'function' && !requireAction('finance', 'Role ini tidak boleh mengubah saldo kas.')) return;
    const today = new Date().toISOString().split('T')[0];
    const saldo = getCurrentCashBalance();
    
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div style="grid-column:span 2;padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr)">
                <div class="kpi-label">Saldo Sistem Saat Ini</div>
                <div style="font-size:24px;font-family:'Playfair Display',serif;color:var(--mossLL)">${fmt(saldo)}</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px">Masukkan saldo kas real. Sistem akan mencatat selisihnya sebagai koreksi kas.</div>
            </div>
            <div><label class="kpi-label">Tanggal Koreksi *</label><input type="date" id="cash-date" value="${today}" class="f-input"></div>
            <div><label class="kpi-label">Metode / Akun Kas *</label><select id="cash-method" class="f-input"><option>Kas Tunai</option><option>Bank Transfer</option><option>QRIS</option><option>E-Wallet</option><option>Lainnya</option></select></div>
            <div style="grid-column:span 2"><label class="kpi-label">Saldo Kas Real *</label><input type="number" id="cash-target" class="f-input" placeholder="Contoh: 1500000" min="0"></div>
            <div style="grid-column:span 2"><label class="kpi-label">Catatan</label><textarea id="cash-note" class="f-input" placeholder="Contoh: Saldo awal kas, hasil opname kas, atau koreksi pembukuan"></textarea></div>
        </div>`;
    
    openModal('Input Manual Kas', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitCashAdjust()">Simpan Saldo Kas</button>`);
}

function submitCashAdjust() {
    const date = document.getElementById('cash-date').value;
    const method = document.getElementById('cash-method').value;
    const target = Number(document.getElementById('cash-target').value) || 0;
    const note = document.getElementById('cash-note').value.trim();
    
    if (!date || target < 0) return showToast('Tanggal dan saldo kas wajib diisi dengan benar!', 'error');
    
    const current = getCurrentCashBalance();
    const diff = target - current;
    
    if (diff === 0) { closeModal(); return showToast('Saldo kas sudah sama. Tidak ada koreksi yang dicatat.'); }
    
    const type = diff > 0 ? 'income' : 'expense';
    const id = generateFinanceId(type, date);
    const amount = Math.abs(diff);
    const typeCode = type === 'income' ? 'in' : 'out';
    const desc = diff > 0 ? 'Penyesuaian Saldo Kas' : 'Koreksi Selisih Kas';
    const fullNote = `Saldo kas diset manual menjadi ${fmt(target)}. Saldo sistem sebelumnya ${fmt(current)}. ${note}`;
    
    const tx = { 
        id, ID:id, tanggal:date, tgl:date, Tgl:date, 
        keterangan:desc, ket:desc, Ket:desc, 
        kategori:'Saldo Awal / Koreksi Kas', kat:'Saldo Awal / Koreksi Kas', Kat:'Saldo Awal / Koreksi Kas', 
        metode:method, Metode:method, 
        jumlah:amount, jml:amount, Jml:amount, 
        dariKe:'Input Manual Kas', DariKe:'Input Manual Kas', 
        tipe:typeCode, Tipe:typeCode, 
        catatan:fullNote, Catatan:fullNote, timestamp:new Date().toISOString() 
    };

    if (type === 'income') { 
        INCOME.unshift(tx); 
        if(typeof apiSaveIncome === 'function') apiSaveIncome(tx).then(res => res.success ? showToast(`Saldo kas berhasil disesuaikan: ${id}`) : showToast('Gagal menyimpan koreksi kas', 'error')); 
    } else { 
        EXPENSE.unshift(tx); 
        if(typeof apiSaveExpense === 'function') apiSaveExpense(tx).then(res => res.success ? showToast(`Saldo kas berhasil disesuaikan: ${id}`) : showToast('Gagal menyimpan koreksi kas', 'error')); 
    }
    
    if(typeof refreshAllViews === 'function') refreshAllViews();
    closeModal();
}

// ── CASH RECONCILIATION ─────────────────────────────────────
let CASH_RECONCILIATIONS = JSON.parse(localStorage.getItem('cascade_cash_reconciliations') || '[]');

function saveCashReconciliationsLocal() {
    localStorage.setItem('cascade_cash_reconciliations', JSON.stringify(CASH_RECONCILIATIONS));
}

function generateCashReconId(dateStr) {
    const parts = String(dateStr || '').split('-');
    if (parts.length !== 3) return 'CR-' + Date.now().toString().slice(-6);
    const prefix = `CR-${parts[1]}${parts[2]}-`;
    const existing = CASH_RECONCILIATIONS.map(r => String(r.id || '')).filter(id => id.startsWith(prefix)).map(id => parseInt(id.slice(prefix.length), 10)).filter(Number.isFinite);
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
}

function getFinanceRowsUntilDate(dateStr) {
    const income = (INCOME || []).map(i => normalizeFinanceTx(i, 'income')).filter(i => i.tanggal && i.tanggal <= dateStr);
    const expense = (EXPENSE || []).map(e => normalizeFinanceTx(e, 'expense')).filter(e => e.tanggal && e.tanggal <= dateStr);
    return { income, expense };
}

function getFinanceRowsOnDate(dateStr) {
    const income = (INCOME || []).map(i => normalizeFinanceTx(i, 'income')).filter(i => i.tanggal === dateStr);
    const expense = (EXPENSE || []).map(e => normalizeFinanceTx(e, 'expense')).filter(e => e.tanggal === dateStr);
    return { income, expense };
}

function getSystemBalanceUntilDate(dateStr) {
    const rows = getFinanceRowsUntilDate(dateStr);
    const totalIncome = rows.income.reduce((sum, i) => sum + normalizeAmount(i.jumlah), 0);
    const totalExpense = rows.expense.reduce((sum, e) => sum + normalizeAmount(e.jumlah), 0);
    return totalIncome - totalExpense;
}

function getPreviousCashClose(dateStr) {
    const prev = CASH_RECONCILIATIONS.filter(r => String(r.tanggal || '') < dateStr).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))[0];
    return prev || null;
}

function getCashReconciliationSummary(dateStr) {
    const dayRows = getFinanceRowsOnDate(dateStr);
    const pemasukan = dayRows.income.reduce((sum, i) => sum + normalizeAmount(i.jumlah), 0);
    const pengeluaran = dayRows.expense.reduce((sum, e) => sum + normalizeAmount(e.jumlah), 0);
    const saldoSistem = getSystemBalanceUntilDate(dateStr);
    const prevClose = getPreviousCashClose(dateStr);
    const saldoAwal = prevClose ? normalizeAmount(prevClose.saldoFisik) : saldoSistem - pemasukan + pengeluaran;

    return { saldoAwal, pemasukan, pengeluaran, saldoSistem };
}

function openCashReconcile() {
    if (typeof requireAction === 'function' && !requireAction('finance', 'Role ini tidak boleh mengubah saldo kas.')) return;
    const today = new Date().toISOString().split('T')[0];
    const s = getCashReconciliationSummary(today);
    const adminName = typeof getCurrentAdminName === 'function' ? getCurrentAdminName() : 'Admin';

    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div><label class="kpi-label">Tanggal Tutup Kas *</label><input type="date" id="recon-date" value="${today}" class="f-input" onchange="refreshCashReconcilePreview()"></div>
            <div><label class="kpi-label">Admin</label><input type="text" id="recon-admin" value="${escapeHTML(adminName)}" class="f-input"></div>
            
            <div style="grid-column:span 2;padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div><div class="kpi-label">Saldo Awal</div><div id="recon-saldo-awal" style="font-weight:700;">${fmt(s.saldoAwal)}</div></div>
                    <div><div class="kpi-label">Pemasukan Hari Ini</div><div id="recon-income" style="font-weight:700;color:var(--mossLL);">${fmt(s.pemasukan)}</div></div>
                    <div><div class="kpi-label">Pengeluaran Hari Ini</div><div id="recon-expense" style="font-weight:700;color:var(--red);">${fmt(s.pengeluaran)}</div></div>
                    <div><div class="kpi-label">Saldo Sistem</div><div id="recon-system" style="font-weight:700;color:var(--mossL);">${fmt(s.saldoSistem)}</div></div>
                </div>
            </div>

            <div><label class="kpi-label">Saldo Fisik / Saldo Real *</label><input type="number" id="recon-physical" class="f-input" value="${s.saldoSistem}" min="0" oninput="refreshCashReconcileDifference()"></div>
            <div><label class="kpi-label">Selisih</label><input type="text" id="recon-diff-label" class="f-input" value="Rp 0" readonly></div>
            
            <div style="grid-column:span 2;">
                <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--txt2);">
                    <input type="checkbox" id="recon-create-adjustment">
                    Buat transaksi koreksi otomatis jika ada selisih
                </label>
                <div style="font-size:11px;color:var(--txt3);margin-top:4px;">Jika dicentang, selisih kas akan otomatis masuk ke halaman Keuangan sebagai koreksi kas.</div>
            </div>
            <div style="grid-column:span 2;"><label class="kpi-label">Catatan</label><textarea id="recon-note" class="f-input" placeholder="Contoh: Kas cocok, selisih karena pembulatan..."></textarea></div>
        </div>
    `;

    openModal('Tutup Kas Harian', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitCashReconcile()">Simpan Tutup Kas</button>`);
    refreshCashReconcileDifference();
}

function refreshCashReconcilePreview() {
    const dateStr = document.getElementById('recon-date')?.value;
    if (!dateStr) return;

    const s = getCashReconciliationSummary(dateStr);
    if (document.getElementById('recon-saldo-awal')) document.getElementById('recon-saldo-awal').textContent = fmt(s.saldoAwal);
    if (document.getElementById('recon-income')) document.getElementById('recon-income').textContent = fmt(s.pemasukan);
    if (document.getElementById('recon-expense')) document.getElementById('recon-expense').textContent = fmt(s.pengeluaran);
    if (document.getElementById('recon-system')) document.getElementById('recon-system').textContent = fmt(s.saldoSistem);
    if (document.getElementById('recon-physical')) document.getElementById('recon-physical').value = s.saldoSistem;

    refreshCashReconcileDifference();
}

function refreshCashReconcileDifference() {
    const dateStr = document.getElementById('recon-date')?.value;
    const physical = Number(document.getElementById('recon-physical')?.value || 0);
    if (!dateStr) return;

    const s = getCashReconciliationSummary(dateStr);
    const diff = physical - s.saldoSistem;
    const diffLabel = document.getElementById('recon-diff-label');
    
    if (diffLabel) {
        diffLabel.value = fmt(diff);
        diffLabel.style.color = diff === 0 ? 'var(--mossLL)' : 'var(--red)';
        diffLabel.style.fontWeight = '700';
    }
}

function submitCashReconcile() {
    const dateStr = document.getElementById('recon-date')?.value;
    const admin = document.getElementById('recon-admin')?.value.trim() || (typeof getCurrentAdminName === 'function' ? getCurrentAdminName() : 'Admin');
    const physical = Number(document.getElementById('recon-physical')?.value || 0);
    const note = document.getElementById('recon-note')?.value.trim() || '';
    const createAdjustment = document.getElementById('recon-create-adjustment')?.checked || false;

    if (!dateStr) return showToast('Tanggal tutup kas wajib diisi!', 'error');
    if (physical < 0) return showToast('Saldo fisik tidak boleh minus!', 'error');

    const s = getCashReconciliationSummary(dateStr);
    const diff = physical - s.saldoSistem;

    const existingSameDate = CASH_RECONCILIATIONS.find(r => r.tanggal === dateStr);
    if (existingSameDate && !confirm('Tanggal ini sudah pernah ditutup. Simpan rekonsiliasi baru untuk tanggal yang sama?')) return;

    const id = generateCashReconId(dateStr);
    const status = diff === 0 ? 'Cocok' : 'Selisih';

    const recon = {
        id, ID: id, tanggal: dateStr, Tanggal: dateStr,
        saldoAwal: s.saldoAwal, SaldoAwal: s.saldoAwal,
        pemasukan: s.pemasukan, Pemasukan: s.pemasukan,
        pengeluaran: s.pengeluaran, Pengeluaran: s.pengeluaran,
        saldoSistem: s.saldoSistem, SaldoSistem: s.saldoSistem,
        saldoFisik: physical, SaldoFisik: physical,
        selisih: diff, Selisih: diff,
        status, Status: status,
        admin, Admin: admin,
        catatan: note, Catatan: note,
        timestamp: new Date().toISOString(), Timestamp: new Date().toISOString()
    };

    CASH_RECONCILIATIONS.unshift(recon);
    saveCashReconciliationsLocal();

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Keuangan', aksi: 'Tutup Kas Harian', refId: id, lama: fmt(s.saldoSistem), baru: fmt(physical), catatan: `Tanggal ${dateStr}; Selisih ${fmt(diff)}` });
    }

    if (createAdjustment && diff !== 0) createCashReconcileAdjustment(recon);

    if (typeof apiSaveCashReconciliation === 'function') {
        apiSaveCashReconciliation(recon).then(res => {
            if (!res.success) showToast('Tutup kas tersimpan lokal, tetapi gagal ke database online', 'error');
        });
    }

    closeModal();
    if(typeof refreshAllViews === 'function') refreshAllViews();
    renderCashReconciliationTable();
    showToast(`Tutup kas ${id} berhasil disimpan`);
}

function createCashReconcileAdjustment(recon) {
    const diff = normalizeAmount(recon.selisih);
    if (diff === 0) return;

    const type = diff > 0 ? 'income' : 'expense';
    const amount = Math.abs(diff);
    const txId = generateFinanceId(type, recon.tanggal);
    const typeCode = type === 'income' ? 'in' : 'out';
    const desc = diff > 0 ? 'Koreksi Selisih Kas Lebih' : 'Koreksi Selisih Kas Kurang';
    const note = `Otomatis dari rekonsiliasi kas ${recon.id}. Saldo sistem ${fmt(recon.saldoSistem)}, saldo fisik ${fmt(recon.saldoFisik)}. ${recon.catatan || ''}`;

    const tx = {
        id: txId, ID: txId, tanggal: recon.tanggal, tgl: recon.tanggal, Tgl: recon.tanggal,
        keterangan: desc, ket: desc, Ket: desc,
        kategori: 'Saldo Awal / Koreksi Kas', kat: 'Saldo Awal / Koreksi Kas', Kat: 'Saldo Awal / Koreksi Kas',
        metode: 'Rekonsiliasi Kas', Metode: 'Rekonsiliasi Kas',
        jumlah: amount, jml: amount, Jml: amount,
        dariKe: recon.id, DariKe: recon.id,
        tipe: typeCode, Tipe: typeCode,
        catatan: note, Catatan: note, timestamp: new Date().toISOString()
    };

    if (type === 'income') {
        INCOME.unshift(tx);
        if(typeof apiSaveIncome === 'function') apiSaveIncome(tx).then(res => { if (!res.success) showToast('Koreksi kas gagal disimpan ke database', 'error'); });
    } else {
        EXPENSE.unshift(tx);
        if(typeof apiSaveExpense === 'function') apiSaveExpense(tx).then(res => { if (!res.success) showToast('Koreksi kas gagal disimpan ke database', 'error'); });
    }

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Keuangan', aksi: 'Koreksi Otomatis Rekonsiliasi', refId: txId, lama: '-', baru: fmt(amount), catatan: recon.id });
    }
}

function renderCashReconciliationTable() {
    const tbody = document.getElementById('cash-recon-tbody');
    if (!tbody) return;

    if (!CASH_RECONCILIATIONS.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--txt3);">Belum ada rekonsiliasi kas.</td></tr>`;
        return;
    }

    tbody.innerHTML = CASH_RECONCILIATIONS.slice(0, 60).map(r => {
        const diff = normalizeAmount(r.selisih);
        const statusColor = diff === 0 ? 'var(--mossLL)' : 'var(--red)';
        return `
            <tr>
                <td style="font-family:monospace;color:var(--mossL)">${escapeHTML(r.id)}</td>
                <td>${fmtDate(r.tanggal)}</td>
                <td>${fmt(r.pemasukan)}</td>
                <td>${fmt(r.pengeluaran)}</td>
                <td>${fmt(r.saldoSistem)}</td>
                <td>${fmt(r.saldoFisik)}</td>
                <td style="font-weight:700;color:${statusColor};">${fmt(diff)}</td>
                <td><strong style="color:${statusColor};">${escapeHTML(r.status)}</strong></td>
                <td>${escapeHTML(r.admin || '-')}</td>
            </tr>
        `;
    }).join('');
}

// ── EXPENSE VOUCHER ─────────────────────────────────────────
function getExpenseById(id) {
    return (EXPENSE || []).map(e => normalizeFinanceTx(e, 'expense')).find(e => String(e.id) === String(id));
}

function printExpenseVoucher(id) {
    if (typeof requireAction === 'function' && !requireAction('finance', 'Role ini tidak boleh mencetak voucher pengeluaran.')) return;

    const tx = getExpenseById(id);
    if (!tx) return showToast('Data pengeluaran tidak ditemukan', 'error');

    const voucherNo = `VCR-${tx.id}`;
    const printedAt = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const adminName = typeof getCurrentAdminName === 'function' ? getCurrentAdminName() : 'Admin';

    const voucherHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"><title>${escapeHTML(voucherNo)}</title>
<style>
@page { size: A4; margin: 14mm; } * { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #1f2a1f; background: #ffffff; font-size: 12px; line-height: 1.45; }
.voucher { border: 2px solid #2e4820; padding: 20px; min-height: 260mm; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2e4820; padding-bottom: 16px; margin-bottom: 18px; }
.brand h1 { margin: 0; color: #2e4820; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 28px; font-style: italic; font-weight: 400; }
.brand .sub { font-size: 10px; letter-spacing: 2px; color: #4e7038; text-transform: uppercase; }
.title { text-align: right; } .title h2 { margin: 0 0 8px; font-size: 22px; color: #2e4820; } .title div { margin: 2px 0; }
.section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #4e7038; font-weight: 700; border-bottom: 1px solid #d7dfcf; padding-bottom: 6px; margin: 18px 0 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.box { border: 1px solid #d7dfcf; border-radius: 10px; padding: 12px 14px; background: #fbfcf7; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed #e4eadc; } .row:last-child { border-bottom: 0; }
.label { color: #6f7f63; } .value { font-weight: 700; text-align: right; }
.amount-box { margin-top: 18px; border: 2px solid #2e4820; border-radius: 12px; padding: 16px; background: #f6f8f1; display: flex; justify-content: space-between; align-items: center; }
.amount-label { font-size: 13px; color: #4e7038; font-weight: 700; text-transform: uppercase; } .amount-value { font-size: 26px; font-weight: 700; color: #c05040; }
.note { margin-top: 18px; min-height: 80px; padding: 12px 14px; border-radius: 10px; background: #fbfcf7; border: 1px solid #d7dfcf; color: #4f5f4a; }
.signatures { margin-top: 48px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; text-align: center; }
.sign-box { min-height: 120px; } .sign-title { font-weight: 700; color: #2e4820; } .sign-space { height: 68px; } .sign-line { border-top: 1px solid #8f9f86; padding-top: 6px; font-size: 11px; }
.footer-note { margin-top: 26px; font-size: 10px; color: #6f7f63; border-top: 1px solid #d7dfcf; padding-top: 10px; }
.actions { position: fixed; right: 18px; bottom: 18px; display: flex; gap: 10px; } .actions button { border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer; font-weight: 700; }
.print { background: #4e7038; color: white; } .close { background: #e8dcc8; color: #2e2418; }
@media print { .actions { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="voucher">
    <div class="header">
        <div class="brand"><h1>Cascade</h1><div class="sub">Cabin & Camp</div><p>Voucher internal pengeluaran kas/bank</p></div>
        <div class="title"><h2>VOUCHER PENGELUARAN</h2><div>No Voucher: <strong>${escapeHTML(voucherNo)}</strong></div><div>ID Transaksi: <strong>${escapeHTML(tx.id)}</strong></div><div>Tanggal Cetak: <strong>${escapeHTML(printedAt)}</strong></div></div>
    </div>
    <div class="section-title">Informasi Transaksi</div>
    <div class="grid">
        <div class="box"><div class="row"><span class="label">Tanggal Transaksi</span><span class="value">${fmtDate(tx.tanggal)}</span></div><div class="row"><span class="label">Kategori</span><span class="value">${escapeHTML(tx.kategori || '-')}</span></div><div class="row"><span class="label">Metode Pembayaran</span><span class="value">${escapeHTML(tx.metode || '-')}</span></div></div>
        <div class="box"><div class="row"><span class="label">Dibayarkan Kepada</span><span class="value">${escapeHTML(tx.dariKe || '-')}</span></div><div class="row"><span class="label">Dibuat Oleh</span><span class="value">${escapeHTML(adminName)}</span></div><div class="row"><span class="label">Status Dokumen</span><span class="value">Untuk Audit Internal</span></div></div>
    </div>
    <div class="section-title">Rincian Pengeluaran</div>
    <div class="box"><div class="row"><span class="label">Keterangan</span><span class="value">${escapeHTML(tx.keterangan || '-')}</span></div><div class="row"><span class="label">Catatan</span><span class="value">${escapeHTML(tx.catatan || '-')}</span></div></div>
    <div class="amount-box"><div><div class="amount-label">Total Pengeluaran</div><div style="font-size:11px;color:#6f7f63;margin-top:4px;">Jumlah dana yang dibayarkan</div></div><div class="amount-value">${fmt(tx.jumlah)}</div></div>
    <div class="note"><strong>Catatan Audit:</strong><br>Voucher ini merupakan bukti internal atas transaksi pengeluaran. Lampirkan nota, invoice vendor, bukti transfer, atau dokumen pendukung lain jika tersedia.</div>
    <div class="signatures">
        <div class="sign-box"><div class="sign-title">Dibuat Oleh</div><div class="sign-space"></div><div class="sign-line">Admin</div></div>
        <div class="sign-box"><div class="sign-title">Diperiksa Oleh</div><div class="sign-space"></div><div class="sign-line">Finance</div></div>
        <div class="sign-box"><div class="sign-title">Disetujui Oleh</div><div class="sign-space"></div><div class="sign-line">Owner</div></div>
        <div class="sign-box"><div class="sign-title">Diterima Oleh</div><div class="sign-space"></div><div class="sign-line">Penerima Dana</div></div>
    </div>
    <div class="footer-note">Dicetak dari sistem admin Cascade Cabin & Camp. Simpan voucher ini bersama bukti transaksi asli untuk keperluan audit dan rekonsiliasi.</div>
</div>
<div class="actions"><button class="close" onclick="window.close()">Tutup</button><button class="print" onclick="window.print()">Print / Save PDF</button></div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body></html>
    `;

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Keuangan', aksi: 'Cetak Voucher Pengeluaran', refId: tx.id, lama: '-', baru: voucherNo, catatan: tx.keterangan || '-' });
    }

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return showToast('Popup diblokir browser. Izinkan popup untuk mencetak voucher.', 'error');
    win.document.open();
    win.document.write(voucherHtml);
    win.document.close();
}