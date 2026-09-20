// FIX Bug #9: Tab Logic sudah dihandle di initQuillCropper (dipanggil saat DOMContentLoaded).
// Listener duplikat dihapus untuk menghindari event terpasang 2x pada tombol tab yang sama.

function switchWebPublikTab(tabId, btn) {
  const section = document.getElementById('section-webpublik');
  if (!section) return;

  const tabBtns = section.querySelectorAll('.tab-btn');
  tabBtns.forEach((b) => {
    const isActive = b === btn && b.getAttribute('data-tab') === tabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
    b.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  section.querySelectorAll('.tab-content').forEach((content) => {
    const isActive = content.id === tabId;
    content.classList.toggle('active', isActive);
    content.style.display = isActive ? 'block' : 'none';
    content.style.visibility = isActive ? 'visible' : 'hidden';
    content.hidden = !isActive;
    content.setAttribute('aria-hidden', String(!isActive));
  });
}

function applySchoolWebPublikTabRestriction() {
  const user = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  const isSchool = user && user.role === 'Sekolah';
  const section = document.getElementById('section-webpublik');
  if (!section) return;

  const allowedTabs = new Set(['tab-berita', 'tab-referensi']);

  section.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    const keep = !isSchool || allowedTabs.has(tab);
    btn.hidden = !keep;
    btn.disabled = !keep;
    btn.setAttribute('aria-hidden', String(!keep));
    btn.style.display = keep ? '' : 'none';
    btn.style.visibility = keep ? 'visible' : 'hidden';
    if (!keep) btn.classList.remove('active');
  });

  section.querySelectorAll('.tab-content').forEach(content => {
    const keep = !isSchool || content.id === 'tab-berita' || content.id === 'tab-referensi';
    const active = keep && content.id === 'tab-berita';
    content.hidden = !keep;
    content.style.display = active ? 'block' : keep ? 'none' : 'none';
    content.style.visibility = keep ? 'visible' : 'hidden';
    content.classList.toggle('active', active);
    if (!keep) content.classList.remove('active');
  });

  if (isSchool) {
    const beritaBtn = section.querySelector('.tab-btn[data-tab="tab-berita"]');
    const beritaContent = document.getElementById('tab-berita');
    if (beritaBtn) {
      beritaBtn.classList.add('active');
      beritaBtn.style.display = '';
      beritaBtn.hidden = false;
      beritaBtn.disabled = false;
    }
    if (beritaContent) {
      beritaContent.classList.add('active');
      beritaContent.style.display = 'block';
      beritaContent.hidden = false;
    }
  }
}

async function loadWebPublik() {
  if (typeof initQuillCropper === 'function') {
    initQuillCropper();
  }

  applySchoolWebPublikTabRestriction();

  // Muat konten tab utama (Berita) terlebih dahulu agar cepat responsif
  await loadNews();

  // Muat konten tab lainnya secara teratur (non-blocking) agar tidak mencekik kuota concurrent request GAS
  loadReferensi();
  setTimeout(() => loadSliders(), 120);
  setTimeout(() => loadBoard(), 240);
  setTimeout(() => loadSocials(), 360);
  setTimeout(() => loadProfilOrganisasi(), 480);
}

function renderNewsTable(newsData) {
  const tbody = document.querySelector('#table-berita tbody');
  if (!tbody || !Array.isArray(newsData)) return;

  const user = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  const isSekolah = user && user.role === 'Sekolah';
  tbody.innerHTML = newsData.map(n => {
    const isOwner = !isSekolah ||
      !n.created_by ||
      String(n.created_by) === 'Admin' ||
      String(n.created_by) === String(user.school_id) ||
      String(n.created_by) === String(user.id);
    const editBtn = isOwner
      ? `<button class="btn btn-sm btn-outline" onclick="editNews(${JSON.stringify(n).replace(/"/g,'&quot;')})" style="padding:4px 8px;"><i class="fas fa-edit"></i> Edit</button>`
      : `<button class="btn btn-sm btn-outline" disabled title="Berita sekolah lain" style="padding:4px 8px;color:#94a3b8;cursor:not-allowed;"><i class="fas fa-edit"></i> Edit</button>`;
    const hapusBtn = isOwner
      ? `<button class="btn btn-sm btn-outline" style="padding:4px 8px;color:#ef4444;" onclick="deleteNews('${n.id}')"><i class="fas fa-trash"></i> Hapus</button>`
      : `<button class="btn btn-sm btn-outline" disabled title="Berita sekolah lain" style="padding:4px 8px;color:#cbd5e1;cursor:not-allowed;"><i class="fas fa-trash"></i> Hapus</button>`;
    return `
  <tr>
    <td>${n.date || '-'}</td>
    <td>${n.title || '-'}</td>
    <td>${n.is_published ? '<span class="badge" style="background:#10b981;color:white;padding:2px 8px;border-radius:12px;font-size:0.8rem;">Dipublikasikan</span>' : '<span style="color:var(--text-muted)">Draft</span>'}</td>
    <td style="display:flex;gap:6px;">${editBtn}${hapusBtn}</td>
  </tr>
  `;
  }).join('');
}

// --- NEWS ---
async function loadNews() {
  const tbody = document.querySelector('#table-berita tbody');
  const cachedNews = (typeof safeReadJsonStorage === 'function') ? safeReadJsonStorage('mktas_news', []) : [];
  
  // Stale-While-Revalidate: render cache seketika (0 ms)!
  if (cachedNews && cachedNews.length > 0) {
    renderNewsTable(cachedNews);
  } else if (tbody) {
    tbody.innerHTML = "<tr><td colspan='4' class='table-loading-cell'><div class='loader'></div><div>Memuat berita...</div></td></tr>";
  }

  try {
    const res = await fetchAPI('getNews', {});
    if (res.status === 'success' && Array.isArray(res.data)) {
      try { localStorage.setItem('mktas_news', JSON.stringify(res.data)); } catch(e) {}
      renderNewsTable(res.data);
    } else if (!cachedNews || cachedNews.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#ef4444;">${res.message || 'Gagal memuat berita.'}</td></tr>`;
    }
  } catch (err) {
    if (tbody && (!cachedNews || cachedNews.length === 0)) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#ef4444;">Gagal memuat berita: ${err.message || 'koneksi timeout'}</td></tr>`;
    }
  }
}

let _editNewsId = null;
function formatNewsDateForInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;
  return raw.slice(0, 16);
}

function editNews(n) {
  _editNewsId = n.id;
  document.getElementById('news-title').value = n.title || '';
  document.getElementById('news-date').value = formatNewsDateForInput(n.date);
  document.getElementById('news-image').value = n.image_url || '';
  document.getElementById('news-published').checked = !!n.is_published;
  if (n.image_url) {
    const prev = document.getElementById('preview-berita');
    prev.src = n.image_url; prev.style.display = 'block';
  }
  if (quillEditor) quillEditor.root.innerHTML = n.content || '';
  document.querySelector('#modal-berita .modal-header h3').textContent = 'Edit Berita';
  showModal('modal-berita');
}

  async function saveNews(e) {
    e.preventDefault();
    Swal.fire({ title: 'Menyimpan Berita...', text: 'Mohon tunggu', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    let imageUrl = document.getElementById('news-image').value;
    
    // Jika gambar berupa base64 (gambar baru), upload ke Cloudinary via Apps Script (melalui IPC)
    if (imageUrl && imageUrl.startsWith('data:image')) {
      try {
        const uploadRes = await fetchAPI('uploadImageToAppsScript', { base64Image: imageUrl });
        if (uploadRes && uploadRes.status === 'success' && /^https?:\/\//i.test(uploadRes.url || '')) {
          imageUrl = uploadRes.url;
        } else {
          Swal.close();
          Swal.fire('Upload Gagal', uploadRes?.message || 'Gambar belum berhasil diunggah ke penyimpanan online.', 'error');
          return;
        }
      } catch (err) {
        console.error('Error saat upload gambar ke Cloudinary:', err);
        Swal.close();
        Swal.fire('Upload Gagal', err?.message || 'Gambar belum berhasil diunggah ke penyimpanan online.', 'error');
        return;
      }
    }

    const localSet = safeReadJsonStorage('mktas_settings', {});
    const domainResmi = (localSet.domain_resmi || localSet.website || 'https://www.mktas-tebo.or.id').replace(/\/+$/, '');

    const data = {
      title: document.getElementById('news-title').value,
      date: document.getElementById('news-date').value,
      image_url: imageUrl,
      imageUrl: imageUrl,
      content: quillEditor ? quillEditor.root.innerHTML : '',
      is_published: document.getElementById('news-published').checked ? 1 : 0,
      domain_resmi: domainResmi
    };
    
    const action = _editNewsId ? 'updateNews' : 'addNews';
    if (_editNewsId) data.id = _editNewsId;
    
    // Simpan ke database lokal
    const res = await fetchAPI(action, data);
    
    if (res.status === 'success') {
      let publishUrl = '';
      // Backend add/updateNews sudah membuat file GitHub satu kali.
      if (data.is_published) {
        const slug = res.slug || (typeof generateNewsSlug === 'function'
          ? generateNewsSlug(data.title, data.date)
          : data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        publishUrl = `${domainResmi}/berita/${slug}.html`;
      }
      
      if (data.is_published && publishUrl) {
        Swal.fire({
          title: 'Berita Berhasil Dipublikasikan!',
          html: `
            <p style="margin-bottom:12px;color:var(--text);font-size:0.95rem;">
              ${_editNewsId ? 'Berita diperbarui' : 'Berita baru tersimpan'} dan file HTML otomatis dibuat di GitHub di folder <code>berita/</code>.
            </p>
            <div style="text-align:left;background:#f1f5f9;padding:12px 14px;border-radius:10px;border:1px solid #cbd5e1;margin-bottom:14px;">
              <div style="font-size:0.8rem;font-weight:700;color:#475569;margin-bottom:4px;">
                <i class="fa-solid fa-link"></i> Link URL Cantik untuk Dibagikan:
              </div>
              <a href="${publishUrl}" target="_blank" style="color:#2563eb;word-break:break-all;font-size:0.88rem;text-decoration:underline;">${publishUrl}</a>
            </div>
            <button type="button" class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText('${publishUrl}');Swal.showValidationMessage('Tautan berhasil disalin!');" style="padding:7px 16px;border-radius:8px;">
              <i class="fa-regular fa-copy"></i> Salin Tautan
            </button>
          `,
          icon: 'success',
          confirmButtonText: 'Selesai',
          confirmButtonColor: 'var(--primary-color, #2563eb)'
        });
      } else {
        Swal.fire('Berhasil', _editNewsId ? 'Berita diperbarui (Draf tersimpan).' : 'Berita disimpan sebagai Draf.', 'success');
      }

      _editNewsId = null;
      document.querySelector('#modal-berita .modal-header h3').textContent = 'Tambah Berita';
      closeModal('modal-berita');
      e.target.reset();
      if (quillEditor) quillEditor.root.innerHTML = '';
      document.getElementById('preview-berita').style.display = 'none';
      document.getElementById('news-image').value = '';
      loadNews();
    } else {
      Swal.fire('Error', 'Gagal menyimpan berita', 'error');
    }
  }

async function deleteNews(id) {
  const conf = await Swal.fire({ title:'Hapus berita ini?', icon:'warning', showCancelButton:true, confirmButtonText:'Hapus', confirmButtonColor:'#ef4444' });
  if (conf.isConfirmed) { await fetchAPI('deleteNews', { id }); loadNews(); }
}

// --- FILE REFERENSI (Web Publik) ---
let allReferensiData = [];
let _editRefId = null;

async function loadReferensi() {
  const tbody = document.querySelector('#table-referensi tbody');
  const loader = document.getElementById('loader-referensi');
  if (loader) loader.classList.add('hidden');
  if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="table-loading-cell"><div class="loader"></div><div>Memuat data berkas referensi...</div></td></tr>';

  try {
    const res = await fetchAPI('getReferenceFiles', {});
    if (res.status === 'success') {
      allReferensiData = res.data || [];
      renderReferensiTable();
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Gagal memuat file referensi.</td></tr>';
    }
  } catch (err) {
    console.error('Error loadReferensi:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Terjadi kesalahan saat memuat data.</td></tr>';
  }
  if (loader) loader.classList.add('hidden');
}

function safeReadJsonStorage(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch (e) {
    try { localStorage.removeItem(key); } catch (removeErr) {}
    return fallback;
  }
}

function getActiveUserRole() {
  if (window.currentUser && window.currentUser.role) return window.currentUser.role;
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) return currentUser.role;
  try {
    const u = safeReadJsonStorage('mktas_user', {});
    if (u && u.role) return u.role;
  } catch (e) {}
  return '';
}

function renderReferensiTable() {
  const tbody = document.querySelector('#table-referensi tbody');
  if (!tbody) return;

  const userRole = getActiveUserRole();

  // Tombol tambah disembunyikan untuk role Sekolah
  const btnTambah = document.getElementById('btn-tambah-referensi');
  if (btnTambah) {
    if (userRole === 'Sekolah') {
      btnTambah.style.display = 'none';
    } else {
      btnTambah.style.display = 'inline-block';
    }
  }

  if (allReferensiData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Belum ada file referensi tersimpan.</td></tr>';
    return;
  }

  tbody.innerHTML = allReferensiData.map(r => {
    const jenisBadge = r.jenis === 'Internal'
      ? '<span class="badge" style="background:#3b82f6;color:white;padding:3px 8px;border-radius:12px;font-size:0.8rem;">Internal</span>'
      : '<span class="badge" style="background:#f59e0b;color:white;padding:3px 8px;border-radius:12px;font-size:0.8rem;">Eksternal</span>';

    let sumberDisplay = '';
    if (r.tipe_sumber === 'file') {
      const sizeKB = r.file_size ? (r.file_size / 1024).toFixed(0) : '0';
      sumberDisplay = `<i class="fas fa-file-pdf" style="color:#ef4444;margin-right:6px;"></i> ${r.file_name || 'Dokumen Terlampir'} <small class="text-muted" style="color:var(--text-muted);">(${sizeKB} KB)</small>`;
    } else {
      sumberDisplay = `<i class="fas fa-link" style="color:#3b82f6;margin-right:6px;"></i> <a href="${r.url}" target="_blank" style="color:var(--primary-color);text-decoration:underline;" title="${r.url}">${r.url && r.url.length > 35 ? r.url.substring(0, 35) + '...' : (r.url || '-')}</a>`;
    }

    let actionBtns = '';
    if (userRole === 'Sekolah') {
      actionBtns = `
        <button class="btn btn-sm btn-info" onclick="previewReferensi('${r.id}')" style="padding:4px 10px;">
          <i class="fas fa-eye"></i> Lihat
        </button>
      `;
    } else {
      actionBtns = `
        <button class="btn btn-sm btn-info" onclick="previewReferensi('${r.id}')" style="padding:4px 8px;">
          <i class="fas fa-eye"></i> Lihat
        </button>
        <button class="btn btn-sm btn-outline" onclick="openEditReferensi('${r.id}')" style="padding:4px 8px;">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteReferensi('${r.id}')" style="padding:4px 8px;">
          <i class="fas fa-trash"></i> Hapus
        </button>
      `;
    }

    return `
      <tr>
        <td><b>${r.nama}</b></td>
        <td>${jenisBadge}</td>
        <td>${sumberDisplay}</td>
        <td style="text-align: center; white-space: nowrap;">${actionBtns}</td>
      </tr>
    `;
  }).join('');
}

function openTambahReferensi() {
  if (getActiveUserRole() === 'Sekolah') {
    Swal.fire('Akses Ditolak', 'Akun sekolah hanya memiliki akses melihat file referensi.', 'warning');
    return;
  }
  _editRefId = null;
  const form = document.getElementById('form-referensi');
  if (form) form.reset();
  document.getElementById('ref-id').value = '';
  document.getElementById('modal-ref-title').textContent = 'Tambah File Referensi';
  toggleRefSumber('file');
  const radioFile = document.querySelector('input[name="ref-sumber-pilihan"][value="file"]');
  if (radioFile) radioFile.checked = true;
  document.getElementById('ref-file-info').textContent = 'Format didukung: PDF, Dokumen Office, Gambar (Maks. 1 MB)';
  window.showModal('modal-referensi');
}

function openEditReferensi(id) {
  if (getActiveUserRole() === 'Sekolah') {
    Swal.fire('Akses Ditolak', 'Akun sekolah hanya memiliki akses melihat file referensi.', 'warning');
    return;
  }
  const item = allReferensiData.find(r => r.id === id);
  if (!item) return;

  _editRefId = id;
  document.getElementById('ref-id').value = item.id;
  document.getElementById('ref-nama').value = item.nama;
  document.getElementById('ref-jenis').value = item.jenis;
  document.getElementById('modal-ref-title').textContent = 'Edit File Referensi';

  const radio = document.querySelector(`input[name="ref-sumber-pilihan"][value="${item.tipe_sumber}"]`);
  if (radio) radio.checked = true;
  toggleRefSumber(item.tipe_sumber);

  if (item.tipe_sumber === 'url') {
    document.getElementById('ref-url-input').value = item.url || '';
  } else {
    document.getElementById('ref-file-input').value = '';
    document.getElementById('ref-file-info').textContent = `File saat ini: ${item.file_name || 'Dokumen'} (${(item.file_size / 1024).toFixed(0)} KB). Kosongkan jika tidak ingin mengganti file.`;
  }

  window.showModal('modal-referensi');
}

function closeModalReferensi() {
  window.closeModal('modal-referensi');
}

function toggleRefSumber(val) {
  const groupFile = document.getElementById('group-ref-file');
  const groupUrl = document.getElementById('group-ref-url');
  if (val === 'file') {
    if (groupFile) groupFile.style.display = 'block';
    if (groupUrl) groupUrl.style.display = 'none';
  } else {
    if (groupFile) groupFile.style.display = 'none';
    if (groupUrl) groupUrl.style.display = 'block';
  }
}

async function saveReferensi(e) {
  e.preventDefault();
  if (getActiveUserRole() === 'Sekolah') {
    Swal.fire('Akses Ditolak', 'Akun sekolah tidak diizinkan menambah atau mengedit file referensi.', 'warning');
    return;
  }
  const id = document.getElementById('ref-id').value;
  const nama = document.getElementById('ref-nama').value.trim();
  const jenis = document.getElementById('ref-jenis').value;
  const tipeRadio = document.querySelector('input[name="ref-sumber-pilihan"]:checked');
  const tipe_sumber = tipeRadio ? tipeRadio.value : 'file';

  if (!nama) {
    Swal.fire('Peringatan', 'Nama referensi harus diisi.', 'warning');
    return;
  }

  let file_name = '';
  let file_data = '';
  let file_size = 0;
  let url = '';

  if (tipe_sumber === 'url') {
    url = document.getElementById('ref-url-input').value.trim();
    if (!url) {
      Swal.fire('Peringatan', 'Tautan URL harus diisi.', 'warning');
      return;
    }
  } else {
    const fileInput = document.getElementById('ref-file-input');
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file.size > 1024 * 1024) { // Max 1 MB
        Swal.fire('Ukuran Terlalu Besar', 'Ukuran file tidak boleh melebihi 1 MB.', 'warning');
        return;
      }
      file_name = file.name;
      file_size = file.size;

      // Baca sebagai Base64 Data URL
      file_data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
      });
    } else {
      if (!id) {
        Swal.fire('Peringatan', 'Pilih file dokumen yang ingin diupload.', 'warning');
        return;
      }
    }
  }

  Swal.fire({
    title: 'Menyimpan File Referensi...',
    text: 'Mohon tunggu',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const payload = { id, nama, jenis, tipe_sumber, file_name, file_data, file_size, url };
  const action = id ? 'editReferenceFile' : 'addReferenceFile';

  try {
    const res = await fetchAPI(action, payload);
    if (res.status === 'success') {
      closeModalReferensi();
      Swal.fire({ icon: 'success', title: 'Berhasil', text: res.message, timer: 1500, showConfirmButton: false });
      loadReferensi();
    } else {
      Swal.fire('Gagal', res.message || 'Terjadi kesalahan saat menyimpan.', 'error');
    }
  } catch (err) {
    console.error('Error saveReferensi:', err);
    Swal.fire('Error', err.message || 'Gagal menghubungi server.', 'error');
  }
}

async function deleteReferensi(id) {
  if (getActiveUserRole() === 'Sekolah') {
    Swal.fire('Akses Ditolak', 'Akun sekolah tidak diizinkan menghapus file referensi.', 'warning');
    return;
  }
  const conf = await Swal.fire({
    title: 'Hapus File Referensi?',
    text: 'Data referensi akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444'
  });

  if (conf.isConfirmed) {
    Swal.fire({
      title: 'Menghapus file referensi...',
      text: 'Mohon tunggu sebentar.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAPI('deleteReferenceFile', { id });
    if (res.status === 'success') {
      Swal.close();
      Swal.fire({ icon: 'success', title: 'Dihapus', text: res.message, timer: 1500, showConfirmButton: false });
      loadReferensi();
    } else {
      Swal.close();
      Swal.fire('Gagal', res.message || 'Gagal menghapus', 'error');
    }
  }
}

function previewReferensi(id) {
  const item = allReferensiData.find(r => r.id === id);
  if (!item) return;

  const titleEl = document.getElementById('preview-ref-title');
  const bodyEl = document.getElementById('preview-ref-body');
  const extBtn = document.getElementById('btn-open-external-ref');

  titleEl.textContent = item.nama;

  if (item.tipe_sumber === 'url') {
    extBtn.style.display = 'inline-flex';
    extBtn.href = item.url;
    bodyEl.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
        <i class="fas fa-external-link-alt" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 15px;"></i>
        <h4 style="margin-bottom: 10px;">${item.nama}</h4>
        <p style="color: var(--text-muted); max-width: 500px; margin-bottom: 20px; word-break: break-all;">
          Dokumen ini bersumber dari tautan eksternal:<br>
          <a href="${item.url}" target="_blank" style="color: var(--primary-color); font-weight: 600;">${item.url}</a>
        </p>
        <a href="${item.url}" target="_blank" class="btn btn-primary" style="padding: 10px 20px;">
          <i class="fas fa-external-link-alt" style="margin-right: 6px;"></i> Buka Tautan Referensi
        </a>
      </div>
    `;
  } else {
    extBtn.style.display = 'none';
    if (!item.file_data) {
      bodyEl.innerHTML = '<p style="color:red;">File tidak dapat ditampilkan.</p>';
    } else {
      const isPdf = item.file_data.startsWith('data:application/pdf') || (item.file_name && item.file_name.toLowerCase().endsWith('.pdf'));
      const isImg = item.file_data.startsWith('data:image');

      if (isPdf) {
        bodyEl.innerHTML = `<iframe src="${item.file_data}" style="width: 100%; height: 75vh; border: none; border-radius: 8px;"></iframe>`;
      } else if (isImg) {
        bodyEl.innerHTML = `<img src="${item.file_data}" style="max-width: 100%; max-height: 75vh; border-radius: 8px; object-fit: contain;" />`;
      } else {
        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 30px;">
            <i class="fas fa-file-alt" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 15px;"></i>
            <h4>${item.file_name}</h4>
            <p style="color: var(--text-muted); margin-bottom: 20px;">Format file ini tidak mendukung pratinjau langsung di aplikasi.</p>
            <a href="${item.file_data}" download="${item.file_name}" class="btn btn-primary">
              <i class="fas fa-download" style="margin-right: 6px;"></i> Unduh File (${(item.file_size / 1024).toFixed(0)} KB)
            </a>
          </div>
        `;
      }
    }
  }

  window.showModal('modal-preview-referensi');
}

function closePreviewReferensi() {
  const m = document.getElementById('modal-preview-referensi');
  if (m) m.classList.remove('active');
  const bodyEl = document.getElementById('preview-ref-body');
  if (bodyEl) bodyEl.innerHTML = '';
}

// --- SLIDERS ---
async function loadSliders() {
  const res = await fetchAPI('getSliders', {});
  const tbody = document.querySelector('#table-sliders tbody');
  if (res.status === 'success') {
    tbody.innerHTML = res.data.map(s => `
      <tr>
        <td><img src="${s.image_url}" width="60" style="border-radius:4px;"/></td>
        <td>${s.title}</td>
        <td>${s.is_active ? 'Aktif' : 'Tidak Aktif'}</td>
        <td>
          <button class="btn btn-outline" style="padding: 4px 8px; color:#ef4444;" onclick="deleteSlider('${s.id}')">Hapus</button>
        </td>
      </tr>
    `).join('');
  }
}

async function saveSlider(e) {
  e.preventDefault();
  const data = {
    title: document.getElementById('slider-title').value,
    image_url: document.getElementById('slider-image').value,
    is_active: document.getElementById('slider-active').checked ? 1 : 0
  };

  Swal.fire({
    title: 'Menyimpan slide...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  const res = await fetchAPI('addSlider', data);
  if (res.status === 'success') {
    Swal.close();
    Swal.fire('Berhasil', 'Slider disimpan', 'success');
    closeModal('modal-slider');
    e.target.reset();
    document.getElementById('preview-slider').style.display = 'none';
    loadSliders();
  } else {
    Swal.close();
    Swal.fire('Gagal', res.message || 'Slider gagal disimpan', 'error');
  }
}
async function deleteSlider(id) {
  if(confirm('Yakin ingin menghapus slider?')) {
    Swal.fire({
      title: 'Menghapus slide...',
      text: 'Mohon tunggu sebentar.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAPI('deleteSlider', { id });
    Swal.close();
    if (res.status === 'success') {
      Swal.fire({ icon: 'success', title: 'Dihapus', text: res.message || 'Slide berhasil dihapus.', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire('Gagal', res.message || 'Gagal menghapus slide', 'error');
    }
    loadSliders();
  }
}

// --- BOARD MEMBERS ---
async function loadBoard() {
  const res = await fetchAPI('getBoardMembers', {});
  const tbody = document.querySelector('#table-pengurus tbody');
  if (res.status === 'success') {
    const data = res.data || [];
    window.boardMemberNames = data.map(item => (item.name || '').trim()).filter(Boolean);
    tbody.innerHTML = data.map(b => `
      <tr>
        <td style="text-align:center;">${b.order_index}</td>
        <td><img src="${b.image_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(b.name) + '&background=random&size=40'}" width="40" style="width:40px;height:52px;object-fit:cover;border-radius:10px;"/></td>
        <td><b>${b.name}</b></td>
        <td>${b.position}</td>
        <td style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-outline" onclick="editBoardMember(${JSON.stringify(b).replace(/"/g,'&quot;')})" style="padding:4px 8px;"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-sm btn-outline" style="padding:4px 8px;color:#ef4444;" onclick="deleteBoardMember('${b.id}')"><i class="fas fa-trash"></i> Hapus</button>
        </td>
      </tr>
    `).join('');
  }
}

let _editBoardId = null;
function syncBoardMemberPhotoFromStaff() {
  const input = document.getElementById('board-name');
  const hidden = document.getElementById('board-image');
  const preview = document.getElementById('preview-board');
  if (!input || !hidden || !preview) return false;
  const query = (input.value || '').trim().toLowerCase();
  if (!query) {
    hidden.value = '';
    preview.style.display = 'none';
    return false;
  }
  const staff = (window.allPegawaiData || []).find(p => {
    const name = (p.nama || p.nama_lengkap || '').trim().toLowerCase();
    return name === query;
  });
  if (!staff) {
    return false;
  }
  const photo = staff.foto || staff.image_url || '';
  hidden.value = photo;
  if (photo) {
    preview.src = photo;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
  return !!photo;
}

function setBoardPositionMode(value) {
  const select = document.getElementById('board-position-select');
  const manual = document.getElementById('board-position-manual');
  const wrapper = document.getElementById('board-position-manual-wrapper');
  if (!select || !manual || !wrapper) return;

  const isManual = value === 'Lainnya';
  wrapper.style.display = isManual ? 'block' : 'none';
  manual.required = isManual;
  if (!isManual) {
    manual.value = '';
  }
}

function applyBoardPositionValue(value) {
  const select = document.getElementById('board-position-select');
  const manual = document.getElementById('board-position-manual');
  if (!select) return;

  const fixed = ['Ketua', 'Sekretaris', 'Bendahara'];
  if (fixed.includes(value)) {
    select.value = value;
    setBoardPositionMode(value);
    if (manual) manual.value = '';
  } else {
    select.value = 'Lainnya';
    setBoardPositionMode('Lainnya');
    if (manual) manual.value = value || '';
  }
}

function editBoardMember(b) {
  _editBoardId = b.id;
  document.getElementById('board-name').value = b.name || '';
  document.getElementById('board-order').value = b.order_index || 1;
  document.getElementById('board-image').value = b.image_url || '';
  applyBoardPositionValue(b.position || 'Lainnya');
  const prev = document.getElementById('preview-board');
  if (b.image_url) {
    prev.src = b.image_url; prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
  syncBoardMemberPhotoFromStaff();
  document.querySelector('#modal-pengurus .modal-header h3').textContent = 'Edit Pengurus';
  showModal('modal-pengurus');
}

function openTambahPengurus() {
  _editBoardId = null;
  const form = document.getElementById('form-pengurus');
  if (form) form.reset();
  const prev = document.getElementById('preview-board');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  document.getElementById('board-image').value = '';
  const select = document.getElementById('board-position-select');
  if (select) select.value = 'Ketua';
  setBoardPositionMode('Ketua');
  const h3 = document.querySelector('#modal-pengurus .modal-header h3');
  if (h3) h3.textContent = 'Tambah Pengurus';
  showModal('modal-pengurus');
}

async function saveBoardMember(e) {
  e.preventDefault();
  const selectedRole = document.getElementById('board-position-select').value;
  const manualRole = document.getElementById('board-position-manual').value.trim();
  const finalPosition = selectedRole === 'Lainnya' ? manualRole : selectedRole;

  if (!finalPosition) {
    Swal.fire('Gagal', 'Jabatan harus dipilih atau diisi.', 'error');
    return;
  }

  const name = document.getElementById('board-name').value.trim();
  const matchedStaff = (window.allPegawaiData || []).find(p => {
    const sourceName = (p.nama || p.nama_lengkap || '').trim().toLowerCase();
    return sourceName === name.toLowerCase();
  });
  const imageUrl = matchedStaff ? (matchedStaff.foto || matchedStaff.image_url || '') : (document.getElementById('board-image').value || '');

  const data = {
    name,
    position: finalPosition,
    order_index: parseInt(document.getElementById('board-order').value),
    image_url: imageUrl
  };

  if (!data.name) {
    Swal.fire('Gagal', 'Nama pengurus wajib diisi.', 'error');
    return;
  }

  const duplicateNames = new Set((window.boardMemberNames || []).map(n => String(n).trim().toLowerCase()));
  const currentName = data.name.toLowerCase();
  if (!_editBoardId && duplicateNames.has(currentName)) {
    Swal.fire('Gagal', 'Nama pengurus ini sudah ada di daftar. Pilih nama lain.', 'error');
    return;
  }

  const action = _editBoardId ? 'updateBoardMember' : 'addBoardMember';
  if (_editBoardId) data.id = _editBoardId;

  Swal.fire({
    title: _editBoardId ? 'Memperbarui pengurus...' : 'Menyimpan pengurus...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  const res = await fetchAPI(action, data);
  if (res.status === 'success') {
    Swal.close();
    Swal.fire('Berhasil', _editBoardId ? 'Pengurus diperbarui' : 'Pengurus disimpan', 'success');
    _editBoardId = null;
    document.querySelector('#modal-pengurus .modal-header h3').textContent = 'Tambah Pengurus';
    closeModal('modal-pengurus');
    e.target.reset();
    document.getElementById('preview-board').style.display = 'none';
    loadBoard();
  } else {
    Swal.close();
    Swal.fire('Gagal', res.message || 'Pengurus gagal disimpan', 'error');
  }
}
async function deleteBoardMember(id) {
  const conf = await Swal.fire({ title:'Hapus pengurus ini?', icon:'warning', showCancelButton:true, confirmButtonText:'Hapus', confirmButtonColor:'#ef4444' });
  if (conf.isConfirmed) {
    Swal.fire({
      title: 'Menghapus pengurus...',
      text: 'Mohon tunggu sebentar.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAPI('deleteBoardMember', { id });
    Swal.close();
    if (res.status === 'success') {
      Swal.fire({ icon: 'success', title: 'Dihapus', text: res.message || 'Pengurus berhasil dihapus.', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire('Gagal', res.message || 'Gagal menghapus pengurus', 'error');
    }
    loadBoard();
  }
}

// Autocomplete nama pengurus dari data pegawai
async function initBoardNameAutocomplete() {
  const input = document.getElementById('board-name');
  if (!input) return;
  if (typeof allPegawaiData !== 'undefined' && allPegawaiData.length === 0) {
    try {
      const staffRes = await fetchAPI('getStaff', {});
      if (staffRes.status === 'success' && Array.isArray(staffRes.data)) {
        allPegawaiData = staffRes.data;
      }
    } catch (err) {
      console.warn('[autocomplete pengurus] Gagal memuat pegawai:', err);
    }
  }
  let dropdown = document.getElementById('board-name-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'board-name-dropdown';
    dropdown.style = 'position:absolute;z-index:9999;background:var(--bg-card,#fff);border:1px solid var(--border-color,#ddd);border-radius:8px;max-height:200px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:none;';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(dropdown);
  }
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      syncBoardMemberPhotoFromStaff();
      dropdown.style.display = 'none';
      return;
    }
    const usedNames = new Set((window.boardMemberNames || []).map(n => String(n).trim().toLowerCase()));
    const matches = (typeof allPegawaiData !== 'undefined' ? allPegawaiData : []).filter(p => {
      const name = String(p.nama || p.nama_lengkap || '').trim();
      return name && !usedNames.has(name.toLowerCase()) && name.toLowerCase().includes(q.toLowerCase());
    }).slice(0, 8);
    if (matches.length === 0) {
      syncBoardMemberPhotoFromStaff();
      dropdown.style.display = 'none';
      return;
    }
    dropdown.innerHTML = matches.map(p => `
      <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border-color,#eee);font-size:0.9rem;"
            onmousedown="document.getElementById('board-name').value='${(p.nama || p.nama_lengkap || '').replace(/'/g,"\\'")}'; document.getElementById('board-image').value='${(p.foto || p.image_url || '').replace(/'/g,"\\'")}'; document.getElementById('preview-board').src='${(p.foto || p.image_url || '').replace(/'/g,"\\'")}'; document.getElementById('preview-board').style.display='block'; document.getElementById('board-name-dropdown').style.display='none';">
          <b>${p.nama || p.nama_lengkap || '-'}</b><br>
        <small style="color:var(--text-muted);">${p.jabatan_tugas || p.jabatan || ''} — ${p.nip || ''}</small>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  });
  input.addEventListener('blur', () => {
    syncBoardMemberPhotoFromStaff();
    setTimeout(() => { dropdown.style.display = 'none'; }, 200);
  });
}

// --- SOCIALS ---
const MEDSOS_MAP = [
  { platform: 'Facebook',   icon: 'fa-brands fa-facebook',   color: '#1877f2' },
  { platform: 'Instagram',  icon: 'fa-brands fa-instagram',  color: '#e1306c' },
  { platform: 'WhatsApp',   icon: 'fa-brands fa-whatsapp',   color: '#25d366' },
  { platform: 'Twitter / X',icon: 'fa-brands fa-x-twitter',  color: '#000000' },
  { platform: 'Telegram',   icon: 'fa-brands fa-telegram',   color: '#0088cc' },
  { platform: 'Threads',    icon: 'fa-brands fa-threads',    color: '#000000' },
  { platform: 'TikTok',     icon: 'fa-brands fa-tiktok',     color: '#010101' },
  { platform: 'YouTube',    icon: 'fa-brands fa-youtube',    color: '#ff0000' },
  { platform: 'LinkedIn',   icon: 'fa-brands fa-linkedin',   color: '#0077b5' },
  { platform: 'Pinterest',  icon: 'fa-brands fa-pinterest',  color: '#bd081c' },
  { platform: 'Snapchat',   icon: 'fa-brands fa-snapchat',   color: '#fffc00' },
  { platform: 'Website / Blog', icon: 'fa-solid fa-globe',   color: '#6366f1' },
  { platform: 'Email',      icon: 'fa-solid fa-envelope',    color: '#ea4335' },
  { platform: 'Lainnya',    icon: 'fa-solid fa-link',        color: '#6b7280' },
];

async function loadSocials() {
  const res = await fetchAPI('getSocials', {});
  const tbody = document.querySelector('#table-medsos tbody');
  if (res.status === 'success') {
    tbody.innerHTML = res.data.map(s => {
      const m = MEDSOS_MAP.find(x => x.platform === s.platform);
      const color = m ? m.color : '#6b7280';
      return `
        <tr>
          <td><i class="${s.icon}" style="color:${color};font-size:1.2rem;margin-right:6px;"></i> <b>${s.platform}</b></td>
          <td><a href="${s.url}" target="_blank" style="word-break:break-all;">${s.url}</a></td>
          <td style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="deleteSocial('${s.id}')" style="padding:4px 8px;color:#ef4444;"><i class="fas fa-trash"></i> Hapus</button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

async function saveSocial(e) {
  e.preventDefault();
  const select = document.getElementById('social-platform');
  const platform = select.value;
  const m = MEDSOS_MAP.find(x => x.platform === platform);
  const data = {
    platform,
    url: document.getElementById('social-url').value,
    icon: m ? m.icon : 'fa-solid fa-link'
  };

  Swal.fire({
    title: 'Menyimpan media sosial...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  const res = await fetchAPI('addSocial', data);
  if (res.status === 'success') {
    Swal.close();
    Swal.fire('Berhasil', 'Medsos disimpan', 'success');
    closeModal('modal-medsos');
    e.target.reset();
    updateSocialIconPreview();
    loadSocials();
  } else {
    Swal.close();
    Swal.fire('Gagal', res.message || 'Medsos gagal disimpan', 'error');
  }
}
async function deleteSocial(id) {
  const conf = await Swal.fire({ title:'Hapus medsos ini?', icon:'warning', showCancelButton:true, confirmButtonText:'Hapus', confirmButtonColor:'#ef4444' });
  if (conf.isConfirmed) {
    Swal.fire({
      title: 'Menghapus media sosial...',
      text: 'Mohon tunggu sebentar.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAPI('deleteSocial', { id });
    Swal.close();
    if (res.status === 'success') {
      Swal.fire({ icon: 'success', title: 'Dihapus', text: res.message || 'Medsos berhasil dihapus.', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire('Gagal', res.message || 'Gagal menghapus medsos', 'error');
    }
    loadSocials();
  }
}

function updateSocialIconPreview() {
  const select = document.getElementById('social-platform');
  if (!select) return;
  const platform = select.value;
  const m = MEDSOS_MAP.find(x => x.platform === platform);
  const preview = document.getElementById('social-icon-preview');
  if (preview && m) {
    preview.className = m.icon;
    preview.style.color = m.color;
    preview.style.fontSize = '1.6rem';
  }
}

// --- QUILL, CROPPER & IMGBB LOGIC ---
let quillEditor = null;
let quillPengantar = null;
let quillSejarah = null;
let quillVisimisi = null;
let cropper = null;
let currentCropInput = null; // 'berita', 'slider', 'board'

function openTambahBerita() {
  _editNewsId = null;
  const form = document.getElementById('form-berita');
  if (form) form.reset();
  if (quillEditor) quillEditor.root.innerHTML = '';
  const prev = document.getElementById('preview-berita');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  document.getElementById('news-image').value = '';
  const h3 = document.querySelector('#modal-berita .modal-header h3');
  if (h3) h3.textContent = 'Tambah Berita';
  showModal('modal-berita');
}

function closeModalBerita() {
  // Reset state edit
  _editNewsId = null;
  const h3 = document.querySelector('#modal-berita .modal-header h3');
  if (h3) h3.textContent = 'Tambah Berita';
  // Reset form
  const form = document.getElementById('form-berita');
  if (form) form.reset();
  // Reset quill
  if (quillEditor) quillEditor.root.innerHTML = '';
  // Reset preview
  const prev = document.getElementById('preview-berita');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  document.getElementById('news-image').value = '';
  closeModal('modal-berita');
}

function initQuillCropper() {
  const quillToolbarOptions = [
    [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub' }, { 'script': 'super' }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link', 'image', 'video'],
    ['clean']
  ];

  // 1. Initialize Quill Editor Berita dengan toolbar lengkap seperti MS Word
  if (document.getElementById('editor-berita') && !quillEditor) {
    quillEditor = new Quill('#editor-berita', {
      theme: 'snow',
      placeholder: 'Ketik isi berita di sini...',
      modules: {
        toolbar: quillToolbarOptions
      }
    });
  }

  // 2. Initialize Quill Editor untuk Profil Organisasi (Kata Pengantar & Sejarah Singkat)
  if (document.getElementById('editor-profil-pengantar') && !quillPengantar) {
    quillPengantar = new Quill('#editor-profil-pengantar', {
      theme: 'snow',
      placeholder: 'Tuliskan kata pengantar singkat tentang forum ini...',
      modules: {
        toolbar: quillToolbarOptions
      }
    });
    if (window._cachedProfilPengantar) {
      quillPengantar.root.innerHTML = window._cachedProfilPengantar;
    }
  }

  if (document.getElementById('editor-profil-sejarah') && !quillSejarah) {
    quillSejarah = new Quill('#editor-profil-sejarah', {
      theme: 'snow',
      placeholder: 'Ceritakan sejarah berdirinya organisasi...',
      modules: {
        toolbar: quillToolbarOptions
      }
    });
    if (window._cachedProfilSejarah) {
      quillSejarah.root.innerHTML = window._cachedProfilSejarah;
    }
  }

  if (document.getElementById('editor-profil-visimisi') && !quillVisimisi) {
    quillVisimisi = new Quill('#editor-profil-visimisi', {
      theme: 'snow',
      placeholder: 'Tuliskan Visi dan Misi organisasi di sini...',
      modules: {
        toolbar: quillToolbarOptions
      }
    });
    if (window._cachedProfilVisimisi) {
      quillVisimisi.root.innerHTML = window._cachedProfilVisimisi;
    }
  }

  // 2. Setup Web Publik Tabs (scoped to #section-webpublik)
  const webPublikSection = document.getElementById('section-webpublik');
  if (webPublikSection) {
    const tabBtns = webPublikSection.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        switchWebPublikTab(target, btn);

        if (target === 'tab-profil') {
          if (quillPengantar && window._cachedProfilPengantar && (!quillPengantar.root.innerHTML || quillPengantar.root.innerHTML === '<p><br></p>')) {
            quillPengantar.root.innerHTML = window._cachedProfilPengantar;
          }
          if (quillSejarah && window._cachedProfilSejarah && (!quillSejarah.root.innerHTML || quillSejarah.root.innerHTML === '<p><br></p>')) {
            quillSejarah.root.innerHTML = window._cachedProfilSejarah;
          }
          if (quillVisimisi && window._cachedProfilVisimisi && (!quillVisimisi.root.innerHTML || quillVisimisi.root.innerHTML === '<p><br></p>')) {
            quillVisimisi.root.innerHTML = window._cachedProfilVisimisi;
          }
        }
      });
    });
  }

  // Cropper logic is now handled in utils.js globally
  initBoardNameAutocomplete();
}


async function uploadToCloudinary(base64Image) {
  if (!base64Image) return null;

  const extractUploadUrl = (response) => {
    const url = typeof response === 'string'
      ? response
      : response?.url || response?.data?.url || '';
    return /^https?:\/\//i.test(url) ? url : '';
  };

  // Jika di Electron desktop, panggil IPC action uploadImageToAppsScript
  const isElectron = typeof window !== 'undefined' && window.IS_ELECTRON === true;
  if (isElectron) {
    try {
      Swal.fire({
        title: 'Mengunggah Gambar ke Cloud...',
        text: 'Mengoptimasi dan menyimpan ke Cloudinary...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      const res = await fetchAPI('uploadImageToAppsScript', { base64Image });
      Swal.close();
      const uploadedUrl = extractUploadUrl(res);
      if (uploadedUrl) return uploadedUrl;
      throw new Error('Server tidak mengembalikan URL gambar.');
    } catch (e) {
      Swal.close();
      throw e;
    }
  }

  // Mode browser: gunakan satu jalur backend agar API secret tidak pernah
  // dikirim ke browser dan tidak ada kegagalan direct-upload yang tersamar.
  Swal.fire({ 
    title: 'Mengunggah Gambar...', 
    text: 'Mohon tunggu sebentar',
    allowOutsideClick: false, 
    didOpen: () => Swal.showLoading() 
  });

  try {
    const fallbackRes = await fetchAPI('uploadImageToAppsScript', { base64Image });
    Swal.close();
    const uploadedUrl = extractUploadUrl(fallbackRes);
    if (uploadedUrl) return uploadedUrl;
    throw new Error(fallbackRes?.message || 'Backend tidak mengembalikan URL gambar.');
  } catch (fErr) {
    console.warn('Apps Script upload error:', fErr);
    throw fErr;
  }

  Swal.close();
  throw new Error('Server tidak mengembalikan URL gambar.');
}

document.addEventListener("DOMContentLoaded", initQuillCropper);


// -----------------------------------------

// --- TAB PROFIL ORGANISASI ---
document.getElementById('profil-struktur-file')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      document.getElementById('preview-profil-struktur').src = evt.target.result;
      document.getElementById('preview-profil-struktur').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

async function loadProfilOrganisasi() {
  try {
    const res = await fetchAPI('getSettings', {});
    let cached = {};
    try { cached = safeReadJsonStorage('mktas_settings', {}); } catch (e) {}
    const settings = Object.assign({}, cached, res.status === 'success' ? (res.data || {}) : {});
    
    // Kata Pengantar
    if (settings.profil_pengantar) window._cachedProfilPengantar = settings.profil_pengantar;
    if (quillPengantar) {
      quillPengantar.root.innerHTML = settings.profil_pengantar || '';
    } else {
      const el = document.getElementById('profil-pengantar');
      if (el) el.value = settings.profil_pengantar || '';
    }

    // Visi & Misi
    if (settings.profil_visimisi) window._cachedProfilVisimisi = settings.profil_visimisi;
    if (quillVisimisi) {
      quillVisimisi.root.innerHTML = settings.profil_visimisi || '';
    } else {
      const elVisi = document.getElementById('profil-visimisi');
      if (elVisi) elVisi.value = settings.profil_visimisi || '';
    }

    // Sejarah Singkat
    if (settings.profil_sejarah) window._cachedProfilSejarah = settings.profil_sejarah;
    if (quillSejarah) {
      quillSejarah.root.innerHTML = settings.profil_sejarah || '';
    } else {
      const el = document.getElementById('profil-sejarah');
      if (el) el.value = settings.profil_sejarah || '';
    }

    // Data Organisasi
    const elData = document.getElementById('profil-data');
    if (elData && settings.profil_data) elData.value = settings.profil_data;
    
    if (settings.profil_struktur) {
      const urlInput = document.getElementById('profil-struktur-url');
      if (urlInput) urlInput.value = settings.profil_struktur;
      const preview = document.getElementById('preview-profil-struktur');
      if (preview) {
        preview.src = settings.profil_struktur;
        preview.style.display = 'block';
      }
    }
  } catch (e) {
    console.error('Failed to load Profil Organisasi', e);
  }
}


async function saveProfilOrganisasi() {
  Swal.fire({ title: 'Menyimpan Profil...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  try {
    let strukturUrl = document.getElementById('profil-struktur-url').value;
    const fileInput = document.getElementById('profil-struktur-file');
    
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      const base64Data = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      try {
        const uploadRes = await fetchAPI('uploadImageToAppsScript', { base64Image: base64Data, filename: file.name });
        if (uploadRes && uploadRes.url) {
          strukturUrl = uploadRes.url;
        } else if (uploadRes && uploadRes.data && uploadRes.data.url) {
          strukturUrl = uploadRes.data.url;
        } else {
          throw new Error('Gambar struktur belum berhasil diunggah ke penyimpanan online.');
        }
      } catch (err) {
        throw err;
      }
    }
    
    const getQuillContent = (q, fallbackId) => {
      if (q && q.root) {
        const html = q.root.innerHTML;
        if (html === '<p><br></p>') return '';
        return html;
      }
      return document.getElementById(fallbackId)?.value || '';
    };

    const data = {
      pengantar: getQuillContent(quillPengantar, 'profil-pengantar'),
      visimisi: getQuillContent(quillVisimisi, 'profil-visimisi'),
      sejarah: getQuillContent(quillSejarah, 'profil-sejarah'),
      data: document.getElementById('profil-data')?.value || '',
      struktur: strukturUrl
    };
    
    
      const saveRes = await fetchAPI('saveSettings', {
        profil_pengantar: data.pengantar,
        profil_visimisi: data.visimisi,
        profil_sejarah: data.sejarah,
        profil_data: data.data,
        profil_struktur: data.struktur
      });
      if (!saveRes || saveRes.status !== 'success') {
        throw new Error(saveRes?.message || 'Profil gagal disimpan ke Spreadsheet.');
      }

      localStorage.setItem('mktas_profil', JSON.stringify({
        pengantar: data.pengantar,
        visimisi: data.visimisi,
        sejarah: data.sejarah,
        data: data.data,
        struktur: data.struktur
      }));

    Swal.fire('Berhasil!', 'Profil Organisasi telah disimpan.', 'success');
  } catch (error) {
    console.error(error);
    Swal.fire('Gagal!', error.message || 'Terjadi kesalahan saat menyimpan profil.', 'error');
  }
}

// Ensure it loads when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadProfilOrganisasi, 1000);
});
