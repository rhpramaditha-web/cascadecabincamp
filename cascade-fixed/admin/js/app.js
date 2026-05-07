/* ============================================================
   js/app.js — SPA Logic & UI Manager
   Tugas: Mengatur navigasi, merender tabel, dan logika klik
   ============================================================ */

// ── 1. INIT SINKRONISASI AWAL ──
document.addEventListener('DOMContentLoaded', async () => {
    showToast('Memuat data...');
    
    // Tunggu sync selesai dulu
    await syncDataFromSheets();
    
    // Baru render & tampilkan halaman
    showPage('dashboard');
    closeToast(); // atau update toast
});

// Fungsi ini dipanggil oleh api.js setelah data berhasil ditarik
function refreshAllViews() {
    renderDashboardKPI();
    renderBookingTable();
    renderTamuTable();
	renderFinance();
	renderCalendar();
    // Jika Anda punya fungsi renderKalender atau renderFinance, taruh di sini nanti
}

// ── 2. SISTEM NAVIGASI SPA ──
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetPage = document.getElementById('page-' + pageId);
    const targetNav  = document.getElementById('nav-' + pageId);
    
    if (targetPage) targetPage.classList.add('active');
    if (targetNav)  targetNav.classList.add('active');

    const titles = {
        'dashboard': ['Ringkasan', 'Pantau kondisi camp hari ini'],
        'booking':   ['Semua Reservasi', 'Kelola pesanan tamu'],
        'tamu':      ['Database Tamu', 'Daftar riwayat pelanggan'],
        'kalender':  ['Kalender', 'Jadwal ketersediaan'],
        'unit':      ['Status Unit', 'Manajemen kebersihan & maintenance'],
        'finance':   ['Keuangan', 'Pemasukan & Pengeluaran']
    };
    
    document.getElementById('topbar-title').textContent = titles[pageId]?.[0] || 'Dashboard';
    document.getElementById('topbar-sub').textContent   = titles[pageId]?.[1] || '';
}

// ── 3. MODAL MANAGER ──
function openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

// ── 4. DASHBOARD RENDERER ──
function renderDashboardKPI() {
    const today = new Date().toISOString().split('T')[0];
    
    const checkinsToday = BOOKINGS.filter(b => b.tglIn === today && b.stTamu !== 'Dibatalkan').length;
    const activeNow = BOOKINGS.filter(b => b.tglIn <= today && b.tglOut >= today && ['Check-in','Akan datang','Konfirmasi'].includes(b.stTamu)).length;
    const available = 16 - activeNow; // Total 16 unit (4 Cabin, 7 Tent, 5 Glamping)
    
    const incomeBlnIni = INCOME.reduce((sum, tx) => sum + (parseFloat(tx.jml) || 0), 0);

    document.getElementById('kpi-checkin').textContent = checkinsToday;
    document.getElementById('kpi-available').textContent = available;
    document.getElementById('kpi-income').textContent = fmt(incomeBlnIni);

    // Render Tabel Kecil Dashboard
    const dashWrap = document.getElementById('dash-table-wrap');
    if (!recent.length) {
  dashWrap.innerHTML = '<p style="padding:20px;text-align:center;color:var(--txt3)">Belum ada reservasi</p>';
  return;
}
    
    if (!dashWrap) return;
    dashWrap.innerHTML = `
        <table>
            <thead><tr><th>ID</th><th>Tamu</th><th>Check-in</th><th>Status</th></tr></thead>
            <tbody>
                ${recent.map(b => `
                    <tr style="cursor:pointer" onclick="showPage('booking')">
                        <td style="color:var(--mossL);font-family:monospace">${b.id}</td>
                        <td><strong>${b.nama}</strong></td>
                        <td>${fmtDate(b.tglIn)}</td>
                        <td>${stPill(b.stTamu)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ── 5. BOOKING & QUICK ADD ──
function renderBookingTable() {
    const tbody = document.getElementById('booking-tbody');
    const q = (document.getElementById('booking-search')?.value || '').toLowerCase();
    
    if (!tbody) return;

    const filtered = BOOKINGS.filter(b => 
        !q || b.nama.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)
    );

    tbody.innerHTML = filtered.map(b => `
        <tr>
            <td style="color:var(--mossL);font-family:monospace">${b.id}</td>
            <td><strong>${b.nama}</strong><br><span style="font-size:11px;color:var(--txt3)">${b.wa}</span></td>
            <td>${fmtDate(b.tglIn)}</td>
            <td>${b.unit}</td>
            <td><strong>${fmt(b.total)}</strong></td>
            <td>${payPill(b.stBayar)}</td>
            <td>${stPill(b.stTamu)}</td>
            <td>
                <button class="btn-secondary" style="padding:6px 12px;font-size:11px;" onclick="viewBookingDetail('${b.id}')">Detail</button>
            </td>
        </tr>
    `).join('');
}

function filterBookings() { renderBookingTable(); }

function openQuickAdd() {
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div><label class="kpi-label">Nama Lengkap *</label><input type="text" id="qa-nama" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div><label class="kpi-label">WhatsApp *</label><input type="text" id="qa-wa" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div><label class="kpi-label">Check-in *</label><input type="date" id="qa-in" min="${today}" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div><label class="kpi-label">Check-out *</label><input type="date" id="qa-out" min="${today}" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div>
                <label class="kpi-label">Tipe Unit *</label>
                <select id="qa-unit" class="f-input" style="width:100%;padding:10px;border-radius:4px">
                    <option>Forest Tent</option><option>Riverside Tent</option><option>Riverside Glamping</option>
                </select>
            </div>
            <div><label class="kpi-label">Jumlah Tamu</label><input type="number" id="qa-tamu" value="2" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
        </div>
        <div><label class="kpi-label">Catatan</label><textarea id="qa-catatan" class="f-input" style="width:100%;padding:10px;border-radius:4px;min-height:60px"></textarea></div>
    `;
    const foot = `
        <button class="btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn-primary" onclick="submitQuickAdd()">Simpan Booking</button>
    `;
    openModal('Tambah Reservasi Baru', body, foot);
}

function submitQuickAdd() {
    const nama = document.getElementById('qa-nama').value.trim();
    const wa   = document.getElementById('qa-wa').value.trim();
    const tIn  = document.getElementById('qa-in').value;
    const tOut = document.getElementById('qa-out').value;
    const unit = document.getElementById('qa-unit').value;
    const tamu = document.getElementById('qa-tamu').value || 2;
    const ctt  = document.getElementById('qa-catatan').value;

    if (!nama || !wa || !tIn || !tOut) { showToast('Harap lengkapi kolom ber-bintang', 'error'); return; }
    if (tOut <= tIn) { showToast('Check-out harus setelah Check-in', 'error'); return; }

    const prices = {
        'Forest Tent': { wd: 300000, we: 650000 },
        'Riverside Tent': { wd: 400000, we: 750000 },
        'Riverside Glamping': { wd: 750000, we: 1050000 }
    };

    // Hitung malam (sama seperti web tamu)
    let wd = 0, we = 0;
    for (let d = new Date(tIn); d < new Date(tOut); d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 5 || d.getDay() === 6) we++; else wd++;
    }

    const durasi = wd + we;
    const cfg = prices[unit];
    const total = (wd * cfg.wd) + (we * cfg.we);
    
    let info = [];
    if (wd > 0) info.push(`${wd}m Weekday`);
    if (we > 0) info.push(`${we}m Weekend`);

    const id = 'BK-' + String(BOOKINGS.length + 1).padStart(3, '0');
    const newBk = {
        id, nama, wa, email:'', kota:'-', tglIn: tIn, tglOut: tOut, durasi, tamu,
        unit, paket: info.join(' + '), harga: total, total, 
        stBayar: 'Belum', stTamu: 'Konfirmasi', catatan: ctt, sumber: 'Admin Dashboard'
    };

    // 1. Simpan di memori & refresh layar (Instant feedback)
    BOOKINGS.unshift(newBk);
    refreshAllViews();
    closeModal();
    showToast('Menyimpan ke satelit...');

    // 2. Kirim ke Google Sheets
    apiSaveBooking(newBk).then(res => {
        if (res.success) showToast(`Reservasi ${id} berhasil diamankan!`);
        else showToast('Gagal simpan ke Sheets', 'error');
    });
}

function viewBookingDetail(id) {
    const b = BOOKINGS.find(x => x.id === id);
    if (!b) return;

    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:14px">
            <div><div class="kpi-label">Nama</div><strong>${b.nama}</strong></div>
            <div><div class="kpi-label">WhatsApp</div>${b.wa}</div>
            <div><div class="kpi-label">Unit</div>${b.unit} (${b.tamu} org)</div>
            <div><div class="kpi-label">Total Harga</div><strong style="color:var(--mossL);font-size:16px">${fmt(b.total)}</strong></div>
            <div><div class="kpi-label">Check-in</div>${fmtDate(b.tglIn)}</div>
            <div><div class="kpi-label">Check-out</div>${fmtDate(b.tglOut)}</div>
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
    `;

    const foot = `
        <button class="btn-ghost" style="color:var(--red);margin-right:auto" onclick="hapusBooking('${b.id}')">Hapus Data</button>
        <button class="btn-ghost" onclick="closeModal()">Tutup</button>
        <a href="https://wa.me/${b.wa.replace(/\D/g,'')}" target="_blank" class="btn-primary" style="text-decoration:none">Chat WhatsApp</a>
    `;

    openModal(`ID: ${b.id}`, body, foot);
}

function changeStatus(id, key, val) {
    const b = BOOKINGS.find(x => x.id === id);
    if (b) b[key] = val; // Update lokal
    refreshAllViews();
    apiUpdateBooking(id, { [key]: val }); // Update satelit background
}

function hapusBooking(id) {
    if(!confirm('Yakin ingin menghapus data ini dari sistem?')) return;
    BOOKINGS = BOOKINGS.filter(b => b.id !== id);
    refreshAllViews();
    closeModal();
    apiDeleteBooking(id).then(() => showToast('Data dihapus permanen'));
}

// ── 6. DATA TAMU ──
function renderTamuTable() {
    const tbody = document.getElementById('tamu-tbody');
    if (!tbody) return;

    const map = {};
    BOOKINGS.forEach(b => {
        if (!map[b.wa]) map[b.wa] = { nama:b.nama, wa:b.wa, kota:b.kota, count:0, last:'' };
        map[b.wa].count++;
        if (b.tglIn > map[b.wa].last) map[b.wa].last = b.tglIn;
    });

    tbody.innerHTML = Object.values(map).map(t => `
        <tr>
            <td><strong>${t.nama}</strong></td>
            <td>${t.wa}</td>
            <td>${t.kota}</td>
            <td><span class="status-pill available">${t.count}x Menginap</span></td>
            <td>${fmtDate(t.last)}</td>
            <td><a href="https://wa.me/${t.wa.replace(/\D/g,'')}" target="_blank" class="btn-ghost">Chat WA</a></td>
        </tr>
    `).join('');
}

// ── 7. RENDERER & LOGIKA KEUANGAN (FINANCE) ──
function renderFinance() {
    const tbody = document.getElementById('finance-tbody');
    if (!tbody) return;

    let totalIn = 0;
    let totalOut = 0;
    let allTx = [];

    // A. Ambil Pemasukan Otomatis dari Booking
    BOOKINGS.forEach(b => {
        if (b.stBayar === 'DP 50%' || b.stBayar === 'Lunas') {
            const nominal = b.stBayar === 'Lunas' ? b.total : (b.total / 2);
            allTx.push({
                id: b.id, ket: `Booking: ${b.nama}`, tgl: b.tglIn,
                kat: 'Reservasi', tipe: 'in', jml: nominal
            });
        }
    });

    // B. Ambil Transaksi Manual (Dari Google Sheets / Input Admin)
    INCOME.forEach(i => allTx.push({ ...i, tipe: 'in' }));
    EXPENSE.forEach(e => allTx.push({ ...e, tipe: 'out' }));

    // Urutkan riwayat dari yang terbaru
    allTx.sort((a, b) => new Date(b.tgl) - new Date(a.tgl));

    tbody.innerHTML = allTx.map(tx => {
        const isIn = tx.tipe === 'in';
        if (isIn) totalIn += parseFloat(tx.jml);
        else totalOut += parseFloat(tx.jml);

        return `
        <tr>
            <td style="color:var(--mossL);font-family:monospace">${tx.id}</td>
            <td><strong>${tx.ket}</strong></td>
            <td>${fmtDate(tx.tgl)}</td>
            <td>${tx.kat || '-'}</td>
            <td><span class="status-pill ${isIn ? 'available' : 'cancelled'}">${isIn ? 'Masuk' : 'Keluar'}</span></td>
            <td><strong style="color:var(--${isIn ? 'mossL' : 'red'})">${fmt(tx.jml)}</strong></td>
        </tr>
        `;
    }).join('');

    if (allTx.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--txt3)">Belum ada transaksi.</td></tr>';
    }

    // Update Angka Saldo di Atas
    const saldo = totalIn - totalOut;
    if (document.getElementById('fin-in')) document.getElementById('fin-in').textContent = fmt(totalIn);
    if (document.getElementById('fin-out')) document.getElementById('fin-out').textContent = fmt(totalOut);
    if (document.getElementById('fin-saldo')) document.getElementById('fin-saldo').textContent = fmt(saldo);
}

// -- Fungsi Buka Formulir Transaksi --
function openFinanceAdd() {
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div>
                <label class="kpi-label">Jenis Transaksi *</label>
                <select id="fin-tipe" class="f-input" style="width:100%;padding:10px;border-radius:4px" onchange="updateFinKat()">
                    <option value="in">Pemasukan (Income)</option>
                    <option value="out">Pengeluaran (Expense)</option>
                </select>
            </div>
            <div><label class="kpi-label">Tanggal *</label><input type="date" id="fin-tgl" value="${today}" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div><label class="kpi-label">Jumlah (Rp) *</label><input type="number" id="fin-jml" class="f-input" placeholder="Contoh: 150000" style="width:100%;padding:10px;border-radius:4px"></div>
            <div>
                <label class="kpi-label">Kategori *</label>
                <select id="fin-kat" class="f-input" style="width:100%;padding:10px;border-radius:4px">
                    <option>Add-on / Ekstra</option><option>Makanan / Minuman</option><option>Lainnya</option>
                </select>
            </div>
        </div>
        <div><label class="kpi-label">Keterangan *</label><input type="text" id="fin-ket" class="f-input" placeholder="Contoh: Beli token listrik, Kayu bakar..." style="width:100%;padding:10px;border-radius:4px"></div>
    `;
    openModal('Catat Transaksi Manual', body, `<button class="btn-ghost" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="submitFinanceAdd()">Simpan Transaksi</button>`);
}

function updateFinKat() {
    const tipe = document.getElementById('fin-tipe').value;
    const kat = document.getElementById('fin-kat');
    if (tipe === 'in') {
        kat.innerHTML = '<option>Add-on / Ekstra</option><option>Makanan / Minuman</option><option>Lainnya</option>';
    } else {
        kat.innerHTML = '<option>Operasional / Gaji</option><option>Maintenance / Perbaikan</option><option>Marketing</option><option>Lainnya</option>';
    }
}

// -- Fungsi Kirim Transaksi --
function submitFinanceAdd() {
    const tipe = document.getElementById('fin-tipe').value;
    const tgl  = document.getElementById('fin-tgl').value;
    const jml  = parseFloat(document.getElementById('fin-jml').value);
    const kat  = document.getElementById('fin-kat').value;
    const ket  = document.getElementById('fin-ket').value.trim();

    if (!tgl || isNaN(jml) || !ket) { showToast('Harap lengkapi Tanggal, Jumlah, dan Keterangan!', 'error'); return; }

    const prefix = tipe === 'in' ? 'IN-' : 'OUT-';
    const arr = tipe === 'in' ? INCOME : EXPENSE;
    const id = prefix + String(arr.length + 1).padStart(3, '0');

    const newTx = { id, tgl, ket, kat, jml, tipe, metode: 'Cash/Transfer', catatan: 'Manual' };

    // 1. Simpan ke layar langsung
    if (tipe === 'in') INCOME.push(newTx); else EXPENSE.push(newTx);
    refreshAllViews();
    closeModal();
    showToast('Menyimpan transaksi ke satelit...');

    // 2. Simpan ke Google Sheets
    if (tipe === 'in') {
        apiSaveIncome(newTx).then(res => { if(res.success) showToast('Pemasukan berhasil dicatat!'); });
    } else {
        apiSaveExpense(newTx).then(res => { if(res.success) showToast('Pengeluaran berhasil dicatat!'); });
    }
}

// ── 7. RENDER CALENDAR ──
function renderCalendar() {
    const calGrid = document.getElementById('cal-grid');
    if (!calGrid) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';
    
    // Header hari
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    days.forEach(d => {
        html += `<div style="text-align:center;font-weight:500;font-size:11px;color:var(--txt3);padding:8px">${d}</div>`;
    });

    // Kosongkan hari awal bulan
    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }

    // Hari-hari dalam bulan
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const bookingsOnDay = BOOKINGS.filter(b => b.tglIn <= dateStr && b.tglOut >= dateStr).length;
        const isToday = day === today.getDate() && month === today.getMonth();

        html += `
            <div style="
                padding:8px;
                text-align:center;
                border-radius:var(--r);
                cursor:pointer;
                background:${isToday ? 'var(--bg3)' : 'transparent'};
                border:1px solid ${isToday ? 'var(--bdr2)' : 'transparent'};
            ">
                <div style="font-weight:${isToday ? '600' : '400'};color:var(--txt1)">${day}</div>
                ${bookingsOnDay > 0 ? `<div style="font-size:10px;color:var(--mossL)">●</div>` : ''}
            </div>
        `;
    }

    calGrid.innerHTML = html;
}