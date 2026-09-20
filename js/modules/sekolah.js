// --- Data Loading ---
let currentSekolahPage = 1;
let filteredSekolahData = [];
const SEKOLAH_PER_PAGE = 10;

// KELEMAHAN #6: Variabel-variabel pegawai di bawah ini adalah SATU-SATUNYA deklarasi.
// Deklarasi duplikat di app.js (yang tidak dipakai dashboard.html) sudah tidak relevan.
const ITEMS_PER_PAGE = 10;
let currentPegawaiPage = 1;
let allPegawaiData = [];
let filteredPegawaiData = [];

async function loadSekolah(forceRefresh = false) {
  const tbody = document.querySelector("#table-sekolah tbody");
  const pagination = document.getElementById("pagination-sekolah");

  initWilayah('add');
  initWilayah('edit');

  if (currentUser && currentUser.role === "Admin") {
    document.querySelectorAll(".btn-import-school, .btn-add-school").forEach(b => b.style.display = "none");
  } else if (currentUser && currentUser.role === "Superadmin") {
    document.querySelectorAll(".btn-import-school, .btn-add-school").forEach(b => b.style.display = "inline-block");
  }

  // 1. Tampilkan data seketika jika ada cache lokal (0 ms)
  const localSchools = (typeof safeReadJsonStorage === 'function') ? safeReadJsonStorage('mktas_schools', []) : JSON.parse(localStorage.getItem('mktas_schools') || '[]');
  const cachedVer = localStorage.getItem('mktas_data_version') || '';

  if (Array.isArray(localSchools) && localSchools.length > 0 && !forceRefresh) {
    cachedSchools = localSchools;
    filterSekolah();
    if (pagination) pagination.style.visibility = "visible";
  } else {
    if (pagination) pagination.style.visibility = "hidden";
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="table-loading-cell">
            <div class="loader"></div>
            <div>Memuat data sekolah...</div>
          </td>
        </tr>
      `;
    }
  }

  const extLoader = document.getElementById("loader-sekolah");
  if (extLoader) extLoader.classList.add("hidden");

  // 2. Cek versi di latar belakang (ringan, tidak membuka spreadsheet)
  try {
    const vRes = await fetchAPI('getDataVersion', {});
    const serverVer = (vRes && vRes.status === 'success' && vRes.version) ? String(vRes.version) : '';

    // Jika versi server cocok dengan cache dan data sudah ada: SELESAI (0 spreadsheet calls)
    if (serverVer && serverVer === cachedVer && Array.isArray(localSchools) && localSchools.length > 0 && !forceRefresh) {
      return;
    }

    const result = await fetchAPI("getSchools");

    if (result.status === "success" && Array.isArray(result.data)) {
      cachedSchools = result.data;
      if (serverVer) localStorage.setItem('mktas_data_version', serverVer);
      try { localStorage.setItem('mktas_schools', JSON.stringify(cachedSchools)); } catch (e) { }
      filterSekolah();
      if (pagination) pagination.style.visibility = "visible";
    } else if (!localSchools || localSchools.length === 0) {
      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="4" style="text-align:center;color:var(--danger-color);padding:30px 20px;">Gagal memuat data: ${result.message || 'Terjadi kesalahan'}</td></tr>`;
      }
    }
  } catch (err) {
    console.error('[loadSekolah]', err);
    if (tbody && (!localSchools || localSchools.length === 0)) {
      tbody.innerHTML =
        `<tr><td colspan="4" style="text-align:color;color:var(--danger-color);padding:30px 20px;">Gagal memuat data sekolah. Periksa koneksi.</td></tr>`;
    }
  }
}

function filterSekolah() {
  const searchInput = document.getElementById("search-sekolah");
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  
  filteredSekolahData = cachedSchools.filter(item => {
    return (item.nama && item.nama.toLowerCase().includes(search));
  });
  
  currentSekolahPage = 1;
  renderSekolahTable();
}

function changeSekolahPage(step) {
  const totalPages = Math.ceil(filteredSekolahData.length / SEKOLAH_PER_PAGE) || 1;
  currentSekolahPage += step;
  
  if(currentSekolahPage < 1) currentSekolahPage = 1;
  if(currentSekolahPage > totalPages) currentSekolahPage = totalPages;
  
  renderSekolahTable();
}

function renderSekolahTable() {
  const tbody = document.querySelector("#table-sekolah tbody");
  const textPage = document.getElementById("text-sekolah-page");
  if(!tbody) return;
  
  const totalPages = Math.ceil(filteredSekolahData.length / SEKOLAH_PER_PAGE) || 1;
  if(textPage) textPage.innerText = `Page ${currentSekolahPage} of ${totalPages}`;
  
  const btnPrev = document.getElementById("btn-sekolah-prev");
  const btnNext = document.getElementById("btn-sekolah-next");
  if(btnPrev) btnPrev.disabled = (currentSekolahPage === 1);
  if(btnNext) btnNext.disabled = (currentSekolahPage === totalPages);
  
  const startIdx = (currentSekolahPage - 1) * SEKOLAH_PER_PAGE;
  const endIdx = startIdx + SEKOLAH_PER_PAGE;
  const paginatedData = filteredSekolahData.slice(startIdx, endIdx);
  
  let html = "";
  if(paginatedData.length === 0) {
    html = `<tr><td colspan="4" style="text-align: center;">Tidak ada data sekolah ditemukan</td></tr>`;
  } else {
    paginatedData.forEach((item) => {
      let actionBtns = '';
      const encodedSchoolName = encodeURIComponent(item.nama || '');
      if (currentUser.role === "Superadmin") {
        actionBtns = `
          <button class="btn btn-sm btn-info" onclick="openPegawaiSekolahPage('${item.id}', decodeURIComponent('${encodedSchoolName}'))" title="Pegawai"><i class="fas fa-users"></i> <span class="btn-aksi-text">Pegawai</span></button>
          <button class="btn btn-sm btn-outline" onclick="openEditSchool('${item.id}')" title="Edit"><i class="fas fa-edit"></i> <span class="btn-aksi-text">Edit</span></button>
          <button class="btn btn-sm btn-danger" onclick="deleteSchool('${item.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
        `;
      } else if (currentUser.role === "Admin") {
        actionBtns = `
          <button class="btn btn-sm btn-info" onclick="openPegawaiSekolahPage('${item.id}', decodeURIComponent('${encodedSchoolName}'))" title="Pegawai"><i class="fas fa-users"></i> <span class="btn-aksi-text">Pegawai</span></button>
        `;
      }
      html += `<tr>
                  <td><b>${item.nama}</b><br><small class="text-muted" style="color: #666;">NPSN: ${item.npsn || '-'}</small></td>
                  <td>${item.kecamatan || '-'}</td>
                  <td>${item.nama_admin || '-'}<br><small class="text-muted" style="color: #666;">${item.no_hp_admin || '-'}</small></td>
                  <td>${actionBtns}</td>
              </tr>`;
    });
  }
  tbody.innerHTML = html;
}

async function loadPegawai(forceRefresh = false) {
  const tbody = document.querySelector("#tbody-pegawai");
  const pagination = document.getElementById("btn-pegawai-prev")?.parentElement;

  const cacheKey = (currentUser && currentUser.role === "Sekolah" && currentUser.school_id)
    ? `mktas_staff_${currentUser.school_id}`
    : 'mktas_staff_all';
  const localStaff = (typeof safeReadJsonStorage === 'function')
    ? safeReadJsonStorage(cacheKey, [])
    : JSON.parse(localStorage.getItem(cacheKey) || '[]');
  const cachedVer = localStorage.getItem('mktas_data_version') || '';

  // 1. Tampilkan data seketika jika ada cache lokal (0 ms)
  if (Array.isArray(localStaff) && localStaff.length > 0 && !forceRefresh) {
    allPegawaiData = localStaff;
    populatePegawaiSchoolFilter();
    filterPegawaiTable();
    if (pagination) pagination.style.visibility = "visible";
  } else {
    if (pagination) pagination.style.visibility = "hidden";
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-loading-cell">
            <div class="loader"></div>
            <div>Memuat data pegawai...</div>
          </td>
        </tr>
      `;
    }
  }

  const extLoader = document.getElementById("loader-pegawai");
  if (extLoader) extLoader.classList.add("hidden");

  // 2. Cek versi data di latar belakang (ringan, tanpa membuka spreadsheet)
  try {
    const vRes = await fetchAPI('getDataVersion', {});
    const serverVer = (vRes && vRes.status === 'success' && vRes.version) ? String(vRes.version) : '';

    // Jika versi server cocok dengan cache dan data sudah tampil: SELESAI (0 panggilan spreadsheet)
    if (serverVer && serverVer === cachedVer && Array.isArray(localStaff) && localStaff.length > 0 && !forceRefresh) {
      return;
    }

    let payload = {};
    if (currentUser && currentUser.role === "Sekolah") {
      payload.school_id = currentUser.school_id;
    }

    const result = await fetchAPI("getStaff", payload);

    if (result.status === "success" && Array.isArray(result.data)) {
      allPegawaiData = result.data;
      if (serverVer) localStorage.setItem('mktas_data_version', serverVer);
      try { localStorage.setItem(cacheKey, JSON.stringify(allPegawaiData)); } catch(e) {}

      populatePegawaiSchoolFilter();
      filterPegawaiTable();
      if (pagination) pagination.style.visibility = "visible";
    } else if (!localStaff || localStaff.length === 0) {
      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="5" style="text-align:center;color:var(--danger-color);padding:30px 20px;">Gagal memuat data: ${result.message || 'Terjadi kesalahan'}</td></tr>`;
      }
    }
  } catch (err) {
    console.error('[loadPegawai]', err);
    if (tbody && (!localStaff || localStaff.length === 0)) {
      tbody.innerHTML =
        `<tr><td colspan="5" style="text-align:center;color:var(--danger-color);padding:30px 20px;">Gagal memuat data pegawai. Periksa koneksi.</td></tr>`;
    }
  }
}

function populatePegawaiSchoolFilter() {
  const filterSekolahEl = document.getElementById("filter-pegawai-sekolah");
  if (filterSekolahEl && Array.isArray(allPegawaiData)) {
    const uniqueSchools = [...new Set(allPegawaiData.map(item => item.sekolah_nama).filter(Boolean))];
    let optionsHtml = '<option value="">-- Semua Sekolah --</option>';
    uniqueSchools.forEach(sch => optionsHtml += `<option value="${sch}">${sch}</option>`);
    filterSekolahEl.innerHTML = optionsHtml;
  }
}

function filterPegawaiTable() {
  const search = document.getElementById("filter-pegawai-search").value.toLowerCase();
  const school = document.getElementById("filter-pegawai-sekolah").value;
  const status = document.getElementById("filter-pegawai-status").value;
  const jabatan = document.getElementById("filter-pegawai-jabatan").value;
  
  filteredPegawaiData = allPegawaiData.filter(item => {
    const matchSearch = (item.nama && item.nama.toLowerCase().includes(search)) || (item.nip && item.nip.toLowerCase().includes(search));
    const matchSchool = school === "" || item.sekolah_nama === school;
    const matchStatus = status === "" || item.status_pegawai === status;
    const matchJabatan = jabatan === "" || item.jabatan_tugas === jabatan;
    
    return matchSearch && matchSchool && matchStatus && matchJabatan;
  });
  
  currentPegawaiPage = 1;
  renderPegawaiTable();
}

function changePegawaiPage(step) {
  const totalPages = Math.ceil(filteredPegawaiData.length / ITEMS_PER_PAGE);
  currentPegawaiPage += step;
  
  if(currentPegawaiPage < 1) currentPegawaiPage = 1;
  if(currentPegawaiPage > totalPages) currentPegawaiPage = totalPages || 1;
  
  renderPegawaiTable();
}

function renderPegawaiTable() {
  const tbody = document.getElementById("tbody-pegawai");
  const textPage = document.getElementById("text-pegawai-page");
  
  if(!tbody || !textPage) return;
  
  const totalPages = Math.ceil(filteredPegawaiData.length / ITEMS_PER_PAGE) || 1;
  textPage.innerText = `Page ${currentPegawaiPage} of ${totalPages}`;
  
  // Disable/enable buttons
  document.getElementById("btn-pegawai-prev").disabled = (currentPegawaiPage === 1);
  document.getElementById("btn-pegawai-next").disabled = (currentPegawaiPage === totalPages);
  
  const startIdx = (currentPegawaiPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedData = filteredPegawaiData.slice(startIdx, endIdx);
  
  let html = "";
  if(paginatedData.length === 0) {
    html = `<tr><td colspan="5" style="text-align: center;">Tidak ada data ditemukan</td></tr>`;
  } else {
    paginatedData.forEach(item => {
      const jabatanSk = item.nama_jabatan_sk || item.jabatan_sk || item.jabatan || '-';
      const jabatanTugas = item.nama_jabatan_tugas || item.jabatan_tugas || item.nama_jabatan_sk || item.jabatan_sk || item.jabatan || '-';
      html += `<tr>
                  <td><b>${item.nama_lengkap || item.nama || '-'}</b><br><small style="color: var(--text-muted);white-space:nowrap;">NIP: ${item.nip || '-'}</small></td>
                  <td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      <span>${jabatanSk}</span>
                      <span style="background: var(--bg-gradient-end); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; display:inline-block; width:max-content; max-width:100%;">${jabatanTugas}</span>
                    </div>
                  </td>
                  <td>${item.sekolah_nama || '-'}</td>
                  <td>${item.status_pegawai || '-'}</td>
                  <td>${item.no_wa || '-'}</td>
              </tr>`;
    });
  }
  tbody.innerHTML = html;
}

async function exportPegawaiExcel() {
  if (typeof XLSX === 'undefined') {
    Swal.fire('Error', 'Library Excel belum dimuat. Muat ulang halaman lalu coba lagi.', 'error');
    return;
  }

  const rows = (allPegawaiData && allPegawaiData.length ? allPegawaiData : await fetchAPI('getStaff', {})).data || allPegawaiData || [];
  const cleanRows = rows.map(item => ({
    'ID': item.id || '',
    'NIP': item.nip || '',
    'Nama Lengkap': item.nama_lengkap || item.nama || '',
    'Jenis Kelamin': item.jenis_kelamin || '',
    'Tempat Lahir': item.tempat_lahir || '',
    'Tanggal Lahir': item.tgl_lahir || '',
    'Pendidikan Terakhir': item.pendidikan_terakhir || '',
    'Status Pegawai': item.status_pegawai || '',
    'Pangkat / Golongan': item.pangkat_gol || '',
    'Jabatan SK': item.nama_jabatan_sk || item.jabatan_sk || '',
    'Jabatan Tugas': item.nama_jabatan_tugas || item.jabatan_tugas || '',
    'Nama Sekolah': item.sekolah_nama || '',
    'No WA': item.no_wa || item.no_hp || '',
    'Email': item.email || '',
    'School ID': item.school_id || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(cleanRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pegawai');

  const colWidths = [10, 18, 28, 14, 18, 14, 18, 16, 20, 32, 32, 28, 16, 24, 14];
  worksheet['!cols'] = colWidths.map(width => ({ wch: width }));

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
    if (!row) continue;
    // skip header row style; keep sheet readable
  }

  XLSX.writeFile(workbook, 'data_pegawai_mktas.xlsx');
  Swal.fire({ icon: 'success', title: 'Excel berhasil diunduh', text: 'File berisi data pegawai lengkap dan rapi.', timer: 2200, showConfirmButton: false });
}

window.exportPegawaiExcel = exportPegawaiExcel;

// --- HAPUS SEKOLAH (dengan konfirmasi ketat: ketik "HAPUS") ---
async function deleteSchool(id) {
  // Cari nama sekolah
  const sekolah = cachedSchools.find(s => s.id === id);
  const namaSekolah = sekolah ? sekolah.nama : id;

  const { value: inputUser, isConfirmed } = await Swal.fire({
    title: '⚠️ Hapus Sekolah?',
    html: `
      <p style="margin-bottom:12px;">Anda akan menghapus sekolah:<br>
      <b style="color:var(--danger-color, #ef4444);">${namaSekolah}</b></p>
      <p style="margin-bottom:12px;color:#666;font-size:0.9rem;">
        ⚠️ <b>Seluruh data pegawai</b> di sekolah ini juga akan ikut <b>dihapus permanen</b>.
      </p>
      <p style="margin-bottom:8px;font-weight:600;">Ketik <code style="background:#fee2e2;padding:2px 6px;border-radius:4px;color:#ef4444;">HAPUS</code> untuk konfirmasi:</p>
      <input id="swal-input-hapus" class="swal2-input" placeholder="Ketik HAPUS" style="text-transform:uppercase;" />
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Hapus Sekarang',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444',
    focusConfirm: false,
    preConfirm: () => {
      const val = document.getElementById('swal-input-hapus').value.trim().toUpperCase();
      if (val !== 'HAPUS') {
        Swal.showValidationMessage('Ketik kata HAPUS untuk melanjutkan!');
        return false;
      }
      return val;
    }
  });

  if (!isConfirmed) return;

  Swal.fire({
    title: 'Menghapus sekolah...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  const res = await fetchAPI('deleteSchool', { id });
  if (res.status === 'success') {
    Swal.close();
    Swal.fire({ icon: 'success', title: 'Dihapus!', text: 'Sekolah dan semua pegawainya telah dihapus.', timer: 2000, showConfirmButton: false });
    // Hapus seketika dari memori & cache lokal (0 ms)
    cachedSchools = cachedSchools.filter(s => s.id !== id);
    try { localStorage.setItem('mktas_schools', JSON.stringify(cachedSchools)); } catch (e) {}
    filterSekolah();
    loadSekolah(true);
  } else {
    Swal.close();
    Swal.fire('Gagal', res.message || 'Terjadi kesalahan', 'error');
  }
}

// ============================================================
// MAP PICKER — Leaflet + OpenStreetMap (tanpa API key)
// ============================================================
let _mapPickerTargetId = null;
let _leafletMap = null;
let _leafletMarker = null;
let _pickedLat = null;
let _pickedLng = null;

function openMapPicker(targetInputId) {
  _mapPickerTargetId = targetInputId;
  _pickedLat = null;
  _pickedLng = null;

  // Baca koordinat awal dari input jika ada
  const existing = (document.getElementById(targetInputId) || {}).value || '';
  let initLat = -2.5; // center Indonesia
  let initLng = 118.0;
  let initZoom = 5;
  if (existing) {
    const parts = existing.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      initLat = parts[0]; initLng = parts[1]; initZoom = 15;
      _pickedLat = initLat; _pickedLng = initLng;
    }
  }

  document.getElementById('map-coord-display').textContent =
    _pickedLat ? `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}` : 'Belum dipilih — klik peta';
  document.getElementById('map-search-input').value = '';

  // Tampilkan overlay peta (bukan class modal, tapi inline style)
  document.getElementById('modal-map-picker').style.display = 'flex';

  // Init Leaflet (lazy)
  setTimeout(() => {
    if (!window.L) { alert('Library peta (Leaflet) belum dimuat. Periksa koneksi internet.'); return; }
    const mapEl = document.getElementById('leaflet-map');

    if (_leafletMap) {
      _leafletMap.setView([initLat, initLng], initZoom);
      if (_leafletMarker && _pickedLat) {
        _leafletMarker.setLatLng([initLat, initLng]);
      } else if (_leafletMarker) {
        _leafletMap.removeLayer(_leafletMarker);
        _leafletMarker = null;
      }
      _leafletMap.invalidateSize();
    } else {
      _leafletMap = L.map(mapEl).setView([initLat, initLng], initZoom);
      L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      }).addTo(_leafletMap);

      _leafletMap.on('click', function(e) {
        _pickedLat = e.latlng.lat;
        _pickedLng = e.latlng.lng;
        document.getElementById('map-coord-display').textContent =
          `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}`;
        if (_leafletMarker) {
          _leafletMarker.setLatLng(e.latlng);
        } else {
          _leafletMarker = L.marker(e.latlng, { draggable: true }).addTo(_leafletMap);
          _leafletMarker.on('dragend', function(ev) {
            const pos = ev.target.getLatLng();
            _pickedLat = pos.lat; _pickedLng = pos.lng;
            document.getElementById('map-coord-display').textContent =
              `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}`;
          });
        }
      });
    }

    // Jika ada koordinat awal, taruh marker
    if (_pickedLat) {
      if (_leafletMarker) {
        _leafletMarker.setLatLng([_pickedLat, _pickedLng]);
      } else {
        _leafletMarker = L.marker([_pickedLat, _pickedLng], { draggable: true }).addTo(_leafletMap);
        _leafletMarker.on('dragend', function(ev) {
          const pos = ev.target.getLatLng();
          _pickedLat = pos.lat; _pickedLng = pos.lng;
          document.getElementById('map-coord-display').textContent =
            `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}`;
        });
      }
    }
  }, 150);
}

async function searchMapLocation() {
  const q = document.getElementById('map-search-input').value.trim();
  if (!q) return;
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      { headers: { 'Accept-Language': 'id' } }
    );
    const data = await resp.json();
    if (!data.length) { Swal.fire('Info', 'Lokasi tidak ditemukan. Coba kata kunci lain.', 'info'); return; }
    const { lat, lon, display_name } = data[0];
    _pickedLat = parseFloat(lat); _pickedLng = parseFloat(lon);
    document.getElementById('map-coord-display').textContent =
      `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}`;
    _leafletMap.setView([_pickedLat, _pickedLng], 16);
    if (_leafletMarker) {
      _leafletMarker.setLatLng([_pickedLat, _pickedLng]);
    } else {
      _leafletMarker = L.marker([_pickedLat, _pickedLng], { draggable: true }).addTo(_leafletMap);
      _leafletMarker.on('dragend', function(ev) {
        const pos = ev.target.getLatLng();
        _pickedLat = pos.lat; _pickedLng = pos.lng;
        document.getElementById('map-coord-display').textContent =
          `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}`;
      });
    }
    _leafletMarker.bindPopup(display_name).openPopup();
  } catch(e) {
    Swal.fire('Error', 'Gagal mencari lokasi. Periksa koneksi internet.', 'error');
  }
}

function confirmMapCoord() {
  if (_pickedLat === null) {
    Swal.fire('Belum dipilih', 'Klik di peta atau cari lokasi terlebih dahulu.', 'warning');
    return;
  }
  const coordStr = `${_pickedLat.toFixed(6)}, ${_pickedLng.toFixed(6)}`;
  const el = document.getElementById(_mapPickerTargetId);
  if (el) el.value = coordStr;
  document.getElementById('modal-map-picker').style.display = 'none';
}

// ============================================================
// FIX Bug #5: openEditSchool — populate kecamatan juga
// ============================================================
function openEditSchool(id) {
  try {
    const school = cachedSchools.find(s => String(s.id) === String(id));
    if (!school) {
      Swal.fire('Error', 'Data sekolah tidak ditemukan', 'error');
      return;
    }

    document.getElementById("edit-school-id").value = school.id || '';
    document.getElementById("edit-school-nama").value = school.nama || '';
    document.getElementById("edit-school-status").value = school.status || '';
    document.getElementById("edit-school-username").value = school.username || '';
    document.getElementById("edit-school-npsn").value = school.npsn || '';
    document.getElementById("edit-school-admin").value = school.nama_admin || '';
    document.getElementById("edit-school-nohp").value = school.no_hp_admin || '';
    document.getElementById("edit-school-alamat").value = school.alamat || '';

  // Set koordinat jika ada
  const koordinatEl = document.getElementById("edit-school-koordinat");
  if (koordinatEl) koordinatEl.value = school.koordinat || '';

  // FIX Bug #5: Cascade timeout — populate provinsi → kab/kota → kecamatan secara berurutan
  initWilayah('edit').then(() => {
    setTimeout(() => {
      const provEl = document.getElementById("edit-school-provinsi");
      if (provEl) {
        // Set provinsi berdasarkan teks (bukan ID) karena data tersimpan sebagai nama
        for (let i = 0; i < provEl.options.length; i++) {
          if (provEl.options[i].text === school.provinsi || provEl.options[i].value === school.provinsi) {
            provEl.selectedIndex = i;
            break;
          }
        }
        provEl.dispatchEvent(new Event("change"));
      }

      setTimeout(async () => {
        const kabEl = document.getElementById("edit-school-kabkota");
        if (kabEl && typeof getKabupatenByProvinsiId === 'function') {
          const provId = document.getElementById("edit-school-provinsi")?.value;
          if (provId) {
            const kabs = await getKabupatenByProvinsiId(provId);
            kabEl.innerHTML = '<option value="">-- Pilih Kabupaten/Kota --</option>';
            kabs.forEach(kab => {
              kabEl.innerHTML += `<option value="${kab.id}">${kab.nama}</option>`;
            });
            // Set kab/kota
            for (let i = 0; i < kabEl.options.length; i++) {
              if (kabEl.options[i].text === school.kabupaten_kota || kabEl.options[i].value === school.kabupaten_kota) {
                kabEl.selectedIndex = i;
                break;
              }
            }
          }
        }

        // FIX Bug #5: Populate kecamatan — ini yang sebelumnya TIDAK ADA
        setTimeout(async () => {
          const kecEl = document.getElementById("edit-school-kecamatan");
          const kabEl = document.getElementById("edit-school-kabkota");
          if (kecEl && kabEl && typeof getKecamatanByKabupatenId === 'function') {
            const kabId = kabEl.value;
            if (kabId) {
              const kecs = await getKecamatanByKabupatenId(kabId);
              kecEl.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
              kecs.forEach(kec => {
                kecEl.innerHTML += `<option value="${kec.id}">${kec.nama}</option>`;
              });
              // Set kecamatan
              for (let i = 0; i < kecEl.options.length; i++) {
                if (kecEl.options[i].text === school.kecamatan || kecEl.options[i].value === school.kecamatan) {
                  kecEl.selectedIndex = i;
                  break;
                }
              }
              // Sync kode wilayah
              const kodeEl = document.getElementById("edit-school-kodewilayah");
              if (kodeEl) kodeEl.value = school.kode_wilayah || kecEl.value || '';
            }
          }
        }, 150);
      }, 150);
    }, 100);
  }).catch(() => {
    // fallback: tetap buka modal meskipun wilayah gagal dimuat
  });

    window.showModal("modal-edit-sekolah");
  } catch (err) {
    Swal.fire('Error', 'Gagal membuka form edit: ' + err.message, 'error');
    console.error(err);
  }
}

// ============================================================
// FIX Bug #6: openEditStaff — populate semua field termasuk tempat_lahir, tgl_lahir, pendidikan_terakhir
// ============================================================
function openEditStaff(id) {
  const staff = allPegawaiData.find(s => String(s.id) === String(id));
  if (!staff) return;

  document.getElementById("edit-staff-sekolah").value = staff.sekolah_nama || '';
  document.getElementById("edit-staff-nip").value = staff.nip || '';
  document.getElementById("edit-staff-nama").value = staff.nama || staff.nama_lengkap || '';
  document.getElementById("edit-staff-jk").value = staff.jenis_kelamin || 'Laki-laki';

  // FIX Bug #6: Populate field yang sebelumnya TIDAK diisi (terhapus setiap kali edit)
  const tempatlahirEl = document.getElementById("edit-staff-tempatlahir");
  if (tempatlahirEl) tempatlahirEl.value = staff.tempat_lahir || '';

  const tgllahirEl = document.getElementById("edit-staff-tgllahir");
  if (tgllahirEl) tgllahirEl.value = staff.tgl_lahir || '';

  const pendidikanEl = document.getElementById("edit-staff-pendidikan");
  if (pendidikanEl) pendidikanEl.value = staff.pendidikan_terakhir || '';

  document.getElementById("edit-staff-status").value = staff.status_pegawai || 'PNS';
  updatePangkatOptions('edit');

  setTimeout(() => {
    const pangkatEl = document.getElementById("edit-staff-pangkat");
    if (pangkatEl) pangkatEl.value = staff.pangkat_gol || '-';
  }, 100);

  document.getElementById("edit-staff-jabatan-sk").value = staff.jabatan_sk || staff.nama_jabatan_sk || '';
  document.getElementById("edit-staff-jabatan-tugas").value = staff.jabatan_tugas || staff.nama_jabatan_tugas || '';
  document.getElementById("edit-staff-nowa").value = staff.no_wa || '';
  document.getElementById("edit-staff-email").value = staff.email || '';

  const fotoEl = document.getElementById("edit-staff-foto");
  const editPreview = document.getElementById("preview-edit-staff-foto");
  if (editPreview) {
    if (staff.foto) {
      editPreview.src = staff.foto;
      editPreview.style.display = 'block';
    } else {
      editPreview.src = '';
      editPreview.style.display = 'none';
    }
  }
  if (fotoEl) fotoEl.value = staff.foto || '';

  // Save ID & school_id to form dataset
  const form = document.getElementById("form-edit-pegawai");
  if (form) {
    form.dataset.id = id;
    form.dataset.schoolId = staff.school_id;
  }

  window.showModal("modal-edit-pegawai");
}

// ============================================================
// Helper: loadPegawaiSekolahInline — refresh inline list setelah edit
// ============================================================
async function loadPegawaiSekolahInline(schoolId, forceRefresh = false) {
  if (typeof window.loadPegawaiSekolahInline === 'function' && window.loadPegawaiSekolahInline !== loadPegawaiSekolahInline) {
    return window.loadPegawaiSekolahInline(schoolId, forceRefresh);
  }
  if (!schoolId) { loadPegawai(forceRefresh); return; }
  try {
    const result = await fetchAPI("getStaff", { school_id: schoolId });
    if (result.status === "success") {
      allPegawaiData = result.data;
      filterPegawaiTable();
    }
  } catch(e) { console.error('[loadPegawaiSekolahInline]', e); }
}

window.openEditSchool = openEditSchool;
window.openEditStaff = openEditStaff;

