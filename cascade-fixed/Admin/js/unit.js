/* ============================================================
   js/unit.js — Manajemen Unit, Mapping, dan Master Settings
   ============================================================ */

// ── MASTER SETTINGS & UNIT DATA ─────────────────────────────
const DEFAULT_MASTER_SETTINGS = {
    unitRates: {
        RT:  { weekday: 400000, weekend: 750000 },
        FT:  { weekday: 300000, weekend: 650000 },
        CRT: { weekday: 500000, weekend: 850000 },
        RG:  { weekday: 700000, weekend: 1050000 }
    },
    holidays: []
};

function loadMasterSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('cascade_master_settings') || '{}');
        return {
            unitRates: { ...DEFAULT_MASTER_SETTINGS.unitRates, ...(saved.unitRates || {}) },
            holidays: Array.isArray(saved.holidays) ? saved.holidays : []
        };
    } catch (err) {
        console.warn('Gagal membaca master setting, gunakan default.', err);
        return JSON.parse(JSON.stringify(DEFAULT_MASTER_SETTINGS));
    }
}

let MASTER_SETTINGS = loadMasterSettings();

function saveMasterSettingsLocal() {
    localStorage.setItem('cascade_master_settings', JSON.stringify(MASTER_SETTINGS));
}

const UNIT_TYPES = {
    RT:  { name: 'Riverside Tent', capacity: 4, weekday: 400000, weekend: 750000 },
    FT:  { name: 'Forest Tent', capacity: 4, weekday: 300000, weekend: 650000 },
    CRT: { name: 'Cascading Riverside Tent', capacity: 4, weekday: 500000, weekend: 850000 },
    RG:  { name: 'Riverside Glamping', capacity: 4, weekday: 700000, weekend: 1050000 },
};

function applyMasterSettingsToUnitTypes() {
    Object.keys(MASTER_SETTINGS.unitRates || {}).forEach(code => {
        if (!UNIT_TYPES[code]) return;
        const rate = MASTER_SETTINGS.unitRates[code];
        UNIT_TYPES[code].weekday = Number(rate.weekday) || UNIT_TYPES[code].weekday;
        UNIT_TYPES[code].weekend = Number(rate.weekend) || UNIT_TYPES[code].weekend;
    });

    if (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) {
        UNITS.forEach(unit => {
            const cfg = UNIT_TYPES[unit.typeCode];
            if (!cfg) return;
            unit.priceWeekday = cfg.weekday;
            unit.priceWeekend = cfg.weekend;
        });
    }
}

function makeUnit(typeCode, number) {
    const type = UNIT_TYPES[typeCode];
    const seq = String(number).padStart(2, '0');
    return {
        id: `${typeCode}-${seq}`,
        typeCode,
        name: `${type.name} ${number}`,
        capacity: type.capacity,
        status: 'Ready',
        priceWeekday: type.weekday,
        priceWeekend: type.weekend,
        note: ''
    };
}

let UNITS = [
    ...Array.from({ length: 5 }, (_, i) => makeUnit('RT', i + 1)),
    ...Array.from({ length: 9 }, (_, i) => makeUnit('FT', i + 1)),
    ...Array.from({ length: 4 }, (_, i) => makeUnit('CRT', i + 1)),
    ...Array.from({ length: 5 }, (_, i) => makeUnit('RG', i + 1)),
];

applyMasterSettingsToUnitTypes();

// ── HOLIDAY & RATE HELPERS ──────────────────────────────────
function getHolidaySetting(dateStr) {
    return (MASTER_SETTINGS.holidays || []).find(h => h.date === dateStr) || null;
}

function isHolidayRateDate(dateStr) {
    const h = getHolidaySetting(dateStr);
    return Boolean(h && h.rateType === 'weekend');
}

function isWeekendOrHoliday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const day = d.getDay();
    return day === 5 || day === 6 || isHolidayRateDate(dateStr); // Jumat, Sabtu, atau Libur
}

function getRateTypeForDate(dateStr) {
    if (isHolidayRateDate(dateStr)) return 'Holiday';
    return isWeekendOrHoliday(dateStr) ? 'Weekend' : 'Weekday';
}

function getUnitTypeCodeFromName(nameOrCode) {
    const raw = String(nameOrCode || '').trim();
    const v = raw.toLowerCase();
    if (!raw) return '';
    if (UNIT_TYPES[raw.toUpperCase()]) return raw.toUpperCase();
    
    const found = Object.entries(UNIT_TYPES).find(([code, type]) => type.name.toLowerCase() === v);
    if (found) return found[0];

    const aliases = {
        'forest tent': 'FT',
        'riverside tent': 'RT',
        'cascading riverside tent': 'CRT',
        'riverside glamping': 'RG'
    };
    return aliases[v] || '';
}

function getUnitTypeName(codeOrName) {
    const code = getUnitTypeCodeFromName(codeOrName);
    return code ? UNIT_TYPES[code].name : String(codeOrName || '-');
}

// ── UNIT STATUS & MAPPING HELPERS ───────────────────────────
function getUnitStatusLabel(status) {
    const labels = {
        Ready: 'Siap Dijual', Dirty: 'Perlu Dibersihkan', Cleaning: 'Sedang Dibersihkan',
        Maintenance: 'Perbaikan', Blocked: 'Diblokir', Nonaktif: 'Nonaktif'
    };
    return labels[status] || status || '-';
}

function bookingMatchesUnitType(b, typeCode) {
    const typeName = UNIT_TYPES[typeCode]?.name;
    return b.unit === typeName || b.unit === typeCode || String(b.unit || '').startsWith(typeCode + '-');
}

function getBookingAssignedUnitId(b) {
    const keys = ['unitAssigned', 'UnitAssigned', 'assignedUnit', 'AssignedUnit', 'kodeUnit', 'KodeUnit', 'unitFisik', 'UnitFisik'];
    const direct = readField(b, keys,'');
    if (direct) return direct;
    return readField(b?.raw, keys, '');
}

function setBookingAssignedUnit(row, unitId) {
    row.unitAssigned = unitId;
    row.UnitAssigned = unitId;
    row.assignedUnit = unitId;
    row.KodeUnit = unitId;
}

function isBookingOverlap(checkinA, checkoutA, checkinB, checkoutB) {
    if (!checkinA || !checkoutA || !checkinB || !checkoutB) return false;
    const aIn = new Date(checkinA + 'T00:00:00');
    const aOut = new Date(checkoutA + 'T00:00:00');
    const bIn = new Date(checkinB + 'T00:00:00');
    const bOut = new Date(checkoutB + 'T00:00:00');
    return aIn < bOut && aOut > bIn;
}

function getAvailableUnitsForBooking(unitTypeName, checkin, checkout, ignoreBookingId = '') {
    const typeCode = getUnitTypeCodeFromName(unitTypeName);
    if (!typeCode) return [];

    const units = UNITS.filter(u => u.typeCode === typeCode && u.status === 'Ready').sort((a, b) => a.id.localeCompare(b.id));
    const bookings = getBookings().filter(b => !isCancelled(b) && isActiveGuestStatus(b) && String(b.id) !== String(ignoreBookingId));

    return units.filter(unit => {
        const used = bookings.some(b => {
            const assignedUnit = getBookingAssignedUnitId(b);
            if (!assignedUnit || assignedUnit !== unit.id) return false;
            return isBookingOverlap(checkin, checkout, b.checkin, b.checkout);
        });
        return !used;
    });
}

function getUnitLabel(unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return unitId || '-';
    return `${unit.id} - ${unit.name}`;
}

function assignBookingsToUnitsForDate(dateStr) {
    const assignments = {};
    Object.keys(UNIT_TYPES).forEach(typeCode => {
        const units = UNITS.filter(u => u.typeCode === typeCode).sort((a, b) => a.id.localeCompare(b.id));
        const bookings = getBookings().filter(b => !isCancelled(b) && isActiveGuestStatus(b) && isDateInStay(dateStr, b) && bookingMatchesUnitType(b, typeCode))
            .sort((a, b) => {
                const aAssigned = getBookingAssignedUnitId(a);
                const bAssigned = getBookingAssignedUnitId(b);
                if (aAssigned && !bAssigned) return -1;
                if (!aAssigned && bAssigned) return 1;
                return (a.checkin || '').localeCompare(b.checkin || '') || String(a.id).localeCompare(String(b.id));
            });

        bookings.forEach(b => {
            const assignedUnit = getBookingAssignedUnitId(b);
            if (assignedUnit && units.some(u => u.id === assignedUnit) && !assignments[assignedUnit]) {
                assignments[assignedUnit] = b;
            }
        });

        bookings.forEach(b => {
            const assignedUnit = getBookingAssignedUnitId(b);
            if (assignedUnit) return;
            const emptyUnit = units.find(u => !assignments[u.id]);
            if (emptyUnit) assignments[emptyUnit.id] = b;
        });
    });
    return assignments;
}

function getAssignedBookingForUnitOnDate(unit, dateStr) {
    return assignBookingsToUnitsForDate(dateStr)[unit.id] || null;
}

function getUnitBookingToday(unit) {
    const today = new Date().toISOString().split('T')[0];
    return getAssignedBookingForUnitOnDate(unit, today);
}

function getUnitTodayStatus(unit) {
    if (unit.status !== 'Ready') return getUnitStatusLabel(unit.status);
    const b = getUnitBookingToday(unit);
    return b ? `${b.nama} · ${b.stTamu}` : 'Tersedia';
}

function getNextBookingLabel(unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return '-';
    const today = new Date().toISOString().split('T')[0];
    const upcomingDates = [...new Set(getBookings()
        .filter(b => !isCancelled(b) && isActiveGuestStatus(b) && b.checkin >= today && bookingMatchesUnitType(b, unit.typeCode))
        .map(b => b.checkin).filter(Boolean))].sort();

    for (const dateStr of upcomingDates) {
        const assigned = getAssignedBookingForUnitOnDate(unit, dateStr);
        if (assigned) return `${fmtDate(dateStr)} · ${assigned.nama}`;
    }
    return 'Tidak ada';
}

// ── UI RENDERING: UNIT PAGE ─────────────────────────────────
function renderUnitTable() {
    const tbody = document.getElementById('unit-tbody');
    if (!tbody) return;

    const search = (document.getElementById('unit-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('unit-type-filter')?.value || '';
    const statusFilter = document.getElementById('unit-status-filter')?.value || '';

    const filtered = UNITS.filter(unit => {
        const typeName = UNIT_TYPES[unit.typeCode]?.name || unit.typeCode;
        const matchesSearch = !search || unit.id.toLowerCase().includes(search) || unit.name.toLowerCase().includes(search) || typeName.toLowerCase().includes(search);
        const matchesType = !typeFilter || unit.typeCode === typeFilter;
        const matchesStatus = !statusFilter || unit.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
    });

    const issueCount = UNITS.filter(u => ['Maintenance', 'Blocked', 'Nonaktif'].includes(u.status)).length;
    const readyCount = UNITS.filter(u => u.status === 'Ready').length;
    const occupiedCount = Object.keys(assignBookingsToUnitsForDate(new Date().toISOString().split('T')[0])).length;
    
    if (document.getElementById('unit-total')) document.getElementById('unit-total').textContent = UNITS.length;
    if (document.getElementById('unit-ready')) document.getElementById('unit-ready').textContent = readyCount;
    if (document.getElementById('unit-occupied')) document.getElementById('unit-occupied').textContent = occupiedCount;
    if (document.getElementById('unit-issue')) document.getElementById('unit-issue').textContent = issueCount;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada data unit.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(unit => {
        const typeName = UNIT_TYPES[unit.typeCode]?.name || unit.typeCode;
        return `<tr>
            <td style="font-family:monospace;color:var(--mossL)">${escapeHTML(unit.id)}</td>
            <td><strong>${escapeHTML(unit.name)}</strong></td>
            <td>${escapeHTML(typeName)}</td>
            <td>${unit.capacity} orang</td>
            <td>${fmt(unit.priceWeekday)}</td>
            <td>${fmt(unit.priceWeekend)}</td>
            <td>${escapeHTML(getUnitStatusLabel(unit.status))}</td>
            <td>${escapeHTML(getUnitTodayStatus(unit))}</td>
            <td>${escapeHTML(getNextBookingLabel(unit.id))}</td>
            <td>
                <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="openUnitDetail('${unit.id}')">Detail</button>
                <button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="changeUnitStatus('${unit.id}')">Status</button>
            </td>
        </tr>`;
    }).join('');
}

function resetUnitFilter() {
    if (document.getElementById('unit-search')) document.getElementById('unit-search').value = '';
    if (document.getElementById('unit-type-filter')) document.getElementById('unit-type-filter').value = '';
    if (document.getElementById('unit-status-filter')) document.getElementById('unit-status-filter').value = '';
    renderUnitTable();
}

function openUnitDetail(unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return;
    const typeName = UNIT_TYPES[unit.typeCode]?.name || unit.typeCode;
    const next = getNextBookingLabel(unit.id);
    const body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
        <div><div class="kpi-label">Kode Unit</div><strong>${escapeHTML(unit.id)}</strong></div>
        <div><div class="kpi-label">Nama Unit</div>${escapeHTML(unit.name)}</div>
        <div><div class="kpi-label">Tipe Camp</div>${escapeHTML(typeName)}</div>
        <div><div class="kpi-label">Kapasitas</div>${unit.capacity} orang</div>
        <div><div class="kpi-label">Harga Weekday</div>${fmt(unit.priceWeekday)}</div>
        <div><div class="kpi-label">Harga Weekend</div>${fmt(unit.priceWeekend)}</div>
        <div><div class="kpi-label">Status Operasional</div>${escapeHTML(getUnitStatusLabel(unit.status))}</div>
        <div><div class="kpi-label">Status Hari Ini</div>${escapeHTML(getUnitTodayStatus(unit))}</div>
        <div style="grid-column:span 2"><div class="kpi-label">Booking Berikutnya</div>${escapeHTML(next)}</div>
    </div>`;
    
    const foot = `
        <button class="btn-ghost" style="color:var(--red);" onclick="openBlockUnit('${unit.id}')">Blokir Tanggal (Maintenance)</button>
        <button class="btn-secondary" onclick="changeUnitStatus('${unit.id}')">Ubah Status</button>
        <button class="btn-primary" onclick="closeModal()">Tutup</button>
    `;
    openModal(`Detail Unit ${escapeHTML(unit.id)}`, body, foot);
}

function changeUnitStatus(unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return;
    const body = `<div><label class="kpi-label">Status Unit</label>
        <select id="unit-new-status" class="f-input">
            <option ${unit.status==='Ready'?'selected':''}>Ready</option>
            <option ${unit.status==='Dirty'?'selected':''}>Dirty</option>
            <option ${unit.status==='Cleaning'?'selected':''}>Cleaning</option>
            <option ${unit.status==='Maintenance'?'selected':''}>Maintenance</option>
            <option ${unit.status==='Blocked'?'selected':''}>Blocked</option>
            <option ${unit.status==='Nonaktif'?'selected':''}>Nonaktif</option>
        </select></div>`;
    const foot = `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitUnitStatus('${unit.id}')">Simpan Status</button>`;
    openModal(`Ubah Status ${escapeHTML(unit.id)}`, body, foot);
}

function submitUnitStatus(unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return;
    const oldStatus = unit.status;
    const newStatus = document.getElementById('unit-new-status').value;
    unit.status = newStatus;

    if(typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Unit', aksi: 'Ubah Status Unit', refId: unitId, lama: oldStatus, baru: newStatus, catatan: unit.name || '-' });
    }

    closeModal();
    renderUnitTable();
    if(typeof renderDashboardKPI === 'function') renderDashboardKPI();
    showToast(`Status ${unitId} berhasil diubah`);
}

// Membuka Form Blokir Tanggal
function openBlockUnit(unitId) {
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <div style="display:grid;gap:14px;">
            <div style="padding:14px;background:rgba(192,80,64,0.12);border:1px solid var(--red);border-radius:10px;">
                <div style="font-weight:700;color:var(--red);font-size:15px;margin-bottom:6px;">Blokir Unit: ${unitId}</div>
                <div style="font-size:12px;color:var(--txt2);">Unit akan ditutup secara otomatis pada rentang tanggal berikut, sehingga tidak bisa di-booking tamu.</div>
            </div>
            <div><label class="kpi-label">Tanggal Mulai Blokir *</label><input type="date" id="block-in" min="${today}" class="f-input"></div>
            <div><label class="kpi-label">Tanggal Selesai Blokir *</label><input type="date" id="block-out" min="${today}" class="f-input"></div>
            <div><label class="kpi-label">Alasan Maintenance / Keterangan *</label><input type="text" id="block-reason" class="f-input" placeholder="Contoh: Perbaikan atap bocor"></div>
        </div>
    `;
    openModal(`Blokir Tanggal Unit`, body, `<button class="btn-ghost" onclick="openUnitDetail('${unitId}')">Batal</button><button class="btn-primary" style="background:var(--red);" onclick="submitBlockUnit('${unitId}')">Blokir Sekarang</button>`);
}

// Mengeksekusi Blokir Unit (Membuat Fake Booking)
function submitBlockUnit(unitId) {
    const tIn = document.getElementById('block-in').value;
    const tOut = document.getElementById('block-out').value;
    const reason = document.getElementById('block-reason').value.trim();

    if (!tIn || !tOut || !reason) return showToast('Tanggal dan alasan wajib diisi!', 'error');
    if (new Date(tIn) >= new Date(tOut)) return showToast('Tanggal selesai harus lebih dari tanggal mulai!', 'error');

    // Cek apakah tanggal tsb sedang dipakai tamu asli
    if (typeof isUnitIdBooked === 'function' && isUnitIdBooked(unitId, tIn, tOut)) {
        return showToast('Unit ini masih memiliki tamu pada tanggal tersebut. Batalkan/pindahkan tamu terlebih dahulu.', 'error');
    }

    const unit = UNITS.find(u => u.id === unitId);
    const id = 'MTN-' + Date.now().toString().slice(-6);
    const fakeBooking = {
        id, ID: id, nama: 'MAINTENANCE / DIBLOKIR', wa: '-', email: '', kota: '-',
        checkin: tIn, checkout: tOut, unit: unit.typeCode, unitAssigned: unitId,
        guests: 0, total: 0, dp: 0, stBayar: 'Lunas', // Di-Lunas-kan agar tidak masuk piutang
        stTamu: 'Konfirmasi', sumber: 'MAINTENANCE',
        catatan: `ALASAN: ${reason}`, timestamp: new Date().toISOString()
    };

    BOOKINGS.push(fakeBooking);
    
    if (typeof addActivityLog === 'function') addActivityLog({ modul: 'Unit', aksi: 'Blokir Tanggal', refId: id, lama: unitId, baru: 'Diblokir', catatan: reason });
    
    if (typeof apiSaveBooking === 'function') {
        showLoading('Menyimpan Blokir...');
        apiSaveBooking(fakeBooking).then(res => {
            hideLoading();
            if (res.success) { showToast(`Unit ${unitId} berhasil diblokir.`); closeModal(); refreshAllViews(); }
            else showToast('Gagal memblokir', 'error');
        });
    }
}

function openUnitAdd() {
    const options = Object.entries(UNIT_TYPES).map(([code, t]) => `<option value="${code}">${t.name}</option>`).join('');
    const body = `<div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div><label class="kpi-label">Kode Unit *</label><input type="text" id="unit-id" class="f-input" placeholder="Contoh: RT-06"></div>
        <div><label class="kpi-label">Nama Unit *</label><input type="text" id="unit-name" class="f-input" placeholder="Contoh: Riverside Tent 6"></div>
        <div><label class="kpi-label">Tipe Camp *</label><select id="unit-type" class="f-input">${options}</select></div>
        <div><label class="kpi-label">Kapasitas *</label><input type="number" id="unit-capacity" class="f-input" value="4"></div>
        <div><label class="kpi-label">Harga Weekday *</label><input type="number" id="unit-price-weekday" class="f-input" placeholder="300000"></div>
        <div><label class="kpi-label">Harga Weekend *</label><input type="number" id="unit-price-weekend" class="f-input" placeholder="650000"></div>
    </div>`;
    openModal('Tambah Unit Baru', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitUnitAdd()">Tambah Unit</button>`);
}

function submitUnitAdd() {
    const id = document.getElementById('unit-id').value.trim().toUpperCase();
    const name = document.getElementById('unit-name').value.trim();
    const typeCode = document.getElementById('unit-type').value;
    const capacity = Number(document.getElementById('unit-capacity').value) || UNIT_TYPES[typeCode].capacity;
    const priceWeekday = Number(document.getElementById('unit-price-weekday').value) || UNIT_TYPES[typeCode].weekday;
    const priceWeekend = Number(document.getElementById('unit-price-weekend').value) || UNIT_TYPES[typeCode].weekend;
    
    if (!id || !name || UNITS.some(u => u.id === id)) return showToast('Kode unit kosong atau sudah digunakan!', 'error');
    
    UNITS.push({ id, typeCode, name, capacity, status: 'Ready', priceWeekday, priceWeekend, note: '' });
    closeModal();
    renderUnitTable();
    showToast(`Unit ${id} berhasil ditambahkan!`);
}

// ── UI RENDERING: MASTER SETTING PAGE ───────────────────────
function renderMasterSettingsPage() {
    renderUnitRateSettings();
    renderHolidaySettings();
}

function renderUnitRateSettings() {
    const tbody = document.getElementById('settings-rate-tbody');
    if (!tbody) return;

    tbody.innerHTML = Object.entries(UNIT_TYPES).map(([code, type]) => {
        const rate = MASTER_SETTINGS.unitRates[code] || { weekday: type.weekday, weekend: type.weekend };
        return `
            <tr>
                <td style="font-family:monospace;color:var(--mossL)">${escapeHTML(code)}</td>
                <td><strong>${escapeHTML(type.name)}</strong></td>
                <td>${type.capacity} orang</td>
                <td><input type="number" id="rate-${code}-weekday" class="f-input" value="${rate.weekday}" min="0"></td>
                <td><input type="number" id="rate-${code}-weekend" class="f-input" value="${rate.weekend}" min="0"></td>
            </tr>
        `;
    }).join('');
}

function saveUnitRateSettings() {
    if (typeof isOwner === 'function' && !isOwner()) return showToast('Hanya Owner yang boleh mengubah Master Setting.', 'error');

    Object.keys(UNIT_TYPES).forEach(code => {
        const weekday = Number(document.getElementById(`rate-${code}-weekday`)?.value || 0);
        const weekend = Number(document.getElementById(`rate-${code}-weekend`)?.value || 0);
        if (!MASTER_SETTINGS.unitRates[code]) MASTER_SETTINGS.unitRates[code] = {};
        MASTER_SETTINGS.unitRates[code].weekday = weekday;
        MASTER_SETTINGS.unitRates[code].weekend = weekend;
    });

    saveMasterSettingsLocal();
    applyMasterSettingsToUnitTypes();

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Master Setting', aksi: 'Ubah Tarif Unit', refId: 'UNIT_RATE', lama: '-', baru: 'Tarif diperbarui' });
    }

    if(typeof refreshAllViews === 'function') refreshAllViews();
    renderMasterSettingsPage();
    showToast('Tarif unit berhasil disimpan');
}

function renderHolidaySettings() {
    const tbody = document.getElementById('settings-holiday-tbody');
    if (!tbody) return;

    const rows = [...(MASTER_SETTINGS.holidays || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--txt3);">Belum ada tanggal libur.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(h => `
        <tr>
            <td>${fmtDate(h.date)}</td>
            <td><strong>${escapeHTML(h.name || '-')}</strong></td>
            <td>${h.rateType === 'weekend' ? 'Weekend / Holiday Rate' : 'Weekday Rate'}</td>
            <td>${escapeHTML(h.note || '-')}</td>
            <td>
                <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="deleteHolidaySetting('${escapeHTML(h.date)}')">Hapus</button>
            </td>
        </tr>
    `).join('');
}

function openHolidaySettingAdd() {
    if (typeof isOwner === 'function' && !isOwner()) return showToast('Hanya Owner yang boleh mengubah Master Setting.', 'error');
    const today = new Date().toISOString().split('T')[0];

    const body = `
        <div style="display:grid;gap:14px;">
            <div><label class="kpi-label">Tanggal Libur / High Season *</label><input type="date" id="holiday-date" class="f-input" value="${today}"></div>
            <div><label class="kpi-label">Nama Libur / Event *</label><input type="text" id="holiday-name" class="f-input" placeholder="Contoh: Libur Nasional"></div>
            <div><label class="kpi-label">Rate yang Digunakan</label><select id="holiday-rate-type" class="f-input"><option value="weekend">Weekend / Holiday Rate</option><option value="weekday">Weekday Rate</option></select></div>
            <div><label class="kpi-label">Catatan</label><textarea id="holiday-note" class="f-input" placeholder="Opsional"></textarea></div>
        </div>
    `;

    openModal('Tambah Tanggal Libur', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitHolidaySettingAdd()">Simpan</button>`);
}

function submitHolidaySettingAdd() {
    const date = document.getElementById('holiday-date')?.value || '';
    const name = document.getElementById('holiday-name')?.value.trim() || '';
    const rateType = document.getElementById('holiday-rate-type')?.value || 'weekend';
    const note = document.getElementById('holiday-note')?.value.trim() || '';

    if (!date || !name) return showToast('Tanggal dan nama libur wajib diisi.', 'error');

    MASTER_SETTINGS.holidays = (MASTER_SETTINGS.holidays || []).filter(h => h.date !== date);
    MASTER_SETTINGS.holidays.push({ date, name, rateType, note });

    saveMasterSettingsLocal();

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Master Setting', aksi: 'Tambah Tanggal Libur', refId: date, baru: name });
    }

    closeModal();
    renderMasterSettingsPage();
    showToast('Tanggal libur berhasil disimpan');
}

function deleteHolidaySetting(dateStr) {
    if (typeof isOwner === 'function' && !isOwner()) return showToast('Hanya Owner yang boleh mengubah Master Setting.', 'error');
    if (!confirm('Hapus tanggal libur ini dari Master Setting?')) return;

    MASTER_SETTINGS.holidays = (MASTER_SETTINGS.holidays || []).filter(h => h.date !== dateStr);
    saveMasterSettingsLocal();

    if (typeof addActivityLog === 'function') {
        addActivityLog({ modul: 'Master Setting', aksi: 'Hapus Tanggal Libur', refId: dateStr, lama: dateStr, baru: 'Dihapus' });
    }

    renderMasterSettingsPage();
    showToast('Tanggal libur berhasil dihapus');
}