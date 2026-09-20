// api.js - Smart Wrapper for Hybrid Environment

const DEFAULT_ONLINE_API_URL = "https://script.google.com/macros/s/AKfycbxuYyz2h6IbgNU82bXFDLZIt_TffjIyBkeQxDlLTfsXge72UzN2qqFl1X_Xv3kiGVO7/exec"; // Ganti dengan URL deployment Web App Apps Script Anda

function safeReadJsonStorage(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (e) {
    console.warn(`[storage] Invalid JSON for ${key}:`, e);
    return fallback;
  }
}

function safeWriteJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[storage] Could not write ${key}:`, e);
    return false;
  }
}

function getOnlineApiUrl() {
  const ls = safeReadJsonStorage('mktas_settings', {});
  return ls.apps_script_url || localStorage.getItem('mktas_apps_script_url') || DEFAULT_ONLINE_API_URL;
}

function mergeSettings(base, incoming) {
  const merged = Object.assign({}, base || {});
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      merged[key] = value;
    } else if (!(key in merged)) {
      merged[key] = value;
    }
  });
  return merged;
}
window.mergeSettings = mergeSettings;

const ENABLE_WEB_MOCK = false; // Set to false once ONLINE_API_URL is valid

/**
 * Universal fetchAPI function
 * @param {string} action - The action name (e.g., 'getSchools', 'addStaff')
 * @param {object} data - The payload
 * @param {boolean|null} showLoading - Override automatic loading spinner
 * @returns {Promise<object>} - JSON response {status: "success"|"error", data: [...]}
 */
async function fetchAPI(action, data = {}, showLoading = null) {
  // Determine if we should show loading
  const isModifying = ['add', 'update', 'edit', 'delete', 'save', 'import', 'change'].some(p => action.startsWith(p));
  const shouldLoad = showLoading !== null ? showLoading : isModifying;

  if (shouldLoad && typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Memproses...',
      html: 'Mohon tunggu sebentar...',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  // Web / Online Mode
  if (ENABLE_WEB_MOCK) {
    const res = await simulateMockBackend(action, data);
    if (shouldLoad && typeof Swal !== 'undefined') Swal.close();
    return res;
  }

  try {
    console.log(`[API-Online] Calling action: ${action}`);

    let requestData = data;
    let authToken = '';
    try {
      const storedUser = safeReadJsonStorage('mktas_user', null);
      if (storedUser && storedUser.session_token) {
        authToken = storedUser.session_token;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          requestData = Object.assign({}, data, { auth_token: authToken });
        }
      }
    } catch (e) {
      console.warn('[API-Online] Auth context unavailable:', e);
    }

    // Because Google Apps Script CORS can be tricky, we send as POST with URLSearchParams
    const params = new URLSearchParams();
    params.append('action', action);
    if (requestData) params.append('data', JSON.stringify(requestData));
    if (authToken) params.set('auth_token', authToken);
    // Unpack primitive properties directly to URLSearchParams for resilient Apps Script parameter mapping
    if (requestData && typeof requestData === 'object' && !Array.isArray(requestData)) {
      for (const [k, v] of Object.entries(requestData)) {
        if (v !== undefined && v !== null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
          params.set(k, String(v));
        }
      }
    }

    const apiUrl = getOnlineApiUrl();
    const sep = apiUrl.includes('?') ? '&' : '?';
    const targetUrl = `${apiUrl}${sep}action=${encodeURIComponent(action)}&_t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout
    let response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        body: params,
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response || !response.ok) {
      const rawText = await response.text().catch(() => '');
      throw new Error(rawText || `HTTP ${response && response.status ? response.status : 'unknown'}`);
    }

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.error('[API-Online] Invalid JSON response:', rawText);
      result = { status: 'error', message: 'Respons server tidak valid.' };
    }

    if (shouldLoad && typeof Swal !== 'undefined') Swal.close();
    return result && typeof result === 'object' ? result : { status: 'error', message: 'Respons server tidak valid.' };
  } catch (err) {
    console.error("[API-Online] Error:", err);
    if (shouldLoad && typeof Swal !== 'undefined') Swal.close();
    return { status: "error", message: "Gagal menghubungi server online. Periksa koneksi atau URL Apps Script." };
  }
}


/**
 * Simulasi Mock Backend Sementara untuk Web
 */
async function simulateMockBackend(action, data) {
  console.log(`[API-Mock] Simulated action: ${action}`, data);
  await new Promise(resolve => setTimeout(resolve, 300)); // delay 300ms

  let mockResult = { status: "error", message: "Mock action not mapped" };

  switch (action) {
    case "login":
      if (data.username === "superadmin" && data.password === "admin123") {
        mockResult = { status: "success", user: { id: "USR-001", username: "superadmin", role: "Superadmin", school_id: "-" } };
      } else {
        mockResult = { status: "error", message: "Username/password salah " };
      }
      break;
    case "getSchools":
      mockResult = {
        status: "success", data: [
          { id: "SKL-1", nama: "SDN 1 ", status: "Negeri", username: "sdn1mock", npsn: "1010101", alamat: "Jl. Web Mock", provinsi: "JAMBI", kabupaten_kota: "KOTA JAMBI" }
        ]
      };
      break;
    case "getStaff":
      mockResult = {
        status: "success", data: [
          { id: "PGW-1", school_id: "SKL-1", sekolah_nama: "SDN 1 ", nama: "Budi Web", nip: "1980", status_pegawai: "PNS", jabatan_sk: "Tenaga Administrasi", jabatan_tugas: "Operator", no_wa: "08123" }
        ]
      };
      break;
    case "getSchedules":
    case "getPublicSchedules":
      mockResult = {
        status: "success", data: [
          { id: "JDW-1", tahun: "2026", bulan: "September", sekolah: "SDN 1 ", tanggal: "2026-09-25", alamat_kecamatan: "Kecamatan Web", keterangan: "Rapat Web", deskripsi_agenda: "Agenda web" }
        ]
      };
      break;
    case "addSchool":
    case "addStaff":
    case "addSchedule":
      mockResult = { status: "success", message: "Data berhasil disimpan ()" };
      break;
    case "checkUserDefaultPassword":
      mockResult = { status: "success", data: { is_default: false } };
      break;
    case "changeUserPassword":
      mockResult = { status: "success", message: "Password berhasil diperbarui" };
      break;
    case "updateUserProfile":
      mockResult = { status: "success", message: "Profil akun berhasil diperbarui (Mock)" };
      break;
  }

  return mockResult;
}

/**
 * Terapkan 4 warna tema dari Pengaturan Sistem secara global
 * dan bangun seluruh sistem gradien dinamis secara otomatis.
 */
function applyWarnaSettings(d) {
  if (!d) return;
  try {
    const root = document.documentElement;
    const primer = d.warna_primer || getComputedStyle(root).getPropertyValue('--primary-color').trim() || '#6366f1';
    const hover = d.warna_hover || getComputedStyle(root).getPropertyValue('--primary-hover').trim() || '#4f46e5';
    const aksen1 = d.warna_aksen1 || getComputedStyle(root).getPropertyValue('--accent-color').trim() || '#10b981';
    const aksen2 = d.warna_aksen2 || getComputedStyle(root).getPropertyValue('--secondary-color').trim() || '#ec4899';

    root.style.setProperty('--primary-color', primer);
    root.style.setProperty('--primary-hover', hover);
    root.style.setProperty('--accent-color', aksen1);
    root.style.setProperty('--secondary-color', aksen2);

    // Sistem gradien dinamis berbasis 4 warna pengaturan
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${primer} 0%, ${aksen2} 100%)`);
    root.style.setProperty('--gradient-hover', `linear-gradient(135deg, ${hover} 0%, ${aksen1} 100%)`);
    root.style.setProperty('--gradient-sidebar', `linear-gradient(180deg, ${primer} 0%, ${aksen2} 100%)`);
    root.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${primer} 0%, ${aksen1} 100%)`);
    root.style.setProperty('--gradient-text', `linear-gradient(135deg, ${primer} 0%, ${aksen2} 100%)`);
  } catch (e) {
    console.warn('applyWarnaSettings error:', e);
  }
}
window.applyWarnaSettings = applyWarnaSettings;

// Terapkan seketika dari cache localStorage saat api.js dimuat
(function () {
  try {
    const cached = safeReadJsonStorage('mktas_settings', {});
    if (cached && (cached.warna_primer || cached.warna_aksen2)) {
      applyWarnaSettings(cached);
    }
  } catch (e) { }
})();

/**
 * Sinkronisasi Zoom Halaman secara Global:
 * Menyimpan skala zoom yang dipilih pengguna di localStorage dan menerapkannya
 * otomatis di setiap navigasi halaman (baik di Electron desktop maupun Web Browser)
 * agar ukuran tampilan tetap konsisten dan menyatu di semua halaman.
 */
(function setupGlobalZoomSync() {
  try {
    const applySavedZoom = () => {
      const savedZoom = localStorage.getItem('mktas_zoom_factor');
      if (savedZoom) {
        const zf = parseFloat(savedZoom);
        if (zf >= 0.4 && zf <= 2.5) {
          if (window.api && typeof window.api.setZoomFactor === 'function') {
            window.api.setZoomFactor(zf);
          } else {
            applyBrowserZoom(zf);
          }
        }
      }
    };

    const applyBrowserZoom = (zf) => {
      const root = document.documentElement;
      root.style.zoom = zf;
      root.style.width = `${100 / zf}%`;
      root.style.minHeight = `${100 / zf}vh`;
    };

    // Terapkan langsung saat script dimuat
    applySavedZoom();
    // Terapkan kembali saat DOM selesai dimuat
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applySavedZoom);
    }

    // Tangani penyesuaian zoom (Ctrl + +, Ctrl + -, Ctrl + 0)
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0')) {
        let saved = parseFloat(localStorage.getItem('mktas_zoom_factor') || '1.0');
        if (isNaN(saved)) saved = 1.0;

        if (e.key === '+' || e.key === '=') {
          saved = Math.min(saved + 0.05, 2.0);
        } else if (e.key === '-' || e.key === '_') {
          saved = Math.max(saved - 0.05, 0.5);
        } else if (e.key === '0') {
          saved = 1.0;
        }

        saved = Math.round(saved * 100) / 100;
        localStorage.setItem('mktas_zoom_factor', saved);

        if (window.api && typeof window.api.setZoomFactor === 'function') {
          window.api.setZoomFactor(saved);
        } else {
          applyBrowserZoom(saved);
        }
      }
    });

    // Tangani zoom lewat Ctrl + Mouse Wheel
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        let saved = parseFloat(localStorage.getItem('mktas_zoom_factor') || '1.0');
        if (isNaN(saved)) saved = 1.0;

        if (e.deltaY < 0) {
          saved = Math.min(saved + 0.05, 2.0);
        } else if (e.deltaY > 0) {
          saved = Math.max(saved - 0.05, 0.5);
        }

        saved = Math.round(saved * 100) / 100;
        localStorage.setItem('mktas_zoom_factor', saved);

        if (window.api && typeof window.api.setZoomFactor === 'function') {
          window.api.setZoomFactor(saved);
        } else {
          applyBrowserZoom(saved);
        }
      }
    }, { passive: true });
  } catch (e) { }
})();

/**
 * Helper untuk membuat slug URL berita ramah SEO:
 * Format: [DD-MM-YY]-[5 kata pertama dari judul]
 * Contoh: 18-09-26-tas-kab-tebo-adakan-kegiatan
 */
function generateNewsSlug(title, dateStr) {
  let datePart = '';
  if (dateStr) {
    const str = dateStr.toString().trim();
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD-MM-YY
        datePart = ('0' + parts[2]).slice(-2) + '-' + ('0' + parts[1]).slice(-2) + '-' + parts[0].slice(-2);
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY -> DD-MM-YY
        datePart = ('0' + parts[0]).slice(-2) + '-' + ('0' + parts[1]).slice(-2) + '-' + parts[2].slice(-2);
      } else {
        datePart = ('0' + parts[0]).slice(-2) + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[2]).slice(-2);
      }
    }
  }
  if (!datePart) {
    const now = new Date();
    const dd = ('0' + now.getDate()).slice(-2);
    const mm = ('0' + (now.getMonth() + 1)).slice(-2);
    const yy = ('' + now.getFullYear()).slice(-2);
    datePart = dd + '-' + mm + '-' + yy;
  }

  const words = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join('-');

  return `${datePart}-${words || 'berita'}`;
}
window.generateNewsSlug = generateNewsSlug;
