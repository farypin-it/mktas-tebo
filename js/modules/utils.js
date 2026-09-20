// --- GLOBAL MODAL HELPERS & TAB LOGIC ---
window.switchMasterDataTab = function(tabId, btn) {
  const nav = btn.parentElement;
  nav.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const tabSekolah = document.getElementById('master-tab-sekolah');
  if (tabSekolah) {
    tabSekolah.style.display = 'none';
    tabSekolah.classList.remove('active');
  }
  
  const tabPegawai = document.getElementById('master-tab-pegawai');
  if (tabPegawai) {
    tabPegawai.style.display = 'none';
    tabPegawai.classList.remove('active');
  }

  const target = document.getElementById('master-tab-' + tabId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  if (tabId === 'pegawai' && typeof loadPegawai === 'function') {
    loadPegawai();
  }
};

window.switchPengaturanTab = function(tabId, btn) {
  const nav = btn.parentElement;
  nav.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  ['sistem', 'logo', 'akun', 'legalitas', 'backup'].forEach(id => {
    const el = document.getElementById('pengaturan-tab-' + id);
    if (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  });

  const target = document.getElementById('pengaturan-tab-' + tabId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  if (tabId === 'akun' && typeof loadAdmins === 'function') {
    loadAdmins();
  }
  if (tabId === 'backup' && typeof openLogHistoryModal === 'function') {
    openLogHistoryModal(true);
  }
};

window.showModal = function(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;

  // Bersihkan inline styles pengganggu agar CSS class bekerja sempurna
  el.style.removeProperty('display');
  el.style.removeProperty('visibility');
  el.style.removeProperty('opacity');
  el.style.removeProperty('pointer-events');
  el.style.removeProperty('transform');

  el.classList.add('active');
  el.setAttribute('aria-hidden', 'false');
};
window.openModal = window.showModal; // alias

window.closeModal = function(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;

  // Bersihkan inline styles pengganggu
  el.style.removeProperty('display');
  el.style.removeProperty('visibility');
  el.style.removeProperty('opacity');
  el.style.removeProperty('pointer-events');
  el.style.removeProperty('transform');

  el.classList.remove('active');
  el.setAttribute('aria-hidden', 'true');
};

// Global Event Delegation: Menutup modal dengan aman (klik backdrop, tombol close, dan tombol ESC)
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    // 1. Klik Backdrop (area gelap di luar modal-content)
    if (e.target && e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('active')) {
      window.closeModal(e.target);
      return;
    }
    // 2. Klik tombol close (.close-btn, .close-modal, .close-btn-manual, [data-dismiss="modal"])
    const closeTrigger = e.target.closest('.close-btn, .close-modal, .close-btn-manual, [data-dismiss="modal"]');
    if (closeTrigger) {
      const modal = closeTrigger.closest('.modal');
      if (modal) {
        window.closeModal(modal);
      }
    }
  });

  // 3. Tombol Escape di keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModals = document.querySelectorAll('.modal.active');
      activeModals.forEach(m => window.closeModal(m));
    }
  });
}

// --- Public Pages ---

// ----------------------------------------------------
// DELETE & EDIT HANDLERS
// ----------------------------------------------------



async function deleteSchedule(id) {
  const result = await Swal.fire({
    title: 'Hapus Jadwal?',
    text: "Data ini akan dihapus secara permanen!",
    icon: 'warning',
    showCancelButton: true
  });
  if(result.isConfirmed) {
    const res = await fetchAPI("deleteSchedule", { id });
    if(res.status === "success") {
      Swal.fire("Dihapus!", res.message, "success");
      loadJadwal();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  }
}

function openEditSchedule(id) {
  const schedule = allSchedules.find(s => s.id === id);
  if (!schedule) return;
  
  document.getElementById("edit-jadwal-id").value = schedule.id;
  document.getElementById("edit-jadwal-tahun").value = schedule.tahun || '';
  document.getElementById("edit-jadwal-bulan").value = schedule.bulan || '';
  
  // Populate school select
  const select = document.getElementById("edit-jadwal-sekolah");
  select.innerHTML = "";
  cachedSchools.forEach((s) => {
    select.innerHTML += `<option value="${s.nama}">${s.nama}</option>`;
  });
  
  setTimeout(() => {
    document.getElementById("edit-jadwal-sekolah").value = schedule.sekolah || '';
  }, 100);
  
  document.getElementById("edit-jadwal-tanggal").value = schedule.tanggal ? new Date(schedule.tanggal).toISOString().split('T')[0] : '';
  document.getElementById("edit-jadwal-alamat").value = schedule.alamat_kecamatan || '';
  document.getElementById("edit-jadwal-ket").value = schedule.keterangan || '';
  document.getElementById("edit-jadwal-deskripsi").value = schedule.deskripsi_agenda || '';

  window.showModal("modal-edit-jadwal");
}

async function syncToCloud() {
  const btn = document.getElementById("btn-sync-cloud");
  if(btn) btn.disabled = true;
  
  Swal.fire({
    title: 'Sinkronisasi ke Cloud',
    text: 'Sedang mengirim data lokal ke server online...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await fetchAPI("syncToCloud", { timestamp: new Date().toISOString() });
    if (res && (res.status === "success" || (res.status === "error" && res.message && (res.message.includes("not mapped") || res.message.includes("SQLite"))))) {
      Swal.fire("Berhasil", res.message || "Data berhasil disinkronkan!", "success");
    } else {
      Swal.fire("Gagal", (res && res.message) ? res.message : "Gagal sinkronisasi data.", "error");
    }
  } catch (err) {
    Swal.fire("Error", "Gagal menghubungi server cloud.", "error");
  }

  if(btn) btn.disabled = false;
}

async function fetchPublicSchedules() {
  const container = document.getElementById("public-schedules-container");
  if (!container) return;

  try {
    const result = await fetchAPI('getPublicSchedules');
    const schedules = Array.isArray(result && result.data) ? [...result.data] : [];
    schedules.sort((a, b) => {
      const valA = a && a.tanggal ? new Date(a.tanggal).getTime() : 0;
      const valB = b && b.tanggal ? new Date(b.tanggal).getTime() : 0;
      if (Number.isNaN(valA) && Number.isNaN(valB)) return 0;
      if (Number.isNaN(valA)) return 1;
      if (Number.isNaN(valB)) return -1;
      return valB - valA;
    });

    if (result.status === "success" && schedules.length > 0) {
      let html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Bulan/Tahun</th>
                            <th>Tuan Rumah</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
      schedules.forEach((item) => {
        html += `
                    <tr>
                        <td>${item.bulan} ${item.tahun}</td>
                        <td style="font-weight: 600; color: var(--text-dark);">${item.sekolah}</td>
                        <td>${new Date(item.tanggal).toLocaleDateString("id-ID")}</td>
                    </tr>
                `;
      });
      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } else {
      container.innerHTML =
        '<p class="text-center text-muted">Belum ada jadwal MKTAS terdaftar.</p>';
    }
  } catch (err) {
    container.innerHTML =
      '<p class="text-center text-muted">Gagal memuat jadwal.</p>';
  }
}

// --- GLOBAL CROPPER LOGIC ---
let globalCropper = null;
let currentGlobalCropTarget = null;

window.initGlobalCropper = function() {
  const imageToCrop = document.getElementById('image-to-crop');
  if(!imageToCrop) return;
  
  function openGlobalCropModal(fileInput, aspectRatio, targetUrlId, previewImgId) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    currentGlobalCropTarget = { 
      targetUrlId, 
      previewImgId,
      fileType: file.type || '',
      fileName: file.name || ''
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      imageToCrop.src = e.target.result;
      window.showModal('modal-crop');
      
      if (globalCropper) globalCropper.destroy();
      
      // Timeout allows modal transition to finish before calculating cropper dimensions
      setTimeout(() => {
        globalCropper = new Cropper(imageToCrop, {
          aspectRatio: aspectRatio,
          viewMode: 1,
          autoCropArea: 1,
          background: true // Menampilkan kotak-kotak catur agar area transparan terlihat jelas
        });
      }, 300);
    };
    reader.readAsDataURL(file);
  }

  // 1. Settings Logo & Background
  const logoInstansi = document.getElementById('logo-instansi-file');
  if(logoInstansi) logoInstansi.addEventListener('change', function() { openGlobalCropModal(this, 1/1, 'logo-instansi-url', 'preview-logo-instansi'); });
  
  const logoForum = document.getElementById('logo-forum-file');
  if(logoForum) logoForum.addEventListener('change', function() { openGlobalCropModal(this, 1/1, 'logo-forum-url', 'preview-logo-forum'); });
  
  const bgLogin = document.getElementById('bg-login-file');
  if(bgLogin) bgLogin.addEventListener('change', function() { openGlobalCropModal(this, 5/3, 'bg-login-url', 'preview-bg-login'); });

  // 2. Add / Edit Staff
  const addStaffFoto = document.getElementById('add-staff-foto-file');
  if(addStaffFoto) addStaffFoto.addEventListener('change', function() { openGlobalCropModal(this, 3/4, 'add-staff-foto', 'preview-add-staff-foto'); });
  
  const editStaffFoto = document.getElementById('edit-staff-foto-file');
  if(editStaffFoto) editStaffFoto.addEventListener('change', function() { openGlobalCropModal(this, 3/4, 'edit-staff-foto', 'preview-edit-staff-foto'); });

  // 3. Web Publik (Berita, Slider, Board) - replacing logic from web-publik.js
  const newsFile = document.getElementById('news-image-file');
  if(newsFile) newsFile.addEventListener('change', function() { openGlobalCropModal(this, 5/3, 'news-image', 'preview-berita'); });
  
  const sliderFile = document.getElementById('slider-image-file');
  if(sliderFile) sliderFile.addEventListener('change', function() { openGlobalCropModal(this, 2/1, 'slider-image', 'preview-slider'); });
  
  const boardFile = document.getElementById('board-image-file');
  if(boardFile) boardFile.addEventListener('change', function() { openGlobalCropModal(this, 1/1, 'board-image', 'preview-board'); });

  // 5. Galeri Foto (5:3 landscape)
  const gfotoFile = document.getElementById('gfoto-image-file');
  if(gfotoFile) gfotoFile.addEventListener('change', function() { openGlobalCropModal(this, 5/3, 'gfoto-image-url', 'preview-gfoto'); });
  const galeriFotoFile = document.getElementById('galeri-foto-file');
  if(galeriFotoFile) galeriFotoFile.addEventListener('change', function() { openGlobalCropModal(this, 5/3, 'galeri-image-url', 'preview-galeri-img'); });

  // 6. Profil Organisasi (Struktur Organisasi)
  const strukturFile = document.getElementById('profil-struktur-file');
  if(strukturFile) strukturFile.addEventListener('change', function() { openGlobalCropModal(this, 16/9, 'profil-struktur-url', 'preview-profil-struktur'); });

  // Expose helper untuk input dengan data-attributes (onchange="openCropperForInput(this)")
  window.openCropperForInput = function(fileInput) {
    const targetId  = fileInput.dataset.targetHidden || fileInput.dataset.targetUrlId || '';
    const previewId = fileInput.dataset.preview || '';
    const aspectStr = fileInput.dataset.aspect || '1';
    let aspect = 1;
    if (aspectStr.includes(':')) {
      const parts = aspectStr.split(':');
      aspect = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      aspect = parseFloat(aspectStr);
    }
    openGlobalCropModal(fileInput, aspect, targetId, previewId);
  };

  // 4. Crop button action — dengan auto-resize berdasarkan tipe gambar & preservasi transparansi
  const btnCrop = document.getElementById('btn-crop-upload');
  if(btnCrop) {
    btnCrop.addEventListener('click', async () => {
      if (!globalCropper || !currentGlobalCropTarget) return;

      const target = currentGlobalCropTarget;
      const targetId = target.targetUrlId;

      // Deteksi apakah target adalah logo atau gambar berformat PNG (transparan)
      const isLogo = targetId.startsWith('logo') || targetId.includes('logo');
      const isPng = (target.fileType && target.fileType.toLowerCase().includes('png')) || 
                    (target.fileName && target.fileName.toLowerCase().endsWith('.png'));
      const preserveTransparency = isLogo || isPng;

      // Tentukan ukuran max dan quality berdasarkan target
      let maxWidth, maxHeight, quality;
      if (targetId === 'board-image' || targetId === 'add-staff-foto' || targetId === 'edit-staff-foto') {
        // Foto profil pengurus & pegawai — 400x533 (3:4 portrait), kecil & jelas
        maxWidth = 400; maxHeight = 533; quality = 0.85;
      } else if (targetId === 'news-image') {
        // Gambar berita — 800px wide
        maxWidth = 800; maxHeight = 600; quality = 0.80;
      } else if (targetId === 'slider-image') {
        // Gambar slider — 1000px wide
        maxWidth = 1000; maxHeight = 600; quality = 0.82;
      } else if (isLogo) {
        // Logo instansi / forum — resolusi jernih, tajam & transparan
        maxWidth = 400; maxHeight = 400; quality = 1.0;
      } else if (targetId.startsWith('bg-')) {
        // Background login — medium
        maxWidth = 900; maxHeight = 600; quality = 0.80;
      } else if (targetId === 'profil-struktur-url' || targetId.includes('struktur')) {
        // Bagan struktur organisasi — 1200px lebar
        maxWidth = 1200; maxHeight = 800; quality = 0.85;
      } else {
        maxWidth = 800; maxHeight = 800; quality = 0.80;
      }

      // Opsi canvas cropper:
      // JANGAN beri fillColor: '#fff' jika logo / PNG transparan agar tidak berubah menjadi putih atau hitam
      const canvasOpts = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      };
      if (!preserveTransparency) {
        canvasOpts.fillColor = '#ffffff';
      }

      // Crop dulu dari cropper
      const croppedCanvas = globalCropper.getCroppedCanvas(canvasOpts);

      // Resize ke ukuran yang ditentukan
      const resizedCanvas = document.createElement('canvas');
      const srcW = croppedCanvas.width;
      const srcH = croppedCanvas.height;
      let dstW = srcW, dstH = srcH;

      if (srcW > maxWidth || srcH > maxHeight) {
        const ratio = Math.min(maxWidth / srcW, maxHeight / srcH);
        dstW = Math.round(srcW * ratio);
        dstH = Math.round(srcH * ratio);
      }

      resizedCanvas.width  = dstW;
      resizedCanvas.height = dstH;
      const ctx = resizedCanvas.getContext('2d');
      
      // Bersihkan canvas agar transparansi alpha 100% utuh (tidak hitam dan tidak putih)
      ctx.clearRect(0, 0, dstW, dstH);

      // Hanya beri background putih jika BUKAN gambar transparan / logo (misal foto jpeg)
      if (!preserveTransparency) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dstW, dstH);
      }

      ctx.drawImage(croppedCanvas, 0, 0, dstW, dstH);

      // Untuk logo & PNG transparan, gunakan format 'image/png' agar transparansi tidak hilang
      // Untuk foto umum (non-transparan), gunakan 'image/jpeg' dengan kompresi quality
      const base64DataUrl = preserveTransparency 
        ? resizedCanvas.toDataURL('image/png') 
        : resizedCanvas.toDataURL('image/jpeg', quality);
      
      closeModal('modal-crop');
      
      let finalUrl = base64DataUrl;

      // Preview memakai base64 sementara; input hanya menyimpan URL remote.
      if (target) {
        const urlInput = document.getElementById(target.targetUrlId);
        const previewImg = document.getElementById(target.previewImgId);
        if (urlInput) urlInput.value = '';
        if (previewImg) {
          previewImg.src = finalUrl;
          previewImg.style.display = 'block';
        }
      }

      // Unggah otomatis ke Cloudinary (bekerja baik online maupun di Electron desktop)
      if (typeof uploadToCloudinary === 'function') {
        try {
          const uploadedUrl = await uploadToCloudinary(base64DataUrl);
          if (uploadedUrl && /^https?:\/\//i.test(uploadedUrl) && target) {
            const urlInput = document.getElementById(target.targetUrlId);
            const previewImg = document.getElementById(target.previewImgId);
            if (urlInput) {
              urlInput.value = uploadedUrl;
              urlInput.dispatchEvent(new Event('input', { bubbles: true }));
              urlInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (previewImg) previewImg.src = uploadedUrl;
          } else {
            throw new Error('URL gambar hasil upload tidak valid.');
          }
        } catch (err) {
          const urlInput = document.getElementById(target.targetUrlId);
          if (urlInput) urlInput.value = '';
          Swal.fire('Upload Gagal', err?.message || 'Gambar belum berhasil diunggah. Silakan coba lagi.', 'error');
          console.warn('[cropper] uploadToCloudinary error:', err);
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.initGlobalCropper();
});
