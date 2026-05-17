/* ============================================================
   js/booking.js — Manajemen Reservasi, Rombongan, & Invoice
   ============================================================ */

// ── BOOKING HELPERS ─────────────────────────────────────────
function normalizeBooking(b) {
    const total = normalizeAmount(readField(b, ['total', 'Total', 'harga', 'Harga'], 0));
    const dp = normalizeAmount(readField(b, ['dp', 'DP', 'Dp'], Math.round(total / 2)));
    const checkin = normalizeDate(readField(b, ['tglIn', 'TglIn', 'checkin', 'Checkin', 'Check-in', 'Check In', 'tgl_in', 'Tanggal In'], ''));
    const checkout = normalizeDate(readField(b, ['tglOut', 'TglOut', 'checkout', 'Checkout', 'Check-out', 'Check Out', 'tgl_out', 'Tanggal Out'], ''));

    return {
        raw: b,
        id: String(readField(b, ['id', 'ID', 'Id', 'kode', 'Kode'], '')).trim(),
        nama: String(readField(b, ['nama', 'Nama', 'name', 'Name', 'tamu', 'Tamu'], '-')).trim(),
        wa: String(readField(b, ['wa', 'WA', 'WhatsApp', 'Whatsapp', 'No WA', 'No. HP', 'hp', 'HP', 'phone'], '')).trim(),
        email: String(readField(b, ['email', 'Email'], '')).trim(),
        kota: String(readField(b, ['kota', 'Kota', 'asal', 'Asal'], '-')).trim(),
        checkin,
        checkout,
        unit: String(readField(b, ['unit', 'Unit', 'tipeUnit', 'Tipe Unit', 'kamar', 'Kamar'], '-')).trim(),
        unitAssigned: String(readField(b, ['unitAssigned', 'UnitAssigned', 'assignedUnit', 'AssignedUnit', 'kodeUnit', 'KodeUnit', 'unitFisik', 'UnitFisik'], '')).trim(),
        guests: Number(readField(b, ['guests', 'tamu', 'Tamu', 'jumlahTamu', 'Jumlah Tamu'], 0)) || 0,
        total,
        dp,
        stBayar: String(readField(b, ['stBayar', 'Status Bayar', 'statusBayar', 'Bayar', 'bayar'], 'Belum')).trim() || 'Belum',
		deposit: normalizeAmount(readField(b, ['deposit', 'Deposit'], 0)),
        stDeposit: String(readField(b, ['stDeposit', 'StDeposit'], 'Belum')).trim() || 'Belum',
        stTamu: String(readField(b, ['stTamu', 'Status Tamu', 'statusTamu', 'Status', 'status'], 'Konfirmasi')).trim() || 'Konfirmasi',
        catatan: String(readField(b, ['catatan', 'Catatan', 'note', 'Note'], '')).trim(),
        sumber: String(readField(b, ['sumber', 'Sumber', 'source'], '')).trim(),
        timestamp: readField(b, ['timestamp', 'Timestamp', 'createdAt'], '')
    };
}

function getBookings() { return BOOKINGS.map(normalizeBooking).filter(b => b.id); }
function isCancelled(b) { return String(b.stTamu || '').toLowerCase() === 'dibatalkan'; }
function isActiveGuestStatus(b) {
    const s = String(b.stTamu || '').toLowerCase();
    return s === 'konfirmasi' || s === 'check-in';
}
function isDateInStay(dateStr, b) {
    if (!b.checkin) return false;
    if (!b.checkout) return b.checkin === dateStr;
    return dateStr >= b.checkin && dateStr < b.checkout;
}

// ── BOOKING & FINANCE SYNC HELPERS ──────────────────────────
function normalizeKey(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function getIncomeRows() { return (INCOME || []).map(tx => normalizeFinanceTx(tx, 'income')).filter(tx => tx.tipe === 'income'); }
function getExpenseRows() { return (EXPENSE || []).map(tx => normalizeFinanceTx(tx, 'expense')).filter(tx => tx.tipe === 'expense'); }

function financeText(tx) { return normalizeKey([tx.id, tx.keterangan, tx.kategori, tx.metode, tx.dariKe, tx.catatan].join(' ')); }
function isBookingPaymentTx(tx) { return financeText(tx).includes('booking') || normalizeKey(tx.kategori).includes('bookingpenginapan'); }

function financeTxMatchesBooking(tx, booking) {
    const text = financeText(tx);
    const bookingId = normalizeKey(booking.id);
    const guestName = normalizeKey(booking.nama);
    if (bookingId && text.includes(bookingId)) return true;
    if (guestName && text.includes(guestName)) return true;
    return false;
}

function getPaidAmountForBooking(booking) {
    const rows = getIncomeRows().filter(tx => isBookingPaymentTx(tx) && financeTxMatchesBooking(tx, booking));
    return rows.reduce((sum, tx) => sum + normalizeAmount(tx.jumlah), 0);
}

function getBookingPaymentStatus(booking) {
    const manualStatus = String(booking.stBayar || 'Belum').trim();
    const manualLower = manualStatus.toLowerCase();
    const paid = getPaidAmountForBooking(booking);
    const total = normalizeAmount(booking.total);
    const dpMinimum = Math.round(total * 0.5);

    if (manualLower === 'lunas') return 'Lunas';
    if (total > 0 && paid >= total) return 'Lunas';
    if (paid > 0 && paid >= dpMinimum) return 'DP / Sebagian';
    if (paid > 0 && paid < dpMinimum) return 'DP Kurang';
    if (manualLower.includes('dp')) return 'DP / Sebagian';
    return 'Belum';
}

function getCurrentMonthIncomeFromFinance() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    return getIncomeRows().reduce((sum, tx) => {
        const tgl = normalizeDate(tx.tanggal);
        if (!tgl) return sum;
        const d = new Date(`${tgl}T00:00:00`);
        if (isNaN(d.getTime())) return sum;
        if (d.getFullYear() === y && d.getMonth() === m) return sum + normalizeAmount(tx.jumlah);
        return sum;
    }, 0);
}

function getCurrentMonthIncomeFromBookingStatus(bookings) {
    const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1), monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return bookings.reduce((sum, b) => {
        const d = new Date((b.checkin || '') + 'T00:00:00');
        if (isNaN(d.getTime()) || d < monthStart || d > monthEnd || isCancelled(b)) return sum;
        const status = getBookingPaymentStatus(b);
        if (status === 'Lunas') return sum + normalizeAmount(b.total);
        if (status.includes('DP')) return sum + (normalizeAmount(b.dp) || Math.round(normalizeAmount(b.total) / 2));
        return sum;
    }, 0);
}

function syncBookingPaymentStatusesFromFinance() {
    (BOOKINGS || []).forEach(row => {
        const b = normalizeBooking(row);
        if (!b.id) return;
        const computed = getBookingPaymentStatus(b);
        if (computed !== 'Belum') {
            row.stBayar = computed;
            row['Status Bayar'] = computed;
            row.Bayar = computed;
        }
    });
}

function createFinancePaymentForBooking(booking, status) {
    const currentPaid = getPaidAmountForBooking(booking);
    const total = normalizeAmount(booking.total);
    const dp = normalizeAmount(booking.dp) || Math.round(total / 2);
    let targetPaid = 0;

    if (String(status).toLowerCase() === 'lunas') targetPaid = total;
    else if (String(status).toLowerCase().includes('dp')) targetPaid = dp;
    else return;

    const amountToRecord = Math.max(0, targetPaid - currentPaid);
    if (!amountToRecord) return;

    const today = new Date().toISOString().split('T')[0];
    const id = typeof generateFinanceId === 'function' ? generateFinanceId('income', today) : 'INC-' + Date.now().toString().slice(-6);

    const desc = `Booking ${booking.nama}`;
    const note = `Otomatis dari perubahan status bayar booking ${booking.id}. Unit: ${booking.unit}.`;
    const newTx = {
        id, ID: id, tanggal: today, tgl: today, Tgl: today,
        keterangan: desc, ket: desc, Ket: desc,
        kategori: 'Booking Penginapan', kat: 'Booking Penginapan', Kat: 'Booking Penginapan',
        metode: 'Manual Admin', Metode: 'Manual Admin',
        jumlah: amountToRecord, jml: amountToRecord, Jml: amountToRecord,
        dariKe: booking.id, DariKe: booking.id,
        tipe: 'in', Tipe: 'in',
        catatan: note, Catatan: note, timestamp: new Date().toISOString()
    };

    INCOME.unshift(newTx);
    if (typeof apiSaveIncome === 'function') apiSaveIncome(newTx).catch(err => console.error(err));
}

// ── UI RENDERING: BOOKING TABLE ─────────────────────────────
function renderBookingTable() {
    const tbody = document.getElementById('booking-tbody');
    if (!tbody) return;
    const q = (document.getElementById('booking-search')?.value || '').toLowerCase();
    const bookings = getBookings().filter(b => !q || b.nama.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));

    if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada data reservasi.</td></tr>';
        return;
    }

    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td style="font-family:monospace;color:var(--mossL)">${escapeHTML(b.id)}</td>
            <td><strong>${escapeHTML(b.nama)}</strong><br><small>${escapeHTML(b.wa || '-')}</small></td>
            <td>${fmtDate(b.checkin)}</td>
            <td>${escapeHTML(b.unit)}</td>
            <td>${fmt(b.total)}</td>
            <td>${payPill(getBookingPaymentStatus(b))}</td>
            <td>${stPill(b.stTamu)}</td>
            <td><button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Detail</button></td>
        </tr>`).join('');
}

function filterBookings() { renderBookingTable(); }

function generateBookingId(checkinDateString) {
    const [year, month, day] = String(checkinDateString || '').split('-');
    if (!month || !day) return 'BK-' + Date.now().toString().slice(-6);
    const mmdd = `${month}${day}`;
    const prefix = `BK-${mmdd}-`;
    const existingNumbers = getBookings()
        .filter(b => b.checkin === checkinDateString && b.id.startsWith(prefix))
        .map(b => parseInt(b.id.slice(prefix.length), 10))
        .filter(Number.isFinite);
    const next = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
}

// ── QUICK ADD BOOKING ───────────────────────────────────────
function openQuickAdd() {
    if (typeof requireAction === 'function' && !requireAction('booking', 'Role ini tidak boleh menambah booking.')) return;
    const today = new Date().toISOString().split('T')[0];
    
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div><label class="kpi-label">Nama Lengkap *</label><input type="text" id="qa-nama" class="f-input" placeholder="Nama sesuai KTP"></div>
            <div><label class="kpi-label">WhatsApp *</label><input type="text" id="qa-wa" class="f-input" placeholder="08xxxxxxxx"></div>
            <div><label class="kpi-label">Email</label><input type="email" id="qa-email" class="f-input" placeholder="email@tamu.com"></div>
            <div><label class="kpi-label">Kota Asal</label><input type="text" id="qa-kota" class="f-input" placeholder="Contoh: Jakarta"></div>
            <div><label class="kpi-label">Check-in *</label><input type="date" id="qa-in" min="${today}" class="f-input" onchange="updateQuickAddAssignedUnits()"></div>
            <div><label class="kpi-label">Check-out *</label><input type="date" id="qa-out" min="${today}" class="f-input" onchange="updateQuickAddAssignedUnits()"></div>
            <div><label class="kpi-label">Tipe Unit *</label><select id="qa-unit" class="f-input" onchange="updateQuickAddAssignedUnits()">
                <option>Forest Tent</option>
                <option>Riverside Tent</option>
                <option>Cascading Riverside Tent</option>
                <option>Riverside Glamping</option>
            </select></div>
            <div><label class="kpi-label">Unit Fisik</label><select id="qa-unit-assigned" class="f-input"><option value="">Pilih tanggal dulu</option></select></div>
            <div><label class="kpi-label">Jumlah Tamu</label><input type="number" id="qa-tamu" value="2" class="f-input" min="1"></div>
            <div style="grid-column:span 2"><label class="kpi-label">Sumber Booking</label><select id="qa-sumber" class="f-input"><option>Admin Dashboard</option><option>WhatsApp</option><option>Direct Call</option><option>Instagram</option></select></div>
            <div style="grid-column:span 2"><label class="kpi-label">Catatan / Permintaan Khusus</label><textarea id="qa-catatan" class="f-input" placeholder="Catatan tambahan untuk tamu..."></textarea></div>
        </div>`;
    openModal('Tambah Reservasi Baru', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitQuickAdd()">Simpan Booking</button>`);
    setTimeout(updateQuickAddAssignedUnits, 100);
}

function updateQuickAddAssignedUnits() {
    const unitType = document.getElementById('qa-unit')?.value || '';
    const checkin = document.getElementById('qa-in')?.value || '';
    const checkout = document.getElementById('qa-out')?.value || '';
    const select = document.getElementById('qa-unit-assigned');

    if (!select) return;
    if (!unitType || !checkin || !checkout || checkout <= checkin) {
        select.innerHTML = `<option value="">Pilih tanggal valid dulu</option>`;
        return;
    }

    const availableUnits = getAvailableUnitsForBooking(unitType, checkin, checkout);
    if (!availableUnits.length) {
        select.innerHTML = `<option value="">Tidak ada unit tersedia</option>`;
        return;
    }
    select.innerHTML = availableUnits.map(u => `<option value="${escapeHTML(u.id)}">${escapeHTML(u.id)} - ${escapeHTML(u.name)}</option>`).join('');
}

function submitQuickAdd() {
    const nama = document.getElementById('qa-nama')?.value.trim();
    const wa = document.getElementById('qa-wa')?.value.trim();
    const email = document.getElementById('qa-email')?.value.trim();
    const kota = document.getElementById('qa-kota')?.value.trim();
    const tIn = document.getElementById('qa-in')?.value;
    const tOut = document.getElementById('qa-out')?.value;
    const unitType = document.getElementById('qa-unit')?.value;
    const unitAssigned = document.getElementById('qa-unit-assigned')?.value;
    const guests = Number(document.getElementById('qa-tamu')?.value || 2);
    const sumber = document.getElementById('qa-sumber')?.value || 'Admin Dashboard';
    const catatan = document.getElementById('qa-catatan')?.value.trim() || '';

    if (!nama || !wa || !tIn || !tOut || !unitType) return showToast('Nama, WA, Tanggal check-in/out, dan tipe unit wajib diisi.', 'error');
    if (new Date(tIn) >= new Date(tOut)) return showToast('Tanggal check-out harus lebih besar dari check-in.', 'error');

    const id = generateBookingId(tIn);
    const typeCode = getUnitTypeCodeFromName(unitType);
    const cfg = UNIT_TYPES[typeCode];
    if (!cfg) return showToast('Tipe unit tidak valid.', 'error');

    if (guests > cfg.capacity) {
        const isConfirm = confirm(`PERINGATAN KAPASITAS!\n\nJumlah tamu (${guests} orang) melebihi batas maksimal unit ${cfg.name} (Maksimal: ${cfg.capacity} orang).\n\nApakah Anda yakin memaksakan tamu ini masuk ke 1 tenda saja?\n(Pilih BATAL untuk menggunakan fitur + Rombongan jika butuh banyak tenda)`);
        if (!isConfirm) return;
    }

    let wd = 0, we = 0, rateNotes = [];
    let d = new Date(tIn + 'T00:00:00');
    const end = new Date(tOut + 'T00:00:00');

    while (d < end) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (isWeekendOrHoliday(dateStr)) {
            we++;
            const holiday = getHolidaySetting(dateStr);
            if (holiday) rateNotes.push(`${fmtDate(dateStr)}: ${holiday.name} ikut rate weekend`);
        } else {
            wd++;
        }
        d.setDate(d.getDate() + 1);
    }

    const total = wd * cfg.weekday + we * cfg.weekend;
    const holidayNote = rateNotes.length ? `Rate libur/high season: ${rateNotes.join('; ')}` : '';

    const newBk = {
        id, ID: id,
        nama, wa, email, kota,
        checkin: tIn, checkout: tOut,
        unit: typeCode, unitAssigned,
        guests, total,
        dp: Math.round(total / 2),
        stBayar: 'Belum', stTamu: 'Konfirmasi',
        catatan: [catatan, holidayNote].filter(Boolean).join(' | '),
        sumber, timestamp: new Date().toISOString()
    };

    BOOKINGS.push(newBk);
    if(typeof refreshAllViews === 'function') refreshAllViews();
    if(typeof showLoading === 'function') showLoading('Menyimpan Reservasi...');

    if (typeof apiSaveBooking === 'function') {
        apiSaveBooking(newBk).then(res => {
            if(typeof hideLoading === 'function') hideLoading();
            if (res.success) {
                showToast(`Booking ${id} berhasil disimpan!`);
                closeModal();
            } else {
                showToast(`Gagal menyimpan booking: ${res.message}`, 'error');
            }
        });
    } else {
        if(typeof hideLoading === 'function') hideLoading();
        showToast(`Booking ${id} berhasil disimpan (Lokal)!`);
        closeModal();
    }
}

// ── GROUP BOOKING HELPERS ───────────────────────────────────

// ── HELPER: CEK KETERSEDIAAN UNIT FISIK UNTUK ROMBONGAN ──
function isUnitIdBooked(unitId, checkin, checkout) {
    const activeBks = getBookings().filter(b => !isCancelled(b) && isActiveGuestStatus(b));
    return activeBks.some(b => {
        if (getBookingAssignedUnitId(b) === unitId) {
            // Cek apakah tanggalnya bentrok
            return isBookingOverlap(checkin, checkout, b.checkin, b.checkout);
        }
        return false;
    });
}

function getGroupId(b) {
    const match = String(b.catatan || '').match(/ROMBONGAN \[([^\]]+)\]/);
    return match ? match[1] : null;
}

function getGroupBookings(groupId) {
    if (!groupId) return [];
    return getBookings().filter(b => getGroupId(b) === groupId && !isCancelled(b));
}

function openGroupBooking() {
    if (typeof requireAction === 'function' && !requireAction('booking', 'Role ini tidak boleh menambah booking.')) return;
    const today = new Date().toISOString().split('T')[0];
    
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div style="grid-column:span 2;padding:12px;background:var(--bg3);border-radius:8px;font-size:12px;color:var(--txt2);">
                Masukkan jumlah tamu dan tanggal. Sistem akan otomatis memilihkan kombinasi unit yang tersedia.
            </div>
            <div><label class="kpi-label">Nama Perwakilan *</label><input type="text" id="grp-nama" class="f-input" placeholder="Nama Ketua Rombongan"></div>
            <div><label class="kpi-label">WhatsApp *</label><input type="text" id="grp-wa" class="f-input" placeholder="08xxxxxxxx"></div>
            <div><label class="kpi-label">Check-in *</label><input type="date" id="grp-in" min="${today}" class="f-input"></div>
            <div><label class="kpi-label">Check-out *</label><input type="date" id="grp-out" min="${today}" class="f-input"></div>
            <div><label class="kpi-label">Total Tamu (Orang) *</label><input type="number" id="grp-tamu" class="f-input" placeholder="Misal: 15" min="1"></div>
            <div><label class="kpi-label">Sumber</label><select id="grp-sumber" class="f-input"><option>Admin Dashboard</option><option>WhatsApp</option><option>Corporate</option></select></div>
            <div style="grid-column:span 2"><label class="kpi-label">Catatan Tambahan</label><textarea id="grp-catatan" class="f-input" placeholder="Misal: Rombongan kantor PT. XYZ"></textarea></div>
        </div>
    `;
    openModal('Booking Rombongan (Auto-Mapping)', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="reviewGroupBooking()">Cari & Petakan Unit</button>`);
}

function reviewGroupBooking() {
    const nama = document.getElementById('grp-nama')?.value.trim();
    const wa = document.getElementById('grp-wa')?.value.trim();
    const tIn = document.getElementById('grp-in')?.value;
    const tOut = document.getElementById('grp-out')?.value;
    const tamu = Number(document.getElementById('grp-tamu')?.value || 0);
    const sumber = document.getElementById('grp-sumber')?.value;
    const catatan = document.getElementById('grp-catatan')?.value.trim();

    if (!nama || !wa || !tIn || !tOut || tamu <= 0) return showToast('Data perwakilan, tanggal, dan jumlah tamu wajib diisi!', 'error');
    if (new Date(tIn) >= new Date(tOut)) return showToast('Tanggal check-out harus lebih besar!', 'error');

    let availableUnits = UNITS.filter(u => u.status === 'Ready' && !isUnitIdBooked(u.id, tIn, tOut));
    availableUnits.sort((a, b) => b.capacity - a.capacity);

    let selectedUnits = [], currentCapacity = 0;
    for (let u of availableUnits) {
        if (currentCapacity >= tamu) break;
        selectedUnits.push(u);
        currentCapacity += u.capacity;
    }

    if (currentCapacity < tamu) return showToast(`Unit tidak cukup! Hanya tersedia kapasitas untuk ${currentCapacity} orang.`, 'error');

    let wd = 0, we = 0, rateNotes = [];
    let d = new Date(tIn + 'T00:00:00');
    const end = new Date(tOut + 'T00:00:00');

    while (d < end) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (isWeekendOrHoliday(dateStr)) {
            we++;
            const holiday = getHolidaySetting(dateStr);
            if (holiday) rateNotes.push(`${fmtDate(dateStr)}`);
        } else {
            wd++;
        }
        d.setDate(d.getDate() + 1);
    }

    const durasiStr = `${wd + we} Malam (${wd} Weekday, ${we} Weekend)`;
    window._tempGroupBookingData = { nama, wa, tIn, tOut, tamu, sumber, catatan, wd, we, rateNotes };

    let totalHargaGrup = 0;
    const unitListHtml = selectedUnits.map(u => {
        const hrg = (wd * u.priceWeekday) + (we * u.priceWeekend);
        totalHargaGrup += hrg;
        return `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--bdr);">
                <div><strong>${u.id}</strong> - ${u.name} (Kap: ${u.capacity})</div>
                <div style="color:var(--mossL); font-weight:700;">${fmt(hrg)}</div>
            </div>`;
    }).join('');

    const body = `
        <div style="display:grid; gap:14px;">
            <div style="padding:14px; background:rgba(122,170,88,0.1); border:1px solid var(--mossL); border-radius:8px;">
                <div style="font-weight:700; color:var(--mossLL); font-size:16px;">Mapping Unit Berhasil!</div>
                <div style="font-size:13px; margin-top:4px;">Dibutuhkan <strong>${selectedUnits.length} Unit</strong> untuk cover ${tamu} tamu.<br>Total Kapasitas Ter-cover: <strong>${currentCapacity} orang</strong>.</div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">
                <div><div class="kpi-label">Perwakilan</div><strong>${escapeHTML(nama)}</strong></div>
                <div><div class="kpi-label">Durasi</div>${durasiStr}</div>
            </div>
            <div style="background:var(--bg2); border:1px solid var(--bdr); border-radius:8px; padding:12px;">
                <div class="kpi-label" style="margin-bottom:8px;">Unit yang Dialokasikan:</div>
                <div style="max-height:180px; overflow-y:auto; padding-right:10px;">${unitListHtml}</div>
                <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:12px; border-top:2px solid var(--bdr);">
                    <strong>Total Tagihan Rombongan</strong>
                    <strong style="color:var(--amber); font-size:16px;">${fmt(totalHargaGrup)}</strong>
                </div>
            </div>
        </div>
    `;

    openModal('Konfirmasi Rombongan', body, `<button class="btn-ghost" onclick="openGroupBooking()">Kembali Edit</button><button class="btn-primary" onclick='submitGroupBooking(${JSON.stringify(selectedUnits)})'>Proses & Simpan Semua</button>`);
}

function submitGroupBooking(selectedUnits) {
    const data = window._tempGroupBookingData;
    if (!data || !selectedUnits.length) return;

    closeModal();
    let bookingsToSave = [];
    const groupId = 'GRP-' + Date.now().toString().slice(-6);
    const holidayNote = data.rateNotes.length ? `Rate weekend/holiday tgl: ${data.rateNotes.join(', ')}` : '';
    const masterNote = `ROMBONGAN [${groupId}]: ${data.catatan} | Total ${data.tamu} org | ${holidayNote}`;

    for (let u of selectedUnits) {
        const id = generateBookingId(data.tIn); 
        const hrg = (data.wd * u.priceWeekday) + (data.we * u.priceWeekend);
        const newBk = {
            id, ID: id,
            nama: data.nama, wa: data.wa, email: '', kota: '',
            checkin: data.tIn, checkout: data.tOut,
            unit: u.typeCode, unitAssigned: u.id,
            guests: u.capacity, 
            total: hrg, dp: Math.round(hrg / 2),
            stBayar: 'Belum', stTamu: 'Konfirmasi',
            catatan: masterNote, sumber: data.sumber,
            timestamp: new Date().toISOString()
        };
        BOOKINGS.push(newBk);
        bookingsToSave.push(newBk);
    }

    if(typeof refreshAllViews === 'function') refreshAllViews();
    if(typeof showLoading === 'function') showLoading('Menyimpan Rombongan ke Database...');

    if (typeof apiSaveBooking === 'function') {
        const promises = bookingsToSave.map(bk => apiSaveBooking(bk));
        Promise.all(promises).then(() => {
            if(typeof hideLoading === 'function') hideLoading();
            showToast(`Sukses! ${selectedUnits.length} unit rombongan tersimpan.`);
        }).catch(() => {
            if(typeof hideLoading === 'function') hideLoading();
            showToast('Sebagian/seluruh data rombongan gagal disinkron ke cloud.', 'error');
        });
    } else {
        if(typeof hideLoading === 'function') hideLoading();
        showToast(`Sukses! ${selectedUnits.length} unit rombongan tersimpan (Lokal).`);
    }

    delete window._tempGroupBookingData;
}

// ── BOOKING DETAILS & ACTIONS ───────────────────────────────
function viewBookingDetail(id) {
    const b = getBookings().find(x => x.id === id);
    if (!b) return;
    const payStatus = getBookingPaymentStatus(b);
    const payInfo = getPaymentInfo(b);
    const groupId = getGroupId(b);

    let groupBanner = '';
    
    // UI Tambahan jika unit ini bagian dari Rombongan
    if (groupId) {
        const groupBks = getGroupBookings(groupId);
        const groupTotal = groupBks.reduce((s, bk) => s + normalizeAmount(bk.total), 0);
        const groupPaid = groupBks.reduce((s, bk) => s + getPaidAmountForBooking(bk), 0);
        
        groupBanner = `
        <div style="margin-bottom:20px;padding:16px;background:rgba(232,160,48,0.12);border:1px solid var(--amber);border-radius:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                    <div style="font-weight:700;color:var(--amber);margin-bottom:4px;font-size:15px;">Grup Rombongan: ${groupId}</div>
                    <div style="font-size:12px;color:var(--txt2);">
                        Booking ini adalah 1 dari <strong>${groupBks.length} unit</strong> rombongan.<br>
                        Total Tagihan: <strong style="color:var(--txt1)">${fmt(groupTotal)}</strong> | Terbayar: <strong style="color:var(--txt1)">${fmt(groupPaid)}</strong>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-primary" style="background:var(--amber);color:#111;font-weight:700;padding:8px 14px;" onclick="openGroupPaymentProof('${groupId}')">Bayar Rombongan</button>
                    <button class="btn-primary" style="background:transparent;color:var(--amber);border:1px solid var(--amber);font-weight:700;padding:8px 14px;" onclick="printGroupInvoice('${groupId}')">Invoice Rombongan</button>
                </div>
            </div>
        </div>`;
    }

    const proofBox = `
    <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:8px;font-size:13px;">
        <div class="kpi-label">Bukti Pembayaran (Per Unit)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <div><strong>Tanggal:</strong> ${payInfo.tglBayar ? fmtDate(payInfo.tglBayar) : '-'}</div>
            <div><strong>Metode:</strong> ${escapeHTML(payInfo.metodeBayar || '-')}</div>
            <div><strong>Nominal:</strong> ${fmt(payInfo.nominalBayar || 0)}</div>
            <div><strong>Referensi:</strong> ${escapeHTML(payInfo.refBayar || '-')}</div>
        </div>
        ${payInfo.linkBukti ? `<div style="margin-top:8px;"><a href="${escapeHTML(payInfo.linkBukti)}" target="_blank" style="color:var(--mossL);font-weight:700;">Lihat Bukti Pembayaran</a></div>` : `<div style="margin-top:8px;color:var(--txt3);">Belum ada link bukti pembayaran.</div>`}
        ${payInfo.catatanBayar ? `<div style="margin-top:8px;color:var(--txt2);">${escapeHTML(payInfo.catatanBayar)}</div>` : ''}
    </div>`;
	
	const depositBox = `
    <div style="margin-top:16px;padding:12px;background:var(--bg2);border:1px dashed var(--bdr2);border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
                <div class="kpi-label">Uang Jaminan (Security Deposit)</div>
                <div style="font-weight:700;font-size:15px;color:${b.stDeposit === 'Ditahan' ? 'var(--amber)' : (b.stDeposit === 'Dikembalikan' ? 'var(--mossL)' : 'var(--txt1)')}">
                    ${b.stDeposit === 'Belum' ? 'Belum Diserahkan' : `${fmt(b.deposit)} — ${b.stDeposit}`}
                </div>
            </div>
            <button class="btn-secondary" style="padding:6px 12px;font-size:11px;" onclick="openDepositManage('${escapeHTML(b.id)}')">Kelola Jaminan</button>
        </div>
    </div>`;

    const body = `
        ${groupBanner}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:14px">
            <div><div class="kpi-label">Nama</div><strong>${escapeHTML(b.nama)}</strong></div>
            <div><div class="kpi-label">WhatsApp</div>${escapeHTML(b.wa || '-')}</div>
            <div><div class="kpi-label">Tipe Unit</div>${escapeHTML(b.unit)} (${b.guests || '-'} org) </div>
            <div><div class="kpi-label">Unit Fisik</div>${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</div>
            <div><div class="kpi-label">Harga Unit Ini</div><strong style="color:var(--mossL);font-size:16px">${fmt(b.total)}</strong></div>
            <div><div class="kpi-label">Check-in</div>${fmtDate(b.checkin)}</div>
            <div><div class="kpi-label">Check-out</div>${fmtDate(b.checkout)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg3);padding:16px;border-radius:8px">
            <div><label class="kpi-label">Status Bayar</label><select class="f-input" onchange="changeStatus('${escapeHTML(b.id)}', 'stBayar', this.value)"><option ${payStatus==='Belum'?'selected':''}>Belum</option><option ${String(payStatus).includes('DP')?'selected':''}>DP / Sebagian</option><option ${payStatus==='Lunas'?'selected':''}>Lunas</option></select></div>
            <div><label class="kpi-label">Status Tamu</label><select class="f-input" onchange="changeStatus('${escapeHTML(b.id)}', 'stTamu', this.value)"><option ${b.stTamu==='Konfirmasi'?'selected':''}>Konfirmasi</option><option ${b.stTamu==='Check-in'?'selected':''}>Check-in</option><option ${b.stTamu==='Check-out'?'selected':''}>Check-out</option><option ${b.stTamu==='Dibatalkan'?'selected':''}>Dibatalkan</option></select></div>
        </div>
        ${proofBox}
		${depositBox}
        <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:8px;font-size:13px"><div class="kpi-label">Catatan</div>${escapeHTML(b.catatan || '(tidak ada catatan)')}</div>`;
    
    const footerButtons = `
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
            <button class="btn-ghost" style="color:var(--red); padding:0;" onclick="deleteBooking('${escapeHTML(b.id)}')">Hapus Data</button>
            <button class="btn-ghost" style="color:var(--red); padding:0;" onclick="openCancelBooking('${escapeHTML(b.id)}')">Batalkan</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
            <button class="btn-secondary" onclick="openUnitAssign('${escapeHTML(b.id)}')">Assign Unit</button>
            <button class="btn-secondary" onclick="openPaymentProof('${escapeHTML(b.id)}')">Input Bukti Unit</button>
            <button class="btn-secondary" onclick="printInvoice('${escapeHTML(b.id)}')">Invoice Unit</button>
            <button class="btn-primary" onclick="closeModal()">Tutup</button>
        </div>
    `;

    openModal(`Detail Reservasi ${escapeHTML(b.id)}`, body, footerButtons);
}

function changeStatus(id, field, value) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;

    const before = normalizeBooking(row);
    const oldValue = field === 'stBayar' ? getBookingPaymentStatus(before) : readField(before, [field], '-');

    row[field] = value;

    if (field === 'stBayar') {
        row['Status Bayar'] = value;
        row.Bayar = value;
        createFinancePaymentForBooking(before, value);
        if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Reservasi', aksi: 'Ubah Status Bayar', refId: id, lama: oldValue, baru: value, catatan: `Booking ${before.nama || '-'}` });
    }

    if (field === 'stTamu') {
        row['Status Tamu'] = value;
        if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Reservasi', aksi: 'Ubah Status Tamu', refId: id, lama: oldValue, baru: value, catatan: `Booking ${before.nama || '-'}` });
    }

    if(typeof refreshAllViews === 'function') refreshAllViews();

    if (typeof apiUpdateBooking === 'function') {
        apiUpdateBooking(id, { [field]: value, ...(field === 'stBayar' ? { 'Status Bayar': value, Bayar: value } : {}), ...(field === 'stTamu' ? { 'Status Tamu': value } : {}) }).then(res => {
            res.success ? showToast('Status berhasil diubah') : showToast('Gagal mengubah status', 'error');
        });
    } else {
        showToast('Status berhasil diubah (Lokal)');
    }
}

// ── ASSIGN UNIT ─────────────────────────────────────────────

function openUnitAssign(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;
    const b = normalizeBooking(row);
    const currentAssigned = getBookingAssignedUnitId(row);
    const availableUnits = getAvailableUnitsForBooking(b.unit, b.checkin, b.checkout, b.id);
    const currentUnit = currentAssigned ? UNITS.find(u => u.id === currentAssigned) : null;
    const optionRows = [currentUnit ? currentUnit : null, ...availableUnits.filter(u => u.id !== currentAssigned)].filter(Boolean);

    const options = optionRows.length ? optionRows.map(u => `<option value="${escapeHTML(u.id)}" ${u.id === currentAssigned ? 'selected' : ''}>${escapeHTML(u.id)} - ${escapeHTML(u.name)}</option>`).join('') : `<option value="">Tidak ada unit tersedia</option>`;

    const body = `
        <div style="display:grid;gap:14px;">
            <div style="padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);">
                <div class="kpi-label">Booking</div>
                <div style="font-weight:700;color:var(--txt1);font-size:16px;">${escapeHTML(b.id)} - ${escapeHTML(b.nama || '-')}</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">${escapeHTML(b.unit || '-')} · ${fmtDate(b.checkin)} - ${fmtDate(b.checkout)}</div>
            </div>
            <div>
                <label class="kpi-label">Unit Fisik *</label>
                <select id="assign-unit-id" class="f-input">${options}</select>
                <div style="font-size:11px;color:var(--txt3);margin-top:6px;">Unit yang tampil adalah unit Ready dan tidak bentrok dengan booking lain.</div>
            </div>
        </div>
    `;
    openModal(`Assign Unit ${escapeHTML(b.id)}`, body, `<button class="btn-ghost" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Kembali</button><button class="btn-primary" onclick="submitUnitAssign('${escapeHTML(b.id)}')">Simpan Unit</button>`);
}

function submitUnitAssign(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;
    const b = normalizeBooking(row);
    const selectedUnit = document.getElementById('assign-unit-id')?.value || '';

    if (!selectedUnit) return showToast('Pilih unit terlebih dahulu', 'error');
    const unit = UNITS.find(u => u.id === selectedUnit);
    if (!unit) return showToast('Unit tidak valid', 'error');

    const availableUnits = getAvailableUnitsForBooking(b.unit, b.checkin, b.checkout, b.id);
    const currentAssigned = getBookingAssignedUnitId(row);
    if (currentAssigned !== selectedUnit && !availableUnits.some(u => u.id === selectedUnit)) {
        return showToast('Unit sudah terpakai atau tidak tersedia pada tanggal tersebut', 'error');
    }

    const oldUnit = currentAssigned || '-';
    setBookingAssignedUnit(row, selectedUnit);

    if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Reservasi', aksi: 'Assign Unit', refId: id, lama: oldUnit, baru: selectedUnit, catatan: `${b.nama || '-'} - ${b.unit || '-'}` });
    if(typeof refreshAllViews === 'function') refreshAllViews();

    if (typeof apiUpdateBooking === 'function') {
        apiUpdateBooking(id, { unitAssigned: selectedUnit, UnitAssigned: selectedUnit, assignedUnit: selectedUnit, KodeUnit: selectedUnit }).then(res => {
            if (res.success) { showToast(`Booking ${id} berhasil ditempatkan ke ${selectedUnit}`); viewBookingDetail(id); }
            else { showToast('Gagal menyimpan unit ke database', 'error'); }
        });
    } else {
        showToast(`Booking ${id} berhasil ditempatkan ke ${selectedUnit} (Lokal)`);
        viewBookingDetail(id);
    }
}

// ── CANCEL & DELETE ─────────────────────────────────────────
function deleteBooking(id) {
    if (typeof isOwner === 'function' && !isOwner()) return showToast('Hanya Owner yang boleh menghapus data booking.', 'error');
    const b = getBookings().find(x => x.id === id);
    if (!b) return;

    const body = `
        <div style="display:grid;gap:14px;">
            <div style="padding:14px;background:rgba(192,80,64,0.12);border:1px solid var(--red);border-radius:10px;">
                <div style="font-weight:700;color:var(--red);font-size:16px;margin-bottom:6px;">Peringatan Hapus Data</div>
                <div style="font-size:13px;color:var(--txt2);line-height:1.6;">Fitur <strong>Hapus Data</strong> hanya digunakan untuk data salah input, data dummy, atau data testing. Jika tamu benar-benar membatalkan reservasi, gunakan tombol <strong>Batalkan Reservasi</strong>.</div>
            </div>
            <div style="padding:14px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;">
                <div class="kpi-label">Data yang akan dihapus</div>
                <div style="font-weight:700;color:var(--txt1);font-size:15px;margin-top:4px;">${escapeHTML(b.id)} — ${escapeHTML(b.nama || '-')}</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">${escapeHTML(b.unit || '-')} · Check-in ${fmtDate(b.checkin)}</div>
            </div>
            <div><label class="kpi-label">Ketik HAPUS untuk konfirmasi</label><input type="text" id="delete-confirm-text" class="f-input" placeholder="Ketik HAPUS"></div>
        </div>
    `;
    openModal(`Konfirmasi Hapus Data`, body, `<button class="btn-ghost" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Batal</button><button class="btn-secondary" onclick="executeDeleteBooking('${escapeHTML(b.id)}')">Ya, Hapus Data</button>`);
}
	
function executeDeleteBooking(id) {
    const confirmText = document.getElementById('delete-confirm-text')?.value.trim();
    if (confirmText !== 'HAPUS') return showToast('Ketik HAPUS untuk melanjutkan penghapusan data.', 'error');

    const b = getBookings().find(x => x.id === id);
    BOOKINGS = BOOKINGS.filter(x => normalizeBooking(x).id !== id);

    if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Reservasi', aksi: 'Hapus Data Booking', refId: id, lama: b ? `${b.nama || '-'} - ${b.unit || '-'}` : '-', baru: 'Dihapus permanen' });
    
    if(typeof refreshAllViews === 'function') refreshAllViews();
    closeModal();
    showToast('Menghapus dari database...');

    if (typeof apiDeleteBooking === 'function') {
        apiDeleteBooking(id).then(res => {
            res.success ? showToast('Data booking berhasil dihapus') : showToast('Gagal menghapus data booking', 'error');
        });
    } else {
        showToast('Data booking berhasil dihapus (Lokal)');
    }
}	

function openCancelBooking(id) {
    if (typeof requireAction === 'function' && !requireAction('cancel', 'Role ini tidak boleh membatalkan reservasi.')) return;
    const b = getBookings().find(x => x.id === id);
    if (!b) return;
    const paid = getPaidAmountForBooking(b);
    const total = normalizeAmount(b.total);

    const body = `
        <div style="display:grid;gap:14px;">
            <div style="padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);">
                <div class="kpi-label">Reservasi</div>
                <div style="font-weight:700;font-size:16px;color:var(--txt1);">${escapeHTML(b.id)} — ${escapeHTML(b.nama || '-')}</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">Total ${fmt(total)} · Terbayar ${fmt(paid)}</div>
            </div>
            <div><label class="kpi-label">Alasan Pembatalan</label><select id="cancel-reason" class="f-input"><option>Tamu membatalkan</option><option>Reschedule</option><option>Double booking</option><option>Kesalahan input admin</option><option>Cuaca / kondisi operasional</option><option>Lainnya</option></select></div>
            <div><label class="kpi-label">Kebijakan Dana</label><select id="cancel-policy" class="f-input" onchange="syncCancelRefundAmount('${escapeHTML(b.id)}')"><option value="no_refund">DP hangus / tidak ada refund</option><option value="full_refund">Refund penuh pembayaran</option><option value="partial_refund">Refund sebagian</option></select></div>
            <div><label class="kpi-label">Nominal Refund</label><input type="number" id="cancel-refund" class="f-input" value="0" min="0" max="${paid}"><div style="font-size:11px;color:var(--txt3);margin-top:4px;">Sistem akan otomatis mencatat pengeluaran jika ada refund.</div></div>
            <div><label class="kpi-label">Catatan Pembatalan</label><textarea id="cancel-note" class="f-input" placeholder="Contoh: Tamu batal karena jadwal berubah."></textarea></div>
        </div>
    `;
    openModal(`Batalkan Reservasi ${escapeHTML(b.id)}`, body, `<button class="btn-ghost" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Kembali</button><button class="btn-secondary" onclick="submitCancelBooking('${escapeHTML(b.id)}')">Simpan Pembatalan</button>`);
}

function syncCancelRefundAmount(id) {
    const b = getBookings().find(x => x.id === id);
    if (!b) return;
    const paid = getPaidAmountForBooking(b);
    const policy = document.getElementById('cancel-policy')?.value || 'no_refund';
    const refundInput = document.getElementById('cancel-refund');
    if (!refundInput) return;
    if (policy === 'no_refund') refundInput.value = 0;
    if (policy === 'full_refund') refundInput.value = paid;
    if (policy === 'partial_refund') refundInput.value = Math.round(paid / 2);
}

function submitCancelBooking(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;

    const b = normalizeBooking(row);
    const paid = getPaidAmountForBooking(b);

    const reason = document.getElementById('cancel-reason')?.value || 'Lainnya';
    const policy = document.getElementById('cancel-policy')?.value || 'no_refund';
    const refund = Number(document.getElementById('cancel-refund')?.value || 0);
    const note = document.getElementById('cancel-note')?.value.trim() || '';

    if (refund < 0 || refund > paid) return showToast('Nominal refund tidak valid', 'error');

    row.stTamu = 'Dibatalkan';
    row['Status Tamu'] = 'Dibatalkan';
    row.cancelReason = reason; row.CancelReason = reason;
    row.cancelPolicy = policy; row.CancelPolicy = policy;
    row.cancelRefund = refund; row.CancelRefund = refund;
    row.cancelNote = note; row.CancelNote = note;
    row.cancelDate = new Date().toISOString().split('T')[0]; row.CancelDate = row.cancelDate;

    if (refund > 0) createRefundExpenseForCancellation(b, refund, reason, note);

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Reservasi', aksi: 'Batalkan Reservasi', refId: id, lama: b.stTamu, baru: 'Dibatalkan', catatan: `Alasan: ${reason}; Refund: ${fmt(refund)}` });
    }

    if(typeof refreshAllViews === 'function') refreshAllViews();

    if (typeof apiUpdateBooking === 'function') {
        apiUpdateBooking(id, {
            stTamu: 'Dibatalkan', 'Status Tamu': 'Dibatalkan',
            cancelReason: reason, CancelReason: reason,
            cancelPolicy: policy, CancelPolicy: policy,
            cancelRefund: refund, CancelRefund: refund,
            cancelNote: note, CancelNote: note,
            cancelDate: new Date().toISOString().split('T')[0], CancelDate: new Date().toISOString().split('T')[0]
        }).then(res => {
            if (res.success) { showToast(`Reservasi ${id} berhasil dibatalkan`); viewBookingDetail(id); }
            else { showToast('Gagal menyimpan pembatalan ke database', 'error'); }
        });
    } else {
        showToast(`Reservasi ${id} berhasil dibatalkan (Lokal)`);
        viewBookingDetail(id);
    }
}

function createRefundExpenseForCancellation(booking, refundAmount, reason, note) {
    const today = new Date().toISOString().split('T')[0];
    const txId = typeof generateFinanceId === 'function' ? generateFinanceId('expense', today) : 'EXP-' + Date.now().toString().slice(-6);

    const desc = `Refund pembatalan booking ${booking.id} - ${booking.nama || '-'}`;
    const fullNote = [ `Refund dari pembatalan reservasi.`, `Booking ID: ${booking.id}`, `Tamu: ${booking.nama || '-'}`, `Unit: ${booking.unit || '-'}`, `Alasan: ${reason}`, note || '' ].join(' | ');

    const tx = {
        id: txId, ID: txId, tanggal: today, tgl: today, Tgl: today,
        keterangan: desc, ket: desc, Ket: desc,
        kategori: 'Refund / Pembatalan Booking', kat: 'Refund / Pembatalan Booking', Kat: 'Refund / Pembatalan Booking',
        metode: 'Refund', Metode: 'Refund',
        jumlah: refundAmount, jml: refundAmount, Jml: refundAmount,
        dariKe: booking.id, DariKe: booking.id,
        tipe: 'out', Tipe: 'out',
        catatan: fullNote, Catatan: fullNote, timestamp: new Date().toISOString()
    };

    EXPENSE.unshift(tx);
    if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Keuangan', aksi: 'Refund Pembatalan', refId: txId, lama: '-', baru: fmt(refundAmount), catatan: booking.id });
    if (typeof apiSaveExpense === 'function') apiSaveExpense(tx);
}

// ── PAYMENT PROOF & INVOICE ─────────────────────────────────
function getPaymentInfo(b) {
    return {
        tglBayar: readField(b, ['tglBayar', 'TglBayar', 'paymentDate', 'Tanggal Bayar'], ''),
        metodeBayar: readField(b, ['metodeBayar', 'MetodeBayar', 'paymentMethod', 'Metode Bayar'], ''),
        nominalBayar: normalizeAmount(readField(b, ['nominalBayar', 'NominalBayar', 'paymentAmount', 'Nominal Bayar'], 0)),
        refBayar: readField(b, ['refBayar', 'RefBayar', 'paymentRef', 'Referensi Bayar'], ''),
        linkBukti: readField(b, ['linkBukti', 'LinkBukti', 'proofUrl', 'Link Bukti'], ''),
        catatanBayar: readField(b, ['catatanBayar', 'CatatanBayar', 'paymentNote', 'Catatan Bayar'], '')
    };
}

function openPaymentProof(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;

    const b = normalizeBooking(row);
    const pay = getPaymentInfo(row);
    const total = Number(b.total || 0);
    const dp = Number(b.dp || Math.round(total / 2));
    const today = new Date().toISOString().split('T')[0];

    const currentStatus = getBookingPaymentStatus(b);
    const defaultAmount = currentStatus === 'Lunas' ? total : String(currentStatus).includes('DP') ? dp : dp;

    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div style="grid-column:span 2;padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);">
                <div class="kpi-label">Booking</div>
                <div style="font-weight:700;color:var(--txt1);font-size:16px;">${escapeHTML(b.id)} - ${escapeHTML(b.nama || '-')}</div>
            </div>
            <div><label class="kpi-label">Status Bayar *</label><select id="pay-status" class="f-input" onchange="syncPaymentAmount('${b.id}')"><option ${currentStatus === 'Belum' ? 'selected' : ''}>Belum</option><option ${String(currentStatus).includes('DP') ? 'selected' : ''}>DP / Sebagian</option><option ${currentStatus === 'Lunas' ? 'selected' : ''}>Lunas</option></select></div>
            <div><label class="kpi-label">Tanggal Bayar *</label><input type="date" id="pay-date" class="f-input" value="${pay.tglBayar || today}"></div>
            <div><label class="kpi-label">Metode Bayar *</label><select id="pay-method" class="f-input"><option ${pay.metodeBayar === 'Transfer Bank' ? 'selected' : ''}>Transfer Bank</option><option ${pay.metodeBayar === 'QRIS' ? 'selected' : ''}>QRIS</option><option ${pay.metodeBayar === 'Tunai' ? 'selected' : ''}>Tunai</option><option ${pay.metodeBayar === 'EDC / Kartu' ? 'selected' : ''}>EDC / Kartu</option><option ${pay.metodeBayar === 'OTA / Marketplace' ? 'selected' : ''}>OTA / Marketplace</option><option ${pay.metodeBayar === 'Lainnya' ? 'selected' : ''}>Lainnya</option></select></div>
            <div><label class="kpi-label">Nominal Bayar *</label><input type="number" id="pay-amount" class="f-input" value="${pay.nominalBayar || defaultAmount}" min="0"></div>
            <div><label class="kpi-label">Nomor Referensi</label><input type="text" id="pay-ref" class="f-input" value="${escapeHTML(pay.refBayar || '')}"></div>
            
            <!-- UBAH JADI INPUT FILE -->
            <div>
                <label class="kpi-label">Upload Foto Struk</label>
                <input type="file" id="pay-proof-file" class="f-input" accept="image/*" style="padding:6px;">
                ${pay.linkBukti ? `<a href="${pay.linkBukti}" target="_blank" style="font-size:11px; color:var(--mossL); margin-top:4px; display:inline-block;">Lihat Foto Terakhir</a>` : ''}
            </div>
            
            <div style="grid-column:span 2;"><label class="kpi-label">Catatan Pembayaran</label><textarea id="pay-note" class="f-input">${escapeHTML(pay.catatanBayar || '')}</textarea></div>
        </div>
    `;
    openModal(`Bukti Pembayaran (1 Unit)`, body, `<button class="btn-ghost" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Kembali</button><button class="btn-primary" onclick="submitPaymentProof('${escapeHTML(b.id)}')">Simpan Bukti Bayar</button>`);
}

// === HELPER KEUANGAN (JANGAN DIHAPUS) ===
function syncPaymentAmount(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;
    const b = normalizeBooking(row);
    const status = document.getElementById('pay-status')?.value || 'Belum';
    const amountInput = document.getElementById('pay-amount');
    if (!amountInput) return;

    const total = Number(b.total || 0);
    const dp = Number(b.dp || Math.round(total / 2));
    if (status === 'Lunas') amountInput.value = total;
    else if (String(status).includes('DP')) amountInput.value = dp;
    else amountInput.value = 0;
}

function buildPaymentFinanceKey(bookingId, status, ref, amount, date) {
    const base = ref ? ref : `${bookingId}-${status}-${amount}-${date}`;
    return `PAYKEY:${base}`;
}

function paymentFinanceAlreadyExists(paymentKey) {
    return INCOME.map(i => normalizeFinanceTx(i, 'income')).some(tx => {
        const text = [tx.id, tx.keterangan, tx.kategori, tx.dariKe, tx.catatan].join(' ');
        return text.includes(paymentKey);
    });
}

function createFinanceFromPaymentProof(b, payData) {
    const amount = Number(payData.amount || 0);
    if (amount <= 0) return;

    const paymentKey = buildPaymentFinanceKey(b.id, payData.status, payData.ref, amount, payData.date);
    if (paymentFinanceAlreadyExists(paymentKey)) return;

    const txId = typeof generateFinanceId === 'function' ? generateFinanceId('income', payData.date) : 'INC-' + Date.now().toString().slice(-6);
    const desc = `Pembayaran ${payData.status} - ${b.nama || '-'} (${b.id})`;
    const note = [`Booking ID: ${b.id}`, `Unit: ${b.unit || '-'}`, `Metode: ${payData.method || '-'}`, `Referensi: ${payData.ref || '-'}`, `Bukti: ${payData.proof || '-'}`, paymentKey, payData.note || ''].join(' | ');

    const newTx = {
        id: txId, ID: txId,
        tanggal: payData.date, tgl: payData.date, Tgl: payData.date,
        keterangan: desc, ket: desc, Ket: desc,
        kategori: 'Booking Penginapan', kat: 'Booking Penginapan', Kat: 'Booking Penginapan',
        metode: payData.method || '-', Metode: payData.method || '-',
        jumlah: amount, jml: amount, Jml: amount,
        dariKe: b.id, DariKe: b.id,
        tipe: 'in', Tipe: 'in',
        catatan: note, Catatan: note, timestamp: new Date().toISOString()
    };

    INCOME.unshift(newTx);

    if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Keuangan', aksi: 'Tambah Pemasukan dari Bukti Bayar', refId: txId, lama: '-', baru: fmt(amount), catatan: `${b.id} - ${b.nama || '-'}` });
    if (typeof apiSaveIncome === 'function') apiSaveIncome(newTx).catch(err => console.error(err));
}
// ========================================

async function submitPaymentProof(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;

    const status = document.getElementById('pay-status').value;
    const date = document.getElementById('pay-date').value;
    const method = document.getElementById('pay-method').value;
    const amount = Number(document.getElementById('pay-amount').value) || 0;
    const ref = document.getElementById('pay-ref').value.trim();
    const fileInput = document.getElementById('pay-proof-file');
    const note = document.getElementById('pay-note').value.trim();

    if (!status || !date) return showToast('Status dan tanggal wajib diisi!', 'error');

    showLoading('Mengunggah & Menyimpan Data...');

    // PROSES UPLOAD GAMBAR KE DRIVE
    let finalProofUrl = row.linkBukti || row.LinkBukti || '';
    if (fileInput && fileInput.files.length > 0) {
        const uploadRes = await apiUploadImage(fileInput.files[0]);
        if (uploadRes.success) {
            finalProofUrl = uploadRes.url;
        } else {
            hideLoading();
            return showToast('Gagal mengunggah foto struk', 'error');
        }
    }

    row.stBayar = status; row['Status Bayar'] = status; row.Bayar = status;
    row.tglBayar = date; row.metodeBayar = method; row.nominalBayar = amount;
    row.refBayar = ref; row.linkBukti = finalProofUrl; row.catatanBayar = note;

    const normalizedAfter = normalizeBooking(row);
    if (String(status).includes('DP') || status === 'Lunas') {
        createFinanceFromPaymentProof(normalizedAfter, { status, date, method, amount, ref, proof: finalProofUrl, note });
    }

    if(typeof refreshAllViews === 'function') refreshAllViews();

    if (typeof apiUpdateBooking === 'function') {
        apiUpdateBooking(id, { stBayar: status, 'Status Bayar': status, Bayar: status, tglBayar: date, metodeBayar: method, nominalBayar: amount, refBayar: ref, linkBukti: finalProofUrl, catatanBayar: note }).then(res => {
            hideLoading();
            if (res.success) { showToast('Bukti berhasil disimpan'); viewBookingDetail(id); }
            else { showToast('Gagal menyimpan ke database', 'error'); }
        });
    } else {
        hideLoading();
        showToast('Bukti berhasil disimpan (Lokal)');
        viewBookingDetail(id);
    }
}

function openGroupPaymentProof(groupId) {
    const groupBks = getGroupBookings(groupId);
    if (!groupBks.length) return;
    const b = groupBks[0];
    const total = groupBks.reduce((s, bk) => s + normalizeAmount(bk.total), 0);
    const paid = groupBks.reduce((s, bk) => s + getPaidAmountForBooking(bk), 0);
    const remaining = Math.max(total - paid, 0);

    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div style="grid-column:span 2;padding:14px;background:rgba(232,160,48,0.15);border-radius:10px;border:1px solid var(--amber);">
                <div style="font-weight:700;color:var(--txt1);font-size:16px;">Pembayaran Rombongan: ${groupId}</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">Total Tagihan: ${fmt(total)} | Sisa Bayar: ${fmt(remaining)}</div>
            </div>
            <div><label class="kpi-label">Tanggal Bayar *</label><input type="date" id="gpay-date" class="f-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div><label class="kpi-label">Metode Bayar *</label><select id="gpay-method" class="f-input"><option>Transfer Bank</option><option>QRIS</option><option>Tunai</option></select></div>
            <div><label class="kpi-label">Nominal Bayar *</label><input type="number" id="gpay-amount" class="f-input" value="${remaining}" min="0"></div>
            <div><label class="kpi-label">Nomor Referensi</label><input type="text" id="gpay-ref" class="f-input"></div>
            
            <!-- UBAH JADI INPUT FILE -->
            <div><label class="kpi-label">Upload Foto Struk</label><input type="file" id="gpay-proof-file" class="f-input" accept="image/*" style="padding:6px;"></div>
            
            <div style="grid-column:span 2;"><label class="kpi-label">Catatan</label><textarea id="gpay-note" class="f-input"></textarea></div>
        </div>`;
    openModal(`Input Bayar Rombongan`, body, `<button class="btn-ghost" onclick="viewBookingDetail('${b.id}')">Batal</button><button class="btn-primary" style="background:var(--amber);color:#111;" onclick="submitGroupPaymentProof('${groupId}')">Simpan</button>`);
}

async function submitGroupPaymentProof(groupId) {
    const groupBks = getGroupBookings(groupId);
    if (!groupBks.length) return;

    const date = document.getElementById('gpay-date').value;
    const method = document.getElementById('gpay-method').value;
    const amount = Number(document.getElementById('gpay-amount').value) || 0;
    const ref = document.getElementById('gpay-ref').value.trim();
    const fileInput = document.getElementById('gpay-proof-file');
    const note = document.getElementById('gpay-note').value.trim();

    if (!date || amount <= 0) return showToast('Nominal dan tanggal wajib diisi!', 'error');

    showLoading('Mengunggah & Menyimpan Rombongan...');

    let finalProofUrl = '';
    if (fileInput && fileInput.files.length > 0) {
        const uploadRes = await apiUploadImage(fileInput.files[0]);
        if (uploadRes.success) finalProofUrl = uploadRes.url;
        else { hideLoading(); return showToast('Gagal mengunggah foto', 'error'); }
    }

    let remainingPayment = amount;
    let updates = [];

    groupBks.forEach(b => {
        if (remainingPayment <= 0) return;
        const bTotal = normalizeAmount(b.total), bPaid = getPaidAmountForBooking(b), bNeed = Math.max(bTotal - bPaid, 0);
        
        if (bNeed > 0) {
            const payForThis = Math.min(bNeed, remainingPayment);
            remainingPayment -= payForThis;
            
            const txId = typeof generateFinanceId === 'function' ? generateFinanceId('income', date) : 'INC-' + Date.now().toString().slice(-6);
            const newTx = { id: txId, ID: txId, tanggal: date, tgl: date, Tgl: date, keterangan: `Bayar Unit ${b.id} (${groupId})`, kategori: 'Booking Penginapan', kat: 'Booking Penginapan', Kat: 'Booking Penginapan', metode: method, Metode: method, jumlah: payForThis, jml: payForThis, Jml: payForThis, dariKe: b.id, DariKe: b.id, tipe: 'in', Tipe: 'in', catatan: `Metode: ${method} | Bukti: ${finalProofUrl} | ${note}`, timestamp: new Date().toISOString() };
            INCOME.unshift(newTx); if (typeof apiSaveIncome === 'function') apiSaveIncome(newTx);
            
            const newStatus = (bPaid + payForThis) >= bTotal ? 'Lunas' : 'DP / Sebagian';
            const row = BOOKINGS.find(x => x.id === b.id);
            if (row) {
                row.stBayar = newStatus; row.tglBayar = date; row.nominalBayar = (normalizeAmount(row.nominalBayar)||0) + payForThis; row.linkBukti = finalProofUrl;
                updates.push({ id: b.id, data: { stBayar: newStatus, 'Status Bayar': newStatus, tglBayar: date, nominalBayar: row.nominalBayar, linkBukti: finalProofUrl } });
            }
        }
    });

    if(typeof refreshAllViews === 'function') refreshAllViews();
    closeModal();
    
    if (typeof apiUpdateBooking === 'function') {
        Promise.all(updates.map(u => apiUpdateBooking(u.id, u.data))).then(() => { hideLoading(); showToast('Pembayaran rombongan didistribusikan'); });
    } else {
        hideLoading();
    }
}

// ── PRINT INVOICES ──────────────────────────────────────────
function printInvoice(id) {
    const b = getBookings().find(x => String(x.id) === String(id));
    if (!b) return showToast('Data booking tidak ditemukan', 'error');

    // Hitung durasi otomatis
    const tIn = new Date(b.checkin + 'T00:00:00');
    const tOut = new Date(b.checkout + 'T00:00:00');
    let durasi = Math.round((tOut - tIn) / (1000 * 60 * 60 * 24));
    if (isNaN(durasi) || durasi < 1) durasi = 1;

    const payStatus = getBookingPaymentStatus(b);
    const total = Number(b.total || 0);
    const dp = Number(b.dp || Math.round(total / 2));
    const paid = String(payStatus).includes('Lunas') ? total : String(payStatus).includes('DP') ? getPaidAmountForBooking(b) : 0;
    const remaining = Math.max(total - paid, 0);
    const invoiceNo = `INV-${b.id}`;
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const invoiceHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"><title>${invoiceNo}</title>
<style>
@page { size: A4; margin: 14mm; } * { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #1f2a1f; background: #fff; font-size: 12px; line-height: 1.45; }
.header { display: flex; justify-content: space-between; border-bottom: 2px solid #2e4820; padding-bottom: 18px; margin-bottom: 22px; }
.brand h1 { margin: 0; color: #2e4820; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 28px; font-style: italic; font-weight: 400; }
.brand .sub { font-size: 10px; letter-spacing: 2px; color: #4e7038; text-transform: uppercase; }
.meta { text-align: right; } .meta h2 { margin: 0 0 8px; font-size: 24px; color: #2e4820; }
.section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #4e7038; font-weight: 700; border-bottom: 1px solid #d7dfcf; padding-bottom: 6px; margin: 18px 0 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.box { border: 1px solid #d7dfcf; border-radius: 10px; padding: 12px 14px; background: #fbfcf7; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px dashed #e4eadc; }
.row:last-child { border-bottom: 0; }
.label { color: #6f7f63; } .value { font-weight: 700; text-align: right; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { background: #2e4820; color: #fff; padding: 9px; text-align: left; font-size: 11px; }
td { padding: 10px 9px; border-bottom: 1px solid #d7dfcf; }
.text-right { text-align: right; }
.summary { width: 320px; margin-left: auto; margin-top: 14px; border: 1px solid #d7dfcf; border-radius: 10px; overflow: hidden; }
.summary-row { display: flex; justify-content: space-between; padding: 9px 12px; border-bottom: 1px solid #e4eadc; }
.summary-row.total { background: #2e4820; color: #fff; font-weight: 700; }
.note { margin-top: 22px; padding: 12px 14px; border-radius: 10px; background: #fbfcf7; border: 1px solid #d7dfcf; color: #5f6f5c; }
.signature { margin-top: 46px; width: 220px; margin-left: auto; text-align: center; } .signature-space { height: 54px; }
.signature strong { display: block; border-top: 1px solid #9aaa90; padding-top: 6px; }
.actions { position: fixed; right: 18px; bottom: 18px; display: flex; gap: 10px; }
.actions button { border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer; font-weight: 700; }
.print { background: #4e7038; color: white; } .close { background: #e8dcc8; color: #2e2418; }
@media print { .actions { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
    <div class="brand" style="display:flex; align-items:center; gap:14px;">
    <!-- Memanggil file logo untuk Invoice (Print) -->
    <img src="./img/logoHitam.png" style="width:120px; height:auto;">
    <div>
        <h1 style="margin:0;">Cascade</h1>
        <div class="sub" style="margin-top:2px;">Cabin & Camp</div>
        <p style="margin:0; margin-top:4px;">Glamping Pangalengan, Bandung</p>
    </div>
</div>
    <div class="meta"><h2>INVOICE</h2><div>No: <strong>${escapeHTML(invoiceNo)}</strong></div><div>Tanggal: <strong>${escapeHTML(today)}</strong></div><div>Booking ID: <strong>${escapeHTML(b.id)}</strong></div><div>Status: <strong>${escapeHTML(payStatus)}</strong></div></div>
</div>
<div class="grid">
    <div><div class="section-title">Data Tamu</div><div class="box"><div class="row"><span class="label">Nama</span><span class="value">${escapeHTML(b.nama || '-')}</span></div><div class="row"><span class="label">WhatsApp</span><span class="value">${escapeHTML(b.wa || '-')}</span></div><div class="row"><span class="label">Email</span><span class="value">${escapeHTML(b.email || '-')}</span></div><div class="row"><span class="label">Kota</span><span class="value">${escapeHTML(b.kota || '-')}</span></div></div></div>
    <div><div class="section-title">Detail Reservasi</div><div class="box"><div class="row"><span class="label">Check-in</span><span class="value">${fmtDate(b.checkin)}</span></div><div class="row"><span class="label">Check-out</span><span class="value">${fmtDate(b.checkout)}</span></div><div class="row"><span class="label">Durasi</span><span class="value">${durasi} malam</span></div><div class="row"><span class="label">Jumlah Tamu</span><span class="value">${escapeHTML(b.guests || '-')} orang</span></div></div></div>
</div>
<div class="section-title">Rincian Biaya</div>
<table><thead><tr><th>Item</th><th>Rincian</th><th class="text-right">Jumlah</th></tr></thead><tbody><tr><td><strong>${escapeHTML(getUnitTypeName(b.unit))}</strong><br><small>Unit Fisik: ${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</small></td><td>Paket Penginapan</td><td class="text-right">${fmt(total)}</td></tr></tbody></table>
<div class="summary"><div class="summary-row"><span>Total Reservasi</span><strong>${fmt(total)}</strong></div><div class="summary-row"><span>Minimal DP</span><strong>${fmt(dp)}</strong></div><div class="summary-row"><span>Sudah Dibayar</span><strong>${fmt(paid)}</strong></div><div class="summary-row total"><span>Sisa Pembayaran</span><span>${fmt(remaining)}</span></div></div>
<div class="note"><strong>Catatan:</strong><br>${escapeHTML(b.catatan || 'Terima kasih telah melakukan reservasi di Cascade Cabin & Camp.')}</div>
<div class="signature"><div>Admin Cascade</div><div class="signature-space"></div><strong>Authorized Signature</strong></div>
<div class="actions"><button class="close" onclick="window.close()">Tutup</button><button class="print" onclick="window.print()">Print / Save PDF</button></div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return showToast('Popup diblokir browser.', 'error');
    printWindow.document.open(); printWindow.document.write(invoiceHtml); printWindow.document.close();
}

function printGroupInvoice(groupId) {
    const groupBks = getGroupBookings(groupId);
    if (!groupBks.length) return showToast('Data rombongan tidak ditemukan', 'error');

    const b = groupBks[0];
    const invoiceNo = `INV-${groupId}`;
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Hitung durasi otomatis
    const tIn = new Date(b.checkin + 'T00:00:00');
    const tOut = new Date(b.checkout + 'T00:00:00');
    let durasi = Math.round((tOut - tIn) / (1000 * 60 * 60 * 24));
    if (isNaN(durasi) || durasi < 1) durasi = 1;

    // Kalkulasi Rombongan
    const total = groupBks.reduce((sum, bk) => sum + normalizeAmount(bk.total), 0);
    const paid = groupBks.reduce((sum, bk) => sum + getPaidAmountForBooking(bk), 0);
    const remaining = Math.max(total - paid, 0);
    const dp = Math.round(total / 2);
    const payStatus = paid >= total ? 'Lunas' : (paid > 0 ? 'DP / Sebagian' : 'Belum');
    const totalGuests = groupBks.reduce((sum, bk) => sum + (Number(bk.guests) || 0), 0);
    
    // Rekap Tipe Unit
    const unitCountMap = {};
    groupBks.forEach(bk => {
        const typeName = getUnitTypeName(bk.unit) || bk.unit;
        unitCountMap[typeName] = (unitCountMap[typeName] || 0) + 1;
    });
    const unitTypesStr = Object.entries(unitCountMap).map(([type, qty]) => `<strong>${qty}x</strong> ${type}`).join('<br>');

    // List Rincian Tabel
    const itemsHtml = groupBks.map(bk => `<tr><td><strong>${escapeHTML(getUnitTypeName(bk.unit))}</strong><br><small>Unit Fisik: ${escapeHTML(getUnitLabel(getBookingAssignedUnitId(bk)))}</small></td><td>${escapeHTML(bk.id)}</td><td class="text-right">${fmt(bk.total)}</td></tr>`).join('');

    const invoiceHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"><title>${invoiceNo}</title>
<style>
@page { size: A4; margin: 14mm; } * { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #1f2a1f; background: #fff; font-size: 12px; line-height: 1.45; }
.header { display: flex; justify-content: space-between; border-bottom: 2px solid #2e4820; padding-bottom: 18px; margin-bottom: 22px; }
.brand h1 { margin: 0; color: #2e4820; font-family: Georgia, serif; font-size: 28px; font-style: italic; font-weight: 400; }
.brand .sub { font-size: 10px; letter-spacing: 2px; color: #4e7038; text-transform: uppercase; }
.meta { text-align: right; } .meta h2 { margin: 0 0 8px; font-size: 24px; color: #2e4820; }
.section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #4e7038; font-weight: 700; border-bottom: 1px solid #d7dfcf; padding-bottom: 6px; margin: 18px 0 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.box { border: 1px solid #d7dfcf; border-radius: 10px; padding: 12px 14px; background: #fbfcf7; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px dashed #e4eadc; }
.row:last-child { border-bottom: 0; }
.label { color: #6f7f63; } .value { font-weight: 700; text-align: right; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { background: #2e4820; color: #fff; padding: 9px; text-align: left; font-size: 11px; }
td { padding: 10px 9px; border-bottom: 1px solid #d7dfcf; }
.text-right { text-align: right; }
.summary { width: 320px; margin-left: auto; margin-top: 14px; border: 1px solid #d7dfcf; border-radius: 10px; overflow: hidden; }
.summary-row { display: flex; justify-content: space-between; padding: 9px 12px; border-bottom: 1px solid #e4eadc; }
.summary-row.total { background: #2e4820; color: #fff; font-weight: 700; }
.note { margin-top: 22px; padding: 12px 14px; border-radius: 10px; background: #fbfcf7; border: 1px solid #d7dfcf; color: #5f6f5c; }
.signature { margin-top: 46px; width: 220px; margin-left: auto; text-align: center; } .signature-space { height: 54px; }
.signature strong { display: block; border-top: 1px solid #9aaa90; padding-top: 6px; }
.actions { position: fixed; right: 18px; bottom: 18px; display: flex; gap: 10px; }
.actions button { border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer; font-weight: 700; }
.print { background: #4e7038; color: white; } .close { background: #e8dcc8; color: #2e2418; }
@media print { .actions { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
    <div class="brand" style="display:flex; align-items:center; gap:14px;">
    <!-- Memanggil file logo untuk Invoice (Print) -->
    <img src="./img/logoHitam.png" style="width:120px; height:auto;">
    <div>
        <h1 style="margin:0;">Cascade</h1>
        <div class="sub" style="margin-top:2px;">Cabin & Camp</div>
        <p style="margin:0; margin-top:4px;">Glamping Pangalengan, Bandung</p>
    </div>
</div>
    <div class="meta"><h2>INVOICE ROMBONGAN</h2><div>No: <strong>${escapeHTML(invoiceNo)}</strong></div><div>Tanggal Cetak: <strong>${escapeHTML(today)}</strong></div><div>Status: <strong>${escapeHTML(payStatus)}</strong></div></div>
</div>
<div class="grid">
    <div>
        <div class="section-title">Data Perwakilan</div>
        <div class="box">
            <div class="row"><span class="label">Nama</span><span class="value">${escapeHTML(b.nama || '-')}</span></div>
            <div class="row"><span class="label">WhatsApp</span><span class="value">${escapeHTML(b.wa || '-')}</span></div>
            <div class="row"><span class="label">Total Unit</span><span class="value">${groupBks.length} Unit</span></div>
            <div class="row"><span class="label">Total Tamu</span><span class="value">${totalGuests} Orang</span></div>
        </div>
    </div>
    <div>
        <div class="section-title">Detail Reservasi</div>
        <div class="box">
            <div class="row"><span class="label">Check-in</span><span class="value">${fmtDate(b.checkin)}</span></div>
            <div class="row"><span class="label">Check-out</span><span class="value">${fmtDate(b.checkout)}</span></div>
            <div class="row"><span class="label">Durasi Menginap</span><span class="value">${durasi} malam</span></div>
            <div class="row" style="flex-direction:column; gap:4px; border-bottom:0;">
                <span class="label">Rekap Tipe Unit:</span>
                <span class="value" style="text-align:left; font-weight:400;">${unitTypesStr}</span>
            </div>
        </div>
    </div>
</div>
<div class="section-title">Rincian Unit Rombongan</div>
<table><thead><tr><th>Tipe Unit & Fisik</th><th>Booking ID</th><th class="text-right">Harga</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div class="summary"><div class="summary-row"><span>Total Reservasi Rombongan</span><strong>${fmt(total)}</strong></div><div class="summary-row"><span>Minimal DP</span><strong>${fmt(dp)}</strong></div><div class="summary-row"><span>Sudah Dibayar</span><strong>${fmt(paid)}</strong></div><div class="summary-row total"><span>Sisa Pembayaran</span><span>${fmt(remaining)}</span></div></div>
<div class="note"><strong>Catatan Tambahan:</strong><br>${escapeHTML(b.catatan || 'Terima kasih telah melakukan reservasi di Cascade Cabin & Camp.')}</div>
<div class="signature"><div>Admin Cascade</div><div class="signature-space"></div><strong>Authorized Signature</strong></div>
<div class="actions"><button class="close" onclick="window.close()">Tutup</button><button class="print" onclick="window.print()">Print / Save PDF</button></div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return showToast('Popup diblokir browser.', 'error');
    printWindow.document.open(); printWindow.document.write(invoiceHtml); printWindow.document.close();
}

// ── SECURITY DEPOSIT (UANG JAMINAN) ─────────────────────────
function openDepositManage(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;
    const b = normalizeBooking(row);
    
    const body = `
        <div style="display:grid;gap:14px;">
            <div style="padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);">
                <div style="font-weight:700;color:var(--txt1);font-size:16px;">${escapeHTML(b.id)} - ${escapeHTML(b.nama || '-')}</div>
                <div style="font-size:12px;color:var(--txt3);margin-top:4px;">
                    Status Saat Ini: <strong style="color:var(--amber)">${b.stDeposit}</strong> (${fmt(b.deposit)})
                </div>
            </div>
            <div>
                <label class="kpi-label">Nominal Jaminan *</label>
                <input type="number" id="dep-amount" class="f-input" value="${b.deposit || 100000}" min="0">
            </div>
            <div>
                <label class="kpi-label">Status Jaminan *</label>
                <select id="dep-status" class="f-input">
                    <option value="Belum" ${b.stDeposit === 'Belum' ? 'selected' : ''}>Belum Ada</option>
                    <option value="Ditahan" ${b.stDeposit === 'Ditahan' ? 'selected' : ''}>Terima (Ditahan saat Check-in)</option>
                    <option value="Dikembalikan" ${b.stDeposit === 'Dikembalikan' ? 'selected' : ''}>Kembalikan (Tamu Check-out)</option>
                    <option value="Hangus" ${b.stDeposit === 'Hangus' ? 'selected' : ''}>Hangus (Denda Kerusakan)</option>
                </select>
            </div>
            <div>
                <label class="kpi-label">Diterima / Dikembalikan Via Kas</label>
                <select id="dep-method" class="f-input">
                    <option>Kas Tunai</option>
                    <option>Transfer Bank</option>
                    <option>QRIS</option>
                </select>
            </div>
            <div style="font-size:11px;color:var(--txt3);line-height:1.6;background:rgba(232,160,48,0.1);padding:10px;border-radius:8px;border:1px solid rgba(232,160,48,0.2);">
                <strong>Info Akuntansi Otomatis:</strong><br>
                - Memilih <b>Terima</b> akan menambah saldo kas.<br>
                - Memilih <b>Kembalikan</b> akan mengurangi saldo kas (dikembalikan ke tamu).<br>
                - Memilih <b>Hangus</b> akan merubah status uang titipan menjadi uang pemasukan mutlak.
            </div>
        </div>
    `;
    openModal('Kelola Uang Jaminan', body, `<button class="btn-ghost" onclick="viewBookingDetail('${b.id}')">Kembali</button><button class="btn-primary" onclick="submitDepositManage('${b.id}')">Simpan Jaminan</button>`);
}

function submitDepositManage(id) {
    const row = BOOKINGS.find(x => normalizeBooking(x).id === id);
    if (!row) return;

    const amount = Number(document.getElementById('dep-amount').value) || 0;
    const newStatus = document.getElementById('dep-status').value;
    const method = document.getElementById('dep-method').value;
    
    const b = normalizeBooking(row);
    const oldStatus = b.stDeposit;

    if (newStatus !== 'Belum' && amount <= 0) return showToast('Nominal jaminan wajib diisi!', 'error');

    const tglSekarang = new Date().toISOString().split('T')[0];

    // Logika Akuntansi (Pencatatan Otomatis ke Menu Keuangan)
    if (newStatus === 'Ditahan' && oldStatus !== 'Ditahan') {
        const txId = typeof generateFinanceId === 'function' ? generateFinanceId('income', tglSekarang) : 'INC-' + Date.now().toString().slice(-6);
        const tx = { id: txId, ID: txId, tanggal: tglSekarang, tgl: tglSekarang, Tgl: tglSekarang, keterangan: `Titipan Jaminan - ${b.nama} (${b.id})`, ket: `Titipan Jaminan - ${b.nama} (${b.id})`, Ket: `Titipan Jaminan - ${b.nama} (${b.id})`, kategori: 'Titipan Uang Jaminan', kat: 'Titipan Uang Jaminan', Kat: 'Titipan Uang Jaminan', metode: method, Metode: method, jumlah: amount, jml: amount, Jml: amount, dariKe: b.id, DariKe: b.id, tipe: 'in', Tipe: 'in', catatan: `Status: Ditahan`, Catatan: `Status: Ditahan`, timestamp: new Date().toISOString() };
        if(typeof INCOME !== 'undefined') INCOME.unshift(tx);
        if (typeof apiSaveIncome === 'function') apiSaveIncome(tx);
    } 
    else if (newStatus === 'Dikembalikan' && oldStatus === 'Ditahan') {
        const txId = typeof generateFinanceId === 'function' ? generateFinanceId('expense', tglSekarang) : 'EXP-' + Date.now().toString().slice(-6);
        const tx = { id: txId, ID: txId, tanggal: tglSekarang, tgl: tglSekarang, Tgl: tglSekarang, keterangan: `Pengembalian Jaminan - ${b.nama} (${b.id})`, ket: `Pengembalian Jaminan - ${b.nama} (${b.id})`, Ket: `Pengembalian Jaminan - ${b.nama} (${b.id})`, kategori: 'Pengembalian Uang Jaminan', kat: 'Pengembalian Uang Jaminan', Kat: 'Pengembalian Uang Jaminan', metode: method, Metode: method, jumlah: amount, jml: amount, Jml: amount, dariKe: b.id, DariKe: b.id, tipe: 'out', Tipe: 'out', catatan: `Status: Dikembalikan`, Catatan: `Status: Dikembalikan`, timestamp: new Date().toISOString() };
        if(typeof EXPENSE !== 'undefined') EXPENSE.unshift(tx);
        if (typeof apiSaveExpense === 'function') apiSaveExpense(tx);
    }

    // Update Data Booking
    row.deposit = amount; row.Deposit = amount;
    row.stDeposit = newStatus; row.StDeposit = newStatus;

    if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Reservasi', aksi: 'Ubah Status Jaminan', refId: id, lama: oldStatus, baru: newStatus, catatan: fmt(amount) });
    if (typeof refreshAllViews === 'function') refreshAllViews();

    if (typeof apiUpdateBooking === 'function') {
        apiUpdateBooking(id, { deposit: amount, Deposit: amount, stDeposit: newStatus, StDeposit: newStatus }).then(res => {
            if (res.success) { showToast('Uang Jaminan diperbarui'); viewBookingDetail(id); }
            else { showToast('Gagal update database', 'error'); }
        });
    } else {
        showToast('Uang Jaminan diperbarui (Lokal)'); viewBookingDetail(id);
    }
}