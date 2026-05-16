// app.js
let BOOKINGS = [];
let INCOME = [];
let EXPENSE = [];
let UNITS = [];
let MASTER_SETTINGS = {};
let CASH_RECONCILIATIONS = [];

MASTER_SETTINGS = loadMasterSettings();

document.addEventListener('DOMContentLoaded', () => {
    applyRoleAccess();

    if (!getCurrentRole()) {
        openRoleLogin();
        return;
    }

    showPage('dashboard');
    renderKalender();
    renderUnitTable();
    setTimeout(syncDataFromSheets, 500);
});

function refreshAllViews() {
    renderBookingTable?.();
    renderUnitTable?.();
    renderFinance?.();
    renderDailyReport?.();
    renderMonthlyReport?.();
    renderReceivableTable?.();
    renderMasterSettingsPage?.();
    renderCancellationArchive?.();
}