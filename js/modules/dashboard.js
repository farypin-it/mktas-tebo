// --- Dashboard Logic ---
let currentUser = null;
let cachedSchools = safeReadJsonStorage('mktas_schools', []);
let allSchedules = safeReadJsonStorage('mktas_schedules', []);

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

function validateStaffBirthDate(value) {
  const date = String(value || '').trim();
  if (!date) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear ? date : null;
}

function safelyToggleHidden(el, show) {
  if (!el) return;
  if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function ifElementExists(id, callback) {
  const el = document.getElementById(id);
  if (el && typeof callback === 'function') callback(el);
}

function initDashboard() {
  const userStr = localStorage.getItem("mktas_user");
  if (!userStr) {
    window.location.href = "login.html";
    return;
  }

  try {
    const parsed = JSON.parse(userStr);
    currentUser = parsed && typeof parsed === 'object' ? parsed : null;
    if (!currentUser) throw new Error('Session user is empty');
  } catch (e) {
    console.warn('[dashboard] Session user is invalid, clearing cache.');
    try { localStorage.removeItem('mktas_user'); } catch (removeErr) {}
    window.location.href = "login.html";
    return;
  }

  if (!currentUser || !currentUser.session_token) {
    localStorage.removeItem('mktas_user');
    window.location.href = "login.html";
    return;
  }

  window.currentUser = currentUser;

  // Jika akun masih menggunakan password default, kembalikan ke halaman login untuk ubah password terlebih dahulu
  if (currentUser.is_default_password === true) {
    window.location.href = "login.html";
    return;
  }

  // Initialize Pangkat options once
  updatePangkatOptions('add');
  updatePangkatOptions('edit');

  // Load pengaturan sistem dari DB
  loadPengaturanSistem();

  // Cek jika akun Sekolah / Admin masih menggunakan password default (123456)
  checkDefaultPasswordPrompt();

  // UI Init
  const displayNama = currentUser.nama || currentUser.nama_admin || currentUser.username;
  const userInfoEl = document.getElementById("user-info");
  if (userInfoEl) userInfoEl.innerText = displayNama;

  const userInitialEl = document.getElementById("user-initial");
  if (userInitialEl) userInitialEl.innerText = (displayNama || currentUser.username).charAt(0).toUpperCase();

  const userRoleBadgeEl = document.getElementById("user-role-badge");
  if (userRoleBadgeEl) {
    let roleText = currentUser.role || "User";
    if (currentUser.role === "Sekolah" && currentUser.nama) {
      roleText += ` • ${currentUser.nama}`;
    }
    userRoleBadgeEl.innerText = roleText;
  }

  const welcomeNameEl = document.getElementById("welcome-name");
  if (welcomeNameEl) welcomeNameEl.innerText = displayNama;

  const welcomeRoleEl = document.getElementById("welcome-role");
  if (welcomeRoleEl) welcomeRoleEl.innerText = currentUser.role;

  // Mobile Topbar Brand: isi nama aplikasi dari settings & username
  (function populateMobileTopbar() {
    const ls = safeReadJsonStorage('mktas_settings', {});
    const appName = ls.singkatan_forum || ls.nama_forum || 'Portal MKTAS';
    const appNameEl = document.getElementById('topbar-appname-mobile');
    if (appNameEl) appNameEl.textContent = appName;

    const usernameEl = document.getElementById('topbar-username-mobile');
    if (usernameEl) {
      let uname = currentUser.username || currentUser.nama || 'User';
      if (currentUser.role === 'Sekolah' && currentUser.nama) {
        uname = currentUser.username ? `${currentUser.username} - ${currentUser.nama}` : currentUser.nama;
      }
      usernameEl.textContent = uname;
    }

    // Logo
    if (ls.logo_forum) {
      const logoImg = document.getElementById('topbar-logo-mobile');
      const logoSvg = document.getElementById('topbar-logo-svg-mobile');
      if (logoImg && logoSvg) {
        logoImg.src = ls.logo_forum;
        logoImg.style.display = 'block';
        logoSvg.style.display = 'none';
      }
    }
  })();

  // Role-based visibility
  if (currentUser.role === "Superadmin" || currentUser.role === "Admin") {
    const menuSekolah = document.getElementById("menu-sekolah");
    const btnAddSchedule = document.getElementById("btn-add-schedule-ui");
    if (menuSekolah) menuSekolah.classList.remove("hidden");
    if (btnAddSchedule) btnAddSchedule.classList.remove("hidden");
  }
  if (currentUser.role === "Superadmin") {
    const menuPengaturan = document.getElementById("menu-pengaturan");
    if (menuPengaturan) menuPengaturan.classList.remove("hidden");
    const backupTab = document.getElementById("tab-backup-restore");
    if (backupTab) backupTab.style.display = '';
  } else {
    const backupTab = document.getElementById("tab-backup-restore");
    if (backupTab) backupTab.style.display = 'none';
  }

  // Tombol Sync Cloud: HANYA TAMPIL DI SUPERADMIN (Admin dan Sekolah disembunyikan)
  const btnSyncCloud = document.getElementById("btn-sync-cloud");
  if (btnSyncCloud) {
    if (currentUser.role === "Superadmin") {
      btnSyncCloud.classList.remove("hidden");
    } else {
      btnSyncCloud.classList.add("hidden");
    }
  }

  // Role Admin: Master Data Readonly
  if (currentUser.role === "Admin") {
    document.querySelectorAll(".btn-import-school, .btn-add-school").forEach(b => {
      if (b) b.style.display = "none";
    });
  }

  // Hide school select on Add Staff if user is just a school
  if (currentUser.role === "Sekolah") {
    const groupSekolah = document.getElementById("group-sekolah-select");
    if (groupSekolah) groupSekolah.classList.add("hidden");
    const menuSekolah = document.getElementById("menu-sekolah");
    if (menuSekolah) {
      menuSekolah.classList.remove("hidden");
      const a = menuSekolah.querySelector("a");
      if (a) {
        a.innerHTML = '<i style="margin-right: 10px;">👥</i> Data Pegawai';
      }
    }

    if (typeof applySchoolWebPublikTabRestriction === 'function') {
      applySchoolWebPublikTabRestriction();
    }

    // Sembunyikan tombol tambah file referensi untuk Sekolah
    const btnRef = document.getElementById("btn-tambah-referensi");
    if (btnRef) btnRef.style.display = "none";
    // Catatan: btn-tambah-galeri TETAP DITAMPILKAN untuk Sekolah agar bisa menambahkan foto/video galeri mereka sendiri

    // Hide upload laporan panel
    const panelUpload = document.getElementById("panel-upload-laporan");
    if (panelUpload) panelUpload.style.display = "none";
  }

  // Navigation
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      // styling
      document
        .querySelectorAll(".nav-item")
        .forEach((nav) => nav.classList.remove("active"));
      el.classList.add("active");

      // show section
      const target = el.getAttribute("data-target");

      document
        .querySelectorAll(".section-content")
        .forEach((sec) => {
          if (sec) {
            sec.classList.remove("active");
            sec.style.display = '';
          }
        });
      const secPegawai = document.getElementById("section-sekolah-pegawai");
      if (secPegawai) { secPegawai.style.display = 'none'; secPegawai.classList.remove('active'); }

      if (currentUser.role === "Sekolah" && target === "sekolah") {
        if (typeof openPegawaiSekolahPage === "function") {
          openPegawaiSekolahPage(currentUser.school_id, currentUser.nama || 'Sekolah');
        }
        const pageTitle = document.getElementById("page-title");
        if (pageTitle) pageTitle.innerHTML = '<i style="margin-right: 10px;">👥</i> Data Pegawai';
        return;
      }

      const targetSection = document.getElementById("section-" + target);
      if (targetSection) targetSection.classList.add("active");

      const pageTitle = document.getElementById("page-title");
      if (pageTitle) {
        const navIcon = el.querySelector('i');
        const titleText = navIcon
          ? Array.from(el.childNodes)
              .filter((node) => node.nodeType === Node.TEXT_NODE)
              .map((node) => node.textContent.trim())
              .join(' ')
              .trim()
          : el.textContent.trim();

        pageTitle.innerHTML = navIcon
          ? `${navIcon.outerHTML}${titleText ? ' ' + titleText : ''}`
          : titleText;
      }

      if (target === "home") loadDashboardData();
      if (target === "sekolah") loadSekolah();
      if (target === "pegawai") loadPegawai();
      if (target === "jadwal") loadJadwal();
      if (target === "laporan") loadLaporan();
      if (target === "webpublik") loadWebPublik();
      if (target === "galeri") loadGaleri();
    });
  });

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Modals
  setupModals();

  // Init Dashboard Bottom Navigation (mobile)
  initDashboardBottomNav();

  const restoreInput = document.getElementById('restore-backup-file');
  if (restoreInput) {
    restoreInput.addEventListener('change', async function () {
      const file = this.files && this.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload || !payload.data || !payload.exported_at) {
          throw new Error('File backup tidak valid.');
        }
        restoreMktasBackup(payload);
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Restore gagal', text: err.message || 'File backup tidak valid.' });
      } finally {
        this.value = '';
      }
    });
  }

  // Load Dashboard Stats
  loadDashboardData();
}

function setupModals() {
  const closeBtns = document.querySelectorAll(".close-btn");
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal && typeof window.closeModal === 'function') {
        window.closeModal(modal.id);
      } else if (modal) {
        modal.classList.remove("active");
      }
    });
  });

  // Add School Modal
  const btnAddSchool = document.querySelector(".btn-add-school");
  if (btnAddSchool)
    btnAddSchool.addEventListener("click", () =>
      window.showModal("modal-sekolah"),
    );

  const formSekolah = document.getElementById("form-sekolah");
  if (formSekolah) {
    formSekolah.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        nama: document.getElementById("add-school-nama").value,
        status: document.getElementById("add-school-status").value,
        username: document.getElementById("add-school-username").value,
        npsn: document.getElementById("add-school-npsn").value,
        nama_admin: document.getElementById("add-school-admin").value,
        no_hp_admin: document.getElementById("add-school-nohp").value,
        alamat: document.getElementById("add-school-alamat").value, // FIX Bug #2: hapus duplikasi key 'alamat'
        provinsi: document.getElementById("add-school-provinsi").options[document.getElementById("add-school-provinsi").selectedIndex]?.text || '',
        kabupaten_kota: document.getElementById("add-school-kabkota").options[document.getElementById("add-school-kabkota").selectedIndex]?.text || '',
        kecamatan: document.getElementById("add-school-kecamatan").options[document.getElementById("add-school-kecamatan").selectedIndex]?.text || '',
        kode_wilayah: document.getElementById("add-school-kodewilayah").value,
        koordinat: (document.getElementById("add-school-koordinat") || {}).value || '',
      };
      const res = await fetchAPI("addSchool", data);
      if (res.status === "success") {
        window.closeModal("modal-sekolah");
        formSekolah.reset();
        loadSekolah(true);
        Swal.fire({ icon: 'success', text: res.message });
      } else {
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  // Edit School Modal
  const formEditSekolah = document.getElementById("form-edit-sekolah");
  if (formEditSekolah) {
    formEditSekolah.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        id: document.getElementById("edit-school-id").value,
        nama: document.getElementById("edit-school-nama").value,
        status: document.getElementById("edit-school-status").value,
        username: document.getElementById("edit-school-username").value,
        npsn: document.getElementById("edit-school-npsn").value,
        nama_admin: document.getElementById("edit-school-admin").value,
        no_hp_admin: document.getElementById("edit-school-nohp").value,
        alamat: document.getElementById("edit-school-alamat").value,
        provinsi: document.getElementById("edit-school-provinsi").options[document.getElementById("edit-school-provinsi").selectedIndex]?.text || '',
        kabupaten_kota: document.getElementById("edit-school-kabkota").options[document.getElementById("edit-school-kabkota").selectedIndex]?.text || '',
        kecamatan: document.getElementById("edit-school-kecamatan").options[document.getElementById("edit-school-kecamatan").selectedIndex]?.text || '',
        kode_wilayah: document.getElementById("edit-school-kodewilayah").value,
        koordinat: (document.getElementById("edit-school-koordinat") || {}).value || '',
      };
      const res = await fetchAPI("editSchool", data);
      if (res.status === "success") {
        window.closeModal("modal-edit-sekolah");
        formEditSekolah.reset();
        loadSekolah(true);
        Swal.fire({ icon: 'success', text: res.message });
      } else {
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  // Import School Modal
  const btnImportSchool = document.querySelector(".btn-import-school");
  if (btnImportSchool)
    btnImportSchool.addEventListener("click", () =>
      window.showModal("modal-import-sekolah"),
    );

  const formAdmin = document.getElementById("form-admin");
  if (formAdmin) {
    formAdmin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nama = document.getElementById("add-admin-nama").value;
      const username = document.getElementById("add-admin-username").value;
      const role = document.getElementById("add-admin-role").value;
      const password = document.getElementById("add-admin-password").value || "123456";

      const data = { nama, username, role, password, school_id: "-" };

      const res = await fetchAPI("addAdmin", data);
      if (res.status === "success") {
        window.closeModal('modal-admin');
        formAdmin.reset();
        loadAdmins();
        Swal.fire({ icon: 'success', text: res.message });
      } else {
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  const btnDownloadTemplate = document.getElementById("btn-download-template");
  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener("click", (e) => {
      e.preventDefault();
      const ws = XLSX.utils.json_to_sheet([
        {
          nama: "Contoh SD",
          status: "Negeri",
          username: "contoh_sd",
          npsn: "12345678",
          nama_admin: "Budi",
          no_hp_admin: "081234567890",
          alamat: "Jl. Pendidikan No. 1",
          provinsi: "JAMBI",
          kabupaten_kota: "KOTA JAMBI"
        }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template_Sekolah");
      XLSX.writeFile(wb, "Template_Import_Sekolah.xlsx");
    });
  }

  const formImportSekolah = document.getElementById("form-import-sekolah");
  if (formImportSekolah) {
    formImportSekolah.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("file-import-sekolah");
      if (!fileInput.files || fileInput.files.length === 0) return;

      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawSchools = XLSX.utils.sheet_to_json(worksheet);

          if (rawSchools.length === 0) {
            Swal.fire({ icon: 'warning', text: 'File Excel kosong atau format tidak sesuai.' });
            return;
          }

          // Normalisasi nama kolom Excel agar sesuai format backend
          const extractF = (row, ...cands) => {
            for (const c of cands) {
              const cn = c.toLowerCase().replace(/[\s\-_\/]/g, '');
              for (const k of Object.keys(row)) {
                if (k.toLowerCase().replace(/[\s\-_\/]/g, '') === cn) {
                  const v = row[k];
                  if (v != null && String(v).trim() !== '') return String(v).trim();
                }
              }
            }
            return '';
          };
          const schools = rawSchools.map(r => {
            const npsn = extractF(r, 'npsn', 'npsn_sekolah', 'nomorpokoksekolahnasional', 'nomor pokok sekolah nasional');
            const nama = extractF(r, 'nama', 'nama_sekolah', 'namasekolah', 'nama sekolah', 'sekolah', 'namalembaga', 'nama lembaga');
            const status = extractF(r, 'status', 'status_sekolah', 'statussekolah', 'jenis') || 'Negeri';
            const username = extractF(r, 'username', 'user', 'username_sekolah') || npsn || (nama ? nama.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) : '');
            return {
              npsn, nama, status, username,
              nama_admin: extractF(r, 'nama_admin', 'namaadmin', 'admin', 'operator', 'nama_operator', 'kepala sekolah'),
              no_hp_admin: extractF(r, 'no_hp_admin', 'nohpadmin', 'no_hp', 'nohp', 'no_wa', 'nowa', 'telepon', 'hp'),
              alamat: extractF(r, 'alamat', 'alamat_sekolah', 'jalan'),
              provinsi: extractF(r, 'provinsi', 'prov'),
              kabupaten_kota: extractF(r, 'kabupaten_kota', 'kabupaten', 'kota', 'kab_kota', 'kabkota', 'kab'),
              kecamatan: extractF(r, 'kecamatan', 'kec'),
              kode_wilayah: extractF(r, 'kode_wilayah', 'kode', 'kodewilayah')
            };
          }).filter(s => s.npsn && s.npsn !== '-' && s.npsn.toLowerCase() !== 'null' && s.nama); // Syarat mutlak: Wajib ada NPSN dan Nama Sekolah

          const totalRaw = rawSchools.length;
          const skippedNoNpsn = totalRaw - schools.length;

          if (schools.length === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'Data Tidak Valid',
              text: 'Tidak ditemukan data sekolah dengan kolom NPSN dan Nama. Hanya data yang memiliki NPSN yang dapat diimpor.'
            });
            return;
          }

          Swal.fire({
            title: 'Memproses...',
            text: `Sedang mengimpor ${schools.length} data sekolah (NPSN valid)${skippedNoNpsn > 0 ? ` [${skippedNoNpsn} baris tanpa NPSN dilewati]` : ''}...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
          });

          const res = await fetchAPI("importSchools", schools);

          if (res.status === "success") {
            document.getElementById("modal-import-sekolah").classList.remove("active");
            document.getElementById("form-import-sekolah").reset();
            loadSekolah(true);
            Swal.fire({ icon: 'success', text: res.message });
          } else {
            Swal.fire({ icon: 'error', text: res.message });
          }
        } catch (error) {
          Swal.fire({ icon: 'error', text: 'Gagal memproses file Excel: ' + error.message });
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  // Add Staff Modal
  const btnAddStaff = document.querySelector(".btn-add-staff");
  if (btnAddStaff)
    btnAddStaff.addEventListener("click", () => {
      // 1. Langsung buka modal seketika (0 ms)!
      window.showModal("modal-pegawai");

      const select = document.getElementById("add-staff-sekolah");
      if (select) {
        if (currentUser && currentUser.role === "Sekolah") {
          select.innerHTML = `<option value="${currentUser.school_id}" selected>${currentUser.nama || 'Sekolah Anda'}</option>`;
          select.disabled = true;
        } else if (cachedSchools && cachedSchools.length > 0) {
          select.innerHTML = "";
          cachedSchools.forEach((s) => {
            select.innerHTML += `<option value="${s.id}">${s.nama}</option>`;
          });
        } else {
          select.innerHTML = '<option value="">Memuat daftar sekolah...</option>';
          ensureSchoolsLoaded().then(() => {
            if (cachedSchools && cachedSchools.length > 0) {
              select.innerHTML = "";
              cachedSchools.forEach((s) => {
                select.innerHTML += `<option value="${s.id}">${s.nama}</option>`;
              });
            }
          });
        }
      }
    });

  const formPegawai = document.getElementById("form-pegawai");
  if (formPegawai) {
    formPegawai.addEventListener("submit", async (e) => {
      e.preventDefault();

      const role = currentUser.role;
      const staffSekolah = document.getElementById("add-staff-sekolah");
      const schoolId = role === "Sekolah" ? currentUser.school_id : (staffSekolah ? staffSekolah.value : null);
      const birthDate = validateStaffBirthDate(document.getElementById("add-staff-tgllahir")?.value);
      if (birthDate === null) {
        Swal.fire({ icon: 'warning', text: 'Tahun tanggal lahir harus 4 digit, contoh: 1990-08-17.' });
        return;
      }

      const data = {
        school_id: schoolId,
        nip: document.getElementById("add-staff-nip").value,
        nama_lengkap: document.getElementById("add-staff-nama").value,
        jenis_kelamin: document.getElementById("add-staff-jk").value,
        tempat_lahir: document.getElementById("add-staff-tempatlahir") ? document.getElementById("add-staff-tempatlahir").value : "",
        tgl_lahir: birthDate,
        pendidikan_terakhir: document.getElementById("add-staff-pendidikan") ? document.getElementById("add-staff-pendidikan").value : "",
        status_pegawai: document.getElementById("add-staff-status").value,
        pangkat_gol: document.getElementById("add-staff-pangkat").value,
        nama_jabatan_sk: document.getElementById("add-staff-jabatan-sk").value,
        nama_jabatan_tugas: document.getElementById("add-staff-jabatan-tugas").value,
        no_wa: document.getElementById("add-staff-nowa").value,
        email: document.getElementById("add-staff-email").value,
        foto: document.getElementById("add-staff-foto") ? document.getElementById("add-staff-foto").value : "",
      };
      Swal.fire({
        title: 'Menyimpan data pegawai...',
        text: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetchAPI("addStaff", data);
      if (res.status === "success") {
        Swal.close();
        window.closeModal("modal-pegawai");
        formPegawai.reset();
        if (typeof currentPegawaiSchoolId !== 'undefined' && currentPegawaiSchoolId) {
          loadPegawaiSekolahInline(currentPegawaiSchoolId, true);
        }
        loadPegawai(true);
        Swal.fire({ icon: 'success', text: res.message });
      } else {
        Swal.close();
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  // Add Schedule Modal
  const btnAddSchedule = document.getElementById("btn-add-schedule-ui");
  if (btnAddSchedule)
    btnAddSchedule.addEventListener("click", () => {
      // 1. Langsung buka modal seketika (0 ms)!
      window.showModal("modal-jadwal");

      // Auto-fill Tahun and make sure modal clears previous data
      if (currentJadwalTahun) {
        const inputTahun = document.getElementById("add-jadwal-tahun");
        if (inputTahun) inputTahun.value = currentJadwalTahun;
      }

      const select = document.getElementById("add-jadwal-sekolah");
      if (select) {
        if (cachedSchools && cachedSchools.length > 0) {
          select.innerHTML = "";
          cachedSchools.forEach((s) => {
            select.innerHTML += `<option value="${s.nama}">${s.nama}</option>`;
          });
        } else {
          select.innerHTML = '<option value="">Memuat daftar sekolah...</option>';
          ensureSchoolsLoaded().then(() => {
            if (cachedSchools && cachedSchools.length > 0) {
              select.innerHTML = "";
              cachedSchools.forEach((s) => {
                select.innerHTML += `<option value="${s.nama}">${s.nama}</option>`;
              });
            }
          });
        }
      }
    });

  const formJadwal = document.getElementById("form-jadwal");
  if (formJadwal) {
    formJadwal.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        tahun: document.getElementById("add-jadwal-tahun").value,
        bulan: document.getElementById("add-jadwal-bulan").value,
        sekolah: document.getElementById("add-jadwal-sekolah").value,
        tanggal: document.getElementById("add-jadwal-tanggal").value,
        alamat_kecamatan: document.getElementById("add-jadwal-alamat").value,
        keterangan: document.getElementById("add-jadwal-ket").value,
        deskripsi_agenda: document.getElementById("add-jadwal-deskripsi").value,
      };
      Swal.fire({
        title: 'Menyimpan jadwal...',
        text: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetchAPI("addSchedule", data);
      if (res.status === "success") {
        Swal.close();
        window.closeModal("modal-jadwal");
        formJadwal.reset();
        await loadJadwal(true);
        if (currentJadwalTahun) {
          filterJadwal();
        }
        Swal.fire({ icon: 'success', text: res.message });
      } else {
        Swal.close();
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  // Edit Staff Submit
  const formEditStaff = document.getElementById("form-edit-pegawai");
  if (formEditStaff) {
    formEditStaff.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = e.target.dataset.id;
      const schoolId = e.target.dataset.schoolId;
      const birthDate = validateStaffBirthDate(document.getElementById("edit-staff-tgllahir")?.value);
      if (birthDate === null) {
        Swal.fire({ icon: 'warning', text: 'Tahun tanggal lahir harus 4 digit, contoh: 1990-08-17.' });
        return;
      }
      const data = {
        id: id,
        school_id: schoolId,
        nip: document.getElementById("edit-staff-nip").value,
        nama_lengkap: document.getElementById("edit-staff-nama").value,
        jenis_kelamin: document.getElementById("edit-staff-jk").value,
        tempat_lahir: document.getElementById("edit-staff-tempatlahir") ? document.getElementById("edit-staff-tempatlahir").value : "",
        tgl_lahir: birthDate,
        pendidikan_terakhir: document.getElementById("edit-staff-pendidikan") ? document.getElementById("edit-staff-pendidikan").value : "",
        status_pegawai: document.getElementById("edit-staff-status").value,
        pangkat_gol: document.getElementById("edit-staff-pangkat").value,
        nama_jabatan_sk: document.getElementById("edit-staff-jabatan-sk").value,
        nama_jabatan_tugas: document.getElementById("edit-staff-jabatan-tugas").value,
        no_wa: document.getElementById("edit-staff-nowa").value,
        email: document.getElementById("edit-staff-email").value,
        foto: document.getElementById("edit-staff-foto") ? document.getElementById("edit-staff-foto").value : "",
      };
      Swal.fire({
        title: 'Memperbarui data pegawai...',
        text: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetchAPI("editStaff", data);
      // FIX Bug #3: Hapus false-positive. Hanya tampilkan sukses jika benar-benar berhasil.
      if (res.status === "success") {
        Swal.close();
        document.getElementById("modal-edit-pegawai").classList.remove("active");
        Swal.fire({ icon: 'success', text: "Data pegawai berhasil diperbarui" });
        // Refresh halaman inline jika sedang terbuka, atau global loadPegawai
        if (typeof currentPegawaiSchoolId !== 'undefined' && currentPegawaiSchoolId) {
          loadPegawaiSekolahInline(currentPegawaiSchoolId, true);
        }
        loadPegawai(true);
      } else {
        Swal.close();
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  // Edit Schedule Submit
  const formEditJadwal = document.getElementById("form-edit-jadwal");
  if (formEditJadwal) {
    formEditJadwal.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        id: document.getElementById("edit-jadwal-id").value,
        tahun: document.getElementById("edit-jadwal-tahun").value,
        bulan: document.getElementById("edit-jadwal-bulan").value,
        sekolah: document.getElementById("edit-jadwal-sekolah").value,
        tanggal: document.getElementById("edit-jadwal-tanggal").value,
        alamat_kecamatan: document.getElementById("edit-jadwal-alamat").value,
        keterangan: document.getElementById("edit-jadwal-ket").value,
        deskripsi_agenda: document.getElementById("edit-jadwal-deskripsi").value,
      };
      Swal.fire({
        title: 'Memperbarui jadwal...',
        text: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetchAPI("editSchedule", data);
      // FIX Bug #3: Hapus false-positive. Hanya tampilkan sukses jika benar-benar berhasil.
      if (res.status === "success") {
        Swal.close();
        document.getElementById("modal-edit-jadwal").classList.remove("active");
        await loadJadwal(true);
        if (currentJadwalTahun) {
          filterJadwal();
        }
        Swal.fire({ icon: 'success', text: "Data jadwal berhasil diperbarui" });
      } else {
        Swal.close();
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }

  // Add Year Modal
  const btnAddYear = document.getElementById("btn-add-year-ui");
  if (btnAddYear)
    btnAddYear.addEventListener("click", async () => {
      const { value: year } = await Swal.fire({
        title: "Tambah Tahun Baru",
        input: "number",
        inputLabel: "Tahun",
        inputValue: new Date().getFullYear(),
        showCancelButton: true
      });
      if (year) {
        // Langsung arahkan ke tabel jadwal untuk tahun baru ini
        // Karena tabel jadwal membaca dari variabel allSchedules (meskipun kosong), 
        // kita bisa langsung memanggil loadJadwalByTahun untuk merender view kosong 
        // agar user bisa menambahkan jadwal di tahun tersebut.
        loadJadwalByTahun(year);
      }
    });
}

async function updateKabKota(mode) {
  const provEl = document.getElementById(`${mode}-school-provinsi`);
  const kabEl = document.getElementById(`${mode}-school-kabkota`);
  if (!provEl || !kabEl) return;

  const provId = provEl.value;
  kabEl.innerHTML = '<option value="">-- Pilih Kabupaten/Kota --</option>';

  if (provId && typeof getKabupatenByProvinsiId === "function") {
    const kabs = await getKabupatenByProvinsiId(provId);
    kabs.forEach(kab => {
      kabEl.innerHTML += `<option value="${kab.id}">${kab.nama}</option>`;
    });
  }
}

async function updateKecamatan(mode) {
  const kabEl = document.getElementById(`${mode}-school-kabkota`);
  const kecEl = document.getElementById(`${mode}-school-kecamatan`);
  if (!kabEl || !kecEl) return;

  const kabId = kabEl.value;
  kecEl.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';

  if (kabId && typeof getKecamatanByKabupatenId === "function") {
    const kecs = await getKecamatanByKabupatenId(kabId);
    kecs.forEach(kec => {
      kecEl.innerHTML += `<option value="${kec.id}">${kec.nama}</option>`;
    });
  }
}

function updateKodeWilayah(mode) {
  const kecEl = document.getElementById(`${mode}-school-kecamatan`);
  const kodeEl = document.getElementById(`${mode}-school-kodewilayah`);
  if (!kecEl || !kodeEl) return;
  kodeEl.value = kecEl.value; // value contains the ID (code)
}

async function initWilayah(mode) {
  const provEl = document.getElementById(`${mode}-school-provinsi`);
  if (!provEl) return;
  provEl.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
  if (typeof getProvinsi === "function") {
    const provs = await getProvinsi();
    provs.forEach(p => {
      provEl.innerHTML += `<option value="${p.id}">${p.nama}</option>`;
    });
  }
}

async function resetPasswordSekolah(id) {
  const result = await Swal.fire({
    title: 'Reset Password?',
    text: "Password akan direset menjadi '123456'",
    icon: 'warning',
    showCancelButton: true
  });

  if (result.isConfirmed) {
    const res = await fetchAPI('resetSchoolPassword', { id });
    if (res.status === 'success') {
      Swal.fire("Berhasil", res.message, "success");
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  }
}

function updatePangkatOptions(mode) {
  const statusEl = document.getElementById(`${mode}-staff-status`);
  const pangkatEl = document.getElementById(`${mode}-staff-pangkat`);

  if (!statusEl || !pangkatEl) return;

  const status = statusEl.value;
  pangkatEl.innerHTML = '';

  if (status === 'PNS') {
    const pnsRanks = [
      "Juru Muda / Ia", "Juru Muda Tk.I / Ib", "Juru / Ic", "Juru Tk.I / Id",
      "Pengatur Muda / IIa", "Pengatur Muda Tk.I / IIb", "Pengatur / IIc", "Pengatur Tk.I / IId",
      "Penata Muda / IIIa", "Penata Muda Tk.I / IIIb", "Penata / IIIc", "Penata Tk.I / IIId",
      "Pembina / IVa", "Pembina Tk.I / IVb", "Pembina Utama Muda / IVc", "Pembina Utama Madya / IVd", "Pembina Utama / IVe"
    ];
    pnsRanks.forEach(rank => pangkatEl.innerHTML += `<option value="${rank}">${rank}</option>`);
  } else if (status === 'PPPK' || status === 'PPPK PW') {
    for (let i = 1; i <= 17; i++) {
      let roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII"][i - 1];
      pangkatEl.innerHTML += `<option value="Golongan ${roman}">Golongan ${roman}</option>`;
    }
  } else {
    pangkatEl.innerHTML = `<option value="-">-</option>`;
  }
}

async function ensureSchoolsLoaded() {
  if (cachedSchools.length === 0) {
    cachedSchools = safeReadJsonStorage('mktas_schools', []);
  }
  if (cachedSchools.length === 0) {
    const result = await fetchAPI("getSchools");
    if (result.status === "success" && Array.isArray(result.data)) {
      cachedSchools = result.data;
      try { localStorage.setItem('mktas_schools', JSON.stringify(cachedSchools)); } catch(e) {}
    }
  }
}

// --- Pengaturan Sistem: Load & Save ke SQLite ---
async function loadPengaturanSistem() {
  try {
    // Ambil dari database (berlaku untuk SQLite Desktop & Google Sheets Web)
    let d = {};
    try {
      const res = await fetchAPI('getSettings', {});
      if (res && res.status === 'success' && res.data) {
        d = res.data;
      }
    } catch (err) {
      console.warn('Gagal memuat pengaturan dari server:', err);
    }
    // Merge dengan localStorage (sebagai fallback & cache lokal)
    const local = safeReadJsonStorage('mktas_settings', {});
    d = typeof mergeSettings === 'function' ? mergeSettings(local, d) : Object.assign({}, local, d); // Data database mengutamakan data terbaru
    try { localStorage.setItem('mktas_settings', JSON.stringify(d)); } catch (e) { }

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    // Tab Sistem
    set('pengaturan-nama', d.nama_forum);
    set('pengaturan-singkatan', d.singkatan_forum);
    set('pengaturan-wilayah', d.wilayah || d.kabupaten);
    set('pengaturan-alamat', d.alamat);
    set('pengaturan-telp', d.telp || d.kontak_wa || d.no_hp);
    set('pengaturan-email', d.email);
    set('pengaturan-web', d.website || d.domain_resmi);
    set('pengaturan-maps', d.maps_embed || d.koordinat);
    set('pengaturan-apps-script-url', d.apps_script_url || localStorage.getItem('mktas_apps_script_url'));

    // --- UPDATE UI SIDEBAR ---
    if (d.logo_forum) {
      const sidebarLogo = document.getElementById('sidebar-logo');
      if (sidebarLogo) {
        sidebarLogo.src = d.logo_forum;
        sidebarLogo.style.display = 'block';
      }
    }
    if (d.wilayah) {
      const sidebarWilayah = document.getElementById('sidebar-wilayah');
      if (sidebarWilayah) sidebarWilayah.textContent = d.wilayah;
    }

    // Tab Logo & Warna
    const setImg = (urlId, previewId, url) => {
      if (!url) return;
      set(urlId, url);
      const img = document.getElementById(previewId);
      if (img) { img.src = url; img.style.display = 'block'; }
    };
    setImg('logo-instansi-url', 'preview-logo-instansi', d.logo_instansi);
    setImg('logo-forum-url', 'preview-logo-forum', d.logo_forum);
    setImg('bg-login-url', 'preview-bg-login', d.bg_login);
    // Apply warna
    set('warna-primer', d.warna_primer);
    set('warna-hover', d.warna_hover);
    set('warna-aksen1', d.warna_aksen1);
    set('warna-aksen2', d.warna_aksen2);
    applyWarnaSettings(d);

    // Tab 4: Data & Legalitas
    set('legalitas-sk-kemenkumham', d.legalitas_sk_kemenkumham);
    set('legalitas-akta-notaris', d.legalitas_akta_notaris);
    set('legalitas-nama-notaris', d.legalitas_nama_notaris);
    set('legalitas-tanggal-pendirian', d.legalitas_tanggal_pendirian);
    set('legalitas-npwp', d.legalitas_npwp);
    set('legalitas-sk-dinas', d.legalitas_sk_dinas);
    set('legalitas-status-lembaga', d.legalitas_status_lembaga);
    set('legalitas-keterangan', d.legalitas_keterangan);
  } catch (e) { console.warn('loadPengaturanSistem error:', e); }
}

async function savePengaturanSistem() {
  const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const telpVal = get('pengaturan-telp');
  const webVal = get('pengaturan-web');
  const data = {
    nama_forum: get('pengaturan-nama'),
    singkatan_forum: get('pengaturan-singkatan'),
    wilayah: get('pengaturan-wilayah'),
    alamat: get('pengaturan-alamat'),
    telp: telpVal,
    kontak_wa: telpVal,
    email: get('pengaturan-email'),
    website: webVal,
    domain_resmi: webVal,
    maps_embed: get('pengaturan-maps'),
    apps_script_url: get('pengaturan-apps-script-url')
  };
  // Simpan ke localStorage (works semua mode)
  const existing = safeReadJsonStorage('mktas_settings', {});
  const merged = Object.assign(existing, data);
  localStorage.setItem('mktas_settings', JSON.stringify(merged));
  if (data.apps_script_url) {
    localStorage.setItem('mktas_apps_script_url', data.apps_script_url);
  }

  // Update UI Sidebar secara langsung
  if (data.wilayah) {
    const sidebarWilayah = document.getElementById('sidebar-wilayah');
    if (sidebarWilayah) sidebarWilayah.textContent = data.wilayah;
  }

  Swal.fire({
    title: 'Menyimpan pengaturan...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  // Simpan ke database (SQLite offline atau Google Sheets online)
  const res = await fetchAPI('saveSettings', data).catch(err => ({ status: 'error', message: err.message }));
  if (res && res.status === 'error') {
    Swal.close();
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: res.message || 'Terjadi kesalahan saat menyimpan ke database.' });
    return;
  }

  // Refresh footer jika ada fungsi pembantu
  if (typeof window.applySettingsToFooter === 'function') {
    window.applySettingsToFooter(merged);
  }

  Swal.close();
  Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Pengaturan sistem berhasil disimpan ke database.', timer: 1800, showConfirmButton: false });
}

async function savePengaturanLogo() {
  const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  const data = {
    logo_instansi: get('logo-instansi-url'),
    logo_forum: get('logo-forum-url'),
    bg_login: get('bg-login-url'),
    warna_primer: get('warna-primer'),
    warna_hover: get('warna-hover'),
    warna_aksen1: get('warna-aksen1'),
    warna_aksen2: get('warna-aksen2')
  };
  // Simpan ke localStorage
  const existing = safeReadJsonStorage('mktas_settings', {});
  localStorage.setItem('mktas_settings', JSON.stringify(Object.assign(existing, data)));

  Swal.fire({
    title: 'Menyimpan logo & warna...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  // Simpan ke database (SQLite offline atau Google Sheets online)
  const res = await fetchAPI('saveSettings', data).catch(err => ({ status: 'error', message: err.message }));
  if (!res || res.status !== 'success') {
    Swal.close();
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: res?.message || 'Pengaturan logo gagal disimpan ke Spreadsheet.' });
    return;
  }
  Swal.close();
  Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Logo & Warna berhasil disimpan.', timer: 1800, showConfirmButton: false });
  applyWarnaSettings(data);
}

async function savePengaturanLegalitas() {
  const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const data = {
    legalitas_sk_kemenkumham: get('legalitas-sk-kemenkumham'),
    legalitas_akta_notaris: get('legalitas-akta-notaris'),
    legalitas_nama_notaris: get('legalitas-nama-notaris'),
    legalitas_tanggal_pendirian: get('legalitas-tanggal-pendirian'),
    legalitas_npwp: get('legalitas-npwp'),
    legalitas_sk_dinas: get('legalitas-sk-dinas'),
    legalitas_status_lembaga: get('legalitas-status-lembaga'),
    legalitas_keterangan: get('legalitas-keterangan')
  };
  const existing = safeReadJsonStorage('mktas_settings', {});
  localStorage.setItem('mktas_settings', JSON.stringify(Object.assign(existing, data)));

  Swal.fire({
    title: 'Menyimpan legalitas...',
    text: 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  // Simpan ke database (SQLite offline atau Google Sheets online)
  const res = await fetchAPI('saveSettings', data).catch(err => ({ status: 'error', message: err.message }));
  if (!res || res.status !== 'success') {
    Swal.close();
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: res?.message || 'Data legalitas gagal disimpan ke Spreadsheet.' });
    return;
  }
  Swal.close();
  Swal.fire({
    icon: 'success',
    title: 'Tersimpan!',
    text: 'Data & Legalitas forum berhasil disimpan dan disinkronkan ke halaman profil publik.',
    timer: 1800,
    showConfirmButton: false
  });
}
window.savePengaturanLegalitas = savePengaturanLegalitas;

function getMktasLogHistory() {
  try {
    const raw = localStorage.getItem('mktas_log_history');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function addMktasLogEntry(action, status, detail) {
  const logs = getMktasLogHistory();
  logs.unshift({
    id: Date.now() + Math.random(),
    action,
    status,
    detail: detail || '',
    created_at: new Date().toISOString()
  });
  const trimmed = logs.slice(0, 50);
  localStorage.setItem('mktas_log_history', JSON.stringify(trimmed));
}

function openLogHistoryModal(previewOnly = false) {
  const list = document.getElementById('log-history-list');
  if (!list) return;

  const logs = getMktasLogHistory();
  if (!logs.length) {
    list.innerHTML = '<div style="padding: 14px; border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-muted);">Belum ada riwayat log.</div>';
    if (!previewOnly) showModal('modal-log-history');
    return;
  }

  list.innerHTML = logs.map(log => `
    <div style="padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 10px; background: rgba(148, 163, 184, 0.04);">
      <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 6px;">
        <strong>${(log.action || 'Aktivitas').replace(/_/g, ' ')}</strong>
        <span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: ${log.status === 'success' ? '#dcfce7' : '#fee2e2'}; color: ${log.status === 'success' ? '#166534' : '#991b1b'};">${log.status === 'success' ? 'Berhasil' : 'Gagal'}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">${new Date(log.created_at || Date.now()).toLocaleString('id-ID')}</div>
      <div style="font-size: 0.9rem; color: var(--text-color);">${log.detail || '-'}</div>
    </div>
  `).join('');

  if (!previewOnly) showModal('modal-log-history');
}
window.openLogHistoryModal = openLogHistoryModal;

async function exportMktasBackup() {
  try {
    const res = await fetchAPI('exportAppBackup', {});
    if (!res || res.status !== 'success' || !res.data) {
      throw new Error(res?.message || 'Backup data gagal diambil dari database spreadsheet.');
    }

    const payload = res.data;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mktas-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-').replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    addMktasLogEntry('backup_data', 'success', 'Backup data dari spreadsheet berhasil diunduh.');
    Swal.fire({ icon: 'success', title: 'Backup berhasil', text: 'File backup dari database spreadsheet berhasil diunduh.', timer: 1800, showConfirmButton: false });
  } catch (err) {
    addMktasLogEntry('backup_data', 'error', err.message || 'Backup gagal.');
    Swal.fire({ icon: 'error', title: 'Backup gagal', text: err.message || 'Terjadi kesalahan saat backup data spreadsheet.' });
  }
}
window.exportMktasBackup = exportMktasBackup;

async function restoreMktasBackup(payload) {
  if (!payload || !payload.data || typeof payload.data !== 'object') {
    throw new Error('Format backup tidak valid.');
  }

  const res = await fetchAPI('restoreAppBackup', { payload });
  if (!res || res.status !== 'success') {
    throw new Error(res?.message || 'Restore data ke spreadsheet gagal.');
  }

  addMktasLogEntry('restore_data', 'success', 'Data berhasil dipulihkan ke spreadsheet dari file backup.');
  Swal.fire({ icon: 'success', title: 'Restore berhasil', text: 'Data berhasil dipulihkan ke database spreadsheet.', timer: 1800, showConfirmButton: false });
  if (typeof loadPengaturanSistem === 'function') {
    loadPengaturanSistem();
  }
  if (typeof loadDashboardData === 'function') {
    loadDashboardData();
  }
}
window.restoreMktasBackup = restoreMktasBackup;

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

    // Update all dynamic gradients derived strictly from settings
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

function previewWarnaRealtime() {
  const primer = document.getElementById('warna-primer')?.value;
  const hover = document.getElementById('warna-hover')?.value;
  const aksen1 = document.getElementById('warna-aksen1')?.value;
  const aksen2 = document.getElementById('warna-aksen2')?.value;
  applyWarnaSettings({
    warna_primer: primer,
    warna_hover: hover,
    warna_aksen1: aksen1,
    warna_aksen2: aksen2
  });
}
window.previewWarnaRealtime = previewWarnaRealtime;

// --- PROMPT WAJIB UBAH PASSWORD DEFAULT (AKUN SEKOLAH & ADMIN) ---
async function checkDefaultPasswordPrompt() {
  if (!currentUser) return;

  // Hanya berlaku untuk akun Sekolah dan Admin (sesuai permintaan)
  if (currentUser.role !== 'Sekolah' && currentUser.role !== 'Admin') {
    return;
  }

  let needChange = false;

  // 1. Cek dari flag session jika baru login
  if (currentUser.is_default_password === true) {
    needChange = true;
  } else {
    // 2. Verifikasi langsung ke database apakah akun saat ini masih menggunakan password default 123456
    try {
      const res = await fetchAPI('checkUserDefaultPassword', {
        id: currentUser.id,
        username: currentUser.username
      });
      if (res && res.status === 'success' && res.data && res.data.is_default) {
        needChange = true;
        currentUser.is_default_password = true;
        localStorage.setItem('mktas_user', JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn('Gagal verifikasi status password default:', e);
    }
  }

  if (needChange) {
    const modal = document.getElementById('modal-wajib-ganti-password');
    if (modal) {
      modal.classList.add('active');
    }
  }
}

function togglePassView(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️';
  }
}
window.togglePassView = togglePassView;

async function submitWajibGantiPassword(e) {
  if (e) e.preventDefault();

  const alertBox = document.getElementById('wajib-pass-alert');
  const alertText = document.getElementById('wajib-pass-alert-text');
  const btn = document.getElementById('btn-submit-wajib-pass');
  const passBaru = (document.getElementById('wajib-pass-baru')?.value || '').trim();
  const passKonf = (document.getElementById('wajib-pass-konfirmasi')?.value || '').trim();

  if (alertBox) alertBox.style.display = 'none';

  function showAlert(msg) {
    if (alertBox && alertText) {
      alertText.textContent = msg;
      alertBox.style.display = 'block';
    }
  }

  // Validasi input
  if (passBaru.length < 6) {
    showAlert('Password baru minimal 6 karakter.');
    return;
  }
  if (passBaru === '123456') {
    showAlert('Password baru tidak boleh menggunakan password standar (123456). Buatlah password baru yang aman.');
    return;
  }
  if (passBaru !== passKonf) {
    showAlert('Konfirmasi password tidak sama dengan password baru.');
    return;
  }

  const origText = btn.innerHTML;
  btn.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;border-top-color:white;display:inline-block;margin-right:8px;vertical-align:middle;"></div> Menyimpan...';
  btn.disabled = true;

  try {
    const res = await fetchAPI('changeUserPassword', {
      id: currentUser.id,
      username: currentUser.username,
      new_password: passBaru
    });

    if (res && res.status === 'success') {
      currentUser.is_default_password = false;
      localStorage.setItem('mktas_user', JSON.stringify(currentUser));

      const modal = document.getElementById('modal-wajib-ganti-password');
      if (modal) modal.classList.remove('active');

      Swal.fire({
        icon: 'success',
        title: 'Password Berhasil Diperbarui!',
        text: 'Akun Anda telah diamankan dengan password baru. Gunakan password baru ini untuk login berikutnya.',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Lanjutkan ke Dashboard'
      });
    } else {
      showAlert(res?.message || 'Gagal mengubah password. Silakan coba lagi.');
    }
  } catch (err) {
    showAlert('Terjadi kesalahan: ' + (err.message || err));
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}
window.submitWajibGantiPassword = submitWajibGantiPassword;

// --- Modal Profil User & Ubah Password ---
function openModalProfilUser() {
  if (!currentUser) {
    const userStr = localStorage.getItem("mktas_user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        if (parsed && typeof parsed === 'object') currentUser = parsed;
      } catch (e) {
        console.warn('[dashboard] Invalid profile session cache, clearing cache.');
        try { localStorage.removeItem('mktas_user'); } catch (removeErr) {}
        currentUser = null;
      }
    }
  }
  if (!currentUser) return;

  const usernameInput = document.getElementById("prof-username");
  const roleDisplay = document.getElementById("prof-role-display");
  const namaInput = document.getElementById("prof-nama");
  const namaLabel = document.getElementById("prof-nama-label");
  const namaHint = document.getElementById("prof-nama-hint");
  const passBaru = document.getElementById("prof-pass-baru");
  const passKonf = document.getElementById("prof-pass-konfirmasi");
  const alertBox = document.getElementById("prof-alert");

  if (usernameInput) usernameInput.value = currentUser.username || "";
  if (roleDisplay) {
    let badgeText = currentUser.role || "User";
    if (currentUser.role === "Sekolah" && currentUser.nama) {
      badgeText += ` — ${currentUser.nama}`;
    }
    roleDisplay.textContent = badgeText;
  }

  if (currentUser.role === "Sekolah") {
    if (namaLabel) namaLabel.textContent = "Nama Admin Sekolah";
    if (namaHint) namaHint.textContent = "Nama penanggung jawab akun di sekolah";
    if (namaInput) {
      namaInput.placeholder = "Masukkan nama admin sekolah...";
      namaInput.value = currentUser.nama_admin || currentUser.nama || "";
    }
  } else {
    if (namaLabel) namaLabel.textContent = "Nama Lengkap / Admin";
    if (namaHint) namaHint.textContent = "Nama penanggung jawab akun admin";
    if (namaInput) {
      namaInput.placeholder = "Masukkan nama admin...";
      namaInput.value = currentUser.nama || "";
    }
  }

  if (passBaru) passBaru.value = "";
  if (passKonf) passKonf.value = "";
  if (alertBox) alertBox.style.display = "none";

  const modal = document.getElementById("modal-profil-user");
  if (modal) modal.classList.add("active");
}
window.openModalProfilUser = openModalProfilUser;

async function submitUpdateProfilUser() {
  const alertBox = document.getElementById("prof-alert");
  const alertText = document.getElementById("prof-alert-text");
  const btn = document.getElementById("btn-save-profil-user");
  const namaInput = document.getElementById("prof-nama");
  const passBaruInput = document.getElementById("prof-pass-baru");
  const passKonfInput = document.getElementById("prof-pass-konfirmasi");

  if (alertBox) alertBox.style.display = "none";

  const nama = (namaInput?.value || "").trim();
  const passBaru = (passBaruInput?.value || "").trim();
  const passKonf = (passKonfInput?.value || "").trim();

  function showAlert(msg) {
    if (alertBox && alertText) {
      alertText.textContent = msg;
      alertBox.style.display = "block";
    }
  }

  if (!nama) {
    showAlert("Nama tidak boleh kosong.");
    return;
  }

  if (passBaru) {
    if (passBaru.length < 6) {
      showAlert("Password baru minimal 6 karakter.");
      return;
    }
    if (passBaru === "123456") {
      showAlert("Password baru tidak boleh menggunakan password standar (123456). Buat password baru yang aman.");
      return;
    }
    if (passBaru !== passKonf) {
      showAlert("Konfirmasi password tidak cocok dengan password baru.");
      return;
    }
  }

  const origBtnText = btn.innerHTML;
  btn.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;border-top-color:white;display:inline-block;margin-right:8px;vertical-align:middle;"></div> Menyimpan...';
  btn.disabled = true;

  try {
    const payload = {
      id: currentUser.id,
      username: currentUser.username,
      role: currentUser.role,
      school_id: currentUser.school_id,
      nama: nama
    };
    if (passBaru) {
      payload.new_password = passBaru;
    }

    const res = await fetchAPI("updateUserProfile", payload);
    if (res && res.status === "success") {
      currentUser.nama = nama;
      if (currentUser.role === "Sekolah") {
        currentUser.nama_admin = nama;
      }
      if (passBaru) {
        currentUser.is_default_password = false;
      }
      localStorage.setItem("mktas_user", JSON.stringify(currentUser));

      // Perbarui UI Header
      const userInfo = document.getElementById("user-info");
      if (userInfo) userInfo.innerText = nama || currentUser.username;

      const userInitial = document.getElementById("user-initial");
      if (userInitial) userInitial.innerText = (nama || currentUser.username).charAt(0).toUpperCase();

      const modal = document.getElementById("modal-profil-user");
      if (modal) modal.classList.remove("active");

      Swal.fire({
        icon: "success",
        title: "Profil Berhasil Disimpan!",
        text: passBaru
          ? "Nama dan password baru Anda berhasil diperbarui."
          : "Nama admin berhasil diperbarui.",
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      showAlert(res?.message || "Gagal menyimpan perubahan profil.");
    }
  } catch (err) {
    showAlert("Terjadi kesalahan: " + (err.message || err));
  } finally {
    btn.innerHTML = origBtnText;
    btn.disabled = false;
  }
}
window.submitUpdateProfilUser = submitUpdateProfilUser;

// Tab Logic for Pengaturan (Mendukung semua tab termasuk legalitas)
function switchPengaturanTab(tabId, btn) {
  if (btn && btn.parentElement) {
    const nav = btn.parentElement;
    nav.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  ['sistem', 'logo', 'akun', 'legalitas'].forEach(id => {
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
}
window.switchPengaturanTab = switchPengaturanTab;


// ============================================================
// DASHBOARD MOBILE BOTTOM NAVIGATION
// Dipanggil dari initDashboard() setelah role diketahui
// ============================================================

function navigateToDash(target, labelEl) {
  // Highlight bottom nav active
  document.querySelectorAll('.dbnav-item').forEach(i => i.classList.remove('active'));
  if (labelEl) {
    const item = labelEl.closest('.dbnav-item');
    if (item) item.classList.add('active');
  }

  // Jika profil, buka modal
  if (target === '__profil__') {
    if (typeof openModalProfilUser === 'function') openModalProfilUser();
    return;
  }

  // Trigger click pada sidebar nav-item yang sesuai
  const sidebarLink = document.querySelector(`.nav-item[data-target="${target}"]`);
  if (sidebarLink) {
    sidebarLink.click();
    return;
  }

  // Fallback: langsung tampilkan section
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.section-content').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const sec = document.getElementById('section-' + target);
  if (sec) {
    sec.classList.add('active');
    const titleMap = {
      home: 'Beranda', sekolah: currentUser.role === 'Sekolah' ? 'Data Pegawai' : 'Master Data',
      jadwal: 'Jadwal', laporan: 'Laporan', webpublik: 'Web Publik',
      galeri: 'Galeri', pengaturan: 'Pengaturan'
    };
    const pt = document.getElementById('page-title');
    if (pt) pt.innerText = titleMap[target] || target;

    if (target === 'jadwal') loadJadwal();
    if (target === 'laporan') loadLaporan();
    if (target === 'webpublik') loadWebPublik();
    if (target === 'galeri') loadGaleri();
    if (target === 'sekolah') {
      if (currentUser.role === 'Sekolah' && typeof openPegawaiSekolahPage === 'function') {
        openPegawaiSekolahPage(currentUser.school_id, currentUser.nama || 'Sekolah');
      } else {
        loadSekolah();
      }
    }
  }
}
window.navigateToDash = navigateToDash;

function initDashboardBottomNav() {
  const nav = document.getElementById('dash-bottom-nav');
  if (!nav || !currentUser) return;

  const role = currentUser.role; // 'Superadmin' | 'Admin' | 'Sekolah'
  const initial = (currentUser.nama || currentUser.username || 'A').charAt(0).toUpperCase();

  // Helper: buat item biasa
  const item = (icon, label, target, isActive = false) =>
    `<button class="dbnav-item${isActive ? ' active' : ''}" onclick="navigateToDash('${target}', this)" title="${label}">
      <div class="dbnav-icon"><i class="${icon}"></i></div>
      <span class="dbnav-label">${label}</span>
    </button>`;

  // Helper: buat item tengah FAB (Beranda)
  const centerItem = (isActive = false) =>
    `<button class="dbnav-item dbnav-center${isActive ? ' active' : ''}" onclick="navigateToDash('home', this)" title="Beranda">
      <div class="dbnav-center-circle"><i class="fa-solid fa-house"></i></div>
      <span class="dbnav-label">Beranda</span>
    </button>`;

  // Helper: tombol profil (popup)
  const profilItem = () =>
    `<button class="dbnav-item dbnav-profil" onclick="navigateToDash('__profil__', this)" title="Profil">
      <div class="dbnav-icon" style="width:26px;height:26px;border-radius:50%;background:var(--gradient-primary);color:white;font-size:0.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${initial}</div>
      <span class="dbnav-label">Profil</span>
    </button>`;

  let html = '';

  if (role === 'Sekolah') {
    // Sekolah: Data Pegawai | Jadwal | Laporan | [Beranda] | Web Publik | Galeri | Profil
    html =
      item('fa-solid fa-users', 'Pegawai', 'sekolah', true) +
      item('fa-regular fa-calendar-days', 'Jadwal', 'jadwal') +
      item('fa-regular fa-file-lines', 'Laporan', 'laporan') +
      centerItem() +
      item('fa-solid fa-globe', 'Web Publik', 'webpublik') +
      item('fa-regular fa-images', 'Galeri', 'galeri') +
      profilItem();

  } else if (role === 'Admin') {
    // Admin: Master Data | Jadwal | Laporan | [Beranda] | Web Publik | Galeri | Profil
    html =
      item('fa-solid fa-database', 'Master Data', 'sekolah') +
      item('fa-regular fa-calendar-days', 'Jadwal', 'jadwal') +
      item('fa-regular fa-file-lines', 'Laporan', 'laporan') +
      centerItem(true) +
      item('fa-solid fa-globe', 'Web Publik', 'webpublik') +
      item('fa-regular fa-images', 'Galeri', 'galeri') +
      profilItem();

  } else if (role === 'Superadmin') {
    // Superadmin: Master Data | Jadwal | Laporan | [Beranda] | Web Publik | Galeri | Pengaturan
    html =
      item('fa-solid fa-database', 'Master Data', 'sekolah') +
      item('fa-regular fa-calendar-days', 'Jadwal', 'jadwal') +
      item('fa-regular fa-file-lines', 'Laporan', 'laporan') +
      centerItem(true) +
      item('fa-solid fa-globe', 'Web Publik', 'webpublik') +
      item('fa-regular fa-images', 'Galeri', 'galeri') +
      item('fa-solid fa-gear', 'Pengaturan', 'pengaturan');
  }

  nav.innerHTML = html;
  // Tampilkan nav (CSS sudah handle display via media query, tapi pastikan tidak ada display:none inline)
  nav.style.removeProperty('display');
}
window.initDashboardBottomNav = initDashboardBottomNav;

// ============================================================
// DASHBOARD CHARTS & STATS
// ============================================================
let chartInstances = {};

async function loadDashboardData() {
  if (!currentUser) return;

  const fallbackData = {
    totalSekolah: 0,
    totalStaff: 0,
    jadwal: { terlaksana: 0, belum: 0 },
    staff: { PNS: 0, PPPK: 0, Honorer: 0, Lainnya: 0 },
    laporanBulan: {
      Jan: 0, Feb: 0, Mar: 0, Apr: 0, Mei: 0, Jun: 0,
      Jul: 0, Ags: 0, Sep: 0, Okt: 0, Nov: 0, Des: 0
    }
  };

  try {
    const res = await fetchAPI("getDashboardStats", {});
    const payload = res && res.status === "success" && res.data ? res.data : fallbackData;
    renderDashboardStats(payload);
    renderDashboardCharts(payload);
  } catch (error) {
    console.error("Gagal memuat statistik dashboard:", error);
    renderDashboardStats(fallbackData);
    renderDashboardCharts(fallbackData);
  }
}

function renderDashboardStats(data) {
  const safeData = data || {
    totalSekolah: 0,
    totalStaff: 0,
    jadwal: { terlaksana: 0, belum: 0 }
  };

  const elTotalSekolah = document.getElementById("stat-total-sekolah");
  const elTotalPegawai = document.getElementById("stat-total-pegawai");
  const elJadwalTerlaksana = document.getElementById("stat-jadwal-terlaksana");
  const elJadwalBelum = document.getElementById("stat-jadwal-belum");

  if (elTotalSekolah) elTotalSekolah.textContent = Number(safeData.totalSekolah || 0);
  if (elTotalPegawai) elTotalPegawai.textContent = Number(safeData.totalStaff || 0);
  if (elJadwalTerlaksana) elJadwalTerlaksana.textContent = Number(safeData.jadwal?.terlaksana || 0);
  if (elJadwalBelum) elJadwalBelum.textContent = Number(safeData.jadwal?.belum || 0);
}

function renderDashboardCharts(data) {
  // Pastikan Chart.js sudah dimuat
  if (typeof Chart === 'undefined') return;

  const safeData = data || {
    jadwal: { terlaksana: 0, belum: 0 },
    staff: { PNS: 0, PPPK: 0, Honorer: 0, Lainnya: 0 },
    laporanBulan: {
      Jan: 0, Feb: 0, Mar: 0, Apr: 0, Mei: 0, Jun: 0,
      Jul: 0, Ags: 0, Sep: 0, Okt: 0, Nov: 0, Des: 0
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  // 1. Chart Status Jadwal
  const ctxJadwal = document.getElementById('chartJadwal');
  if (ctxJadwal) {
    if (chartInstances.jadwal) chartInstances.jadwal.destroy();
    chartInstances.jadwal = new Chart(ctxJadwal, {
      type: 'doughnut',
      data: {
        labels: ['Terlaksana', 'Belum Terlaksana'],
        datasets: [{
          data: [Number(safeData.jadwal?.terlaksana || 0), Number(safeData.jadwal?.belum || 0)],
          backgroundColor: ['#10b981', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: chartOptions
    });
  }

  // 2. Chart Status Pegawai
  const ctxPegawai = document.getElementById('chartPegawai');
  if (ctxPegawai) {
    if (chartInstances.pegawai) chartInstances.pegawai.destroy();
    const staffLabels = Object.keys(safeData.staff || {});
    const staffValues = Object.values(safeData.staff || {});
    chartInstances.pegawai = new Chart(ctxPegawai, {
      type: 'bar',
      data: {
        labels: staffLabels.length ? staffLabels : ['PNS', 'PPPK', 'Honorer', 'Lainnya'],
        datasets: [{
          label: 'Jumlah Pegawai',
          data: staffValues.length ? staffValues : [0, 0, 0, 0],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        ...chartOptions,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // 3. Chart Laporan per Bulan (Hanya untuk Admin/Superadmin)
  const containerLaporan = document.getElementById('chart-laporan-container');
  const ctxLaporan = document.getElementById('chartLaporan');

  if (currentUser.role !== 'Sekolah' && containerLaporan && ctxLaporan) {
    containerLaporan.style.display = 'block';

    if (chartInstances.laporan) chartInstances.laporan.destroy();
    const laporanLabels = Object.keys(safeData.laporanBulan || {});
    const laporanValues = Object.values(safeData.laporanBulan || {});
    chartInstances.laporan = new Chart(ctxLaporan, {
      type: 'line',
      data: {
        labels: laporanLabels.length ? laporanLabels : ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
        datasets: [{
          label: 'Laporan Diupload',
          data: laporanValues.length ? laporanValues : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        ...chartOptions,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }
}
