/* ============================================================
   js/guest.js — Database Tamu (Guest Management)
   ============================================================ */

function renderTamuTable() {
    const tbody = document.getElementById('tamu-tbody');
    if (!tbody) return;

    const bookings = getBookings();
    const map = new Map();

    bookings.forEach(b => {
        const key = normalizeKey(b.wa || b.email || b.nama || b.id);
        if (!key) return;
        
        const existing = map.get(key);
        
        if (!existing) {
            map.set(key, {
                nama: b.nama,
                wa: b.wa,
                email: b.email,
                kota: b.kota,
                total: 1,
                terakhir: b.checkin,
                bookings: [b]
            });
        } else {
            existing.total += 1;
            existing.bookings.push(b);
            
            // Perbarui data tamu jika booking ini lebih baru
            if (dateToTime(b.checkin) > dateToTime(existing.terakhir)) {
                existing.terakhir = b.checkin;
                existing.nama = b.nama || existing.nama;
                existing.kota = b.kota || existing.kota;
                existing.wa = b.wa || existing.wa;
                existing.email = b.email || existing.email;
            }
        }
    });

    window.__TAMU_CACHE = Array.from(map.values()).sort((a, b) => dateToTime(b.terakhir) - dateToTime(a.terakhir));

    if (!window.__TAMU_CACHE.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--txt3)">Belum ada data pelanggan.</td></tr>';
        return;
    }

    tbody.innerHTML = window.__TAMU_CACHE.map((t, idx) => {
        const waClean = String(t.wa || '').replace(/[^\d]/g, '');
        const waCell = waClean ? `<a href="${buildWaLink(t.wa)}" target="_blank" style="color:var(--mossL);text-decoration:none">${escapeHTML(t.wa)}</a>` : '-';
        const promoMsg = `Halo ${t.nama}, kami dari Cascade Cabin & Camp. Kami ingin menginformasikan promo dan ketersediaan terbaru untuk pengalaman menginap berikutnya.`;
        
        return `<tr>
            <td><strong>${escapeHTML(t.nama || '-')}</strong></td>
            <td>${waCell}</td>
            <td>${escapeHTML(t.kota || '-')}</td>
            <td style="text-align:center;font-weight:600">${t.total}</td>
            <td>${fmtDate(t.terakhir)}</td>
            <td style="white-space:nowrap">
                <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="openTamuDetail(${idx})">Detail</button>
                ${waClean ? `<a class="btn-ghost" style="padding:4px 10px;font-size:11px" href="${buildWaLink(t.wa)}" target="_blank">WA</a>` : ''}
                ${waClean ? `<a class="btn-ghost" style="padding:4px 10px;font-size:11px" href="${buildWaLink(t.wa, promoMsg)}" target="_blank">Promo</a>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function openTamuDetail(index) {
    const t = window.__TAMU_CACHE?.[index];
    if (!t) return;
    
    const rows = t.bookings
        .sort((a, b) => dateToTime(b.checkin) - dateToTime(a.checkin))
        .map(b => `
            <tr>
                <td>${escapeHTML(b.id)}</td>
                <td>${fmtDate(b.checkin)}</td>
                <td>${escapeHTML(b.unit)}</td>
                <td>${payPill(getBookingPaymentStatus(b))}</td>
                <td>${stPill(b.stTamu)}</td>
            </tr>`
        ).join('');
        
    const waButton = t.wa ? `<a class="btn-primary" href="${buildWaLink(t.wa)}" target="_blank">Chat WhatsApp</a>` : '';
    
    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
            <div><div class="kpi-label">Nama</div><strong>${escapeHTML(t.nama || '-')}</strong></div>
            <div><div class="kpi-label">WhatsApp</div>${escapeHTML(t.wa || '-')}</div>
            <div><div class="kpi-label">Kota</div>${escapeHTML(t.kota || '-')}</div>
            <div><div class="kpi-label">Total Booking</div>${t.total}</div>
        </div>
        <div class="tbl-wrap">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Check-in</th>
                        <th>Unit</th>
                        <th>Bayar</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
        
    openModal(`Detail Tamu — ${escapeHTML(t.nama || '-')}`, body, `${waButton}<button class="btn-ghost" onclick="closeModal()">Tutup</button>`);
}