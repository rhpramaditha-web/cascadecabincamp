/* ============================================================
   js/report.js — Laporan Harian, Laporan Bulanan, Piutang, Batal
   ============================================================ */

// ── PIUTANG (RECEIVABLES) ───────────────────────────────────
function getReceivableData() {
    return getBookings()
        .filter(b => !isCancelled(b))
        .map(b => {
            const total = normalizeAmount(b.total);
            const dp = normalizeAmount(b.dp) || Math.round(total / 2);
            const status = getBookingPaymentStatus(b);

            let paid = getPaidAmountForBooking(b);
            if (paid <= 0) {
                if (status === 'Lunas') paid = total;
                else if (String(status).includes('DP')) paid = dp;
            }

            const remaining = Math.max(total - paid, 0);

            return { ...b, total, dp, paid, remaining, paymentStatus: status };
        })
        .filter(b => b.total > 0 && b.remaining > 0 && b.paymentStatus !== 'Lunas')
        .sort((a, b) => dateToTime(a.checkin) - dateToTime(b.checkin) || b.remaining - a.remaining);
}

function getReceivableSummary(rows) {
    const total = rows.reduce((sum, b) => sum + normalizeAmount(b.remaining), 0);
    const dpCount = rows.filter(b => String(b.paymentStatus).includes('DP')).length;
    const unpaidCount = rows.filter(b => b.paymentStatus === 'Belum').length;
    return { total, count: rows.length, dpCount, unpaidCount };
}

function renderReceivableTable() {
    const tbody = document.getElementById('receivable-tbody');
    if (!tbody) return;

    const q = (document.getElementById('rcv-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('rcv-status-filter')?.value || '';

    let rows = getReceivableData();

    if (q) rows = rows.filter(b => [b.id, b.nama, b.wa, b.unit, b.checkin, b.paymentStatus].join(' ').toLowerCase().includes(q));
    if (statusFilter === 'Belum') rows = rows.filter(b => b.paymentStatus === 'Belum');
    if (statusFilter === 'DP') rows = rows.filter(b => String(b.paymentStatus).includes('DP'));

    const summaryAll = getReceivableSummary(getReceivableData());
    if (document.getElementById('rcv-total')) document.getElementById('rcv-total').textContent = fmt(summaryAll.total);
    if (document.getElementById('rcv-count')) document.getElementById('rcv-count').textContent = summaryAll.count;
    if (document.getElementById('rcv-dp')) document.getElementById('rcv-dp').textContent = summaryAll.dpCount;
    if (document.getElementById('rcv-unpaid')) document.getElementById('rcv-unpaid').textContent = summaryAll.unpaidCount;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--txt3);">Tidak ada piutang sesuai filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(b => {
        const waMsg = buildReceivableWaMessage(b);
        const waBtn = b.wa ? `<a class="btn-ghost" style="padding:4px 10px;font-size:11px" href="${buildWaLink(b.wa, waMsg)}" target="_blank">Tagih WA</a>` : '';
        const groupId = typeof getGroupId === 'function' ? getGroupId(b) : null;

        return `
            <tr>
                <td style="font-family:monospace;color:var(--mossL)">
                    ${escapeHTML(b.id)}
                    ${groupId ? `<br><small style="color:var(--amber);font-weight:700;">${groupId}</small>` : ''}
                </td>
                <td><strong>${escapeHTML(b.nama || '-')}</strong><br><small>${escapeHTML(b.wa || '-')}</small></td>
                <td>${fmtDate(b.checkin)}</td>
                <td>${escapeHTML(b.unit || '-')}<br><small>${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</small></td>
                <td>${fmt(b.total)}</td>
                <td style="color:var(--mossLL);font-weight:700;">${fmt(b.paid)}</td>
                <td style="color:var(--red);font-weight:700;">${fmt(b.remaining)}</td>
                <td>${payPill(b.paymentStatus)}</td>
                <td style="white-space:nowrap">
                    <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Detail</button>
                    ${waBtn}
                </td>
            </tr>
        `;
    }).join('');
}

function resetReceivableFilter() {
    if (document.getElementById('rcv-search')) document.getElementById('rcv-search').value = '';
    if (document.getElementById('rcv-status-filter')) document.getElementById('rcv-status-filter').value = '';
    renderReceivableTable();
}

function buildReceivableWaMessage(b) {
    return `Halo ${b.nama || 'Bapak/Ibu'}, kami dari Cascade Cabin & Camp ingin mengingatkan terkait reservasi ${b.id} untuk tanggal check-in ${fmtDate(b.checkin)} pada unit ${b.unit || '-'}.
\nRincian pembayaran:
Total tagihan: ${fmt(b.total)}
Sudah dibayar: ${fmt(b.paid)}
Sisa pembayaran: ${fmt(b.remaining)}
\nMohon dapat melakukan pelunasan sesuai ketentuan reservasi. Terima kasih.`;
}


// ── ARSIP PEMBATALAN (CANCELLATION) ─────────────────────────
function getCancelField(b, keys, fallback = '') {
    const direct = readField(b, keys, '');
    if (direct !== '') return direct;
    const raw = readField(b?.raw, keys, '');
    if (raw !== '') return raw;
    return fallback;
}

function getCancelPolicyLabel(policy) {
    const labels = { no_refund: 'DP hangus / tanpa refund', full_refund: 'Refund penuh', partial_refund: 'Refund sebagian' };
    return labels[policy] || policy || '-';
}

function getCancellationArchiveData() {
    return getBookings()
        .filter(b => String(b.stTamu || '').toLowerCase() === 'dibatalkan')
        .map(b => {
            const reason = getCancelField(b, ['cancelReason', 'CancelReason'], '-');
            const policy = getCancelField(b, ['cancelPolicy', 'CancelPolicy'], 'no_refund');
            const refund = normalizeAmount(getCancelField(b, ['cancelRefund', 'CancelRefund'], 0));
            const note = getCancelField(b, ['cancelNote', 'CancelNote'], '');
            const cancelDate = normalizeDate(getCancelField(b, ['cancelDate', 'CancelDate'], ''));
            const paid = getPaidAmountForBooking(b);
            const retained = Math.max(paid - refund, 0);
            return { ...b, cancelReason: reason, cancelPolicy: policy, cancelRefund: refund, cancelNote: note, cancelDate, paid, retained };
        })
        .sort((a, b) => dateToTime(b.cancelDate || b.checkin) - dateToTime(a.cancelDate || a.checkin));
}

function getCancellationSummary(rows) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const totalRefund = rows.reduce((sum, b) => sum + normalizeAmount(b.cancelRefund), 0);
    const noRefundCount = rows.filter(b => normalizeAmount(b.cancelRefund) <= 0).length;
    const thisMonthCount = rows.filter(b => String(b.cancelDate || '').startsWith(currentMonth)).length;
    return { total: rows.length, totalRefund, noRefundCount, thisMonthCount };
}

function renderCancellationArchive() {
    const tbody = document.getElementById('cancel-archive-tbody');
    if (!tbody) return;

    const q = (document.getElementById('cancel-search')?.value || '').toLowerCase();
    const policyFilter = document.getElementById('cancel-policy-filter')?.value || '';

    let rows = getCancellationArchiveData();
    const summary = getCancellationSummary(rows);

    if (document.getElementById('cancel-total')) document.getElementById('cancel-total').textContent = summary.total;
    if (document.getElementById('cancel-refund-total')) document.getElementById('cancel-refund-total').textContent = fmt(summary.totalRefund);
    if (document.getElementById('cancel-no-refund')) document.getElementById('cancel-no-refund').textContent = summary.noRefundCount;
    if (document.getElementById('cancel-this-month')) document.getElementById('cancel-this-month').textContent = summary.thisMonthCount;

    if (q) rows = rows.filter(b => [b.id, b.nama, b.wa, b.unit, b.cancelReason, b.cancelPolicy, b.cancelNote].join(' ').toLowerCase().includes(q));
    if (policyFilter) rows = rows.filter(b => b.cancelPolicy === policyFilter);

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--txt3);">Tidak ada data pembatalan sesuai filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(b => `
        <tr>
            <td style="font-family:monospace;color:var(--mossL)">${escapeHTML(b.id)}</td>
            <td><strong>${escapeHTML(b.nama || '-')}</strong><br><small>${escapeHTML(b.wa || '-')}</small></td>
            <td>${fmtDate(b.checkin)}</td>
            <td>${escapeHTML(b.unit || '-')}<br><small>${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</small></td>
            <td>${escapeHTML(b.cancelReason || '-')}</td>
            <td>${escapeHTML(getCancelPolicyLabel(b.cancelPolicy))}</td>
            <td style="font-weight:700;color:${b.cancelRefund > 0 ? 'var(--red)' : 'var(--txt3)'};">${fmt(b.cancelRefund)}</td>
            <td>${b.cancelDate ? fmtDate(b.cancelDate) : '-'}</td>
            <td style="white-space:nowrap"><button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="openCancellationDetail('${escapeHTML(b.id)}')">Detail</button></td>
        </tr>
    `).join('');
}

function resetCancellationFilter() {
    if (document.getElementById('cancel-search')) document.getElementById('cancel-search').value = '';
    if (document.getElementById('cancel-policy-filter')) document.getElementById('cancel-policy-filter').value = '';
    renderCancellationArchive();
}

function openCancellationDetail(id) {
    const b = getCancellationArchiveData().find(x => x.id === id);
    if (!b) return showToast('Data pembatalan tidak ditemukan', 'error');

    const refundColor = b.cancelRefund > 0 ? 'var(--red)' : 'var(--txt3)';
    const retained = Math.max(normalizeAmount(b.paid) - normalizeAmount(b.cancelRefund), 0);

    const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:14px;">
            <div><div class="kpi-label">Booking ID</div><strong>${escapeHTML(b.id)}</strong></div>
            <div><div class="kpi-label">Nama Tamu</div><strong>${escapeHTML(b.nama || '-')}</strong></div>
            <div><div class="kpi-label">WhatsApp</div>${escapeHTML(b.wa || '-')}</div>
            <div><div class="kpi-label">Tanggal Batal</div>${b.cancelDate ? fmtDate(b.cancelDate) : '-'}</div>
            <div><div class="kpi-label">Check-in</div>${fmtDate(b.checkin)}</div>
            <div><div class="kpi-label">Check-out</div>${fmtDate(b.checkout)}</div>
            <div><div class="kpi-label">Tipe Unit</div>${escapeHTML(b.unit || '-')}</div>
            <div><div class="kpi-label">Unit Fisik</div>${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</div>
        </div>

        <div style="margin-top:16px;padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);">
            <div class="kpi-label">Informasi Pembatalan</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;font-size:14px;">
                <div><strong>Alasan:</strong><br>${escapeHTML(b.cancelReason || '-')}</div>
                <div><strong>Kebijakan Dana:</strong><br>${escapeHTML(getCancelPolicyLabel(b.cancelPolicy))}</div>
                <div><strong>Total Terbayar:</strong><br>${fmt(b.paid)}</div>
                <div><strong>Refund:</strong><br><span style="color:${refundColor};font-weight:700;">${fmt(b.cancelRefund)}</span></div>
                <div><strong>Dana Tertahan / DP Hangus:</strong><br><span style="color:var(--mossLL);font-weight:700;">${fmt(retained)}</span></div>
                <div><strong>Status Tamu:</strong><br>${stPill(b.stTamu)}</div>
            </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:8px;font-size:13px;"><div class="kpi-label">Catatan Pembatalan</div>${escapeHTML(b.cancelNote || '-')}</div>
    `;

    const waMsg = `Halo ${b.nama || 'Bapak/Ibu'}, kami mengonfirmasi bahwa reservasi ${b.id} telah dibatalkan.\nAlasan: ${b.cancelReason || '-'}\nKebijakan dana: ${getCancelPolicyLabel(b.cancelPolicy)}\nNominal refund: ${fmt(b.cancelRefund)}\nTerima kasih.`;
    const waBtn = b.wa ? `<a class="btn-primary" href="${buildWaLink(b.wa, waMsg)}" target="_blank">Kirim WA</a>` : '';

    openModal(`Detail Pembatalan ${escapeHTML(b.id)}`, body, `${waBtn}<button class="btn-secondary" onclick="viewBookingDetail('${escapeHTML(b.id)}')">Lihat Booking</button><button class="btn-ghost" onclick="closeModal()">Tutup</button>`);
}


// ── LAPORAN HARIAN (DAILY REPORT) ───────────────────────────
function getDailyReportDate() {
    const input = document.getElementById('daily-report-date');
    if (!input) return new Date().toISOString().split('T')[0];
    if (!input.value) input.value = new Date().toISOString().split('T')[0];
    return input.value;
}

function getLatestCashReconByDate(dateStr) {
    return (CASH_RECONCILIATIONS || [])
        .filter(r => String(r.tanggal || r.Tanggal || '') === dateStr)
        .sort((a, b) => String(b.timestamp || b.Timestamp || '').localeCompare(String(a.timestamp || a.Timestamp || '')))[0] || null;
}

function sumRowsAmount(rows) { return rows.reduce((sum, row) => sum + normalizeAmount(row.jumlah), 0); }

function groupFinanceByCategory(rows) {
    const map = new Map();
    rows.forEach(row => {
        const cat = row.kategori || '-';
        map.set(cat, (map.get(cat) || 0) + normalizeAmount(row.jumlah));
    });
    return Array.from(map.entries()).map(([kategori, jumlah]) => ({ kategori, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
}

function buildDailyReportData(dateStr) {
    const bookings = getBookings();
    const activeBookings = bookings.filter(b => !isCancelled(b));
    const checkins = activeBookings.filter(b => b.checkin === dateStr);
    const checkouts = activeBookings.filter(b => b.checkout === dateStr);
    const staying = activeBookings.filter(b => isDateInStay(dateStr, b));

    const occupiedMap = assignBookingsToUnitsForDate(dateStr);
    const occupiedCount = Object.keys(occupiedMap).length;
    const issueUnits = UNITS.filter(u => ['Maintenance', 'Blocked', 'Nonaktif'].includes(u.status));
    const readyUnits = UNITS.filter(u => u.status === 'Ready');
    const availableCount = Math.max(UNITS.length - occupiedCount - issueUnits.length, 0);

    const incomeRows = (INCOME || []).map(i => normalizeFinanceTx(i, 'income')).filter(i => i.tanggal === dateStr);
    const expenseRows = (EXPENSE || []).map(e => normalizeFinanceTx(e, 'expense')).filter(e => e.tanggal === dateStr);
    const incomeTotal = sumRowsAmount(incomeRows);
    const expenseTotal = sumRowsAmount(expenseRows);
    const netTotal = incomeTotal - expenseTotal;

    const recon = getLatestCashReconByDate(dateStr);
    const receivables = getReceivableRows(dateStr); // uses receivable helper

    const cancellations = typeof getCancellationArchiveData === 'function' ? getCancellationArchiveData().filter(b => b.cancelDate === dateStr) : [];
    const cancellationRefundTotal = cancellations.reduce((sum, b) => sum + normalizeAmount(b.cancelRefund), 0);
    const cancellationRetainedTotal = cancellations.reduce((sum, b) => sum + normalizeAmount(b.retained), 0);
	
	return {
        dateStr, checkins, checkouts, staying, occupiedCount, availableCount, issueUnits, readyUnits, totalUnits: UNITS.length,
        incomeRows, expenseRows, incomeTotal, expenseTotal, netTotal,
        incomeByCategory: groupFinanceByCategory(incomeRows), expenseByCategory: groupFinanceByCategory(expenseRows),
        recon, receivables, cancellations, cancellationRefundTotal, cancellationRetainedTotal
    };
}

function getReceivableRows(dateStr) {
    return getBookings().filter(b => !isCancelled(b) && b.checkin <= dateStr).map(b => {
        const total = normalizeAmount(b.total);
        let paid = getPaidAmountForBooking(b);
        const status = getBookingPaymentStatus(b);
        if (paid <= 0) {
            if (status === 'Lunas') paid = total;
            else if (String(status).includes('DP')) paid = normalizeAmount(b.dp) || Math.round(total/2);
        }
        return { ...b, paid, remaining: Math.max(total - paid, 0), paymentStatus: status };
    }).filter(b => b.remaining > 0 && b.paymentStatus !== 'Lunas').sort((a, b) => b.remaining - a.remaining);
}

function renderDailyReport() {
    const wrap = document.getElementById('daily-report-wrap');
    if (!wrap) return;

    const dateStr = getDailyReportDate();
    const r = buildDailyReportData(dateStr);

    const reconStatus = r.recon ? `${escapeHTML(r.recon.status || r.recon.Status || '-')} · Selisih ${fmt(r.recon.selisih || r.recon.Selisih || 0)}` : 'Belum tutup kas';

    const checkinRows = r.checkins.length ? r.checkins.map(b => `<tr><td>${escapeHTML(b.id)}</td><td><strong>${escapeHTML(b.nama)}</strong><br><small>${escapeHTML(b.wa || '-')}</small></td><td>${escapeHTML(b.unit)}</td><td>${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</td><td>${payPill(getBookingPaymentStatus(b))}</td><td>${stPill(b.stTamu)}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--txt3);">Tidak ada check-in pada tanggal ini.</td></tr>`;
    const checkoutRows = r.checkouts.length ? r.checkouts.map(b => `<tr><td>${escapeHTML(b.id)}</td><td><strong>${escapeHTML(b.nama)}</strong></td><td>${escapeHTML(b.unit)}</td><td>${escapeHTML(getUnitLabel(getBookingAssignedUnitId(b)))}</td><td>${fmt(b.total)}</td><td>${payPill(getBookingPaymentStatus(b))}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--txt3);">Tidak ada check-out pada tanggal ini.</td></tr>`;
    
    const incomeCatRows = r.incomeByCategory.length ? r.incomeByCategory.map(x => `<tr><td>${escapeHTML(x.kategori)}</td><td style="text-align:right;font-weight:700;color:var(--mossLL);">${fmt(x.jumlah)}</td></tr>`).join('') : `<tr><td colspan="2" style="text-align:center;padding:18px;color:var(--txt3);">Tidak ada pemasukan.</td></tr>`;
    const expenseCatRows = r.expenseByCategory.length ? r.expenseByCategory.map(x => `<tr><td>${escapeHTML(x.kategori)}</td><td style="text-align:right;font-weight:700;color:var(--red);">${fmt(x.jumlah)}</td></tr>`).join('') : `<tr><td colspan="2" style="text-align:center;padding:18px;color:var(--txt3);">Tidak ada pengeluaran.</td></tr>`;
    
    const receivableRows = r.receivables.length ? r.receivables.slice(0, 10).map(b => `<tr><td>${escapeHTML(b.id)}</td><td><strong>${escapeHTML(b.nama)}</strong></td><td>${fmt(b.total)}</td><td>${fmt(b.paid)}</td><td style="font-weight:700;color:var(--red);">${fmt(b.remaining)}</td><td>${payPill(b.paymentStatus)}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--txt3);">Tidak ada piutang aktif.</td></tr>`;

    wrap.innerHTML = `
        <div id="daily-report-print-area">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;">
                <div>
                    <div style="font-family:'Playfair Display',serif;font-size:26px;color:var(--txt1);">Daily Closing Report</div>
                    <div style="color:var(--txt3);font-size:13px;margin-top:4px;">Tanggal: <strong>${fmtDate(dateStr)}</strong></div>
                </div>
                <div style="text-align:right;font-size:12px;color:var(--txt3);"><div>Admin: <strong>${escapeHTML(getCurrentAdminName())}</strong></div><div>Generated: ${fmtDateTime(new Date().toISOString())}</div></div>
            </div>

            <div class="kpi-grid" style="margin-bottom:18px;">
                <div class="kpi-card"><div class="kpi-label">Check-in</div><div class="kpi-val">${r.checkins.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Check-out</div><div class="kpi-val">${r.checkouts.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Unit Terisi</div><div class="kpi-val">${r.occupiedCount}</div></div>
				<div class="kpi-card highlight"><div class="kpi-label">Pembatalan</div><div class="kpi-val">${r.cancellations.length}</div></div>
           </div>

            <div class="kpi-grid" style="margin-bottom:18px;">
                <div class="kpi-card"><div class="kpi-label">Pemasukan Harian</div><div class="kpi-val" style="color:var(--mossLL);">${fmt(r.incomeTotal)}</div></div>
                <div class="kpi-card"><div class="kpi-label">Pengeluaran Harian</div><div class="kpi-val" style="color:var(--red);">${fmt(r.expenseTotal)}</div></div>
                <div class="kpi-card highlight"><div class="kpi-label">Net Harian</div><div class="kpi-val">${fmt(r.netTotal)}</div></div>
                <div class="kpi-card"><div class="kpi-label">Unit Tersedia</div><div class="kpi-val">${r.availableCount}</div></div>
				<div class="kpi-card highlight"><div class="kpi-label">Status Kas</div><div class="kpi-val" style="font-size:20px;">${escapeHTML(reconStatus)}</div></div>
            </div>

            <div class="card" style="margin-bottom:18px;">
                <div class="card-head"><div class="card-title">Ringkasan Unit</div></div>
                <div class="card-body"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:14px;"><div><div class="kpi-label">Total Unit</div><strong>${r.totalUnits}</strong></div><div><div class="kpi-label">Ready</div><strong>${r.readyUnits.length}</strong></div><div><div class="kpi-label">Terisi</div><strong>${r.occupiedCount}</strong></div><div><div class="kpi-label">Maintenance / Blocked</div><strong>${r.issueUnits.length}</strong></div></div></div>
            </div>

            <div class="card" style="margin-bottom:18px;"><div class="card-head"><div class="card-title">Daftar Check-in</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>ID</th><th>Tamu</th><th>Tipe Unit</th><th>Unit Fisik</th><th>Bayar</th><th>Status</th></tr></thead><tbody>${checkinRows}</tbody></table></div></div>
            <div class="card" style="margin-bottom:18px;"><div class="card-head"><div class="card-title">Daftar Check-out</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>ID</th><th>Tamu</th><th>Tipe Unit</th><th>Unit Fisik</th><th>Total</th><th>Bayar</th></tr></thead><tbody>${checkoutRows}</tbody></table></div></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">
                <div class="card"><div class="card-head"><div class="card-title">Pemasukan per Kategori</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>Kategori</th><th style="text-align:right;">Jumlah</th></tr></thead><tbody>${incomeCatRows}</tbody></table></div></div>
                <div class="card"><div class="card-head"><div class="card-title">Pengeluaran per Kategori</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>Kategori</th><th style="text-align:right;">Jumlah</th></tr></thead><tbody>${expenseCatRows}</tbody></table></div></div>
            </div>

            <div class="card" style="margin-bottom:18px;">
                <div class="card-head"><div class="card-title">Piutang / Sisa Pembayaran</div></div>
                <div class="card-body-flush tbl-wrap"><table><thead><tr><th>ID</th><th>Tamu</th><th>Total</th><th>Terbayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${receivableRows}</tbody></table></div>
            </div>
            
            <div class="card">
                <div class="card-head"><div class="card-title">Rekonsiliasi Kas</div></div>
                <div class="card-body">
                    ${r.recon ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:14px;"><div><div class="kpi-label">Saldo Sistem</div><strong>${fmt(r.recon.saldoSistem || r.recon.SaldoSistem || 0)}</strong></div><div><div class="kpi-label">Saldo Fisik</div><strong>${fmt(r.recon.saldoFisik || r.recon.SaldoFisik || 0)}</strong></div><div><div class="kpi-label">Selisih</div><strong>${fmt(r.recon.selisih || r.recon.Selisih || 0)}</strong></div><div><div class="kpi-label">Status</div><strong>${escapeHTML(r.recon.status || r.recon.Status || '-')}</strong></div></div><div style="margin-top:12px;font-size:13px;color:var(--txt3);">Catatan: ${escapeHTML(r.recon.catatan || r.recon.Catatan || '-')}</div>` : `<div style="color:var(--txt3);">Belum ada data tutup kas untuk tanggal ini.</div>`}
                </div>
            </div>
        </div>
    `;
}

function printDailyReport() {
    const dateStr = getDailyReportDate();
    const area = document.getElementById('daily-report-print-area');
    if (!area) return showToast('Laporan belum tersedia untuk dicetak', 'error');

    const printHtml = `
<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan Harian ${escapeHTML(dateStr)}</title>
<style>
@page { size: A4; margin: 12mm; } * { box-sizing: border-box; }
body { font-family: Arial, sans-serif; color: #1f2a1f; background: #fff; font-size: 11px; line-height: 1.35; }
h1, h2, h3 { margin: 0; }
.card { border: 1px solid #d7dfcf; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
.card-head { padding: 10px 12px; background: #f3f6ee; border-bottom: 1px solid #d7dfcf; }
.card-title { font-weight: 700; font-size: 13px; } .card-body { padding: 12px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.kpi-card { border: 1px solid #d7dfcf; border-radius: 8px; padding: 10px; background: #fbfcf7; }
.kpi-label { font-size: 9px; text-transform: uppercase; color: #6f7f63; font-weight: 700; }
.kpi-val { font-size: 18px; font-weight: 700; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; }
th { background: #2e4820; color: #fff; text-align: left; padding: 7px; font-size: 10px; }
td { border-bottom: 1px solid #e1e7da; padding: 7px; vertical-align: top; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>${area.innerHTML}<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script></body></html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return showToast('Popup diblokir browser. Izinkan popup untuk mencetak laporan.', 'error');
    win.document.open(); win.document.write(printHtml); win.document.close();
}


// ── LAPORAN BULANAN (MONTHLY REPORT) ────────────────────────
function getMonthlyReportMonth() {
    const input = document.getElementById('monthly-report-month');
    const current = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (!input) return current;
    if (!input.value) input.value = current;
    return input.value;
}

function getMonthRange(monthStr) {
    const [year, month] = String(monthStr).split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;

    const days = [];
    let d = new Date(start);
    while (d < end) {
        days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        d.setDate(d.getDate() + 1);
    }
    return { year, month, startStr, endStr, days, daysCount: days.length };
}

function isDateInMonth(dateStr, monthStr) { return String(dateStr || '').startsWith(monthStr); }
function bookingTouchesMonth(b, monthStr) {
    const range = getMonthRange(monthStr);
    if (!b.checkin || !b.checkout) return isDateInMonth(b.checkin, monthStr);
    return b.checkin < range.endStr && b.checkout > range.startStr;
}

function groupByField(rows, fieldName, fallback = '-') {
    const map = new Map();
    rows.forEach(row => {
        const key = row[fieldName] || fallback;
        map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
}

function groupAmountByCategory(rows) {
    const map = new Map();
    rows.forEach(row => {
        const cat = row.kategori || '-';
        map.set(cat, (map.get(cat) || 0) + normalizeAmount(row.jumlah));
    });
    return Array.from(map.entries()).map(([kategori, jumlah]) => ({ kategori, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
}

function calculateMonthlyOccupancy(monthStr) {
    const range = getMonthRange(monthStr);
    const totalUnitNights = UNITS.length * range.daysCount;
    let occupiedUnitNights = 0;

    range.days.forEach(dateStr => {
        const occupiedMap = assignBookingsToUnitsForDate(dateStr);
        occupiedUnitNights += Object.keys(occupiedMap).length;
    });

    const rate = totalUnitNights > 0 ? Math.round((occupiedUnitNights / totalUnitNights) * 1000) / 10 : 0;
    return { occupiedUnitNights, totalUnitNights, rate };
}

function buildMonthlyReportData(monthStr) {
    const range = getMonthRange(monthStr);
    const bookings = getBookings();
    const activeBookings = bookings.filter(b => !isCancelled(b));
    const activeBookingsInMonth = activeBookings.filter(b => bookingTouchesMonth(b, monthStr));
    const checkins = activeBookings.filter(b => isDateInMonth(b.checkin, monthStr));
    const checkouts = activeBookings.filter(b => isDateInMonth(b.checkout, monthStr));

    const cancellations = typeof getCancellationArchiveData === 'function' ? getCancellationArchiveData().filter(b => isDateInMonth(b.cancelDate, monthStr)) : [];
    const incomeRows = (INCOME || []).map(i => normalizeFinanceTx(i, 'income')).filter(i => isDateInMonth(i.tanggal, monthStr));
    const expenseRows = (EXPENSE || []).map(e => normalizeFinanceTx(e, 'expense')).filter(e => isDateInMonth(e.tanggal, monthStr));

    const incomeTotal = incomeRows.reduce((sum, i) => sum + normalizeAmount(i.jumlah), 0);
    const expenseTotal = expenseRows.reduce((sum, e) => sum + normalizeAmount(e.jumlah), 0);
    const netTotal = incomeTotal - expenseTotal;
    const refundTotal = cancellations.reduce((sum, b) => sum + normalizeAmount(b.cancelRefund), 0);
    const retainedTotal = cancellations.reduce((sum, b) => sum + normalizeAmount(b.retained), 0);

    const receivables = typeof getReceivableData === 'function' ? getReceivableData() : [];
    const receivableTotal = receivables.reduce((sum, b) => sum + normalizeAmount(b.remaining), 0);

    return {
        monthStr, range, activeBookingsInMonth, checkins, checkouts, cancellations,
        incomeRows, expenseRows, incomeTotal, expenseTotal, netTotal,
        refundTotal, retainedTotal, receivables, receivableTotal,
        occupancy: calculateMonthlyOccupancy(monthStr),
        unitTypeRank: groupByField(checkins, 'unit', '-'),
        sourceRank: groupByField(checkins, 'sumber', '-'),
        incomeByCategory: groupAmountByCategory(incomeRows),
        expenseByCategory: groupAmountByCategory(expenseRows)
    };
}

function renderRankRows(rows, emptyText = 'Belum ada data') {
    if (!rows.length) return `<tr><td colspan="2" style="text-align:center;padding:18px;color:var(--txt3);">${emptyText}</td></tr>`;
    return rows.map(row => `<tr><td>${escapeHTML(row.label || row.kategori || '-')}</td><td style="text-align:right;font-weight:700;">${row.jumlah !== undefined ? fmt(row.jumlah) : row.total}</td></tr>`).join('');
}

function renderMonthlyReport() {
    const wrap = document.getElementById('monthly-report-wrap');
    if (!wrap) return;

    const monthStr = getMonthlyReportMonth();
    const r = buildMonthlyReportData(monthStr);
    const monthLabel = new Date(`${monthStr}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const cancellationRows = r.cancellations.length ? r.cancellations.slice(0, 10).map(b => `<tr><td>${escapeHTML(b.id)}</td><td><strong>${escapeHTML(b.nama || '-')}</strong></td><td>${fmtDate(b.cancelDate)}</td><td>${escapeHTML(b.cancelReason || '-')}</td><td>${escapeHTML(getCancelPolicyLabel(b.cancelPolicy))}</td><td style="text-align:right;color:var(--red);font-weight:700;">${fmt(b.cancelRefund)}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--txt3);">Tidak ada pembatalan bulan ini.</td></tr>`;
    const receivableRows = r.receivables.length ? r.receivables.slice(0, 10).map(b => `<tr><td>${escapeHTML(b.id)}</td><td><strong>${escapeHTML(b.nama || '-')}</strong></td><td>${fmtDate(b.checkin)}</td><td>${fmt(b.total)}</td><td>${fmt(b.paid)}</td><td style="text-align:right;color:var(--red);font-weight:700;">${fmt(b.remaining)}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--txt3);">Tidak ada piutang aktif.</td></tr>`;

    wrap.innerHTML = `
        <div id="monthly-report-print-area">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;">
                <div>
                    <div style="font-family:'Playfair Display',serif;font-size:26px;color:var(--txt1);">Monthly Management Report</div>
                    <div style="color:var(--txt3);font-size:13px;margin-top:4px;">Periode: <strong>${escapeHTML(monthLabel)}</strong></div>
                </div>
                <div style="text-align:right;font-size:12px;color:var(--txt3);"><div>Admin: <strong>${escapeHTML(getCurrentAdminName())}</strong></div><div>Generated: ${fmtDateTime(new Date().toISOString())}</div></div>
            </div>

            <div class="kpi-grid" style="margin-bottom:18px;">
                <div class="kpi-card"><div class="kpi-label">Check-in Bulan Ini</div><div class="kpi-val">${r.checkins.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Booking Aktif</div><div class="kpi-val">${r.activeBookingsInMonth.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Booking Batal</div><div class="kpi-val" style="color:var(--red);">${r.cancellations.length}</div></div>
                <div class="kpi-card highlight"><div class="kpi-label">Occupancy Rate</div><div class="kpi-val">${r.occupancy.rate}%</div></div>
            </div>

            <div class="kpi-grid" style="margin-bottom:18px;">
                <div class="kpi-card"><div class="kpi-label">Pemasukan</div><div class="kpi-val" style="color:var(--mossLL);">${fmt(r.incomeTotal)}</div></div>
                <div class="kpi-card"><div class="kpi-label">Pengeluaran</div><div class="kpi-val" style="color:var(--red);">${fmt(r.expenseTotal)}</div></div>
                <div class="kpi-card highlight"><div class="kpi-label">Net Income</div><div class="kpi-val">${fmt(r.netTotal)}</div></div>
                <div class="kpi-card"><div class="kpi-label">Piutang Aktif</div><div class="kpi-val" style="color:var(--red);">${fmt(r.receivableTotal)}</div></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">
                <div class="card"><div class="card-head"><div class="card-title">Tipe Unit Terlaris</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>Tipe Unit</th><th style="text-align:right;">Booking</th></tr></thead><tbody>${renderRankRows(r.unitTypeRank, 'Belum ada booking bulan ini.')}</tbody></table></div></div>
                <div class="card"><div class="card-head"><div class="card-title">Sumber Booking</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>Sumber</th><th style="text-align:right;">Booking</th></tr></thead><tbody>${renderRankRows(r.sourceRank, 'Belum ada sumber booking.')}</tbody></table></div></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">
                <div class="card"><div class="card-head"><div class="card-title">Pemasukan per Kategori</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>Kategori</th><th style="text-align:right;">Jumlah</th></tr></thead><tbody>${renderRankRows(r.incomeByCategory, 'Tidak ada pemasukan bulan ini.')}</tbody></table></div></div>
                <div class="card"><div class="card-head"><div class="card-title">Pengeluaran per Kategori</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>Kategori</th><th style="text-align:right;">Jumlah</th></tr></thead><tbody>${renderRankRows(r.expenseByCategory, 'Tidak ada pengeluaran bulan ini.')}</tbody></table></div></div>
            </div>
            
            <div class="card"><div class="card-head"><div class="card-title">Piutang Aktif</div></div><div class="card-body-flush tbl-wrap"><table><thead><tr><th>ID</th><th>Tamu</th><th>Check-in</th><th>Total</th><th>Terbayar</th><th style="text-align:right;">Sisa</th></tr></thead><tbody>${receivableRows}</tbody></table></div></div>
        </div>
    `;
}

function printMonthlyReport() {
    const monthStr = getMonthlyReportMonth();
    const area = document.getElementById('monthly-report-print-area');
    if (!area) return showToast('Laporan bulanan belum tersedia untuk dicetak', 'error');

    const printHtml = `
<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan Bulanan ${escapeHTML(monthStr)}</title>
<style>
@page { size: A4; margin: 12mm; } * { box-sizing: border-box; }
body { font-family: Arial, sans-serif; color: #1f2a1f; background: #fff; font-size: 11px; line-height: 1.35; }
.card { border: 1px solid #d7dfcf; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
.card-head { padding: 10px 12px; background: #f3f6ee; border-bottom: 1px solid #d7dfcf; } .card-title { font-weight: 700; font-size: 13px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.kpi-card { border: 1px solid #d7dfcf; border-radius: 8px; padding: 10px; background: #fbfcf7; }
.kpi-label { font-size: 9px; text-transform: uppercase; color: #6f7f63; font-weight: 700; } .kpi-val { font-size: 17px; font-weight: 700; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; }
th { background: #2e4820; color: #fff; text-align: left; padding: 7px; font-size: 10px; } td { border-bottom: 1px solid #e1e7da; padding: 7px; vertical-align: top; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>${area.innerHTML}<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script></body></html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return showToast('Popup diblokir browser. Izinkan popup untuk mencetak laporan bulanan.', 'error');
    win.document.open(); win.document.write(printHtml); win.document.close();
}