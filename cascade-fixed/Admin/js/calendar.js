/* ============================================================
   js/calendar.js — Rendering Kalender dan Daftar Tamu Harian
   ============================================================ */

let currentCalMonth = new Date();

function getBookingsOnCalendarDate(dateStr) {
    return getBookings().filter(b => !isCancelled(b) && isDateInStay(dateStr, b));
}

function openCalendarDay(dateStr) {
    const dayBookings = getBookingsOnCalendarDate(dateStr);
    const dateLabel = fmtDate(dateStr);
    
    if (!dayBookings.length) {
        openModal(`Kalender ${dateLabel}`, `<div style="color:var(--txt3);font-size:14px">Belum ada tamu pada tanggal ini.</div>`, `<button class="btn-ghost" onclick="closeModal()">Tutup</button>`);
        return;
    }

    const body = `<div style="display:grid;gap:12px">
        ${dayBookings.map(b => {
            const payStatus = getBookingPaymentStatus(b);
            return `
            <div style="padding:14px;border:1px solid var(--bdr);border-radius:10px;background:var(--bg3)">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                    <div>
                        <div style="font-weight:700;color:var(--txt1);font-size:15px">${escapeHTML(b.nama)}</div>
                        <div style="margin-top:2px;color:var(--txt3);font-size:12px">${escapeHTML(b.id)} · ${escapeHTML(b.unit)}</div>
                    </div>
                    ${stPill(b.stTamu)}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;font-size:13px;color:var(--txt2)">
                    <div><span class="kpi-label">Check-in</span><div>${fmtDate(b.checkin)}</div></div>
                    <div><span class="kpi-label">Check-out</span><div>${fmtDate(b.checkout)}</div></div>
                    <div><span class="kpi-label">Bayar</span><div>${payPill(payStatus)}</div></div>
                    <div><span class="kpi-label">Total</span><div>${fmt(b.total)}</div></div>
                </div>
                <div style="margin-top:12px; display:flex; gap:8px;">
                    <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Lihat Detail Reservasi</button>
                </div>
            </div>`;
        }).join('')}
    </div>`;
    
    openModal(`Daftar Tamu — ${dateLabel}`, body, `<button class="btn-ghost" onclick="closeModal()">Tutup</button>`);
}

function renderKalender() {
    const cal = document.getElementById('cal-grid');
    const label = document.getElementById('cal-label');
    if (!cal || !label) return;

    const year = currentCalMonth.getFullYear();
    const month = currentCalMonth.getMonth();
    label.textContent = currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    
    // Array nama hari untuk disisipkan ke mobile
    const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']; 
    let html = '';

    // Header Nama Hari (Akan disembunyikan di Mobile)
    namaHari.forEach(d => {
        html += `<div class="cal-header-cell" style="text-align:center;padding:8px;color:var(--txt3);font-size:11px;font-weight:600">${d}</div>`;
    });
    
    // Kotak Kosong awal bulan (Akan disembunyikan di Mobile)
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-empty-cell"></div>';
    }

    // Isi Tanggal
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayBookings = getBookingsOnCalendarDate(dateStr);
        const isToday = dateStr === today;
        const borderStyle = isToday ? '2px solid var(--mossL)' : '1px solid var(--bdr)';
        const bgColor = dayBookings.length ? 'var(--bg3)' : 'transparent';
        
        // Dapatkan nama hari untuk tanggal ini
        const hariIndex = new Date(year, month, day).getDay();
        const namaHariIni = namaHari[hariIndex];

        const guestList = dayBookings.slice(0, 3).map(b => `
            <div style="margin-top:4px;padding:3px 5px;border-radius:6px;background:rgba(168,216,128,.08);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                <span style="color:var(--mossLL);font-weight:700">${escapeHTML(b.nama || 'Tamu')}</span>
                <span style="color:var(--txt3)"> · ${escapeHTML(b.stTamu || 'Konfirmasi')}</span>
            </div>`).join('');
        const moreInfo = dayBookings.length > 3 ? `<div style="margin-top:3px;color:var(--txt3);font-size:10px;text-align:left">+${dayBookings.length - 3} tamu lain</div>` : '';

        html += `<div class="cal-date-cell" style="min-height:88px;padding:8px;border:${borderStyle};border-radius:8px;background:${bgColor};cursor:pointer;font-size:12px" onclick="openCalendarDay('${dateStr}')">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span class="cal-mobile-day" style="display:none;font-weight:600;color:var(--txt3);font-size:12px;">${namaHariIni},</span>
                    <span style="font-weight:700;color:var(--txt1);font-size:14px;">${day}</span>
                </div>
                ${dayBookings.length ? `<div style="font-size:10px;color:var(--mossL);font-weight:700">${dayBookings.length}</div>` : ''}
            </div>
            <div class="cal-guest-list">${guestList}${moreInfo}</div>
        </div>`;
    }
    cal.innerHTML = html;
}

function changeMonth(offset) {
    currentCalMonth = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + offset, 1);
    renderKalender();
}