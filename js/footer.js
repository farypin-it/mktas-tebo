/**
 * footer.js - Komponen Footer Tunggal Terpusat (Single Source of Truth)
 * Digunakan di seluruh halaman publik Portal MKTAS:
 * index.html, berita.html, berita-detail.html, profil.html, galeri.html, referensi.html
 */

(function () {
  function getPathPrefix() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('/berita/') || (window.location.href.indexOf('/berita/') !== -1 && !path.endsWith('/berita.html'))) {
      return '../';
    }
    return '';
  }

  function renderFooterHTML() {
    const footerEl = document.getElementById('kontak') || document.querySelector('footer.public-footer');
    if (!footerEl) return;

    const prefix = getPathPrefix();

    footerEl.className = 'public-footer';
    footerEl.id = 'kontak';
    footerEl.innerHTML = `
      <!-- MAPS SECTION -->
      <section id="maps-section" style="width: 100%; height: 350px; display: none; background: #e5e7eb; margin-bottom: -1px;">
        <div id="map-container" style="width: 100%; height: 100%; position: relative; z-index: 1;"></div>
      </section>

      <div class="container" style="padding-top: 40px;">
        <div class="footer-grid">

          <!-- Kolom 1: Profil Singkat & Kontak -->
          <div class="footer-col">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
              <img id="footer-logo" src="" alt="Logo"
                style="width: 50px; height: 50px; object-fit: contain; display: none;" />
              <div>
                <h4 id="footer-forum-name" style="margin-bottom: 5px;">Portal MKTAS</h4>
                <p id="footer-region" style="font-size: 0.9rem; color: #9ca3af; margin:0;"></p>
              </div>
            </div>
            <div id="footer-address-container" style="display:flex; gap:10px; margin-bottom: 10px; align-items: flex-start;">
              <i class="fa-solid fa-location-dot" style="width: 20px; color: #ef4444; margin-top:4px;"></i>
              <span id="footer-address"></span>
            </div>
            <p id="footer-phone-container">
              <i class="fa-brands fa-whatsapp" style="width: 20px; color: #25D366;"></i>
              <a href="javascript:void(0);" id="footer-phone-link" class="footer-contact-link" target="_blank" rel="noopener noreferrer" title="Hubungi via WhatsApp">
                <span id="footer-phone"></span>
              </a>
            </p>
            <p id="footer-email-container">
              <i class="fa-solid fa-envelope" style="width: 20px; color: #3b82f6;"></i>
              <a href="javascript:void(0);" id="footer-email-link" class="footer-contact-link" title="Kirim Email">
                <span id="footer-email"></span>
              </a>
            </p>
            <p id="footer-website-container">
              <i class="fa-solid fa-globe" style="width: 20px; color: #10b981;"></i>
              <a href="javascript:void(0);" id="footer-website" class="footer-contact-link" target="_blank" rel="noopener noreferrer" title="Kunjungi Website"></a>
            </p>
          </div>

          <!-- Kolom 2: Tautan Cepat -->
          <div class="footer-col">
            <h4>Tautan Cepat</h4>
            <ul style="list-style:none; padding:0; line-height:2;">
              <li><a href="${prefix}profil.html" style="color:#9ca3af; text-decoration:none;"><i class="fa-solid fa-angle-right"></i> Profil Organisasi</a></li>
              <li><a href="${prefix}berita.html" style="color:#9ca3af; text-decoration:none;"><i class="fa-solid fa-angle-right"></i> Kumpulan Berita</a></li>
              <li><a href="${prefix}index.html#jadwal" style="color:#9ca3af; text-decoration:none;"><i class="fa-solid fa-angle-right"></i> Jadwal Kegiatan</a></li>
              <li><a href="${prefix}galeri.html" style="color:#9ca3af; text-decoration:none;"><i class="fa-solid fa-angle-right"></i> Galeri Dokumentasi</a></li>
              <li><a href="${prefix}referensi.html" style="color:#9ca3af; text-decoration:none;"><i class="fa-solid fa-angle-right"></i> File & Dokumen Referensi</a></li>
              <li><a href="${prefix}login.html" style="color:#9ca3af; text-decoration:none;"><i class="fa-solid fa-angle-right"></i> Masuk Portal</a></li>
            </ul>
          </div>

          <!-- Kolom 3: Media Sosial -->
          <div class="footer-col">
            <h4>Ikuti Kami</h4>
            <div class="social-links" id="social-container">
              <!-- Ikon Media Sosial dimuat otomatis dari database -->
            </div>
          </div>
        </div>

        <!-- Baris Bawah Copyright -->
        <div style="border-top: 1px solid #374151; margin-top: 30px; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
          <p style="font-size: 0.85rem; color: #9ca3af; margin: 0;">
            &copy; 2026 <span id="footer-copyright-name">Portal MKTAS</span>. All rights reserved.
          </p>
          <p style="font-size: 0.85rem; color: #9ca3af; margin: 0;">
            Powered by : <a href="https://farypin-inovasiteknologi.com" target="_blank"
              style="color: var(--primary-color, #2563eb); text-decoration: none; font-weight: 600;">PT farypin Inovasi Teknologi</a>
          </p>
        </div>
      </div>
    `;
  }

  function safeParseJson(value, fallback = {}) {
    if (value === null || value === undefined || value === '') return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  async function populateFooterData() {
    let s = {};
    try {
      const raw = localStorage.getItem('mktas_settings');
      if (raw) {
        s = safeParseJson(raw, {});
      }
    } catch (e) {
      console.warn('[footer.js] Invalid settings cache, clearing local data.', e);
      try { localStorage.removeItem('mktas_settings'); } catch (removeErr) {}
      s = {};
    }

    // 1. Tampilkan dulu dari cache lokal agar instan
    applySettingsToDOM(s);

    // 2. Refresh data settings & socials dari server
    if (typeof fetchAPI === 'function') {
      try {
        const [setRes, socRes] = await Promise.all([
          fetchAPI('getSettings', {}).catch(() => null),
          fetchAPI('getSocials', {}).catch(() => null)
        ]);

        if (setRes && setRes.status === 'success' && setRes.data) {
          s = typeof mergeSettings === 'function' ? mergeSettings(s, setRes.data) : Object.assign(s, setRes.data);
          try { localStorage.setItem('mktas_settings', JSON.stringify(s)); } catch (e) { }
          applySettingsToDOM(s);
        }

        if (socRes && socRes.status === 'success' && Array.isArray(socRes.data)) {
          applySocialsToDOM(socRes.data);
        }
      } catch (err) {
        console.warn('[footer.js] Gagal memuat data online:', err);
      }
    }
  }

  function applySettingsToDOM(s) {
    if (!s) return;

    // Header Logo (Global)
    const hImg = document.getElementById('header-logo-img');
    const hSvg = document.getElementById('header-logo-svg');
    const logoUrl = s.logo_forum || s.logo_instansi || '';

    if (logoUrl) {
      if (hImg) {
        hImg.src = logoUrl;
        hImg.style.display = 'block';
      }
      if (hSvg) hSvg.style.display = 'none';
      const footerLogo = document.getElementById('footer-logo');
      if (footerLogo) {
        footerLogo.src = logoUrl;
        footerLogo.style.display = 'block';
      }
    }

    // Nama Forum
    const forumNameEl = document.getElementById('footer-forum-name');
    if (forumNameEl) {
      forumNameEl.textContent = s.nama_forum || s.singkatan_forum || 'Portal MKTAS';
    }

    // Copyright Name
    const copyNameEl = document.getElementById('footer-copyright-name');
    if (copyNameEl) {
      copyNameEl.textContent = s.nama_forum || 'Portal MKTAS';
    }

    // Wilayah
    const regionText = s.wilayah || s.kabupaten || '';
    const regionEl = document.getElementById('footer-region');
    const headerRegionEl = document.getElementById('header-wilayah');
    if (regionEl) regionEl.textContent = regionText;
    if (headerRegionEl) headerRegionEl.textContent = regionText;

    // Alamat
    const addrEl = document.getElementById('footer-address');
    if (addrEl) {
      addrEl.innerHTML = s.alamat ? s.alamat : 'Belum ada data';
    }

    // Telepon / WhatsApp
    const phone = s.telp ?? s.kontak_wa ?? s.no_hp ?? '';
    const phoneText = String(phone).trim();
    const phoneEl = document.getElementById('footer-phone');
    const phoneLinkEl = document.getElementById('footer-phone-link');
    const phoneContainer = document.getElementById('footer-phone-container') || (phoneLinkEl ? phoneLinkEl.closest('p') : null);

    if (phoneEl) phoneEl.textContent = phoneText || 'Belum ada data';
    if (phoneLinkEl) {
      if (phoneText && phoneText !== '-') {
        let cleanPhone = phoneText.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith('8')) {
          cleanPhone = '62' + cleanPhone;
        }
        phoneLinkEl.href = cleanPhone ? `https://wa.me/${cleanPhone}` : 'javascript:void(0);';
        phoneLinkEl.target = cleanPhone ? '_blank' : '_self';
        phoneLinkEl.rel = 'noopener noreferrer';
        phoneLinkEl.style.cursor = 'pointer';
        phoneLinkEl.onclick = null;
        if (phoneContainer) phoneContainer.style.display = 'block';
      } else {
        phoneLinkEl.href = 'javascript:void(0);';
        phoneLinkEl.removeAttribute('target');
        if (phoneContainer) phoneContainer.style.display = 'none';
      }
    }

    // Email
    const email = s.email == null ? '' : String(s.email).trim();
    const emailEl = document.getElementById('footer-email');
    const emailLinkEl = document.getElementById('footer-email-link');
    const emailContainer = document.getElementById('footer-email-container') || (emailLinkEl ? emailLinkEl.closest('p') : null);

    if (emailEl) emailEl.textContent = email || 'Belum ada data';
    if (emailLinkEl) {
      if (email && email !== '-') {
        emailLinkEl.href = `mailto:${email}`;
        emailLinkEl.target = '_self';
        emailLinkEl.style.cursor = 'pointer';
        emailLinkEl.onclick = null;
        if (emailContainer) emailContainer.style.display = 'block';
      } else {
        emailLinkEl.href = 'javascript:void(0);';
        emailLinkEl.onclick = (e) => { e.preventDefault(); };
        if (emailContainer) emailContainer.style.display = 'none';
      }
    }

    // Website
    const websiteValue = s.website ?? s.domain_resmi ?? '';
    const website = String(websiteValue).trim();
    const webEl = document.getElementById('footer-website');
    const webContainer = document.getElementById('footer-website-container') || (webEl ? webEl.closest('p') : null);

    if (webEl) {
      if (website && website !== '-') {
        const webUrl = /^https?:\/\//i.test(website) ? website : 'https://' + website;
        webEl.textContent = website.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        webEl.href = webUrl;
        webEl.target = '_blank';
        webEl.rel = 'noopener noreferrer';
        webEl.style.cursor = 'pointer';
        webEl.onclick = null;
        if (webContainer) webContainer.style.display = 'block';
      } else {
        webEl.href = 'javascript:void(0);';
        webEl.textContent = 'Belum ada data';
        webEl.onclick = (e) => { e.preventDefault(); };
        if (webContainer) webContainer.style.display = 'none';
      }
    }

    // Render Map (Mendukung Embed Iframe, URL Maps, atau Titik Koordinat Leaflet)
    const mapsValue = s.maps_embed ?? s.koordinat ?? '';
    if (String(mapsValue).trim() !== '') {
      const mapsSec = document.getElementById('maps-section');
      const mapCont = document.getElementById('map-container');
      if (mapsSec && mapCont) {
        const raw = String(mapsValue).trim();
        if (raw.includes('<iframe')) {
          mapsSec.style.display = 'block';
          mapCont.innerHTML = raw;
          const ifr = mapCont.querySelector('iframe');
          if (ifr) {
            ifr.style.width = '100%';
            ifr.style.height = '100%';
            ifr.style.border = '0';
          }
        } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
          mapsSec.style.display = 'block';
          mapCont.innerHTML = `<iframe src="${raw}" style="width:100%;height:100%;border:0;" allowfullscreen="" loading="lazy"></iframe>`;
        } else {
          const coords = raw.split(',').map(c => parseFloat(c.trim()));
          if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            mapsSec.style.display = 'block';
            try {
              if (window.L) {
                // Hapus map lama jika ada
                if (mapCont._leaflet_id) {
                  mapCont.outerHTML = '<div id="map-container" style="width: 100%; height: 100%; position: relative; z-index: 1;"></div>';
                }
                const newMapCont = document.getElementById('map-container');
                const map = L.map(newMapCont).setView(coords, 15);
                L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                  maxZoom: 20,
                  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                  attribution: '&copy; Google Maps'
                }).addTo(map);
                L.marker(coords).addTo(map)
                  .bindPopup(`<b>${s.nama_forum || 'Sekretariat'}</b><br>${s.alamat || ''}`)
                  .openPopup();

                // Fix map not rendering correctly when display changes from none to block
                setTimeout(() => { map.invalidateSize(); }, 500);
              } else {
                const query = encodeURIComponent(`${coords[0]},${coords[1]}`);
                mapCont.innerHTML = `<iframe src="https://www.google.com/maps?q=${query}&output=embed" style="width:100%;height:100%;border:0;" loading="lazy" allowfullscreen></iframe>`;
              }
            } catch (err) {
              console.warn('Gagal memuat peta Leaflet:', err);
              const query = encodeURIComponent(`${coords[0]},${coords[1]}`);
              mapCont.innerHTML = `<iframe src="https://www.google.com/maps?q=${query}&output=embed" style="width:100%;height:100%;border:0;" loading="lazy" allowfullscreen></iframe>`;
            }
          }
        }
      }
    }
  }

  function applySocialsToDOM(socials) {
    const container = document.getElementById('social-container');
    if (!container || !Array.isArray(socials) || socials.length === 0) return;

    container.innerHTML = socials.map(s => {
      const url = s.url || '#';
      const icon = s.icon || 'fa-solid fa-link';
      const platform = s.platform || 'Social Media';
      return `<a href="${url}" target="_blank" title="${platform}" rel="noopener noreferrer"><i class="${icon}"></i></a>`;
    }).join('');
  }

  function init() {
    renderFooterHTML();
    populateFooterData();
  }

  window.initPublicFooter = init;
  window.applySettingsToFooter = applySettingsToDOM;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
