/* ============================================================
   CASCADE CABIN & CAMP — Shared Public JavaScript
   Dipakai oleh: index.html, booking.html
   ============================================================ */

// ── NAV: sticky shadow + hamburger ──────────────────────
const nav = document.querySelector('.nav');
const hamburger = document.querySelector('.nav-hamburger');
const navMobile = document.querySelector('.nav-mobile');

window.addEventListener('scroll', () => {
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
});

if (hamburger && navMobile) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navMobile.classList.toggle('open');
  });
  // Close on link click
  navMobile.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navMobile.classList.remove('open');
    });
  });
}

// ── SMOOTH SCROLL for anchor links ──────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      const offset = 72; // nav height
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── TOAST utility ────────────────────────────────────────
function showToast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ── FORMAT HELPERS ───────────────────────────────────────
function fmtRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── BOOKING ID GENERATOR ─────────────────────────────────
function generateBookingId() {
  const d = new Date();
  const yy  = String(d.getFullYear()).slice(2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `BK-${yy}${mm}-${rnd}`;
}

// ── WHATSAPP LINK BUILDER ────────────────────────────────
function buildWaLink(phone, message) {
  const num = phone.replace(/\D/g, '').replace(/^0/, '62');
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// ── FADE-IN ON SCROLL (Intersection Observer) ────────────
const fadeEls = document.querySelectorAll('[data-fade]');
if (fadeEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  fadeEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// ── CONFIG (update sebelum deploy) ───────────────────────
const CONFIG = {
  // Nomor WhatsApp bisnis (format: 62xxx)
  waNumber: '6281234567890',

  // URL Google Apps Script (dari langkah setup Sheets)
  sheetsUrl: 'https://script.google.com/macros/s/AKfycbzDugAAns73AIgGNeEYFPc6uPbQOuCgSDmJ26ZBC4g2Jq5oHR1r0aRE6HxehlwxYf5U/exec',

  // Harga per tipe kamar & paket
  prices: {
    'Forest Tent':   { Weekday: 300000, Weekend: 650000 },
    'Riverside Tent': { Weekday: 400000, Weekend: 750000 },
    'Riverside Glamping':   { Weekday: 700000, Weekend: 1050000 },
	'Cascading Riverside Tent':  { Weekday: 500000, Weekend: 850000 },
  },
};

// 1. Deklarasi variabel global
let selectedAddon = null;

// 2. Fungsi mendeteksi kartu di tengah
function detectCenterAddon() {
  const container = document.getElementById('pricing-scroll-addon');
  if (!container) return; // Mencegah error di halaman yang tidak punya korsel

  const cards = container.querySelectorAll('.price-card');
  const center = container.scrollLeft + container.offsetWidth / 2;

  let closest = null;
  let minDistance = Infinity;

  cards.forEach(card => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const dist = Math.abs(center - cardCenter);

    if (dist < minDistance) {
      minDistance = dist;
      closest = card;
    }
  });

  // Hapus efek dari semua kartu, lalu nyalakan kartu yang paling tengah
  cards.forEach(c => c.classList.remove('active'));

  if (closest) {
    closest.classList.add('active');
    selectedAddon = closest.dataset.pkg; // Simpan nama paket yang sedang disorot
  }
}

// 3. Pasang Event Listener DI LUAR fungsi
const pricingContainer = document.getElementById('pricing-scroll-addon');
if (pricingContainer) {
  pricingContainer.addEventListener('scroll', detectCenterAddon);
  window.addEventListener('resize', detectCenterAddon);
  setTimeout(detectCenterAddon, 100);
}

// 4. Fungsi eksekusi tombol WhatsApp tunggal
function pesanPaket() {
  if (!selectedAddon) {
    selectedAddon = "Paket Tambahan"; // Jaga-jaga jika kosong
  }
  
  // Format pesan WA dinamis sesuai paket yang tersorot
  const msg = `Halo Admin Cascade Cabin, saya tertarik untuk menambahkan paket penyerta (${selectedAddon}) untuk reservasi saya.`;
  
  // Arahkan ke WhatsApp
  window.open(`https://wa.me/6281234567890?text=${encodeURIComponent(msg)}`, '_blank');
}