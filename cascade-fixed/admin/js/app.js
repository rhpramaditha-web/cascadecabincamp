/* ============================================================
   admin/js/app.js — Core UI Manager (Versi Final & Lengkap)
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

// ── 4. RENDER HALAMAN RESERVASI ──
function renderBookingTable() {
    const tbody = document.getElementById('booking-tbody');
    const q = (document.getElementById('booking-search')?.value || '').toLowerCase();
    
    if (!tbody) return;

    // Filter pencarian dan urutkan dari ID terbaru
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
            <td>${fmtDate(b.tglIn)}</td>
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

// ── 5. FITUR TAMBAH BOOKING (Format Sesuai booking.html) ──
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
            <div><label class="kpi-label">Jumlah Tamu</label><input type="number" id="qa-tamu" value="2" class="f-input" style="width:100%;padding:10px;border-radius:4px"></div>
            <div style="grid-column: span 2;">
                <label class="kpi-label">Sumber Booking</label>
                <select id="qa-sumber" class="f-input" style="width:100%;padding:10px;border-radius:4px">
                    <option>Admin Dashboard</option>
                    <option>WhatsApp</option>
                    <option>Direct Call</option>
                    <option>Instagram</option>
                </select>
            </div>
        </div>
        <div><label class="kpi-label">Catatan / Permintaan Khusus</label><textarea id="qa-catatan" class="f-input" style="width:100%;padding:10px;border-radius:4px;min-height:60px" placeholder="Contoh: Tambah extra bed..."></textarea></div>
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
    const guests  = document.getElementById('qa-tamu').value || 2;
    const catatan = document.getElementById('qa-catatan').value;
    const sumber  = document.getElementById('qa-sumber').value;

    if (!nama || !wa || !tIn || !tOut) { 
        showToast('Nama, WA, Check-in, dan Check-out wajib diisi!', 'error'); return; 
    }
    if (tOut <= tIn) { 
        showToast('Tanggal Check-out tidak valid!', 'error'); return; 
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

// ── 6. DETAIL & AKSI BOOKING ──
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
                <select class="f-input"