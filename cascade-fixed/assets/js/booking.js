/* ============================================================
   CASCADE CABIN & CAMP — Booking Form JavaScript (PUBLIC WEB)
   100% SELARAS DENGAN DASHBOARD ADMIN
   ============================================================ */

// -- KONFIGURASI LIMIT UNIT FISIK --
const UNIT_LIMITS = {
  'cabin': 9,      // Forest Tent (FT)
  'tent': 5,       // Riverside Tent (RT)
  'cascading': 4,  // Cascading Riverside Tent (CRT)
  'lodge': 5       // Riverside Glamping (RG)
};

// -- STATE -------------------------------------------------
const state = {
  step: 1,
  checkin: '', checkout: '', durasi: 0,
  guests: 2,
  unit: '', pkgDinamis: '',
  nama: '', wa: '', email: '', kota: '',
  catatan: '', chips: [], sumber: '',
};

// -- INIT --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const inEl = document.getElementById('checkin');
  const outEl = document.getElementById('checkout');
  if(inEl) inEl.min = today;
  if(outEl) outEl.min = today;
  
  initUnitPrices();
  updateSummary();
});

function initUnitPrices() {
  const el = (id) => document.getElementById(id);
  const cfg = CONFIG.prices;
  
  if (el('price-cabin')) el('price-cabin').textContent = `Rp ${cfg['Forest Tent'].Weekday / 1000}rb / malam`;
  if (el('price-tent')) el('price-tent').textContent = `Rp ${cfg['Riverside Tent'].Weekday / 1000}rb / malam`;
  if (el('price-lodge')) el('price-lodge').textContent = `Rp ${cfg['Riverside Glamping'].Weekday / 1000}rb / malam`;
  if (el('price-cascading')) el('price-cascading').textContent = `Rp ${cfg['Cascading Riverside Tent'].Weekday / 1000}rb / malam`;
}

// -- DATE HANDLERS & NIGHT COUNTER -------------------------
document.getElementById('checkin')?.addEventListener('change', function () {
  state.checkin = this.value;
  const co = document.getElementById('checkout');
  co.min = this.value;
  if (co.value && co.value <= this.value) { co.value = ''; state.checkout = ''; }
  calcDurasi(); updateSummary();
});

document.getElementById('checkout')?.addEventListener('change', function () {
  state.checkout = this.value; calcDurasi(); updateSummary();
});

function calcDurasi() {
  if (!state.checkin || !state.checkout) { state.durasi = 0; return; }
  const d = (new Date(state.checkout) - new Date(state.checkin)) / 86400000;
  state.durasi = d > 0 ? d : 0;
}

function countNights(inStr, outStr) {
  let wd = 0, we = 0;
  if (!inStr || !outStr) return { wd, we };
  
  let d = new Date(inStr + 'T00:00:00');
  let end = new Date(outStr + 'T00:00:00');
  
  while (d < end) {
    const day = d.getDay();
    if (day === 5 || day === 6) we++; // Jumat & Sabtu malam
    else wd++;
    d.setDate(d.getDate() + 1); 
  }
  return { wd, we };
}

// -- GUEST COUNTER -----------------------------------------
function changeGuest(d) {
  state.guests = Math.min(20, Math.max(1, state.guests + d));
  document.getElementById('guest-num').textContent = state.guests;
  updateSummary();
}

// -- UNIT SELECTION ----------------------------------------
function selectUnit(id) {
  // Jika unit disable / sold-out, tolak klik
  const card = document.getElementById('unit-' + id);
  if (card && (card.classList.contains('disabled') || card.classList.contains('sold-out'))) {
    showToast('Tipe kamar ini sudah penuh pada tanggal tersebut', 'error');
    return;
  }

  state.unit = id;
  ['cabin', 'tent', 'lodge', 'cascading'].forEach(u =>
    document.getElementById('unit-' + u)?.classList.remove('selected')
  );
  card?.classList.add('selected');
  clearError('err-unit');
  updateSummary();
}

// -- CHIP TOGGLE -------------------------------------------
function toggleChip(el) { el.classList.toggle('selected'); }

// -- SUMMARY UPDATE ----------------------------------------
function updateSummary() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const unitNames = { cabin: 'Forest Tent', tent: 'Riverside Tent', lodge: 'Riverside Glamping', cascading: 'Cascading Riverside Tent' };

  set('sum-checkin',  fmtDate(state.checkin)  || '—');
  set('sum-checkout', fmtDate(state.checkout) || '—');
  set('sum-durasi',   state.durasi ? state.durasi + ' malam' : '—');
  set('sum-tamu',     state.guests + ' orang');
  set('sum-kamar',    state.unit ? unitNames[state.unit] : '—');

  if (state.unit && state.durasi > 0) {
    const { wd, we } = countNights(state.checkin, state.checkout);
    const priceCfg = CONFIG.prices[unitNames[state.unit]];
    const total = (wd * priceCfg.Weekday) + (we * priceCfg.Weekend);
    
    let paketInfo = [];
    if (wd > 0) paketInfo.push(`${wd} malam Weekday`);
    if (we > 0) paketInfo.push(`${we} malam Weekend`);
    
    state.pkgDinamis = paketInfo.join(' + ');

    set('sum-paket', state.pkgDinamis);
    set('sum-harga', 'Sesuai hari');
    set('sum-total', fmtRupiah(total));
    set('sum-dp',    fmtRupiah(Math.round(total / 2)));
  } else {
    set('sum-paket', '—'); set('sum-harga', '—'); set('sum-total', '—'); set('sum-dp', '—');
  }
}

// -- VALIDATION --------------------------------------------
function markErr(id, hasErr) { document.getElementById(id)?.classList.toggle('error', hasErr); }
function showErr(id, show) { document.getElementById(id)?.classList.toggle('visible', show); }
function clearError(id) { showErr(id, false); }

function validateStep(step) {
  let ok = true;
  if (step === 1) {
    const ci = document.getElementById('checkin')?.value;
    const co = document.getElementById('checkout')?.value;
    if (!ci) { markErr('checkin', true); showErr('err-checkin', true); ok = false; }
    else { markErr('checkin', false); showErr('err-checkin', false); }
    if (!co || co <= ci) { markErr('checkout', true); showErr('err-checkout', true); ok = false; }
    else { markErr('checkout', false); showErr('err-checkout', false); }
  }
  if (step === 2) {
    if (!state.unit) { showErr('err-unit', true); ok = false; }
  }
  if (step === 3) {
    const nama  = document.getElementById('nama')?.value.trim();
    const wa    = document.getElementById('wa')?.value.trim();
    const kota  = document.getElementById('kota')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const src   = document.getElementById('sumber')?.value;

    if (!nama) { markErr('nama', true); showErr('err-nama', true); ok = false; } else { markErr('nama', false); showErr('err-nama', false); }
    const waOk = /^0\d{8,12}$/.test((wa || '').replace(/[\s\-]/g, ''));
    if (!wa || !waOk) { markErr('wa', true); showErr('err-wa', true); ok = false; } else { markErr('wa', false); showErr('err-wa', false); }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { markErr('email', true); showErr('err-email', true); ok = false; } else { markErr('email', false); showErr('err-email', false); }
    if (!kota) { markErr('kota', true); showErr('err-kota', true); ok = false; } else { markErr('kota', false); showErr('err-kota', false); }
    if (!src) { markErr('sumber', true); showErr('err-sumber', true); ok = false; } else { markErr('sumber', false); showErr('err-sumber', false); }

    if (ok) {
      state.nama = nama; state.wa = wa; state.email = email; state.kota = kota;
      state.catatan = document.getElementById('catatan')?.value || '';
      state.sumber = src; state.chips = [...document.querySelectorAll('#chips .chip.selected')].map(c => c.textContent);
    }
  }
  return ok;
}

// -- LIVE AVAILABILITY (SINKRON DENGAN ADMIN) -------------
async function fetchLiveAvailability() {
  if (!state.checkin || !state.checkout) return true;

  const btnNext = document.querySelector('#section-1 .btn-next');
  const originalText = btnNext.innerHTML;
  
  // UX Loading
  btnNext.innerHTML = 'Mengecek ketersediaan...';
  btnNext.disabled = true;

  // Reset UI 
  document.querySelectorAll('.unit-card').forEach(card => {
      card.classList.remove('sold-out', 'disabled');
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';
      card.style.filter = 'none';
  });
  initUnitPrices();

  try {
    const res = await fetch(CONFIG.sheetsUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_availability' }), 
      headers: { 'Content-Type': 'text/plain' }
    });
    
    const result = await res.json();
    
    if (result.success) {
      const busyData = result.data;
      const usageCount = { 'cabin': 0, 'tent': 0, 'cascading': 0, 'lodge': 0 };

      // Normalisasi 00:00:00 agar perbandingan akurat
      const selIn = new Date(state.checkin + 'T00:00:00').getTime();
      const selOut = new Date(state.checkout + 'T00:00:00').getTime();

      busyData.forEach(b => {
        if (!b.checkin || !b.checkout) return;

        // Map data Admin (FT/RT/dll) ke ID html Publik (cabin/tent/dll)
        let fId = null;
        const uType = String(b.unitType).toUpperCase();
        if (uType === 'FT' || uType === 'FOREST TENT') fId = 'cabin';
        else if (uType === 'RT' || uType === 'RIVERSIDE TENT') fId = 'tent';
        else if (uType === 'CRT' || uType === 'CASCADING RIVERSIDE TENT') fId = 'cascading';
        else if (uType === 'RG' || uType === 'RIVERSIDE GLAMPING') fId = 'lodge';

        if (!fId) return; 

        // Potong tanggal dari Sheets untuk menghindari error format "Z"
        const bInStr = String(b.checkin).substring(0, 10);
        const bOutStr = String(b.checkout).substring(0, 10);
        const bIn = new Date(bInStr + 'T00:00:00').getTime();
        const bOut = new Date(bOutStr + 'T00:00:00').getTime();

        // Logika Overlap Tanggal (Bentrok)
        if (selIn < bOut && selOut > bIn) {
          usageCount[fId]++;
        }
      });

      // Update Tampilan Kamar
      Object.entries(UNIT_LIMITS).forEach(([id, limit]) => {
        const card = document.getElementById('unit-' + id);
        const priceEl = document.getElementById('price-' + id);
        if (!card) return;

        if (usageCount[id] >= limit) {
          // KONDISI PENUH (SOLD OUT)
          card.classList.add('sold-out', 'disabled');
          card.style.opacity = '0.4';
          card.style.pointerEvents = 'none';
          card.style.filter = 'grayscale(100%)';
          
          if (priceEl) priceEl.innerHTML = "<span style='color:#d32f2f;font-weight:bold;'>TELAH DIPESAN</span>";
          
          // Batalkan pilihan jika kartu ini sedang dipilih
          if (state.unit === id) {
              card.classList.remove('selected');
              state.unit = ''; 
              updateSummary();
          }
        }
      });
    }
  } catch (err) {
    console.error("Gagal sinkronisasi ketersediaan:", err);
  } finally {
    btnNext.innerHTML = originalText;
    btnNext.disabled = false;
  }
  return true;
}

// -- STEP NAVIGATION ---------------------------------------
async function goTo(n) {
  if (n > state.step && !validateStep(state.step)) return;

  // -- CEK KETERSEDIAAN SEBELUM PINDAH KE STEP KAMAR --
  if (n === 2 && state.step === 1) {
    await fetchLiveAvailability();
  }

  state.step = n;

  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + n)?.classList.add('active');

  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('dot-' + i);
    const lbl = document.getElementById('lbl-' + i);
    if (dot) dot.className = 'step-dot' + (i === n ? ' active' : i < n ? ' done' : '');
    if (lbl) lbl.className = 'step-label' + (i === n ? ' active' : i < n ? ' done' : '');
    if (i < 4) {
      const line = document.getElementById('line-' + i);
      if (line) line.className = 'step-line' + (i < n ? ' done' : '');
    }
  }

  if (n === 4) buildReview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -- REVIEW ------------------------------------------------
function buildReview() {
  const unitNames = { cabin: 'Forest Tent', tent: 'Riverside Tent', lodge: 'Riverside Glamping', cascading: 'Cascading Riverside Tent' };
  
  const { wd, we } = countNights(state.checkin, state.checkout);
  const priceCfg = CONFIG.prices[unitNames[state.unit]];
  const total = (wd * priceCfg.Weekday) + (we * priceCfg.Weekend);

  const rows = [
    ['Check-in', fmtDate(state.checkin)],
    ['Check-out', fmtDate(state.checkout)],
    ['Durasi', state.durasi + ' malam'],
    ['Jumlah tamu', state.guests + ' orang'],
    ['Tipe kamar', unitNames[state.unit]],
    ['Rincian Malam', state.pkgDinamis],
    ['Total Harga', fmtRupiah(total)],
    ['DP (50%)', fmtRupiah(Math.round(total / 2))],
    ['Nama', state.nama],
    ['WhatsApp', state.wa],
    ['Kota asal', state.kota],
    ['Sumber', state.sumber],
  ];

  if (state.chips.length) rows.push(['Permintaan', state.chips.join(', ')]);
  if (state.catatan)      rows.push(['Catatan', state.catatan]);

  const el = document.getElementById('review-content');
  if (el) el.innerHTML = rows.map(([l, v]) => `
    <div style="display:flex;justify-content:space-between;gap:16px;font-size:13px;border-bottom:1px solid rgba(139,96,64,0.07);padding-bottom:8px;">
      <span style="color:var(--text-muted)">${l}</span>
      <span style="color:var(--text-main);font-weight:500;text-align:right">${v}</span>
    </div>`).join('');
}

// -- SUBMIT (PAYLOAD DISAMAKAN DENGAN DASHBOARD ADMIN) ---
async function submitForm() {
  const btn = document.getElementById('btn-submit');
  if (!btn) return;
  btn.classList.add('loading');
  btn.disabled = true;

  const unitNames = { cabin: 'Forest Tent', tent: 'Riverside Tent', lodge: 'Riverside Glamping', cascading: 'Cascading Riverside Tent' };
  const bookingId = generateBookingId();
  
  const { wd, we } = countNights(state.checkin, state.checkout);
  const priceCfg = CONFIG.prices[unitNames[state.unit]];
  const total = (wd * priceCfg.Weekday) + (we * priceCfg.Weekend);

  // Struktur payload yang dipahami Admin Backend
  const payload = {
    action: 'add_booking',
    booking: {
      id: bookingId,
      nama: state.nama, 
      wa: state.wa, 
      email: state.email, 
      kota: state.kota,
      checkin: state.checkin, 
      checkout: state.checkout, 
      durasi: state.durasi,
      guests: state.guests,
      unit: unitNames[state.unit], 
      pkg: state.pkgDinamis,
      harga: total, 
      total: total, 
      dp: Math.round(total / 2),
      stBayar: 'Belum',
      stTamu: 'Konfirmasi',
      sumber: state.sumber, 
      catatan: [state.chips.join(', '), state.catatan].filter(Boolean).join(' | '),
      unitAssigned: '',
      deposit: 0,
      stDeposit: 'Belum',
      timestamp: new Date().toISOString()
    }
  };

  if (CONFIG.sheetsUrl && CONFIG.sheetsUrl.indexOf('script.google.com') !== -1) {
    try {
      await fetch(CONFIG.sheetsUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (err) {
      console.warn('Gagal kirim ke Sheets:', err);
    }
  }

  await new Promise(r => setTimeout(r, 1000));
  btn.classList.remove('loading');

  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById('success-screen')?.classList.add('visible');
  document.getElementById('success-nama').textContent = state.nama;
  document.getElementById('success-id-val').textContent = bookingId;

  const waMsg = `Halo Cascade Cabin! ???\n\nSaya baru mengisi form booking:\nID: *${bookingId}*\nNama: ${state.nama}\nCheck-in: ${fmtDate(state.checkin)}\nCheck-out: ${fmtDate(state.checkout)}\nUnit: ${unitNames[state.unit]}\nTotal: ${fmtRupiah(total)}\n\nMohon konfirmasi ketersediaannya. Terima kasih!`;
  const waEl = document.getElementById('wa-link');
  if (waEl) waEl.href = buildWaLink(CONFIG.waNumber, waMsg);

  showToast('Reservasi berhasil dikirim!');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}