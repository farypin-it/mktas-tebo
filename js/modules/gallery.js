// ============================================================
// gallery.js — Modul Galeri Foto & Video — v4 (Role & Ownership)
// ============================================================
console.log('[gallery.js] File dimuat ✓');

// Helper user saat ini
function getCurrentGaleriUser() {
  try {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) {
      return currentUser;
    }
    const raw = localStorage.getItem('mktas_user');
    if (!raw) return { role: 'Admin', username: 'admin' };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { role: 'Admin', username: 'admin' };
  } catch (e) {
    try { localStorage.removeItem('mktas_user'); } catch (removeErr) {}
    return { role: 'Admin', username: 'admin' };
  }
}

function safeParseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== undefined ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

// Cek apakah user berhak menghapus item galeri tertentu
function canDeleteGaleriItem(item, user) {
  if (!user || !user.role) return false;
  if (user.role === 'Superadmin' || user.role === 'Admin') return true;
  if (user.role === 'Sekolah') {
    // Sekolah hanya bisa menghapus jika item dibuat oleh akun sekolah itu sendiri
    if (item.created_by && (item.created_by === user.username || item.created_by === user.id)) return true;
    if (item.uploader_name && (item.uploader_name === user.nama_sekolah || item.uploader_name === user.nama)) return true;
    return false;
  }
  return false;
}

// --- Load Galeri ---
async function loadGaleri() {
  console.log('[gallery.js] loadGaleri() dipanggil');
  await loadGaleriPhoto();
  await loadGaleriVideo();
}

// ==================== FOTO ====================
async function loadGaleriPhoto() {
  const tbody = document.getElementById('tbody-galeri-foto');
  if (!tbody) { console.warn('[gallery] tbody-galeri-foto NOT FOUND'); return; }
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Memuat data foto...</td></tr>';
  try {
    const res = await fetchAPI('getGalleryPhotos', {});
    if (res.status !== 'success') {
      const msg = `Gagal: ${res.message || 'Error tidak diketahui'}`;
      tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:#ef4444;">${msg}</td></tr>`;
      return;
    }
    const data = res.data || [];
    const user = getCurrentGaleriUser();
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:#64748b;padding:24px;">Belum ada foto. Klik tombol <strong>"+ Tambah Galeri"</strong> di atas untuk menambahkan.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(p => {
      const canDel = canDeleteGaleriItem(p, user);
      const uploaderLabel = p.uploader_name || p.created_by || 'Admin';
      return `
        <tr>
          <td><img src="${p.image_url}" alt="${p.title||''}" style="width:90px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);box-shadow:0 1px 3px rgba(0,0,0,0.1);"></td>
          <td>
            <div style="font-weight:500;">${p.title || '-'}</div>
            <div style="margin-top:4px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.75rem;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;">
                <i class="fas fa-user-circle" style="color:var(--primary-color);"></i> ${uploaderLabel}
              </span>
            </div>
          </td>
          <td style="color:var(--text-muted);font-size:0.85rem;">${p.description || '-'}</td>
          <td style="text-align:center;">
            ${canDel 
              ? `<button class="btn btn-sm btn-danger" title="Hapus Foto" onclick="deleteGaleriPhoto('${p.id}')"><i class="fas fa-trash"></i></button>` 
              : `<span class="text-muted" style="font-size:0.75rem;display:inline-block;padding:3px 6px;background:#f8fafc;border-radius:4px;border:1px solid #e2e8f0;" title="Hanya pengunggah atau admin yang dapat menghapus"><i class="fas fa-lock"></i> Lihat</span>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    console.error('[gallery] Exception:', e);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:#ef4444;">Error JS: ${e.message}</td></tr>`;
  }
}

async function deleteGaleriPhoto(id) {
  const conf = await Swal.fire({
    title: 'Hapus Foto?',
    text: 'Foto galeri ini akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444'
  });
  if (!conf.isConfirmed) return;

  const user = getCurrentGaleriUser();
  const res = await fetchAPI('deleteGalleryPhoto', { id, user });
  if (res.status === 'success') {
    Swal.fire({ icon: 'success', title: 'Foto berhasil dihapus', timer: 1200, showConfirmButton: false });
    loadGaleriPhoto();
  } else {
    Swal.fire('Gagal', res.message || 'Gagal menghapus foto', 'error');
  }
}

// ==================== VIDEO ====================
async function loadGaleriVideo() {
  const tbody = document.getElementById('tbody-galeri-video');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Memuat data video...</td></tr>';
  try {
    const res = await fetchAPI('getGalleryVideos', {});
    if (res.status !== 'success') {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:#ef4444;">Gagal: ${res.message || 'Error tidak diketahui'}</td></tr>`;
      return;
    }
    const data = res.data || [];
    const user = getCurrentGaleriUser();
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:24px;">Belum ada video. Klik tombol <strong>"+ Tambah Galeri"</strong> di atas untuk menambahkan.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(v => {
      const ytId = extractYoutubeId(v.video_url);
      const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : (v.thumbnail_url || '');
      const canDel = canDeleteGaleriItem(v, user);
      const uploaderLabel = v.uploader_name || v.created_by || 'Admin';
      return `
        <tr>
          <td>${thumb ? `<img src="${thumb}" style="width:90px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);box-shadow:0 1px 3px rgba(0,0,0,0.1);">` : '<span style="color:var(--text-muted);">-</span>'}</td>
          <td>
            <div style="font-weight:500;">${v.title}</div>
            <div style="margin-top:4px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.75rem;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;">
                <i class="fas fa-user-circle" style="color:var(--primary-color);"></i> ${uploaderLabel}
              </span>
            </div>
          </td>
          <td><a href="${v.video_url}" target="_blank" style="color:var(--primary-color);word-break:break-all;text-decoration:none;"><i class="fab fa-youtube" style="color:#ef4444;margin-right:4px;"></i> ${v.video_url}</a></td>
          <td style="text-align:center;">
            ${canDel 
              ? `<button class="btn btn-sm btn-danger" title="Hapus Video" onclick="deleteGaleriVideo('${v.id}')"><i class="fas fa-trash"></i></button>` 
              : `<span class="text-muted" style="font-size:0.75rem;display:inline-block;padding:3px 6px;background:#f8fafc;border-radius:4px;border:1px solid #e2e8f0;" title="Hanya pengunggah atau admin yang dapat menghapus"><i class="fas fa-lock"></i> Lihat</span>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:#ef4444;">Error JS: ${e.message}</td></tr>`;
  }
}

function extractYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function deleteGaleriVideo(id) {
  const conf = await Swal.fire({
    title: 'Hapus Video?',
    text: 'Data video galeri ini akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444'
  });
  if (!conf.isConfirmed) return;

  const user = getCurrentGaleriUser();
  const res = await fetchAPI('deleteGalleryVideo', { id, user });
  if (res.status === 'success') {
    Swal.fire({ icon: 'success', title: 'Video berhasil dihapus', timer: 1200, showConfirmButton: false });
    loadGaleriVideo();
  } else {
    Swal.fire('Gagal', res.message || 'Gagal menghapus video', 'error');
  }
}

// ==================== UNIFIED MODAL & TAMBAH GALERI ====================

/**
 * Buka modal Tambah Galeri (Foto atau Video)
 * @param {string} [tipe] 'foto' atau 'video'
 */
function openTambahGaleri(tipe) {
  const form = document.getElementById('form-galeri');
  if (form) form.reset();
  
  const hiddenUrl = document.getElementById('galeri-image-url');
  if (hiddenUrl) hiddenUrl.value = '';
  
  const prev = document.getElementById('preview-galeri-img');
  if (prev) {
    prev.src = '';
    prev.style.display = 'none';
  }

  // Jika tipe tidak ditentukan, sesuaikan dengan tab aktif di section galeri
  if (!tipe) {
    const tabVideo = document.getElementById('galeri-tab-video');
    if (tabVideo && tabVideo.style.display === 'block') {
      tipe = 'video';
    } else {
      tipe = 'foto';
    }
  }

  const radio = document.getElementById('tipe-galeri-' + tipe);
  if (radio) {
    radio.checked = true;
  }
  toggleGaleriTipe(tipe);
  openModal('modal-galeri');
}

/**
 * Toggle tampilan kolom form berdasarkan pilihan Foto / Video
 * @param {string} tipe 'foto' | 'video'
 */
function toggleGaleriTipe(tipe) {
  const isFoto = (tipe === 'foto');
  const groupFoto = document.getElementById('group-galeri-foto');
  const groupVideo = document.getElementById('group-galeri-video');
  const lblJudul = document.getElementById('lbl-galeri-judul');
  const labelFoto = document.getElementById('label-tipe-foto');
  const labelVideo = document.getElementById('label-tipe-video');
  const inputTitle = document.getElementById('galeri-title');

  if (groupFoto) groupFoto.style.display = isFoto ? 'block' : 'none';
  if (groupVideo) groupVideo.style.display = isFoto ? 'none' : 'block';

  if (isFoto) {
    if (lblJudul) {
      lblJudul.innerHTML = 'Judul Foto <span id="span-req-judul" style="display:none;color:#ef4444;">*</span> <small id="small-opt-judul" style="color:var(--text-muted);">(opsional)</small>';
    }
    if (inputTitle) inputTitle.placeholder = 'Masukkan judul foto...';
    if (labelFoto) {
      labelFoto.style.borderColor = 'var(--primary-color)';
      labelFoto.style.background = 'rgba(37,99,235,0.06)';
    }
    if (labelVideo) {
      labelVideo.style.borderColor = 'var(--border-color)';
      labelVideo.style.background = 'var(--bg-card, #fff)';
    }
  } else {
    if (lblJudul) {
      lblJudul.innerHTML = 'Judul Video <span id="span-req-judul" style="color:#ef4444;">*</span>';
    }
    if (inputTitle) inputTitle.placeholder = 'Masukkan judul video...';
    if (labelFoto) {
      labelFoto.style.borderColor = 'var(--border-color)';
      labelFoto.style.background = 'var(--bg-card, #fff)';
    }
    if (labelVideo) {
      labelVideo.style.borderColor = 'var(--primary-color)';
      labelVideo.style.background = 'rgba(239,68,68,0.06)';
    }
  }
}

/**
 * Simpan data galeri terpadu (Foto atau Video)
 */
async function saveGaleriUnified(e) {
  e.preventDefault();
  const tipeRadio = document.querySelector('input[name="galeri-tipe"]:checked');
  const tipe = tipeRadio ? tipeRadio.value : 'foto';
  const title = document.getElementById('galeri-title').value.trim();
  const description = document.getElementById('galeri-desc').value.trim();

  // Dapatkan info user yang sedang login
  const user = getCurrentGaleriUser();
  const created_by = user.username || user.id || 'Admin';
  const uploader_name = user.nama_sekolah || user.nama || user.username || 'Admin';

  if (tipe === 'foto') {
    const image_url = document.getElementById('galeri-image-url').value;
    if (!image_url) {
      Swal.fire('Peringatan', 'Foto belum dipilih/diunggah. Silakan pilih file foto terlebih dahulu.', 'warning');
      return;
    }

    const res = await fetchAPI('addGalleryPhoto', { 
      title, 
      image_url, 
      description,
      created_by,
      uploader_name
    });

    if (res.status === 'success') {
      document.getElementById('form-galeri').reset();
      document.getElementById('galeri-image-url').value = '';
      const prev = document.getElementById('preview-galeri-img');
      if (prev) { prev.src = ''; prev.style.display = 'none'; }
      closeModal('modal-galeri');
      Swal.fire({ icon: 'success', title: 'Foto galeri berhasil disimpan!', timer: 1500, showConfirmButton: false });
      
      // Beralih ke tab Foto jika belum
      const tabBtn = document.getElementById('galeri-tab-btn-foto');
      switchGaleriTab('foto', tabBtn);
      loadGaleriPhoto();
    } else {
      Swal.fire('Gagal', res.message || 'Terjadi kesalahan saat menyimpan foto', 'error');
    }
  } else {
    // Video
    const video_url = document.getElementById('galeri-video-url').value.trim();
    if (!title || !video_url) {
      Swal.fire('Peringatan', 'Judul dan URL video wajib diisi.', 'warning');
      return;
    }

    const res = await fetchAPI('addGalleryVideo', { 
      title, 
      video_url, 
      description,
      created_by,
      uploader_name
    });

    if (res.status === 'success') {
      document.getElementById('form-galeri').reset();
      closeModal('modal-galeri');
      Swal.fire({ icon: 'success', title: 'Video galeri berhasil disimpan!', timer: 1500, showConfirmButton: false });
      
      // Beralih ke tab Video jika belum
      const tabBtn = document.getElementById('galeri-tab-btn-video');
      switchGaleriTab('video', tabBtn);
      loadGaleriVideo();
    } else {
      Swal.fire('Gagal', res.message || 'Terjadi kesalahan saat menyimpan video', 'error');
    }
  }
}

// Fallback untuk legacy / pemanggilan lama
async function saveGaleriPhoto(e) { return saveGaleriUnified(e); }
async function saveGaleriVideo(e) { return saveGaleriUnified(e); }

// --- Tab switching Galeri ---
function switchGaleriTab(tab, btn) {
  document.querySelectorAll('#section-galeri .tab-item').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const targetBtn = document.getElementById('galeri-tab-btn-' + tab);
    if (targetBtn) targetBtn.classList.add('active');
  }
  const tabFoto = document.getElementById('galeri-tab-foto');
  const tabVideo = document.getElementById('galeri-tab-video');
  if (tabFoto) tabFoto.style.display = tab === 'foto' ? 'block' : 'none';
  if (tabVideo) tabVideo.style.display = tab === 'video' ? 'block' : 'none';
}
