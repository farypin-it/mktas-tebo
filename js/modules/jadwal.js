// --- Logic Jadwal Bertingkat ---
// FIX Bug #7: attendanceData hanya dideklarasikan SATU KALI di sini.
// Sebelumnya ada deklarasi kosong `let attendanceData = {}` di app.js yang
// meng-override data ini. app.js tidak dipakai di dashboard.html, tapi
// komentar ini mencegah duplikasi terulang di masa depan.
let attendanceData = {};
try {
  const saved = localStorage.getItem('sim_mktas_attendance');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') attendanceData = parsed;
  }
} catch (e) {
  attendanceData = {};
  try { localStorage.removeItem('sim_mktas_attendance'); } catch (removeErr) {}
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

let currentKehadiranPage = 1;
let filteredKehadiranData = [];
const KEHADIRAN_PER_PAGE = 10;

function showJadwalView(viewId) {
  document.getElementById("jadwal-view-tahun").classList.add("hidden");
  document.getElementById("jadwal-view-tabel").classList.add("hidden");
  document.getElementById("jadwal-view-detail").classList.add("hidden");
  document.getElementById(`jadwal-view-${viewId}`).classList.remove("hidden");
}

function renderYearGrid(schedules) {
  const years = [...new Set((schedules || []).map(item => item.tahun).filter(Boolean))].sort().reverse();
  const btnAddYear = document.getElementById('btn-add-year-ui');
  if (btnAddYear) {
    btnAddYear.style.display = (currentUser && currentUser.role === 'Sekolah') ? 'none' : '';
  }

  let html = "";
  years.forEach(tahun => {
    html += `
      <div class="card glass-panel" style="text-align: center; cursor: pointer;" onclick="loadJadwalByTahun('${tahun}')">
        <h2 style="font-size: 2.5rem; color: var(--primary-color);">${tahun}</h2>
        <p style="color: var(--text-muted); margin-top: 10px;">Lihat Jadwal</p>
      </div>
    `;
  });
  if (years.length > 0) {
    document.getElementById("grid-tahun").innerHTML = html;
  }
}

async function loadJadwal() {
  document.getElementById("loader-tahun").classList.add("hidden");
  showJadwalView("tahun");

  // Stale-While-Revalidate: Tampilkan tahun jadwal seketika dari cache (0 ms)!
  const localSchedules = (typeof safeReadJsonStorage === 'function') ? safeReadJsonStorage('mktas_schedules', []) : [];
  if (localSchedules && localSchedules.length > 0) {
    allSchedules = localSchedules;
    renderYearGrid(allSchedules);
  } else {
    document.getElementById("grid-tahun").innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 45px;"><div class="loader"></div><div style="margin-top: 12px; color: var(--text-muted); font-size: 0.9rem;">Memuat daftar tahun jadwal...</div></div>';
  }

  try {
    const result = await fetchAPI("getSchedules");

    if (result.status === "success" && Array.isArray(result.data)) {
      allSchedules = result.data;
      try { localStorage.setItem('mktas_schedules', JSON.stringify(allSchedules)); } catch(e) {}
      renderYearGrid(allSchedules);
    }
  } catch (err) {}
  document.getElementById("loader-tahun").classList.add("hidden");
}

let currentJadwalPage = 1;
let filteredJadwalData = [];
const JADWAL_PER_PAGE = 5;

function sortSchedulesNewestFirst(items) {
  return [...items].sort((a, b) => {
    const valA = a && a.tanggal ? new Date(a.tanggal).getTime() : 0;
    const valB = b && b.tanggal ? new Date(b.tanggal).getTime() : 0;
    if (Number.isNaN(valA) && Number.isNaN(valB)) return 0;
    if (Number.isNaN(valA)) return 1;
    if (Number.isNaN(valB)) return -1;
    return valB - valA;
  });
}

function loadJadwalByTahun(tahun) {
  currentJadwalTahun = tahun;
  document.getElementById("judul-tabel-jadwal").innerText = `Jadwal Tahun ${tahun}`;
  showJadwalView("tabel");
  
  filterJadwal();
}

function filterJadwal() {
  const searchInput = document.getElementById("search-jadwal");
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  
  const schedulesByYear = sortSchedulesNewestFirst(
    allSchedules.filter(item => item.tahun == currentJadwalTahun)
  );
  filteredJadwalData = schedulesByYear.filter(item => {
    return (item.sekolah && item.sekolah.toLowerCase().includes(search));
  });
  
  currentJadwalPage = 1;
  renderJadwalTable();
}

function changeJadwalPage(step) {
  const totalPages = Math.ceil(filteredJadwalData.length / JADWAL_PER_PAGE) || 1;
  currentJadwalPage += step;
  
  if(currentJadwalPage < 1) currentJadwalPage = 1;
  if(currentJadwalPage > totalPages) currentJadwalPage = totalPages;
  
  renderJadwalTable();
}

function renderJadwalTable() {
  const tbody = document.querySelector("#table-jadwal tbody");
  const textPage = document.getElementById("text-jadwal-page");
  if(!tbody) return;

  const isMobile = window.innerWidth <= 768;
  const totalPages = Math.ceil(filteredJadwalData.length / JADWAL_PER_PAGE) || 1;
  if(textPage) textPage.innerText = `Page ${currentJadwalPage} of ${totalPages}`;

  const btnPrev = document.getElementById("btn-jadwal-prev");
  const btnNext = document.getElementById("btn-jadwal-next");
  if(btnPrev) btnPrev.disabled = (currentJadwalPage === 1);
  if(btnNext) btnNext.disabled = (currentJadwalPage === totalPages);

  const startIdx = (currentJadwalPage - 1) * JADWAL_PER_PAGE;
  const endIdx = startIdx + JADWAL_PER_PAGE;
  const paginatedData = filteredJadwalData.slice(startIdx, endIdx);

  let html = "";
  if(paginatedData.length === 0) {
    html = `<tr><td colspan="5" style="text-align: center;">Tidak ada jadwal ditemukan</td></tr>`;
  } else {
    paginatedData.forEach((item) => {
      let actionBtns = '';
      if (currentUser.role === "Superadmin" || currentUser.role === "Admin") {
        actionBtns += `
          <button class="btn btn-sm btn-outline" onclick="openEditSchedule('${item.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSchedule('${item.id}')">Hapus</button>
        `;
      }
      if (currentUser.role === "Sekolah") {
          if (item.keterangan === "Terlaksana") {
              actionBtns += ` <button class="btn btn-sm btn-info" onclick="bukaDaftarHadirSekolah('${item.id}')"><i class="fas fa-eye"></i> Lihat Presensi</button>`;
          } else {
              actionBtns += ` <button class="btn btn-sm btn-primary" onclick="bukaDaftarHadirSekolah('${item.id}')"><i class="fas fa-clipboard-check"></i> Isi Presensi</button>`;
          }
      } else {
          actionBtns += ` <button class="btn btn-sm btn-primary" onclick="openJadwalDetail('${item.id}')">Lihat</button>`;
      }

      const formatBulan = (b) => {
        const map = {'01':'Januari','1':'Januari','02':'Februari','2':'Februari','03':'Maret','3':'Maret','04':'April','4':'April','05':'Mei','5':'Mei','06':'Juni','6':'Juni','07':'Juli','7':'Juli','08':'Agustus','8':'Agustus','09':'September','9':'September','10':'Oktober','11':'November','12':'Desember'};
        return map[b] || b;
      };
      const bulanTahun = item.bulan && item.tahun ? `${formatBulan(item.bulan)} ${item.tahun}` : '-';
      const tanggal = item.tanggal ? new Date(item.tanggal).toLocaleDateString("id-ID") : '-';
      const sekolah = item.sekolah || '-';
      const keterangan = item.keterangan || '-';

      if (isMobile) {
        html += `<tr>
                    <td><b>${sekolah}</b></td>
                    <td>${bulanTahun}</td>
                    <td>${tanggal}</td>
                    <td>${keterangan}</td>
                    <td style="white-space:nowrap;">${actionBtns}</td>
                </tr>`;
      } else {
        html += `<tr>
                    <td>${bulanTahun}</td>
                    <td><b>${sekolah}</b></td>
                    <td>${tanggal}</td>
                    <td>${keterangan}</td>
                    <td style="white-space:nowrap;">${actionBtns}</td>
                </tr>`;
      }
    });
  }
  tbody.innerHTML = html;

  const thead = document.querySelector('#table-jadwal thead tr');
  if (thead) {
    const headers = Array.from(thead.children);
    if (isMobile) {
      headers.forEach((th, index) => {
        const label = ['Tuan Rumah', 'Bulan', 'Tanggal', 'Keterangan', 'Aksi'][index];
        if (label) th.textContent = label;
      });
    } else {
      headers.forEach((th, index) => {
        const label = ['Bulan', 'Tuan Rumah', 'Tanggal', 'Keterangan', 'Aksi'][index];
        if (label) th.textContent = label;
      });
    }
  }
}

async function bukaDaftarHadirSekolah(jadwalId) {
  const schedule = allSchedules.find(item => item.id == jadwalId) || {};
  currentJadwalContext = schedule;
  
  // Buka modal presensi langsung seketika (0 ms)!
  openKehadiranPegawai(currentUser.school_id, currentUser.nama || 'Sekolah Anda');

  // Background fetch status kehadiran
  try {
    const res = await fetchAPI('getAttendance', { jadwal_id: jadwalId });
    if (res.status === 'success' && res.data) {
      attendanceData[jadwalId] = Object.assign({}, res.data);
      try { localStorage.setItem('sim_mktas_attendance', JSON.stringify(attendanceData)); } catch(e) {}
    }
  } catch(e) {}
}

async function openJadwalDetail(jadwalId) {
  showJadwalView("detail");
  const schedule = allSchedules.find(item => item.id == jadwalId) || {};
  currentJadwalContext = schedule;
  document.getElementById("judul-detail-jadwal").innerText = `Detail Pelaksanaan - ${schedule.sekolah || ''}`;
  
  const tbody = document.querySelector("#table-kehadiran tbody");
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-loading-cell"><div class="loader"></div><div>Memuat status kehadiran...</div></td></tr>';
  }

  // Jalankan paralel agar jauh lebih cepat
  try {
    const [_, res] = await Promise.all([
      ensureSchoolsLoaded(),
      fetchAPI('getAttendance', { jadwal_id: jadwalId })
    ]);
    if (res && res.status === 'success' && res.data) {
      attendanceData[jadwalId] = Object.assign({}, res.data);
      try { localStorage.setItem('sim_mktas_attendance', JSON.stringify(attendanceData)); } catch(e) {}
    }
  } catch(e) { /* offline atau gagal, pakai localStorage */ }
  
  filterKehadiran();
}

function filterKehadiran() {
  const searchInput = document.getElementById("search-kehadiran");
  const filterStatus = document.getElementById("filter-kehadiran-status");
  
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  const status = filterStatus ? filterStatus.value : "all";

  // FIX BUG: Akun Sekolah hanya tampilkan sekolahnya sendiri
  const baseList = (currentUser && currentUser.role === 'Sekolah')
    ? cachedSchools.filter(s => String(s.id) === String(currentUser.school_id))
    : cachedSchools;
  
  filteredKehadiranData = baseList.filter(school => {
    const isPresent = (attendanceData[currentJadwalContext.id] && attendanceData[currentJadwalContext.id][school.id]) === true;
    
    const matchSearch = school.nama && school.nama.toLowerCase().includes(search);
    let matchStatus = true;
    if (status === "hadir") matchStatus = isPresent;
    if (status === "tidak_hadir") matchStatus = !isPresent;
    
    return matchSearch && matchStatus;
  });
  
  currentKehadiranPage = 1;
  renderKehadiranTable();
}

function changeKehadiranPage(step) {
  const totalPages = Math.ceil(filteredKehadiranData.length / KEHADIRAN_PER_PAGE) || 1;
  currentKehadiranPage += step;
  
  if(currentKehadiranPage < 1) currentKehadiranPage = 1;
  if(currentKehadiranPage > totalPages) currentKehadiranPage = totalPages;
  
  renderKehadiranTable();
}

function renderKehadiranTable() {
  const tbody = document.querySelector("#table-kehadiran tbody");
  const textPage = document.getElementById("text-kehadiran-page");
  if(!tbody) return;
  
  const totalPages = Math.ceil(filteredKehadiranData.length / KEHADIRAN_PER_PAGE) || 1;
  if(textPage) textPage.innerText = `Page ${currentKehadiranPage} of ${totalPages}`;
  
  const btnPrev = document.getElementById("btn-kehadiran-prev");
  const btnNext = document.getElementById("btn-kehadiran-next");
  if(btnPrev) btnPrev.disabled = (currentKehadiranPage === 1);
  if(btnNext) btnNext.disabled = (currentKehadiranPage === totalPages);
  
  const startIdx = (currentKehadiranPage - 1) * KEHADIRAN_PER_PAGE;
  const endIdx = startIdx + KEHADIRAN_PER_PAGE;
  const paginatedData = filteredKehadiranData.slice(startIdx, endIdx);
  
  let html = "";
  if(paginatedData.length === 0) {
    html = `<tr><td colspan="3" style="text-align: center;">Tidak ada kehadiran ditemukan</td></tr>`;
  } else {
    paginatedData.forEach(school => {
      const isPresent = (attendanceData[currentJadwalContext.id] && attendanceData[currentJadwalContext.id][school.id]) === true;
      const badge = isPresent 
        ? '<span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Hadir</span>' 
        : '<span style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Tidak Hadir</span>';

      html += `
        <tr>
          <td><b>${school.nama}</b></td>
          <td style="text-align: center;">${badge}</td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-info" onclick="openKehadiranPegawai('${school.id}', '${school.nama}')">Lihat Pegawai</button>
          </td>
        </tr>
      `;
    });
  }
  tbody.innerHTML = html;
}

async function openKehadiranPegawai(schoolId, schoolName) {
  currentKehadiranSchoolId = schoolId;
  const modal = document.getElementById("modal-kehadiran-pegawai");
  const loader = document.getElementById("loader-kehadiran-pegawai");
  document.getElementById("modal-kehadiran-title").innerText = `Kehadiran Pegawai - ${schoolName}`;
  window.showModal(modal);
  modal.classList.add("loading");
  modal.style.zIndex = '12000';
  loader.classList.remove("hidden");
  loader.style.display = 'block';
  loader.style.position = 'fixed';
  loader.style.left = '50%';
  loader.style.top = '50%';
  loader.style.transform = 'translate(-50%, -50%)';
  loader.style.zIndex = '2147483647';
  loader.style.pointerEvents = 'none';
  document.querySelector("#table-kehadiran-pegawai tbody").innerHTML = "";

  const isReadOnly = (currentUser && currentUser.role === 'Sekolah' && currentJadwalContext && currentJadwalContext.keterangan === 'Terlaksana');

  // Banner status terkunci
  let noticeEl = document.getElementById("notice-kehadiran-pegawai");
  if (!noticeEl) {
    const descP = document.querySelector("#modal-kehadiran-pegawai .modal-content > p");
    if (descP) {
      noticeEl = document.createElement("div");
      noticeEl.id = "notice-kehadiran-pegawai";
      descP.parentNode.insertBefore(noticeEl, descP.nextSibling);
    }
  }
  if (noticeEl) {
    if (isReadOnly) {
      noticeEl.innerHTML = `
        <div style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 10px 14px; border-radius: 8px; margin-bottom: 15px; font-size: 0.88rem; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-lock" style="font-size: 1.1rem; color: #d97706;"></i>
          <span>Jadwal ini berstatus <b>Terlaksana</b>. Presensi kehadiran telah dikunci dan hanya dapat dilihat (tidak dapat diubah lagi).</span>
        </div>
      `;
    } else {
      noticeEl.innerHTML = '';
    }
  }

  // Sembunyikan atau tampilkan tombol simpan
  const btnSimpan = document.querySelector("#modal-kehadiran-pegawai button[onclick='simpanKehadiranPegawai()']");
  if (btnSimpan) {
    btnSimpan.style.display = isReadOnly ? 'none' : 'inline-block';
  }

  try {
    const result = await fetchAPI('getStaff', { school_id: schoolId });

    if (result.status === "success") {
      let html = "";
      const hasAttended = (attendanceData[currentJadwalContext.id] && attendanceData[currentJadwalContext.id][schoolId]) === true;
      const attendanceForSchedule = attendanceData[currentJadwalContext.id] || {};
      const staffListKey = 'staff_' + schoolId;
      const hasStaffList = Object.prototype.hasOwnProperty.call(attendanceForSchedule, staffListKey);
      const attendedStaffList = Array.isArray(attendanceForSchedule[staffListKey])
        ? attendanceForSchedule[staffListKey]
        : [];
      
      result.data.forEach((item, index) => {
        let isChecked = false;
        if (Array.isArray(attendedStaffList) && attendedStaffList.length > 0) {
          isChecked = attendedStaffList.some(sid => String(sid) === String(item.id));
        } else if (hasAttended && !hasStaffList && index === 0) {
          // Fallback untuk data lama yang belum menyimpan daftar ID pegawai
          isChecked = true;
        }
        const namaStaff = item.nama_lengkap || item.nama || '-';
        const jabatanStaff = item.nama_jabatan_tugas || item.jabatan_tugas || item.jabatan || '-';
        const disabledAttr = isReadOnly ? 'disabled' : '';
        
        const bgColor = isChecked ? '#10b981' : '#ef4444';
        const colorStyle = `background-color: ${bgColor}; color: white; font-weight: bold; width: 100%; height: 35px; cursor: pointer;`;
        
        html += `<tr>
                    <td style="vertical-align: middle;">
                      <b>${namaStaff}</b>
                      <span class="jabatan-mobile-inline" style="display:none; font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${jabatanStaff}</span>
                    </td>
                    <td class="jabatan-desktop-col" style="vertical-align: middle;"><span style="background: var(--bg-gradient-end); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${jabatanStaff}</span></td>
                    <td style="text-align: center; vertical-align: middle; width: 150px;">
                      <select class="chk-kehadiran form-control" data-staff-id="${item.id}" ${disabledAttr} style="padding: 4px; font-size: 0.9rem; border-radius: 4px; text-align: center; ${colorStyle}" onchange="this.style.backgroundColor = this.value === '1' ? '#10b981' : '#ef4444'">
                        <option value="0" ${!isChecked ? 'selected' : ''} style="background-color: #ef4444; color: white;">Tidak Hadir</option>
                        <option value="1" ${isChecked ? 'selected' : ''} style="background-color: #10b981; color: white;">Hadir</option>
                      </select>
                    </td>
                </tr>`;
      });
      if (result.data.length === 0) {
        html = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">Belum ada pegawai terdaftar untuk sekolah ini.</td></tr>`;
      }
      document.querySelector("#table-kehadiran-pegawai tbody").innerHTML = html;
    }
  } catch (err) {
    console.error('[Kehadiran Pegawai] Error:', err);
  }
  modal.classList.remove("loading");
  loader.classList.add("hidden");
  loader.style.display = 'none';
  loader.style.zIndex = '1';
}

async function simpanKehadiranPegawai() {
  if (currentUser && currentUser.role === 'Sekolah' && currentJadwalContext && currentJadwalContext.keterangan === 'Terlaksana') {
    Swal.fire('Terkunci', 'Jadwal yang sudah terlaksana tidak dapat diubah daftar hadirnya.', 'warning');
    return;
  }

  const selects = document.querySelectorAll(".chk-kehadiran");
  let anyChecked = false;
  const checkedStaffIds = [];
  selects.forEach(sel => {
    if(sel.value === "1") {
      anyChecked = true;
      if (sel.dataset.staffId) {
        checkedStaffIds.push(sel.dataset.staffId);
      }
    }
  });

  if(currentKehadiranSchoolId && currentJadwalContext) {
    if (!attendanceData[currentJadwalContext.id]) attendanceData[currentJadwalContext.id] = {};
    attendanceData[currentJadwalContext.id][currentKehadiranSchoolId] = anyChecked;
    attendanceData[currentJadwalContext.id]['staff_' + currentKehadiranSchoolId] = checkedStaffIds;
    // Simpan ke localStorage
    try { localStorage.setItem('sim_mktas_attendance', JSON.stringify(attendanceData)); } catch(e) {}
    // Simpan ke SQLite (offline) / Google Sheets (online)
    const saveResult = await fetchAPI('saveAttendance', {
      jadwal_id: currentJadwalContext.id,
      school_id: currentKehadiranSchoolId,
      status: anyChecked,
      staff_ids: checkedStaffIds
    }).catch(e => ({ status: 'error', message: e.message || 'Gagal menyimpan kehadiran.' }));

    if (!saveResult || saveResult.status !== 'success') {
      Swal.fire('Gagal Menyimpan', saveResult?.message || 'Data kehadiran gagal disimpan.', 'error');
      return;
    }
  }

  if(currentJadwalContext) {
    openJadwalDetail(currentJadwalContext.id);
  }

  window.closeModal('modal-kehadiran-pegawai');
  Swal.fire(`Status kehadiran sekolah berhasil diperbarui menjadi: ${anyChecked ? 'Hadir' : 'Tidak Hadir'}`);
}

function bukaPratinjauPDF() {
  const modalPdf = document.getElementById("modal-cetak-pdf");
  if(!modalPdf) return;
  
  if(currentJadwalContext) {
    const infoStr = `Tahun: ${currentJadwalContext.tahun} | Bulan: ${currentJadwalContext.bulan} | Tuan Rumah: ${currentJadwalContext.sekolah}`;
    document.getElementById("pdf-jadwal-info").innerText = infoStr;
  }

  const tbody = document.getElementById("pdf-table-body");
  tbody.innerHTML = "";
  
  let count = 1;
  cachedSchools.forEach(school => {
    if((attendanceData[currentJadwalContext.id] && attendanceData[currentJadwalContext.id][school.id]) === true) {
      tbody.innerHTML += `
        <tr>
          <td style="text-align: center;">${count++}</td>
          <td><b>${school.nama}</b></td>
          <td style="text-align: center;">Hadir</td>
        </tr>
      `;
    }
  });

  if(count === 1) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Belum ada sekolah yang hadir</td></tr>`;
  }

  currentPdfZoom = 1;
  document.getElementById("pdf-page-content").style.transform = `scale(1)`;
  window.showModal(modalPdf);
}

function zoomPDF(step) {
  currentPdfZoom += step;
  if(currentPdfZoom < 0.5) currentPdfZoom = 0.5;
  if(currentPdfZoom > 2) currentPdfZoom = 2;
  document.getElementById("pdf-page-content").style.transform = `scale(${currentPdfZoom})`;
}

// --- Logic Laporan ---
function showLaporanView(viewId) {
  document.getElementById("laporan-view-tabel").classList.add("hidden");
  document.getElementById("laporan-view-detail").classList.add("hidden");
  document.getElementById(`laporan-view-${viewId}`).classList.remove("hidden");
}

let currentLaporanPage = 1;
let filteredLaporanData = [];
const LAPORAN_PER_PAGE = 10;
let allLaporanData = [];
async function loadLaporan() {
  document.getElementById("loader-laporan").classList.add("hidden");
  document.querySelector("#table-laporan tbody").innerHTML = '<tr><td colspan="5" class="table-loading-cell"><div class="loader"></div><div>Memuat data laporan kegiatan...</div></td></tr>';
  showLaporanView("tabel");

  try {
    const result = await fetchAPI('getSchedules');

    if (result.status === "success") {
      allLaporanData = result.data;
      
      // Populate unique years in filter dropdown
      const filterTahun = document.getElementById("filter-laporan-tahun");
      if(filterTahun) {
        const uniqueYears = [...new Set(allLaporanData.map(item => item.tahun))];
        let optionsHtml = '<option value="">Semua Tahun</option>';
        uniqueYears.sort((a,b)=>b-a).forEach(yr => optionsHtml += `<option value="${yr}">${yr}</option>`);
        filterTahun.innerHTML = optionsHtml;
      }
      
      filterLaporan();
    } else {
      document.querySelector("#table-laporan tbody").innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat laporan.</td></tr>`;
    }
  } catch (err) {
    console.error('[Laporan] Error:', err);
    document.querySelector("#table-laporan tbody").innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat laporan.</td></tr>`;
  }
  document.getElementById("loader-laporan").classList.add("hidden");
}

function filterLaporan() {
  const filterTahun = document.getElementById("filter-laporan-tahun");
  const filterBulan = document.getElementById("filter-laporan-bulan");
  
  const tahun = filterTahun ? filterTahun.value : "";
  const bulan = filterBulan ? filterBulan.value : "";
  
  // Laporan hanya menampilkan jadwal yang sudah terlaksana
  filteredLaporanData = sortSchedulesNewestFirst(
    allLaporanData.filter(item => {
      const isTerlaksana = item.keterangan === 'Terlaksana';
      const matchTahun = tahun === "" || item.tahun == tahun;
      const matchBulan = bulan === "" || item.bulan === bulan;
      return isTerlaksana && matchTahun && matchBulan;
    })
  );
  
  currentLaporanPage = 1;
  renderLaporanTable();
}

function changeLaporanPage(step) {
  const totalPages = Math.ceil(filteredLaporanData.length / LAPORAN_PER_PAGE) || 1;
  currentLaporanPage += step;
  
  if(currentLaporanPage < 1) currentLaporanPage = 1;
  if(currentLaporanPage > totalPages) currentLaporanPage = totalPages;
  
  renderLaporanTable();
}

function renderLaporanTable() {
  const tbody = document.querySelector("#table-laporan tbody");
  const textPage = document.getElementById("text-laporan-page");
  if(!tbody) return;
  
  const totalPages = Math.ceil(filteredLaporanData.length / LAPORAN_PER_PAGE) || 1;
  if(textPage) textPage.innerText = `Page ${currentLaporanPage} of ${totalPages}`;
  
  const btnPrev = document.getElementById("btn-laporan-prev");
  const btnNext = document.getElementById("btn-laporan-next");
  if(btnPrev) btnPrev.disabled = (currentLaporanPage === 1);
  if(btnNext) btnNext.disabled = (currentLaporanPage === totalPages);
  
  const startIdx = (currentLaporanPage - 1) * LAPORAN_PER_PAGE;
  const endIdx = startIdx + LAPORAN_PER_PAGE;
  const paginatedData = filteredLaporanData.slice(startIdx, endIdx);
  
  let html = "";
  if(paginatedData.length === 0) {
    html = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Belum ada jadwal terlaksana / sesuai filter.</td></tr>`;
  } else {
    paginatedData.forEach((item) => {
      html += `<tr>
                  <td>${item.tahun}</td>
                  <td>${item.bulan}</td>
                  <td><b>${item.sekolah}</b></td>
                  <td>${new Date(item.tanggal).toLocaleDateString("id-ID")}</td>
                  <td style="text-align: center;">
                    <button class="btn btn-sm btn-primary" onclick="openLaporanDetail('${item.id}')">Lihat Laporan</button>
                  </td>
              </tr>`;
    });
  }
  tbody.innerHTML = html;
}

function switchLaporanTab(tabId, btn) {
  const nav = btn.parentElement;
  nav.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('laporan-tab-rekap').style.display = 'none';
  document.getElementById('laporan-tab-rekap').classList.remove('active');
  document.getElementById('laporan-tab-dokumen').style.display = 'none';
  document.getElementById('laporan-tab-dokumen').classList.remove('active');

  const target = document.getElementById('laporan-tab-' + tabId);
  target.style.display = 'block';
  target.classList.add('active');
}

function formatTanggalKegiatan(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getLaporanRekapRows() {
  let attendedSchools = [];
  const attendedStaffIds = new Set();
  let hasStaffLists = false;
  if (attendanceData[currentJadwalContext.id]) {
    const scheduleAttendance = attendanceData[currentJadwalContext.id];
    attendedSchools = Object.keys(scheduleAttendance).filter(k => !k.startsWith('staff_') && scheduleAttendance[k] === true);
    Object.keys(scheduleAttendance).forEach(key => {
      if (key.startsWith('staff_')) {
        hasStaffLists = true;
      }
      if (key.startsWith('staff_') && Array.isArray(scheduleAttendance[key])) {
        scheduleAttendance[key].forEach(id => attendedStaffIds.add(String(id)));
      }
    });
  }

  if (attendedSchools.length === 0) return [];

  return allPegawaiData.filter(p => {
    if (hasStaffLists) return attendedStaffIds.has(String(p.id));
    return attendedSchools.includes(String(p.school_id));
  });
}

function renderLaporanRekapMeta() {
  const sekolahEl = document.getElementById('laporan-rekap-sekolah');
  const tanggalEl = document.getElementById('laporan-rekap-tanggal');
  if (!sekolahEl || !tanggalEl) return;

  const sekolah = currentJadwalContext && (currentJadwalContext.sekolah || currentJadwalContext.nama_sekolah || 'Tidak ada data');
  const tanggal = currentJadwalContext && currentJadwalContext.tanggal ? formatTanggalKegiatan(currentJadwalContext.tanggal) : '-';

  sekolahEl.textContent = sekolah;
  tanggalEl.textContent = tanggal;
}

function bukaPratinjauRekapPDF() {
  const modalPdf = document.getElementById('modal-cetak-pdf');
  if (!modalPdf) return;

  const settings = safeReadJsonStorage('mktas_settings', {});
  const forumName = settings.nama_forum || 'Forum MKTAS';
  const forumShort = settings.singkatan_forum || 'MKTAS';
  const wilayah = settings.wilayah || 'Wilayah Kab/Kota & Provinsi';
  const alamat = settings.alamat || '-';
  const email = settings.email || '-';
  const website = settings.website || '-';
  const telp = settings.telp || settings.kontak_wa || settings.no_hp || '-';
  const logoSrc = settings.logo_forum || '';
  const kegiatanNama = 'Musyawarah Kerja Tenaga Administrasi Sekolah';
  const sekolahTuanRumah = currentJadwalContext && (currentJadwalContext.sekolah || currentJadwalContext.nama_sekolah || 'Nama Sekolah Tuan Rumah');
  const tanggalKegiatan = currentJadwalContext && currentJadwalContext.tanggal ? formatTanggalKegiatan(currentJadwalContext.tanggal) : '-';
  const rows = getLaporanRekapRows();

  const tableRows = rows.length
    ? rows.map((p, idx) => `
        <tr>
          <td style="text-align:center; padding: 8px 4px; border: 1px solid #222;">${idx + 1}</td>
          <td style="padding: 8px 6px; border: 1px solid #222; line-height: 1.4;">
            <div style="font-weight: bold;">${p.nama || p.nama_lengkap || '-'}</div>
            <div style="font-size: 10px; color: #222; margin-top: 2px;">NIP: ${p.nip || '-'}</div>
          </td>
          <td style="padding: 8px 6px; border: 1px solid #222;">${p.nama_jabatan_sk || p.jabatan_sk || p.jabatan || '-'}</td>
          <td style="padding: 8px 6px; border: 1px solid #222;">${p.sekolah_nama || '-'}</td>
          <td style="padding: 8px 6px; border: 1px solid #222; width: 80px; text-align: center;">&nbsp;</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="padding: 10px; text-align: center; border: 1px solid #222;">Belum ada data kehadiran.</td></tr>`;

  const ketuaNama = (window.currentUser && (window.currentUser.nama_admin || window.currentUser.nama || window.currentUser.username)) || 'Ketua MKTAS';
  const ketuaNip = (window.currentUser && (window.currentUser.nip || window.currentUser.nik || '-')) || '-';
  const sekretarisNama = 'Sekretaris';
  const sekretarisNip = '-';

  document.getElementById('pdf-page-content').innerHTML = `
    <div style="font-family: 'Times New Roman', serif; color: #111; width: 100%; min-height: 100%;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; margin-bottom: 18px; text-align: center;">
        <div style="width: 62px; height: 62px; border-radius: 10px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid #ddd;">
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo Forum" style="width: 100%; height: 100%; object-fit: contain;" />` : `<span style="font-size: 1.1rem; font-weight: bold; color: #111;">${forumShort.slice(0, 3).toUpperCase()}</span>`}
        </div>
        <div style="line-height: 1.25; text-align: center; flex: 1;">
          <div style="font-size: 14px; font-weight: bold; margin: 0;">${forumName}</div>
          <div style="display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 16px; font-weight: bold; margin-top: 4px;">
            <span>${forumShort}</span>
            <span>${wilayah}</span>
          </div>
          <div style="font-size: 9px; color: #333; margin-top: 4px;">${alamat}</div>
          <div style="font-size: 9px; color: #333;">${email} | ${website} | ${telp}</div>
        </div>
      </div>

      <div style="margin-top: 10px; margin-bottom: 16px; font-size: 12px; line-height: 1.5;">
        <div><strong>Nama Kegiatan:</strong> ${kegiatanNama}</div>
        <div><strong>Tempat Kegiatan:</strong> ${sekolahTuanRumah}</div>
        <div><strong>Waktu Kegiatan:</strong> ${tanggalKegiatan}</div>
      </div>

      <div style="font-weight: bold; text-align: center; margin: 12px 0 10px; font-size: 14px; text-transform: uppercase;">Daftar Kehadiran</div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #222; font-size: 11px; margin-top: 8px;">
        <thead>
          <tr>
            <th style="border: 1px solid #222; padding: 8px 4px; width: 40px; text-align: center;">No</th>
            <th style="border: 1px solid #222; padding: 8px 6px; text-align: center;">Nama</th>
            <th style="border: 1px solid #222; padding: 8px 6px; text-align: center;">Jabatan SK</th>
            <th style="border: 1px solid #222; padding: 8px 6px; text-align: center;">Nama Sekolah</th>
            <th style="border: 1px solid #222; padding: 8px 6px; text-align: center; width: 80px;">Paraf</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top: 28px; text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 0.04em;">PENGURUS ${forumName.toUpperCase()}</div>
      <div style="font-size: 11px; text-align: center; margin-top: 4px;">${wilayah}</div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 26px; font-size: 12px;">
        <div style="width: 45%; text-align: center;">
          <div style="font-weight: bold; margin-bottom: 6px;">Ketua</div>
          <div style="margin-top: 36px;">Ttd</div>
          <div style="margin-top: 8px; font-weight: bold;">${ketuaNama}</div>
          <div style="font-size: 10px;">${ketuaNip}</div>
        </div>
        <div style="width: 45%; text-align: center;">
          <div style="font-weight: bold; margin-bottom: 6px;">Sekretaris</div>
          <div style="margin-top: 36px;">Ttd</div>
          <div style="margin-top: 8px; font-weight: bold;">${sekretarisNama}</div>
          <div style="font-size: 10px;">${sekretarisNip}</div>
        </div>
      </div>
    </div>
  `;

  const title = document.querySelector('#modal-cetak-pdf .pdf-toolbar h3');
  if (title) title.textContent = 'Rekap Kehadiran PDF';

  currentPdfZoom = 1;
  document.getElementById('pdf-page-content').style.transform = 'scale(1)';
  modalPdf.classList.add('active');
}

async function openLaporanDetail(jadwalId) {
  showLaporanView("detail");
  currentJadwalContext = allSchedules.find(item => item.id == jadwalId) || {};
  document.getElementById("judul-laporan-detail").innerText = `Detail Laporan (ID: ${jadwalId})`;
  
  // Activate rekap tab by default
  const nav = document.querySelector('#laporan-view-detail .tabs-nav');
  if(nav) {
    const firstTab = nav.querySelector('button');
    if(firstTab) switchLaporanTab('rekap', firstTab);
  }
  
  await ensureSchoolsLoaded();
  await loadPegawai(); // Ensure allPegawaiData is loaded

  const tbody = document.querySelector("#table-laporan-rekap tbody");
  let html = "";
  
  const attendingStaff = getLaporanRekapRows();
  if (attendingStaff.length === 0) {
    html = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Belum ada sekolah yang hadir pada jadwal ini.</td></tr>`;
  } else {
    attendingStaff.forEach(p => {
      html += `
        <tr>
          <td><b>${p.nama || p.nama_lengkap || '-'}</b><br><small style="color: var(--text-muted);">NIP: ${p.nip || '-'}</small></td>
          <td><span style="background: var(--bg-gradient-end); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${p.nama_jabatan_tugas || p.jabatan_tugas || p.jabatan || '-'}</span></td>
          <td>${p.sekolah_nama || '-'}</td>
          <td style="text-align: center;">
            <span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Hadir</span>
          </td>
        </tr>
      `;
    });
  }
  tbody.innerHTML = html;
  renderLaporanRekapMeta();
  
  // Render daftar dokumen (dari localStorage, persistent)
  if (typeof renderDokumenList === 'function') {
    renderDokumenList(jadwalId);
  }
}



// -----------------------------------------
// FIX deleteSchedule — kembali ke jadwal tahun yang sedang dilihat
// Sebelumnya memanggil loadJadwal() yang kembali ke layar pilih tahun
// -----------------------------------------
async function deleteSchedule(id) {
  const result = await Swal.fire({
    title: 'Hapus Jadwal?',
    text: "Data ini akan dihapus secara permanen!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444'
  });
  if (result.isConfirmed) {
    const res = await fetchAPI("deleteSchedule", { id });
    if (res.status === "success") {
      Swal.fire({ icon: 'success', title: 'Dihapus!', text: res.message, timer: 1800, showConfirmButton: false });
      // FIX: kembali ke tabel jadwal tahun yang sedang dilihat, bukan ke layar pilih tahun
      if (currentJadwalTahun) {
        loadJadwalByTahun(currentJadwalTahun);
      } else {
        loadJadwal();
      }
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  }
}