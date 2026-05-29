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

// ✅ UNIT TO INITIAL MAPPING (SELARAS DENGAN ADMIN)
const unitToInitial = {
  'cabin': 'FT',
  'tent': 'RT',
  'lodge': 'RG',
  'cascading': 'CRT'
};

const unitToName = {
  'cabin': 'Forest Tent',
  'tent': 'Riverside Tent',
  'lodge': 'Riverside Glamping',
  'cascading': 'Cascading Riverside Tent'
};

// ✅ ADDON PRICE CONFIG (UNTUK KALKULASI & KIRIM KE ADMIN)
const ADDON_PRICES = {
  bbq: { name: 'BBQ Grill Set', price: 150000, unit: 'set' },
  kambing: { name: 'Kambing Guling', price: 2000000, unit: 'ekor' },
  liwet: { name: 'Liwetan Tradisional', price: 35000, unit: 'pax' },
  prasmanan: { name: 'Prasmanan Internasional', price: 30000, unit: 'pax' },
  rafting: { name: 'Rafting S. Palayangan', price: 150000, unit: 'org' },
  game: { name: 'Team Bonding / Fun Game', price: 35000, unit: 'org' }
};

// -- STATE -------------------------------------------------
const state = {
  step: 1,
  checkin: '', checkout: '', durasi: 0,
  guests: 2,
  unit: '', pkgDinamis: '',
  nama: '', wa: '', email: '', kota: '',
  catatan: '', chips: [], sumber: '',
  addons: {}, // Simpan data addon
  finalTotal: 0, // Total harga termasuk addon
};

// -- INIT --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const inEl = document.getElementById('checkin');
  const outEl = document.getElementById('checkout');
  if(inEl) inEl.min = today;
  if(outEl) outEl.min = today;
  
  // ✅ ATTACH EVENT LISTENER KE SEMUA ADDON INPUT
  attachAddonListeners();
  
  initUnitPrices();
  updateSummary();
});

// ✅ FUNGSI BARU: Attach listener ke semua addon input
function attachAddonListeners() {
  const addonIds = ['qty-bbq', 'qty-kambing', 'qty-liwet', 'qty-prasmanan', 'qty-rafting', 'qty-game'];
  addonIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateSummary);
      el.addEventListener('change', updateSummary);
    }
  });
}

// ✅ BOOKING ID GENERATOR - Format MMDD-#### (SELARAS ADMIN)
function generateBookingId(checkinDate) {
  const d = new Date(checkinDate + 'T00:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  
  // Generate 4 digit counter dari timestamp
  const counter = String(Date.now() % 10000).padStart(4, '0');
  
  return `${mm}${dd}-${counter}`;
}

// ✅ FUNGSI BARU: Format addon untuk sheet BookingAddons
function formatAddonsForSheet() {
  const addonsArray = [];
  
  Object.entries(state.addons).forEach(([key, qty]) => {
    if (qty > 0) {
      const addonConfig = ADDON_PRICES[key];
      addonsArray.push({
        bookingId: '', // akan diisi setelah booking tersimpan
        addonName: addonConfig.name,
        qty: qty,
        unit: addonConfig.unit,
        price: addonConfig.price,
        subtotal: qty * addonConfig.price,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  return addonsArray;
}

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
  state.guests = Math.min(4, Math.max(1, state.guests + d));
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

// -- SUMMARY UPDATE (DIPERBAIKI) ----------------------------------------
function updateSummary() {
  const setHtml = (id, val) => { 
    const el = document.getElementById(id); 
    if (el) el.innerHTML = val; 
  };
  const setText = (id, val) => { 
    const el = document.getElementById(id); 
    if (el) el.textContent = val; 
  };

  setText('sum-checkin',  fmtDate(state.checkin)  || '—');
  setText('sum-checkout', fmtDate(state.checkout) || '—');
  setText('sum-durasi',   state.durasi ? state.durasi + ' malam' : '—');
  setText('sum-tamu',     state.guests + ' orang');
  setText('sum-kamar',    state.unit ? unitToName[state.unit] : '—');

  if (state.unit && state.durasi > 0) {
    const { wd, we } = countNights(state.checkin, state.checkout);
    const priceCfg = CONFIG.prices[unitToName[state.unit]];
    const baseTotal = (wd * priceCfg.Weekday) + (we * priceCfg.Weekend);
    
	// -- LOGIKA KALKULASI PAKET TAMBAHAN (ADD-ON) --
    let extraCost = 0;
    let chosenAddons = [];
    
    // Fungsi pembantu untuk membaca angka input
    const getQty = (id) => parseInt(document.getElementById(id)?.value || 0, 10);

    const qtyBbq = getQty('qty-bbq');
    const qtyKambing = getQty('qty-kambing');
    const qtyLiwet = getQty('qty-liwet');
    const qtyPrasmanan = getQty('qty-prasmanan');
    const qtyRafting = getQty('qty-rafting');
    const qtyGame = getQty('qty-game');

    // SIMPAN KE STATE
    state.addons = {
      bbq: qtyBbq,
      kambing: qtyKambing,
      liwet: qtyLiwet,
      prasmanan: qtyPrasmanan,
      rafting: qtyRafting,
      game: qtyGame
    };

    if (qtyBbq > 0) {
        extraCost += (qtyBbq * 150000);
        chosenAddons.push(`${qtyBbq}x BBQ Grill (${fmtRupiah(qtyBbq * 150000)})`);
    }
    if (qtyKambing > 0) {
        extraCost += (qtyKambing * 2000000);
        chosenAddons.push(`${qtyKambing}x Kambing Guling (${fmtRupiah(qtyKambing * 2000000)})`);
    }
    if (qtyLiwet > 0) {
        extraCost += (qtyLiwet * 35000);
        chosenAddons.push(`${qtyLiwet}pax Liwetan (${fmtRupiah(qtyLiwet * 35000)})`);
    }
    if (qtyPrasmanan > 0) {
        extraCost += (qtyPrasmanan * 30000);
        chosenAddons.push(`${qtyPrasmanan}pax Prasmanan (${fmtRupiah(qtyPrasmanan * 30000)})`);
    }
    if (qtyRafting > 0) {
        extraCost += (qtyRafting * 150000);
        chosenAddons.push(`${qtyRafting}org Rafting (${fmtRupiah(qtyRafting * 150000)})`);
    }
    if (qtyGame > 0) {
        extraCost += (qtyGame * 35000);
        chosenAddons.push(`${qtyGame}org Fun Game (${fmtRupiah(qtyGame * 35000)})`);
    }

    // TOTAL AKHIR (KAMAR + ADDON)
    const finalTotal = baseTotal + extraCost;
    state.finalTotal = finalTotal;
    
    // Simpan text addon untuk dikirim ke admin
    state.addonText = chosenAddons.length ? chosenAddons.join(' | ') : '';

    // Rincian paket malam
    let paketInfo = [];
    if (wd > 0) paketInfo.push(`${wd} malam Weekday @ ${fmtRupiah(priceCfg.Weekday)}`);
    if (we > 0) paketInfo.push(`${we} malam Weekend @ ${fmtRupiah(priceCfg.Weekend)}`);
    state.pkgDinamis = paketInfo.join(' + ');

    // UPDATE DISPLAY SIDEBAR - ✅ GUNAKAN innerHTML BUKAN textContent
    let paketDisplay = state.pkgDinamis;
    if (chosenAddons.length) {
      paketDisplay += `<br><small style="color:#2e4820;font-weight:600;display:block;margin-top:8px;">Addon:<br>${chosenAddons.join('<br>')}</small>`;
    }
    
    // ✅ GUNAKAN setHtml, BUKAN setText (untuk support HTML)
    setHtml('sum-paket', paketDisplay);
    setText('sum-harga', 'Sesuai hari');
    setText('sum-total', fmtRupiah(finalTotal));
    setText('sum-dp',    fmtRupiah(Math.round(finalTotal / 2)));
  } else {
    setText('sum-paket', '—'); setText('sum-harga', '—'); setText('sum-total', '—'); setText('sum-dp', '—');
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

// -- LIVE AVAILABILITY & HARGA (SINKRON DENGAN ADMIN) -------------
async function fetchLiveAvailability() {
  if (!state.checkin || !state.checkout) return true;

  const btnNext = document.querySelector('#section-1 .btn-next');
  const originalText = btnNext.innerHTML;
  
  // UX Loading
  btnNext.innerHTML = 'Mengecek ketersediaan...';
  btnNext.disabled = true;

  try {
    const res = await fetch(CONFIG.sheetsUrl, {
      method: 'POST',
      body: JSON.stringify({ 
          action: 'get_availability',
          checkin: state.checkin,
          checkout: state.checkout
      }), 
      headers: { 'Content-Type': 'text/plain' }
    });
    
    const result = await res.json();
    
    if (result.success) {
      // 1. TIMPA HARGA LOKAL DENGAN HARGA DARI MASTER SETTING ADMIN
      if (result.rates) {
          CONFIG.prices = result.rates; 
      }
      
      initUnitPrices();
      
      // 2. HITUNG SISA UNIT
      const busyData = result.data || [];
      const usageCount = { 'cabin': 0, 'tent': 0, 'cascading': 0, 'lodge': 0 };

      const selIn = new Date(state.checkin + 'T00:00:00').getTime();
      const selOut = new Date(state.checkout + 'T00:00:00').getTime();

      busyData.forEach(b => {
        if (!b.checkin || !b.checkout) return;
        let fId = null;
        const uType = String(b.unitType).toUpperCase();
        if (uType === 'FT' || uType === 'FOREST TENT') fId = 'cabin';
        else if (uType === 'RT' || uType === 'RIVERSIDE TENT') fId = 'tent';
        else if (uType === 'CRT' || uType === 'CASCADING RIVERSIDE TENT') fId = 'cascading';
        else if (uType === 'RG' || uType === 'RIVERSIDE GLAMPING') fId = 'lodge';

        if (!fId) return; 

        const bIn = new Date(String(b.checkin).substring(0, 10) + 'T00:00:00').getTime();
        const bOut = new Date(String(b.checkout).substring(0, 10) + 'T00:00:00').getTime();

        if (selIn < bOut && selOut > bIn) usageCount[fId]++;
      });

      // 3. TAMPILKAN SISA UNIT DI LAYAR
      Object.entries(UNIT_LIMITS).forEach(([id, limit]) => {
        const card = document.getElementById('unit-' + id);
        const priceEl = document.getElementById('price-' + id);
        if (!card) return;
        
        const terpakai = usageCount[id] || 0;
        const sisa = limit - terpakai; 
        
        // Buat atau timpa elemen penunjuk sisa unit
        let sisaEl = document.getElementById('sisa-' + id);
        if (!sisaEl) {
            sisaEl = document.createElement('div');
            sisaEl.id = 'sisa-' + id;
            sisaEl.style.fontSize = '12px';
            sisaEl.style.fontWeight = 'bold';
            sisaEl.style.marginTop = '4px';
            sisaEl.style.color = '#4e7038';
            priceEl.parentNode.insertBefore(sisaEl, priceEl);
        }

        if (sisa <= 0) {
          card.classList.add('sold-out', 'disabled');
          card.style.opacity = '0.4';
          card.style.pointerEvents = 'none';
          card.style.filter = 'grayscale(100%)';
          
          if (priceEl) priceEl.innerHTML = "<span style='color:#d32f2f;font-weight:bold;'>TELAH DIPESAN</span>";
          sisaEl.innerHTML = "<span style='color:#d32f2f;'>Habis (0 unit)</span>";
          
          if (state.unit === id) {
              card.classList.remove('selected');
              state.unit = ''; 
          }
        } else {
          card.classList.remove('sold-out', 'disabled');
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
          card.style.filter = 'none';
          
          sisaEl.innerHTML = `Tersedia: <span style="color:#d32f2f;">${sisa} unit</span>`;
        }
      });
      
      updateSummary();
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
  const { wd, we } = countNights(state.checkin, state.checkout);
  const priceCfg = CONFIG.prices[unitToName[state.unit]];
  const baseTotal = (wd * priceCfg.Weekday) + (we * priceCfg.Weekend);

  const rows = [
    ['Check-in', fmtDate(state.checkin)],
    ['Check-out', fmtDate(state.checkout)],
    ['Durasi', state.durasi + ' malam'],
    ['Jumlah tamu', state.guests + ' orang'],
    ['Tipe kamar', unitToName[state.unit]],
    ['Rincian Malam', state.pkgDinamis],
    ['Harga kamar', fmtRupiah(baseTotal)],
  ];

  // TAMBAHKAN ADDON KE REVIEW
  if (state.addonText) {
    rows.push(['Paket tambahan', state.addonText]);
  }

  rows.push(
    ['Total Harga', fmtRupiah(state.finalTotal)],
    ['DP (50%)', fmtRupiah(Math.round(state.finalTotal / 2))],
    ['Nama', state.nama],
    ['WhatsApp', state.wa],
    ['Kota asal', state.kota],
    ['Sumber', state.sumber],
  );

  if (state.chips.length) rows.push(['Permintaan', state.chips.join(', ')]);
  if (state.catatan)      rows.push(['Catatan', state.catatan]);

  const el = document.getElementById('review-content');
  if (el) el.innerHTML = rows.map(([l, v]) => `
    <div style="display:flex;justify-content:space-between;gap:16px;font-size:13px;border-bottom:1px solid rgba(139,96,64,0.07);padding-bottom:8px;">
      <span style="color:var(--text-muted)">${l}</span>
      <span style="color:var(--text-main);font-weight:500;text-align:right">${v}</span>
    </div>`).join('');
}

// ✅ FUNGSI BARU: Submit addon ke sheet BookingAddons
async function submitAddons(bookingId) {
  const addonsData = formatAddonsForSheet();
  
  if (addonsData.length === 0) {
    // Tidak ada addon, skip
    return true;
  }

  // Set bookingId untuk setiap addon
  addonsData.forEach(a => a.bookingId = bookingId);

  const payload = {
    action: 'add_booking_addons',
    addons: addonsData
  };

  try {
    const res = await fetch(CONFIG.sheetsUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' }
    });
    
    const result = await res.json();
    
    if (!result.success) {
      console.warn('⚠️ Warning: Addon tidak tersimpan, tapi booking OK:', result.message);
      // Jangan error jika addon gagal, booking sudah tersimpan
      return true;
    }
    
    console.log('✅ Addon berhasil tersimpan ke sheet BookingAddons');
    return true;
  } catch (err) {
    console.warn('⚠️ Warning: Gagal kirim addon ke Sheets:', err);
    // Jangan error jika addon gagal, booking sudah tersimpan
    return true;
  }
}

// -- SUBMIT (SELARAS DENGAN ADMIN) ------------------------------------------------
async function submitForm() {
  const btn = document.getElementById('btn-submit');
  if (!btn) return;
  btn.classList.add('loading');
  btn.disabled = true;

  // ✅ GUNAKAN FORMAT YANG SELARAS DENGAN ADMIN
  const bookingId = generateBookingId(state.checkin);
  
  const { wd, we } = countNights(state.checkin, state.checkout);
  const priceCfg = CONFIG.prices[unitToName[state.unit]];
  const baseTotal = (wd * priceCfg.Weekday) + (we * priceCfg.Weekend);

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
      unit: unitToInitial[state.unit],
      pkg: state.pkgDinamis,
      harga: baseTotal,
      addons: state.addons,
      addonText: state.addonText,
      total: state.finalTotal,
      dp: Math.round(state.finalTotal / 2),
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
      const res = await fetch(CONFIG.sheetsUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' },
      });
      
      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Gagal menyimpan data ke sistem admin');
      }
    } catch (err) {
      console.warn('Gagal kirim ke Sheets:', err);
      showToast('Booking gagal: ' + err.message, 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
      return; 
    }
  }

  // ✅ SETELAH BOOKING BERHASIL, KIRIM ADDON KE SHEET BookingAddons
  await submitAddons(bookingId);

  await new Promise(r => setTimeout(r, 1000));
  btn.classList.remove('loading');

  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById('success-screen')?.classList.add('visible');
  document.getElementById('success-nama').textContent = state.nama;
  document.getElementById('success-id-val').textContent = bookingId;

  const waMsg = `Halo Cascade Cabin! 👋\n\nSaya baru mengisi form booking:\nID: *${bookingId}*\nNama: ${state.nama}\nCheck-in: ${fmtDate(state.checkin)}\nCheck-out: ${fmtDate(state.checkout)}\nTotal: ${fmtRupiah(state.finalTotal)}\n\nTerima kasih!`;
  const waEl = document.getElementById('wa-link');
  if (waEl) waEl.href = buildWaLink(CONFIG.waNumber, waMsg);

  showToast('Reservasi berhasil dikirim!');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
