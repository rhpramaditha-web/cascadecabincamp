/* ============================================================
   js/masterSetting.js — Unit Rate, Holiday & High Season
   ============================================================ */

const DEFAULT_MASTER_SETTINGS = {
    unitRates: {
        RT:  { weekday: 400000, weekend: 750000 },
        FT:  { weekday: 300000, weekend: 650000 },
        CRT: { weekday: 500000, weekend: 850000 },
        RG:  { weekday: 700000, weekend: 1050000 }
    },
    holidays: []
};

let MASTER_SETTINGS = loadMasterSettings();

function loadMasterSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('cascade_master_settings') || '{}');

        return {
            unitRates: {
                ...DEFAULT_MASTER_SETTINGS.unitRates,
                ...(saved.unitRates || {})
            },
            holidays: Array.isArray(saved.holidays) ? saved.holidays : []
        };
    } catch (err) {
        console.warn('Gagal membaca master setting, gunakan default.', err);
        return JSON.parse(JSON.stringify(DEFAULT_MASTER_SETTINGS));
    }
}

function saveMasterSettingsLocal() {
    localStorage.setItem('cascade_master_settings', JSON.stringify(MASTER_SETTINGS));
}

function applyMasterSettingsToUnitTypes() {
    if (typeof UNIT_TYPES === 'undefined') return;

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

function getHolidaySetting(dateStr) {
    return (MASTER_SETTINGS.holidays || []).find(h => h.date === dateStr) || null;
}

function isHolidayRateDate(dateStr) {
    const h = getHolidaySetting(dateStr);
    return Boolean(h && h.rateType === 'weekend');
}

function isNationalHoliday(dateStr) {
    return Boolean(getHolidaySetting(dateStr));
}

function getHolidayName(dateStr) {
    const h = getHolidaySetting(dateStr);
    return h ? h.name : '';
}

function isWeekendOrHoliday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;

    const day = d.getDay();

    // Jumat = 5, Sabtu = 6, dan libur/high season ikut rate weekend.
    return day === 5 || day === 6 || isHolidayRateDate(dateStr);
}

function getRateTypeForDate(dateStr) {
    if (isHolidayRateDate(dateStr)) return 'Holiday';
    return isWeekendOrHoliday(dateStr) ? 'Weekend' : 'Weekday';
}