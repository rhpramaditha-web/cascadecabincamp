/* ============================================================
   admin/js/app.js — Core UI Manager (Fixed & Complete)
   ============================================================ */

// ── 1. INISIALISASI ──
document.addEventListener('DOMContentLoaded', () => {
    showPage('dashboard');
    setTimeout(syncDataFromSheets, 500);
});

function refreshAllViews() {
    renderDashboardKPI();
    renderBookingTable(); 
    renderTamuTable();    
    renderKalender();     
    if (typeof renderFinance === 'function') renderFinance();
}

// ── 2. NAVIGASI HALAMAN (SPA) ──
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetPage = document.getElementById('page-' + pageId);
    const targetNav  = document.getElementById('nav-' + pageId);
    
    if (targetPage) targetPage.classList.add('active');
    if (targetNav)  targetNav.classList.add('active');

    const titles = {
        'dashboard': ['Ringkasan', 'Pantau kondisi camp hari ini'],
        'kalender':  ['Kalender Reservasi', 'Jadwal ketersediaan unit'],
        'booking':   ['Daftar Reservasi', 'Kelola semua pesanan masuk'],
        'finance':   ['Keuangan', 'Pemasukan dan pengeluaran'],
        'tamu':      ['Database Tamu', 'Daftar seluruh pelanggan Cascade'],
    };
    
    document.getElementById('topbar-title').textContent = titles[pageId]?.[0] || 'Admin';
    document.getElementById('topbar-sub').textContent   = titles[pageId]?.[1] || '';
}

// ── 3. MANAJEMEN MODAL (POP-UP) ──
function openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

// ── 4. DASHBOARD KPI RENDER ──
function renderDashboardKPI() {
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = BOOKINGS.filter(b => b.tglIn === today || b.checkin === today);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const monthBookings = BOOKINGS.filter(b => {
        const d = new Date((b.tglIn || b.checkin) + 'T00:00:00');
        return d >= monthStart && d <= monthEnd;
    });
    
    const totalIncome = monthBookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    const availableUnits = 9 - BOOKINGS.filter(b => (b.stTamu === 'Check-in' || b.stTamu === 'Konfirmasi')).length;

    document.getElementById('kpi-checkin').textContent = todayBookings.length;
    document.getElementById('kpi-available').textContent = availableUnits;
    document.getElementById('kpi-income').textContent = fmt(totalIncome);

    // Render recent bookings table
    const tbody = document.getElementById('dash-table-wrap');
    if (!tbody) return;

    const recent = BOOKINGS.slice(0, 5);
    if (recent.length === 0) {
        tbody.innerHTML = '<div style="padding:40px;text-align:center;color:var(--txt3)">Belum ada reservasi</div>';
        return;
    }

    tbody.innerHTML = `
        <table>
            <thead>
                <tr><th>ID</th><th>Tamu</th><th>Check-in</th><th>Unit</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${recent.map(b => `
                    <tr>
                        <td style="font-family:monospace; color:var(--mossL)">${b.id}</td>
                        <td><strong>${b.nama}</strong></td>
                        <td>${fmtDate(b.tglIn || b.checkin)}</td>
                        <td>${b.unit}</td>
                        <td>${stPill(b.stTamu)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ── 5. RENDER HALAMAN RESERVASI ──
function renderBookingTable() {
    const tbody = document.getElementById('booking-tbody');
    const q = (document.getElementById('booking-search')?.value || '').toLowerCase();
    
    if (!tbody) return;

    const filtered = BOOKINGS.filter(b => 
        !q || b.nama.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)
    ).sort((a,b) => (b.id || "").localeCompare(a.id || ""));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada data reservasi.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(b => `
        <tr>
            <td style="font-family:monospace; color:var(--mossL)">${b.id}</td>
            <td><strong>${b.nama}</strong><br><small>${b.wa}</small></td>
            <td>${fmtDate(b.tglIn || b.checkin)}</td>
            <td>${b.unit}</td>
            <td>${fmt(b.total)}</td>
            <td>${payPill(b.stBayar)}</td>
            <td>${stPill(b.stTamu)}</td>
            <td>
                <button class="btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="viewBookingDetail('${b.id}')">Detail</button>
            </td>
        </tr>
    `).join('');
}

function filterBookings() { renderBookingTable(); }

// ── 6. FITUR TAMBAH BOOKING ──
function openQuickAdd() {
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div><label class="kpi-label">Nama Lengkap *</label><input type="text" id="qa-nama" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="Nama sesuai KTP"></div>
            <div><label class="kpi-label">WhatsApp *</label><input type="text" id="qa-wa" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="08xxxxxxxx"></div>
            <div><label class="kpi-label">Email</label><input type="email" id="qa-email" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="email@tamu.com"></div>
            <div><label class="kpi-label">Kota Asal</label><input type="text" id="qa-kota" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="Contoh: Jakarta"></div>
            <div><label class="kpi-label">Check-in *</label><input type="date" id="qa-in" min="${today}" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div><label class="kpi-label">Check-out *</label><input type="date" id="qa-out" min="${today}" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div>
                <label class="kpi-label">Tipe Unit *</label>
                <select id="qa-unit" class="f-input" style="width:100%;padding:10px;border-radius:4px">
                    <option>Forest Tent</option>
                    <option>Riverside Tent</option>
                    <option>Riverside Glamping</option>
                </select>
            </div>
            <div><label class="kpi-label">Jumlah Tamu</label><input type="number" id="qa-tamu" value="2" class="f-input" style="width:100%;padding:10px;border-radius:4px" min="1"></div>
            <div style="grid-column: span 2;">
                <label class="kpi-label">Sumber Booking</label>
                <select id="qa-sumber" class="f-input" style="width:100%;padding:10px;border-radius:4px">
                    <option>Admin Dashboard</option>
                    <option>WhatsApp</option>
                    <option>Direct Call</option>
                    <option>Instagram</option>
                </select>
            </div>
            <div style="grid-column: span 2;">
                <label class="kpi-label">Catatan / Permintaan Khusus</label>
                <textarea id="qa-catatan" class="f-input" style="width:100%;padding:10px;border-radius:4px;min-height:60px" placeholder="Catatan tambahan untuk tamu..."></textarea>
            </div>
        </div>
    `;
    const foot = `
        <button class="btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn-primary" onclick="submitQuickAdd()">Simpan Booking</button>
    `;
    openModal('Tambah Reservasi Baru', body, foot);
}

function submitQuickAdd() {
    const nama    = document.getElementById('qa-nama').value.trim();
    const wa      = document.getElementById('qa-wa').value.trim();
    const email   = document.getElementById('qa-email').value.trim();
    const kota    = document.getElementById('qa-kota').value.trim() || '-';
    const tIn     = document.getElementById('qa-in').value;
    const tOut    = document.getElementById('qa-out').value;
    const unit    = document.getElementById('qa-unit').value;
    const guests  = parseInt(document.getElementById('qa-tamu').value) || 2;
    const catatan = document.getElementById('qa-catatan').value;
    const sumber  = document.getElementById('qa-sumber').value;

    if (!nama || !wa || !tIn || !tOut) { 
        showToast('Nama, WA, Check-in, dan Check-out wajib diisi!', 'error'); 
        return; 
    }
    if (tOut <= tIn) { 
        showToast('Tanggal Check-out harus lebih besar dari Check-in!', 'error'); 
        return; 
    }

    const prices = {
        'Forest Tent': { wd: 300000, we: 650000 },
        'Riverside Tent': { wd: 400000, we: 750000 },
        'Riverside Glamping': { wd: 750000, we: 1050000 }
    };

    let wd = 0, we = 0;
    let d = new Date(tIn + 'T00:00:00');
    let end = new Date(tOut + 'T00:00:00');
    
    while (d < end) {
        const day = d.getDay();
        if (day === 5 || day === 6) we++; else wd++;
        d.setDate(d.getDate() + 1);
    }

    const durasi = wd + we;
    const cfg = prices[unit];
    const total = (wd * cfg.wd) + (we * cfg.we);
    
    let info = [];
    if (wd > 0) info.push(`${wd} malam Weekday`);
    if (we > 0) info.push(`${we} malam Weekend`);

    const id = 'BK' + Date.now().toString().slice(-6);

    const newBk = {
        id: id, nama: nama, wa: wa, email: email, kota: kota,
        checkin: tIn, checkout: tOut, tglIn: tIn, tglOut: tOut,
        durasi: durasi, guests: guests, tamu: guests, unit: unit,
        pkg: info.join(' + '), paket: info.join(' + '),
        harga: total, total: total, dp: Math.round(total / 2),
        stBayar: 'Belum', stTamu: 'Konfirmasi', catatan: catatan,
        sumber: sumber, timestamp: new Date().toISOString()
    };

    BOOKINGS.unshift(newBk);
    refreshAllViews();
    closeModal();
    showToast('Mengirim data ke database...');

    apiSaveBooking(newBk).then(res => {
        if (res.success) showToast(`Reservasi ${id} berhasil disimpan!`);
        else showToast('Gagal menyimpan ke database online', 'error');
    });
}

// ── 7. DETAIL & AKSI BOOKING ──
function viewBookingDetail(id) {
    const b = BOOKINGS.find(x => x.id === id);
    if (!b) return;

    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:14px">
            <div><div class="kpi-label">Nama</div><strong>${b.nama}</strong></div>
            <div><div class="kpi-label">WhatsApp</div>${b.wa}</div>
            <div><div class="kpi-label">Unit</div>${b.unit} (${b.tamu || b.guests} org)</div>
            <div><div class="kpi-label">Total Harga</div><strong style="color:var(--mossL);font-size:16px">${fmt(b.total)}</strong></div>
            <div><div class="kpi-label">Check-in</div>${fmtDate(b.tglIn || b.checkin)}</div>
            <div><div class="kpi-label">Check-out</div>${fmtDate(b.tglOut || b.checkout)}</div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg3);padding:16px;border-radius:8px">
            <div>
                <label class="kpi-label">Status Bayar</label>
                <select class="f-input" style="padding:6px;width:100%" onchange="changeStatus('${b.id}', 'stBayar', this.value)">
                    <option ${b.stBayar==='Belum'?'selected':''}>Belum</option>
                    <option ${b.stBayar==='DP 50%'?'selected':''}>DP 50%</option>
                    <option ${b.stBayar==='Lunas'?'selected':''}>Lunas</option>
                </select>
            </div>
            <div>
                <label class="kpi-label">Status Tamu</label>
                <select class="f-input" style="padding:6px;width:100%" onchange="changeStatus('${b.id}', 'stTamu', this.value)">
                    <option ${b.stTamu==='Konfirmasi'?'selected':''}>Konfirmasi</option>
                    <option ${b.stTamu==='Check-in'?'selected':''}>Check-in</option>
                    <option ${b.stTamu==='Check-out'?'selected':''}>Check-out</option>
                    <option ${b.stTamu==='Dibatalkan'?'selected':''}>Dibatalkan</option>
                </select>
            </div>
        </div>
        
        <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:8px;font-size:13px;">
            <div class="kpi-label">Catatan</div>
            <div>${b.catatan || '(tidak ada catatan)'}</div>
        </div>
    `;
    
    const foot = `
        <button class="btn-secondary" onclick="deleteBooking('${b.id}')">Hapus</button>
        <button class="btn-ghost" onclick="closeModal()">Tutup</button>
    `;
    
    openModal(`Detail Reservasi ${b.id}`, body, foot);
}

function changeStatus(id, field, value) {
    const b = BOOKINGS.find(x => x.id === id);
    if (!b) return;
    
    b[field] = value;
    refreshAllViews();
    
    apiUpdateBooking(id, { [field]: value }).then(res => {
        if (res.success) showToast('Status berhasil diubah');
        else showToast('Gagal mengubah status', 'error');
    });
}

function deleteBooking(id) {
    if (!confirm('Hapus reservasi ini? Tindakan tidak dapat dibatalkan.')) return;
    
    BOOKINGS = BOOKINGS.filter(x => x.id !== id);
    refreshAllViews();
    closeModal();
    showToast('Menghapus dari database...');
    
    apiDeleteBooking(id).then(res => {
        if (res.success) showToast('Reservasi berhasil dihapus');
        else showToast('Gagal menghapus', 'error');
    });
}

// ── 8. RENDER TAMU DATABASE ──
function renderTamuTable() {
    const tbody = document.getElementById('tamu-tbody');
    if (!tbody) return;

    // Deduplikasi tamu berdasarkan WhatsApp
    const uniqueTamu = [];
    const seen = new Set();
    
    for (const b of BOOKINGS) {
        if (b.wa && !seen.has(b.wa)) {
            seen.add(b.wa);
            const lastBooking = BOOKINGS.filter(x => x.wa === b.wa).sort((a, c) => 
                new Date(c.tglIn || c.checkin) - new Date(a.tglIn || a.checkin)
            )[0];
            
            uniqueTamu.push({
                nama: b.nama,
                wa: b.wa,
                kota: b.kota || '-',
                total: BOOKINGS.filter(x => x.wa === b.wa).length,
                terakhir: lastBooking.tglIn || lastBooking.checkin
            });
        }
    }

    if (uniqueTamu.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada data pelanggan.</td></tr>';
        return;
    }

    tbody.innerHTML = uniqueTamu.map(t => `
        <tr>
            <td><strong>${t.nama}</strong></td>
            <td><a href="https://wa.me/${t.wa.replace(/[^\d]/g, '')}" target="_blank" style="color:var(--mossL);text-decoration:none">${t.wa}</a></td>
            <td>${t.kota}</td>
            <td style="text-align:center;font-weight:600">${t.total}</td>
            <td>${fmtDate(t.terakhir)}</td>
            <td><button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="alert('Fitur detail tamu akan hadir')">Detail</button></td>
        </tr>
    `).join('');
}

// ── 9. RENDER KALENDER ──
let currentCalMonth = new Date();

function renderKalender() {
    const cal = document.getElementById('cal-grid');
    const label = document.getElementById('cal-label');
    
    if (!cal || !label) return;

    const year = currentCalMonth.getFullYear();
    const month = currentCalMonth.getMonth();
    
    label.textContent = currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    
    // Header hari
    ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach(d => {
        html += `<div style="text-align:center;padding:8px;color:var(--txt3);font-size:11px;font-weight:600">${d}</div>`;
    });
    
    // Kosongkan sel sebelum hari pertama
    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }
    
    // Isi tanggal
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const bookingsOnDay = BOOKINGS.filter(b => {
            const d = new Date((b.tglIn || b.checkin) + 'T00:00:00');
            return d.toISOString().split('T')[0] === dateStr;
        }).length;
        
        const bgColor = bookingsOnDay > 0 ? 'var(--bg3)' : 'transparent';
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const borderStyle = isToday ? '2px solid var(--mossL)' : '1px solid var(--bdr)';
        
        html += `
            <div style="padding:8px;border:${borderStyle};border-radius:4px;background:${bgColor};text-align:center;cursor:pointer;font-size:12px" onclick="alert('${bookingsOnDay} booking(s) pada ${dateStr}')">
                <div style="font-weight:600;color:var(--txt1)">${day}</div>
                ${bookingsOnDay > 0 ? `<div style="font-size:10px;color:var(--mossL)">${bookingsOnDay} booking</div>` : ''}
            </div>
        `;
    }
    
    cal.innerHTML = html;
}

function changeMonth(offset) {
    currentCalMonth = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + offset, 1);
    renderKalender();
}

// ── 10. FINANCE SECTION ──
function renderFinance() {
    const tbody = document.getElementById('finance-tbody');
    if (!tbody) return;

    // Gabung income dan expense
    const allTransactions = [
        ...INCOME.map(i => ({ ...i, tipe: 'income', icon: '↓' })),
        ...EXPENSE.map(e => ({ ...e, tipe: 'expense', icon: '↑' }))
    ].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    if (allTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada transaksi keuangan.</td></tr>';
        return;
    }

    // Update KPI
    const totalIncome = INCOME.reduce((sum, i) => sum + (Number(i.jumlah) || 0), 0);
    const totalExpense = EXPENSE.reduce((sum, e) => sum + (Number(e.jumlah) || 0), 0);
    
    document.getElementById('fin-in').textContent = fmt(totalIncome);
    document.getElementById('fin-out').textContent = fmt(totalExpense);
    document.getElementById('fin-saldo').textContent = fmt(totalIncome - totalExpense);

    tbody.innerHTML = allTransactions.slice(0, 20).map(t => `
        <tr>
            <td style="font-family:monospace;color:var(--mossL)">${t.id}</td>
            <td><strong>${t.keterangan}</strong></td>
            <td>${fmtDate(t.tanggal)}</td>
            <td>${t.kategori || '-'}</td>
            <td>${t.tipe === 'income' ? '📥 Masuk' : '📤 Keluar'}</td>
            <td style="text-align:right;font-weight:600;color:${t.tipe === 'income' ? 'var(--mossLL)' : 'var(--red)'}">${t.tipe === 'income' ? '+' : '-'} ${fmt(t.jumlah)}</td>
        </tr>
    `).join('');
}

function openFinanceAdd() {
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div><label class="kpi-label">Keterangan *</label><input type="text" id="fin-desc" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="Contoh: Booking Resort"></div>
            <div><label class="kpi-label">Tanggal *</label><input type="date" id="fin-date" value="${today}" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div><label class="kpi-label">Kategori</label><input type="text" id="fin-cat" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="Contoh: Makanan"></div>
            <div>
                <label class="kpi-label">Tipe Transaksi *</label>
                <select id="fin-type" class="f-input" style="width:100%;padding:10px;border-radius:4px">
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                </select>
            </div>
            <div style="grid-column:span 2;"><label class="kpi-label">Jumlah (Rp) *</label><input type="number" id="fin-amount" class="f-input" style="width:100%;padding:10px;border-radius:4px" placeholder="0" min="0"></div>
        </div>
    `;
    const foot = `
        <button class="btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn-primary" onclick="submitFinanceAdd()">Simpan Transaksi</button>
    `;
    openModal('Catat Transaksi Keuangan', body, foot);
}

function submitFinanceAdd() {
    const desc = document.getElementById('fin-desc').value.trim();
    const date = document.getElementById('fin-date').value;
    const cat = document.getElementById('fin-cat').value.trim() || '-';
    const type = document.getElementById('fin-type').value;
    const amount = parseInt(document.getElementById('fin-amount').value) || 0;

    if (!desc || !date || amount === 0) {
        showToast('Keterangan, tanggal, dan jumlah wajib diisi!', 'error');
        return;
    }

    const id = (type === 'income' ? 'INC' : 'EXP') + Date.now().toString().slice(-6);
    
    const newTx = {
        id: id,
        keterangan: desc,
        tanggal: date,
        kategori: cat,
        jumlah: amount,
        timestamp: new Date().toISOString()
    };

    if (type === 'income') {
        INCOME.unshift(newTx);
        apiSaveIncome(newTx).then(res => {
            if (res.success) showToast(`Pemasukan ${id} berhasil dicatat!`);
            else showToast('Gagal menyimpan data', 'error');
        });
    } else {
        EXPENSE.unshift(newTx);
        apiSaveExpense(newTx).then(res => {
            if (res.success) showToast(`Pengeluaran ${id} berhasil dicatat!`);
            else showToast('Gagal menyimpan data', 'error');
        });
    }

    refreshAllViews();
    closeModal();
}
