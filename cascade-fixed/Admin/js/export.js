/* ============================================================
   js/export.js — Fitur Unduh / Export Data ke CSV
   ============================================================ */

function renderExportDataPage() {
    const monthInput = document.getElementById('export-month');
    if (!monthInput) return;

    if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

function csvSafe(value) {
    let v = value === undefined || value === null ? '' : String(value);

    // Mencegah CSV formula injection saat dibuka di Excel.
    if (/^[=+\-@]/.test(v)) {
        v = "'" + v;
    }

    v = v.replaceAll('"', '""');
    return `"${v}"`;
}

function downloadCSV(filename, rows) {
    if (!rows || !rows.length) {
        showToast('Tidak ada data untuk diexport', 'error');
        return;
    }

    const csv = rows
        .map(row => row.map(csvSafe).join(';'))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`File ${filename} berhasil dibuat`);
}

function todayFileStamp() {
    return new Date().toISOString().slice(0, 10);
}

function exportBookingsCSV() {
    if (typeof requireAction === 'function' && !requireAction('export', 'Role ini tidak boleh export data.')) return;
    
    const rows = [[
        'Booking ID', 'Nama', 'WhatsApp', 'Email', 'Kota',
        'Check-in', 'Check-out', 'Tipe Unit', 'Unit Fisik',
        'Jumlah Tamu', 'Total', 'Terbayar', 'Sisa',
        'Status Bayar', 'Status Tamu', 'Sumber', 'Catatan'
    ]];

    getBookings().forEach(b => {
        const total = normalizeAmount(b.total);
        const paid = getPaidAmountForBooking(b);
        const remaining = Math.max(total - paid, 0);

        rows.push([
            b.id, b.nama, b.wa, b.email, b.kota,
            b.checkin, b.checkout, b.unit,
            getUnitLabel(getBookingAssignedUnitId(b)),
            b.guests, total, paid, remaining,
            getBookingPaymentStatus(b),
            b.stTamu, b.sumber, b.catatan
        ]);
    });

    downloadCSV(`reservasi-${todayFileStamp()}.csv`, rows);
}

function exportFinanceCSV() {
    if (typeof requireAction === 'function' && !requireAction('export', 'Role ini tidak boleh export data.')) return;
    
    const rows = [[
        'ID', 'Tanggal', 'Keterangan', 'Kategori',
        'Metode', 'Dari/Ke', 'Tipe', 'Jumlah', 'Catatan'
    ]];

    const incomeRows = (INCOME || []).map(i => normalizeFinanceTx(i, 'income'));
    const expenseRows = (EXPENSE || []).map(e => normalizeFinanceTx(e, 'expense'));

    const all = [...incomeRows, ...expenseRows]
        .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));

    all.forEach(t => {
        rows.push([
            t.id, t.tanggal, t.keterangan, t.kategori,
            t.metode, t.dariKe,
            t.tipe === 'income' ? 'Pemasukan' : 'Pengeluaran',
            t.jumlah, t.catatan
        ]);
    });

    downloadCSV(`keuangan-${todayFileStamp()}.csv`, rows);
}

function exportReceivablesCSV() {
    const rows = [[
        'Booking ID', 'Nama', 'WhatsApp', 'Check-in', 'Check-out',
        'Tipe Unit', 'Unit Fisik', 'Total', 'Terbayar', 'Sisa', 'Status Bayar'
    ]];

    const data = typeof getReceivableData === 'function' ? getReceivableData() : [];

    data.forEach(b => {
        rows.push([
            b.id, b.nama, b.wa, b.checkin, b.checkout,
            b.unit, getUnitLabel(getBookingAssignedUnitId(b)),
            b.total, b.paid, b.remaining, b.paymentStatus
        ]);
    });

    downloadCSV(`piutang-${todayFileStamp()}.csv`, rows);
}

function exportCancellationsCSV() {
    const rows = [[
        'Booking ID', 'Nama', 'WhatsApp', 'Check-in', 'Check-out',
        'Tipe Unit', 'Unit Fisik', 'Tanggal Batal', 'Alasan',
        'Kebijakan Dana', 'Terbayar', 'Refund', 'Dana Tertahan', 'Catatan'
    ]];

    const data = typeof getCancellationArchiveData === 'function' ? getCancellationArchiveData() : [];

    data.forEach(b => {
        rows.push([
            b.id, b.nama, b.wa, b.checkin, b.checkout,
            b.unit, getUnitLabel(getBookingAssignedUnitId(b)),
            b.cancelDate, b.cancelReason, getCancelPolicyLabel(b.cancelPolicy),
            b.paid, b.cancelRefund, b.retained, b.cancelNote
        ]);
    });

    downloadCSV(`pembatalan-${todayFileStamp()}.csv`, rows);
}

function exportCashReconciliationCSV() {
    const rows = [[
        'ID', 'Tanggal', 'Saldo Awal', 'Pemasukan', 'Pengeluaran',
        'Saldo Sistem', 'Saldo Fisik', 'Selisih', 'Status',
        'Admin', 'Catatan', 'Timestamp'
    ]];

    (typeof CASH_RECONCILIATIONS !== 'undefined' ? CASH_RECONCILIATIONS : []).forEach(r => {
        rows.push([
            r.id || r.ID, r.tanggal || r.Tanggal,
            r.saldoAwal || r.SaldoAwal || 0,
            r.pemasukan || r.Pemasukan || 0,
            r.pengeluaran || r.Pengeluaran || 0,
            r.saldoSistem || r.SaldoSistem || 0,
            r.saldoFisik || r.SaldoFisik || 0,
            r.selisih || r.Selisih || 0,
            r.status || r.Status,
            r.admin || r.Admin,
            r.catatan || r.Catatan,
            r.timestamp || r.Timestamp
        ]);
    });

    downloadCSV(`rekonsiliasi-kas-${todayFileStamp()}.csv`, rows);
}

function exportMonthlyReportCSV() {
    const monthInput = document.getElementById('export-month');
    const monthStr = monthInput?.value || (typeof getMonthlyReportMonth === 'function' ? getMonthlyReportMonth() : '');

    if (!monthStr) {
        showToast('Pilih bulan terlebih dahulu', 'error');
        return;
    }

    const r = buildMonthlyReportData(monthStr);

    const rows = [
        ['Section', 'Item', 'Value'],
        ['Ringkasan', 'Periode', monthStr],
        ['Ringkasan', 'Check-in Bulan Ini', r.checkins.length],
        ['Ringkasan', 'Booking Aktif', r.activeBookingsInMonth.length],
        ['Ringkasan', 'Booking Batal', r.cancellations.length],
        ['Ringkasan', 'Occupancy Rate', `${r.occupancy.rate}%`],
        ['Keuangan', 'Pemasukan', r.incomeTotal],
        ['Keuangan', 'Pengeluaran', r.expenseTotal],
        ['Keuangan', 'Net Income', r.netTotal],
        ['Keuangan', 'Piutang Aktif', r.receivableTotal],
        ['Pembatalan', 'Total Refund', r.refundTotal],
        ['Pembatalan', 'DP Hangus / Dana Tertahan', r.retainedTotal],
        ['Occupancy', 'Unit-Night Terisi', r.occupancy.occupiedUnitNights],
        ['Occupancy', 'Kapasitas Unit-Night', r.occupancy.totalUnitNights],
        [],
        ['Pemasukan per Kategori', 'Kategori', 'Jumlah']
    ];

    r.incomeByCategory.forEach(x => { rows.push(['Pemasukan per Kategori', x.kategori, x.jumlah]); });

    rows.push([]);
    rows.push(['Pengeluaran per Kategori', 'Kategori', 'Jumlah']);
    r.expenseByCategory.forEach(x => { rows.push(['Pengeluaran per Kategori', x.kategori, x.jumlah]); });

    rows.push([]);
    rows.push(['Tipe Unit Terlaris', 'Tipe Unit', 'Booking']);
    r.unitTypeRank.forEach(x => { rows.push(['Tipe Unit Terlaris', x.label, x.total]); });

    rows.push([]);
    rows.push(['Sumber Booking', 'Sumber', 'Booking']);
    r.sourceRank.forEach(x => { rows.push(['Sumber Booking', x.label, x.total]); });

    rows.push([]);
    rows.push(['Pembatalan', 'Booking ID', 'Nama', 'Tanggal Batal', 'Refund']);
    r.cancellations.forEach(b => { rows.push(['Pembatalan', b.id, b.nama, b.cancelDate, b.cancelRefund]); });

    rows.push([]);
    rows.push(['Piutang', 'Booking ID', 'Nama', 'Sisa']);
    r.receivables.forEach(b => { rows.push(['Piutang', b.id, b.nama, b.remaining]); });

    downloadCSV(`laporan-bulanan-${monthStr}.csv`, rows);
}

function exportAllCSV() {
    exportBookingsCSV();
    setTimeout(exportFinanceCSV, 300);
    setTimeout(exportReceivablesCSV, 600);
    setTimeout(exportCancellationsCSV, 900);
    setTimeout(exportCashReconciliationCSV, 1200);
    setTimeout(exportMonthlyReportCSV, 1500);
}