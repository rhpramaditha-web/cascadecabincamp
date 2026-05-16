/* ============================================================
   js/dashboard.js — Rendering Dashboard & KPI
   ============================================================ */

function renderDashboardKPI() {
    // Sinkronisasi status pembayaran dari Finance sebelum kalkulasi KPI
    if (typeof syncBookingPaymentStatusesFromFinance === 'function') {
        syncBookingPaymentStatusesFromFinance();
    }

    const today = new Date().toISOString().split('T')[0];
    const bookings = typeof getBookings === 'function' ? getBookings() : [];
    const todayBookings = bookings.filter(b => b.checkin === today && !isCancelled(b));

    const financeIncomeThisMonth = typeof getCurrentMonthIncomeFromFinance === 'function' ? getCurrentMonthIncomeFromFinance() : 0;
    const bookingIncomeThisMonth = typeof getCurrentMonthIncomeFromBookingStatus === 'function' ? getCurrentMonthIncomeFromBookingStatus(bookings) : 0;
    const totalIncome = financeIncomeThisMonth > 0 ? financeIncomeThisMonth : bookingIncomeThisMonth;

    const occupiedToday = typeof assignBookingsToUnitsForDate === 'function' ? assignBookingsToUnitsForDate(today) : {};
    const occupiedCount = Object.keys(occupiedToday).length;

    // Render Angka KPI
    const elCheckin = document.getElementById('kpi-checkin');
    const elOccupied = document.getElementById('kpi-available');
    const elIncome = document.getElementById('kpi-income');
    
    if (elCheckin) elCheckin.textContent = todayBookings.length;
    if (elOccupied) elOccupied.textContent = Math.min(occupiedCount, typeof UNITS !== 'undefined' ? UNITS.length : 0);
    if (elIncome) elIncome.textContent = fmt(totalIncome);

    // Render Tabel Reservasi Terbaru
    const wrap = document.getElementById('dash-table-wrap');
    if (!wrap) return;

    // AMBIL 5 DATA TERBARU (Data dibalik dari bawah ke atas)
    const recent = [...bookings].reverse().slice(0, 5);

    if (!recent.length) {
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--txt3)">Belum ada reservasi</div>';
        return;
    }

    wrap.innerHTML = `
        <table>
            <thead><tr><th>ID</th><th>Tamu</th><th>Check-in</th><th>Unit</th><th>Status</th></tr></thead>
            <tbody>
                ${recent.map(b => `
                    <tr>
                        <td style="font-family:monospace;color:var(--mossL)">
                            ${escapeHTML(b.id)}
                            ${typeof getGroupId === 'function' && getGroupId(b) ? `<br><small style="color:var(--amber);font-weight:700;">Rombongan</small>` : ''}
                        </td>
                        <td><strong>${escapeHTML(b.nama)}</strong></td>
                        <td>${fmtDate(b.checkin)}</td>
                        <td>${escapeHTML(b.unit)}</td>
                        <td>${stPill(b.stTamu)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}