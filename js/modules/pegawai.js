// --- Logic Halaman Pegawai per Sekolah (Inline, bukan Modal) ---
let currentPegawaiSchoolId = (typeof currentUser !== 'undefined' && currentUser && currentUser.school_id) ? currentUser.school_id : '';
let currentPegawaiSchoolName = (typeof currentUser !== 'undefined' && currentUser && currentUser.nama) ? currentUser.nama : '';

async function openPegawaiSekolahPage(schoolId, schoolName) {
  currentPegawaiSchoolId = schoolId;
  currentPegawaiSchoolName = schoolName;

  // Sembunyikan semua section, tampilkan section pegawai sekolah
  document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('section-sekolah-pegawai');
  if (sec) { sec.classList.add('active'); sec.style.display = 'block'; }

  // Set judul
  document.getElementById('judul-pegawai-sekolah').innerText = `Daftar Pegawai TAS — ${schoolName}`;

  // Hide back button for Sekolah role
  const btnKembali = document.querySelector("button[onclick='tutupPegawaiSekolahPage()']");
  if (btnKembali) {
    if (currentUser && currentUser.role === "Sekolah") {
      btnKembali.style.display = 'none';
    } else {
      btnKembali.style.display = 'inline-block';
    }
  }

  // Atur visibilitas tombol Tambah & Import untuk Admin (hanya readonly)
  const btnTambah = document.getElementById('btn-tambah-pegawai-sekolah');
  const btnImport = document.querySelector("#section-sekolah-pegawai button[onclick*='modal-import-pegawai']");
  if (currentUser && currentUser.role === "Admin") {
    if (btnTambah) btnTambah.style.display = 'none';
    if (btnImport) btnImport.style.display = 'none';
  } else {
    if (btnTambah) btnTambah.style.display = 'inline-flex';
    if (btnImport) btnImport.style.display = 'inline-flex';
  }
  if (btnTambah) {
    btnTambah.onclick = () => {
      // Buka modal seketika (0 detik / instan!)
      window.showModal('modal-pegawai');

      const select = document.getElementById('add-staff-sekolah');
      if (select) {
        // Jika user adalah role Sekolah: gunakan data yang sudah ada di memori tanpa request
        if (currentUser && currentUser.role === "Sekolah") {
          const sName = currentPegawaiSchoolName || currentUser.nama || 'Sekolah Anda';
          select.innerHTML = `<option value="${schoolId}" selected>${sName}</option>`;
          select.disabled = true;
        } else {
          // Admin: jika cachedSchools sudah ada
          if (cachedSchools && cachedSchools.length > 0) {
            select.innerHTML = '';
            cachedSchools.forEach(s => {
              select.innerHTML += `<option value="${s.id}"${s.id == schoolId ? ' selected' : ''}>${s.nama}</option>`;
            });
          } else {
            select.innerHTML = `<option value="${schoolId}">${currentPegawaiSchoolName || 'Memuat daftar sekolah...'}</option>`;
            ensureSchoolsLoaded().then(() => {
              if (cachedSchools && cachedSchools.length > 0) {
                select.innerHTML = '';
                cachedSchools.forEach(s => {
                  select.innerHTML += `<option value="${s.id}"${s.id == schoolId ? ' selected' : ''}>${s.nama}</option>`;
                });
              }
            });
          }
        }
      }
    };
  }

  await loadPegawaiSekolahInline(schoolId);
}

function tutupPegawaiSekolahPage() {
  // Sembunyikan section pegawai, tampilkan section sekolah
  const secPegawai = document.getElementById('section-sekolah-pegawai');
  if (secPegawai) { secPegawai.classList.remove('active'); secPegawai.style.display = 'none'; }
  const secSekolah = document.getElementById('section-sekolah');
  if (secSekolah) { secSekolah.classList.add('active'); }
}

function renderPegawaiSekolahInlineRows(tbody, staffList, schoolId) {
  if (!tbody) return;
  // Update allPegawaiData agar openEditStaff bisa menemukan item
  staffList.forEach(item => {
    const idx = allPegawaiData.findIndex(p => p.id === item.id);
    if (idx >= 0) allPegawaiData[idx] = item;
    else allPegawaiData.push(item);
  });

  let html = '';
  if (staffList.length === 0) {
    html = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Belum ada pegawai.</td></tr>`;
  } else {
    staffList.forEach(item => {
      const displayName = item.nama_lengkap || item.nama || '-';
      const displayJabatan = item.nama_jabatan_tugas || item.jabatan_tugas || item.nama_jabatan_sk || item.jabatan_sk || item.jabatan || '-';
      html += `
        <tr>
          <td><b>${displayName}</b><br><small style="color: var(--text-muted);white-space:nowrap;">NIP: ${item.nip || '-'}</small></td>
          <td><span style="background: var(--bg-gradient-end); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${displayJabatan}</span></td>
          <td>${item.no_wa || item.no_hp || '-'}</td>
          <td style="text-align: center; white-space: nowrap;">
            ${currentUser && currentUser.role === 'Admin' ? '<span class="text-muted" style="font-size:0.85rem;">-</span>' : `
              <button class="btn btn-sm btn-outline" onclick="openEditStaff('${item.id}')" title="Edit"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteStaff('${item.id}', '${schoolId}')" title="Hapus"><i class="fas fa-trash"></i></button>
            `}
          </td>
        </tr>
      `;
    });
  }
  tbody.innerHTML = html;
}

async function loadPegawaiSekolahInline(schoolId, forceRefresh = false) {
  const tbody = document.querySelector('#table-pegawai-sekolah-inline tbody');
  const loader = document.getElementById('loader-pegawai-sekolah-inline');
  if (!tbody) return;

  if (loader) loader.classList.add('hidden');

  const cacheKey = `mktas_staff_${schoolId}`;
  const localStaff = (typeof safeReadJsonStorage === 'function')
    ? safeReadJsonStorage(cacheKey, [])
    : JSON.parse(localStorage.getItem(cacheKey) || '[]');
  const cachedVer = localStorage.getItem('mktas_data_version') || '';

  // 1. Tampilkan dari cache seketika jika ada (0 ms)
  if (Array.isArray(localStaff) && localStaff.length > 0 && !forceRefresh) {
    renderPegawaiSekolahInlineRows(tbody, localStaff, schoolId);
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="table-loading-cell"><div class="loader"></div><div>Memuat data pegawai sekolah...</div></td></tr>';
  }

  // 2. Cek versi data di latar belakang
  try {
    const vRes = await fetchAPI('getDataVersion', {});
    const serverVer = (vRes && vRes.status === 'success' && vRes.version) ? String(vRes.version) : '';

    if (serverVer && serverVer === cachedVer && Array.isArray(localStaff) && localStaff.length > 0 && !forceRefresh) {
      return; // Versi data cocok & sudah tampil dari cache: SELESAI (0 spreadsheet calls)
    }

    const result = await fetchAPI('getStaff', { school_id: schoolId });
    if (result.status === 'success' && Array.isArray(result.data)) {
      if (serverVer) localStorage.setItem('mktas_data_version', serverVer);
      try { localStorage.setItem(cacheKey, JSON.stringify(result.data)); } catch (e) {}
      renderPegawaiSekolahInlineRows(tbody, result.data, schoolId);
    } else if (!localStaff || localStaff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--danger-color);">Gagal memuat data: ${result.message || 'Terjadi kesalahan'}</td></tr>`;
    }
  } catch (err) {
    console.error('[loadPegawaiSekolahInline]', err);
    if (!localStaff || localStaff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Gagal memuat data pegawai. Periksa koneksi.</td></tr>`;
    }
  }
}


// Unduh Template Excel Pegawai dengan Dropdown Validation (ExcelJS)
async function unduhTemplatePegawai() {
  if (typeof ExcelJS === 'undefined') {
    Swal.fire('Error', 'Library ExcelJS belum dimuat. Coba muat ulang halaman (perlu koneksi internet).', 'error');
    return;
  }

  const OPT = {
    jenis_kelamin: ['Laki-laki', 'Perempuan'],
    jabatan_tugas: ['Kepala/Kasubbag TU', 'Koordinator TAS', 'Staf Adm. Kepegawaian', 'Staf Adm. Kesiswaan', 'Staf Adm. Keuangan', 'Staf Adm. Kurikulum', 'Staf Adm. Sarpras', 'Staf Adm. Persuratan', 'Operator', 'Laboran', 'Pustakawan', 'Penjaga Sekolah', 'Petugas Kebersihan', 'Satpam', 'Pramusaji', 'Toolman', 'Teknisi'],
    jabatan_sk: ['Kepala Sub Bagian Tata Usaha', 'Kepala Tata Usaha', 'Penata Layanan Operasional', 'Pengelola Layanan Operasional', 'Operator Layanan Operasional', 'Pengadministrasi Umum', 'Pengadministrasi Kepegawaian', 'Pengadministrasi Keuangan', 'Pengadministrasi Persuratan', 'Pengadministrasi Kesiswaan', 'Pengadministrasi Sarana Prasarana', 'Pengadministrasi Kurikulum', 'Pengelola Perpustakaan', 'Pengelola Laboratorium', 'Pranata Komputer', 'Analis SDM Aparatur', 'Arsiparis', 'Pustakawan', 'Penjaga Sekolah', 'Satuan Pengamanan', 'Tenaga Kebersihan', 'Pengemudi'],
    status_pegawai: ['PNS', 'PPPK', 'PPPK PW', 'Non ASN'],
    pangkat_gol: [
      // Golongan PNS
      'Juru Muda / Ia', 'Juru Muda Tk.I / Ib', 'Juru / Ic', 'Juru Tk.I / Id',
      'Pengatur Muda / IIa', 'Pengatur Muda Tk.I / IIb', 'Pengatur / IIc', 'Pengatur Tk.I / IId',
      'Penata Muda / IIIa', 'Penata Muda Tk.I / IIIb', 'Penata / IIIc', 'Penata Tk.I / IIId',
      'Pembina / IVa', 'Pembina Tk.I / IVb', 'Pembina Utama Muda / IVc', 'Pembina Utama Madya / IVd', 'Pembina Utama / IVe',
      // Golongan PPPK / P3K (Golongan I s/d XVII)
      'Golongan I', 'Golongan II', 'Golongan III', 'Golongan IV', 'Golongan V',
      'Golongan VI', 'Golongan VII', 'Golongan VIII', 'Golongan IX', 'Golongan X',
      'Golongan XI', 'Golongan XII', 'Golongan XIII', 'Golongan XIV', 'Golongan XV',
      'Golongan XVI', 'Golongan XVII',
      '-'
    ],
    pendidikan: ['SD', 'SMP', 'SMA/SMK', 'D1/D2/D3', 'S1', 'S2', 'S3'],
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM MKTAS';

  // 1. Sheet Template Pegawai diletakkan di URUTAN PERTAMA (Sheet 1)
  const ws = wb.addWorksheet('Template Pegawai');
  ws.columns = [
    { header: 'nama', key: 'nama', width: 28 },
    { header: 'nip', key: 'nip', width: 24 },
    { header: 'jenis_kelamin', key: 'jk', width: 14 },
    { header: 'jabatan_tugas', key: 'jbt', width: 28 },
    { header: 'jabatan_sk', key: 'jsk', width: 36 },
    { header: 'status_pegawai', key: 'sp', width: 14 },
    { header: 'pangkat_gol', key: 'pg', width: 24 },
    { header: 'no_wa', key: 'nowa', width: 16 },
    { header: 'email', key: 'email', width: 24 },
    { header: 'tempat_lahir', key: 'tl', width: 18 },
    { header: 'tgl_lahir', key: 'tgl', width: 13 },
    { header: 'pendidikan_terakhir', key: 'pend', width: 14 },
  ];

  // Header styling (biru, putih, bold)
  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(1).height = 24;

  // Contoh data baris 1
  ws.addRow({
    nama: 'Budi Santoso', nip: '198001012005011001', jk: 'Laki-laki',
    jbt: 'Operator', jsk: 'Pengelola Layanan Operasional', sp: 'PNS',
    pg: 'Penata Muda / IIIa', nowa: '08123456789', email: 'budi@mail.com',
    tl: 'Jakarta', tgl: '1980-01-01', pend: 'S1'
  });

  // 2. Sheet Pilihan (hidden) diletakkan di URUTAN KEDUA (Sheet 2)
  const wsPilihan = wb.addWorksheet('Pilihan');
  wsPilihan.state = 'hidden';
  Object.values(OPT).forEach((arr, ci) => {
    arr.forEach((val, ri) => { wsPilihan.getCell(ri + 1, ci + 1).value = val; });
  });

  // Dropdown validation (referensi ke sheet Pilihan)
  // col 3=C=jenis_kelamin → Pilihan A, col 4=D=jabatan_tugas → B, dll
  const dvMap = [
    { colIdx: 3, pCol: 'A', count: OPT.jenis_kelamin.length },
    { colIdx: 4, pCol: 'B', count: OPT.jabatan_tugas.length },
    { colIdx: 5, pCol: 'C', count: OPT.jabatan_sk.length },
    { colIdx: 6, pCol: 'D', count: OPT.status_pegawai.length },
    { colIdx: 7, pCol: 'E', count: OPT.pangkat_gol.length },
    { colIdx: 12, pCol: 'F', count: OPT.pendidikan.length },
  ];
  const MAX_ROW = 1000;
  dvMap.forEach(({ colIdx, pCol, count }) => {
    const colLtr = ws.getColumn(colIdx).letter;
    for (let r = 2; r <= MAX_ROW; r++) {
      ws.getCell(`${colLtr}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Pilihan!$${pCol}$1:$${pCol}$${count}`],
        showErrorMessage: true,
        errorTitle: 'Pilihan tidak valid',
        error: 'Pilih dari dropdown yang tersedia.',
      };
    }
  });

  // Download
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'template_pegawai_mktas.xlsx'; a.click();
  URL.revokeObjectURL(url);
  Swal.fire({ icon: 'success', title: 'Template Diunduh!', text: 'Klik sel kolom di Excel → muncul dropdown pilihan (PNS & PPPK).', timer: 3000, showConfirmButton: false });
}

// Proses Import dari modal (baca file input #import-pegawai-file)
async function prosesImportPegawaiExcel() {
  const fileInput = document.getElementById('import-pegawai-file');
  if (!fileInput || !fileInput.files.length) {
    Swal.fire('Peringatan', 'Pilih file Excel terlebih dahulu.', 'warning');
    return;
  }
  const file = fileInput.files[0];

  if (typeof XLSX === 'undefined') {
    Swal.fire('Error', 'Library Excel (SheetJS) belum dimuat.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const workbook = XLSX.read(ev.target.result, { type: 'binary' });

      // CARI SHEET YANG TEPAT (Mencegah membaca sheet 'Pilihan' atau opsi lain)
      let targetSheet = null;
      let targetSheetName = '';

      for (const sName of workbook.SheetNames) {
        const ln = sName.toLowerCase().trim();
        if (ln.includes('pilihan') || ln.includes('option') || ln.includes('ref')) continue;
        const testSheet = workbook.Sheets[sName];
        const sample = XLSX.utils.sheet_to_json(testSheet, { header: 1 });
        if (sample && sample.length > 0) {
          const firstRow = (sample[0] || []).map(c => String(c || '').toLowerCase().replace(/[\s\-_]/g, ''));
          if (firstRow.some(c => c.includes('nama') || c.includes('nip') || c.includes('jabatan'))) {
            targetSheet = testSheet;
            targetSheetName = sName;
            break;
          }
        }
      }

      if (!targetSheet) {
        // Fallback: ambil sheet pertama yang namanya BUKAN 'pilihan'
        targetSheetName = workbook.SheetNames.find(n => !n.toLowerCase().includes('pilihan')) || workbook.SheetNames[0];
        targetSheet = workbook.Sheets[targetSheetName];
      }

      const rows = XLSX.utils.sheet_to_json(targetSheet);

      if (!rows || rows.length === 0) {
        Swal.fire('Peringatan', `Sheet "${targetSheetName}" kosong atau tidak memiliki data pegawai.`, 'warning');
        return;
      }

      // Helper ekstraksi kolom Excel yang fleksibel
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

      const targetSchoolId = currentPegawaiSchoolId || (typeof currentUser !== 'undefined' && currentUser ? currentUser.school_id : '');

      // Normalisasi seluruh baris dari Excel
      const normalizedRows = rows.map(r => {
        const nip = extractF(r, 'nip', 'nik', 'nip_nik', 'nipnik', 'nomor_induk', 'nomorinduk', 'no_ktp', 'noktp', 'no_identitas');
        const nama = extractF(r, 'nama_lengkap', 'nama', 'namalengkap', 'nama_pegawai', 'namapegawai');
        let jk = extractF(r, 'jenis_kelamin', 'jeniskelamin', 'jk', 'gender', 'sex') || 'Laki-laki';
        if (jk.toUpperCase() === 'L' || jk.toLowerCase().includes('laki')) jk = 'Laki-laki';
        else if (jk.toUpperCase() === 'P' || jk.toLowerCase().includes('perempuan') || jk.toLowerCase().includes('wanita')) jk = 'Perempuan';

        return {
          school_id: targetSchoolId,
          nip: nip,
          nama: nama,
          nama_lengkap: nama,
          jenis_kelamin: jk,
          jabatan_tugas: extractF(r, 'jabatan_tugas', 'nama_jabatan_tugas', 'tugas'),
          nama_jabatan_tugas: extractF(r, 'jabatan_tugas', 'nama_jabatan_tugas', 'tugas'),
          nama_jabatan_sk: extractF(r, 'jabatan_sk', 'nama_jabatan_sk', 'sk_jabatan', 'jabatan'),
          status_pegawai: extractF(r, 'status_pegawai', 'statuspegawai', 'status', 'kepegawaian') || 'Honorer',
          pangkat_gol: extractF(r, 'pangkat_gol', 'pangkat', 'golongan', 'gol') || '-',
          no_wa: extractF(r, 'no_wa', 'nowa', 'wa', 'hp', 'no_hp', 'nohp', 'telepon'),
          email: extractF(r, 'email', 'surel'),
          tempat_lahir: extractF(r, 'tempat_lahir', 'tempatlahir', 'tempat'),
          tgl_lahir: extractF(r, 'tgl_lahir', 'tgllahir', 'tanggal_lahir'),
          pendidikan_terakhir: extractF(r, 'pendidikan_terakhir', 'pendidikan', 'ijazah'),
          foto: ''
        };
      });

      // SYARAT MUTLAK: Wajib ada NIP/NIK dan Nama Lengkap!
      const validStaff = normalizedRows.filter(s => s.nip && s.nip !== '-' && s.nip.toLowerCase() !== 'null' && (s.nama_lengkap || s.nama));
      const skippedNoNip = rows.length - validStaff.length;

      if (validStaff.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Tidak Ada Data Valid',
          text: `Tidak ditemukan data pegawai yang memiliki NIP/NIK dan Nama pada sheet "${targetSheetName}". Data tanpa NIP/NIK dilewati.`
        });
        return;
      }

      const confirm = await Swal.fire({
        title: `Import ${validStaff.length} Pegawai?`,
        html: `File: <b>${file.name}</b> (Sheet: <b>${targetSheetName}</b>)<br>Tujuan: <b>${currentPegawaiSchoolName || 'Sekolah'}</b><br><small style="color:var(--text-muted);">* Data dengan NIP/NIK sama otomatis menimpa (update).${skippedNoNip > 0 ? `<br>* <b>${skippedNoNip} baris tanpa NIP/NIK dilewati</b>.` : ''}</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Import!',
        cancelButtonText: 'Batal'
      });
      if (!confirm.isConfirmed) return;

      Swal.fire({
        title: 'Memproses Import...',
        text: `Sedang mengimpor ${validStaff.length} pegawai ke database...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      // Kirim via endpoint importStaff (batch) dengan format data & items ganda agar selalu terbaca
      let res = await fetchAPI('importStaff', {
        school_id: targetSchoolId,
        items: validStaff,
        data: validStaff
      });

      // Fallback jika backend belum merespon batch: panggil addStaff berurutan (sudah ada upsert NIP)
      if (!res || res.status !== 'success') {
        let successCount = 0, failCount = 0;
        for (const payload of validStaff) {
          try {
            const r = await fetchAPI('addStaff', payload);
            if (r && r.status === 'success') successCount++;
            else failCount++;
          } catch { failCount++; }
        }
        res = {
          status: successCount > 0 ? 'success' : 'error',
          message: successCount > 0
            ? `Berhasil memproses ${successCount} pegawai. Gagal: ${failCount}.${skippedNoNip > 0 ? ` Dilewati (tanpa NIP/NIK): ${skippedNoNip} data.` : ''}`
            : 'Gagal mengimpor data ke server. Periksa koneksi atau URL backend online.'
        };
      }

      window.closeModal('modal-import-pegawai');
      fileInput.value = '';
      Swal.fire(res.status === 'success' ? 'Import Selesai' : 'Gagal', res.message || 'Proses import selesai.', res.status === 'success' ? 'success' : 'error');
      if (targetSchoolId) {
        loadPegawaiSekolahInline(targetSchoolId);
      }

    } catch (err) {
      Swal.fire('Error', 'Gagal membaca file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsBinaryString(file);
}

// importPegawaiExcel — alias lama, sekarang buka modal
function importPegawaiExcel() {
  window.showModal('modal-import-pegawai');
}

async function deleteStaff(id, schoolId) {
  const result = await Swal.fire({
    title: 'Hapus Pegawai?',
    text: "Data ini akan dihapus secara permanen!",
    icon: 'warning',
    showCancelButton: true
  });
  if (result.isConfirmed) {
    Swal.fire({
      title: 'Menghapus pegawai...',
      text: 'Mohon tunggu sebentar.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAPI("deleteStaff", { id });
    if (res.status === "success") {
      Swal.close();
      Swal.fire("Dihapus!", res.message, "success");

      // Hapus seketika dari memori & cache lokal (0 ms)
      const targetSId = (typeof currentPegawaiSchoolId !== 'undefined' && currentPegawaiSchoolId) ? currentPegawaiSchoolId : schoolId;
      if (targetSId) {
        const cKey = `mktas_staff_${targetSId}`;
        let sArr = (typeof safeReadJsonStorage === 'function') ? safeReadJsonStorage(cKey, []) : [];
        sArr = sArr.filter(p => p.id !== id);
        try { localStorage.setItem(cKey, JSON.stringify(sArr)); } catch(e) {}
      }
      let allArr = (typeof safeReadJsonStorage === 'function') ? safeReadJsonStorage('mktas_staff_all', []) : [];
      allArr = allArr.filter(p => p.id !== id);
      try { localStorage.setItem('mktas_staff_all', JSON.stringify(allArr)); } catch(e) {}
      allPegawaiData = allPegawaiData.filter(p => p.id !== id);

      // Reload tampilan yang sedang aktif
      if (typeof currentPegawaiSchoolId !== 'undefined' && currentPegawaiSchoolId) {
        loadPegawaiSekolahInline(currentPegawaiSchoolId, true);
      } else if (schoolId) {
        if (typeof loadPegawaiSekolah === 'function') {
          loadPegawaiSekolah(schoolId);
        } else {
          loadPegawai(true);
        }
      } else if (typeof loadPegawai === 'function') {
        loadPegawai(true);
      }
    } else {
      Swal.close();
      Swal.fire("Gagal", res.message, "error");
    }
  }
}
