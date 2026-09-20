// --- Logic Laporan ---
// Dokumen laporan disimpan ke SQLite (via fetchAPI → Electron IPC → db.js)
// BUKAN ke localStorage atau IndexedDB.


// ============================================================
// Render daftar dokumen dari SQLite
// ============================================================

function showLaporanView(viewId) {
  document.getElementById("laporan-view-tabel").classList.add("hidden");
  document.getElementById("laporan-view-detail").classList.add("hidden");
  document.getElementById(`laporan-view-${viewId}`).classList.remove("hidden");
}

async function renderDokumenList(jadwalId) {
  const ul = document.getElementById("list-dokumen-laporan");
  if (!ul) return;
  ul.innerHTML = '<li style="color: var(--text-muted); padding: 12px; text-align: center;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Memuat dokumen...</li>';

  let list = [];
  try {
    const res = await fetchAPI('getDokumenLaporan', { jadwal_id: jadwalId });
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      list = res.data;
    }
  } catch (e) {
    console.error('[Laporan Dokumen] Error fetching docs:', e);
  }

  ul.innerHTML = '';
  if (list.length === 0) {
    ul.innerHTML = '<li style="color: var(--text-muted); padding: 18px; text-align: center; background: rgba(0,0,0,0.02); border-radius: 8px;"><i class="fa-solid fa-folder-open" style="font-size: 1.8rem; margin-bottom: 8px; display: block; opacity: 0.6;"></i>Belum ada dokumen laporan yang diunggah untuk jadwal ini.</li>';
    return;
  }

  const currentUser = (typeof window.currentUser !== 'undefined' && window.currentUser) ? window.currentUser : (JSON.parse(localStorage.getItem('mktas_user') || '{}'));
  const isSekolah = currentUser && currentUser.role === 'Sekolah';

  list.forEach((doc) => {
    const li = document.createElement("li");
    li.style = "padding: 12px 14px; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;";
    const sizeText = doc.file_size ? ` (${(doc.file_size / 1024).toFixed(1)} KB)` : '';
    const tglText  = doc.uploaded_at ? ` \u2014 ${new Date(doc.uploaded_at).toLocaleDateString('id-ID')}` : '';

    let actionButtons = `
      <button class="btn btn-sm btn-info" onclick="lihatDokumenLaporanById('${doc.id}')" title="Buka dan Pratinjau Dokumen">
        <i class="fa-solid fa-eye"></i> Lihat
      </button>
      <button class="btn btn-sm btn-primary" onclick="unduhDokumenLaporanById('${doc.id}')" title="Unduh Dokumen">
        <i class="fa-solid fa-download"></i> Unduh
      </button>
    `;

    // Tombol hapus hanya muncul untuk Admin / Superadmin
    if (!isSekolah) {
      actionButtons += `
        <button class="btn btn-sm btn-danger" onclick="hapusDokumenLaporan('${doc.id}', '${jadwalId}')" title="Hapus Dokumen">
          <i class="fa-solid fa-trash"></i> Hapus
        </button>
      `;
    }

    li.innerHTML = `
      <div style="flex: 1; min-width: 200px;">
        <strong style="font-size: 0.92rem; color: var(--text-main);"><i class="fa-solid fa-file-lines" style="color: var(--primary-color); margin-right: 6px;"></i>${doc.jenis || 'Dokumen'}</strong><br>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${doc.file_name || 'Dokumen'}${sizeText}${tglText}</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        ${actionButtons}
      </div>
    `;
    ul.appendChild(li);
  });
}

// Unduh dokumen laporan ke perangkat (berlaku untuk semua pengguna)
async function unduhDokumenLaporanById(docId) {
  const jadwalId = currentJadwalContext && currentJadwalContext.id;
  if (!jadwalId) {
    Swal.fire('Error', 'Jadwal tidak terdeteksi.', 'error');
    return;
  }
  const resAll = await fetchAPI('getDokumenLaporan', { jadwal_id: jadwalId });
  if (resAll && resAll.status === 'success' && Array.isArray(resAll.data)) {
    const doc = resAll.data.find(d => String(d.id) === String(docId));
    if (doc && doc.data_url) {
      const fileName = doc.file_name || 'dokumen_laporan';
      const a = document.createElement('a');
      a.href = doc.data_url;
      a.download = fileName;
      if (doc.data_url.startsWith('http://') || doc.data_url.startsWith('https://')) {
        a.target = '_blank';
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
  }
  Swal.fire('Error', 'Dokumen tidak ditemukan atau file unduhan rusak.', 'error');
}

// Lihat dokumen — ambil data_url dari SQLite / online berdasarkan id
async function lihatDokumenLaporanById(docId) {
  const jadwalId = currentJadwalContext && currentJadwalContext.id;
  if (!jadwalId) return;
  const resAll = await fetchAPI('getDokumenLaporan', { jadwal_id: jadwalId });
  if (resAll && resAll.status === 'success' && Array.isArray(resAll.data)) {
    const doc = resAll.data.find(d => String(d.id) === String(docId));
    if (doc && doc.data_url) {
      lihatDokumenLaporan(doc.data_url, doc.file_name || 'Dokumen');
      return;
    }
  }
  Swal.fire('Error', 'Dokumen tidak ditemukan.', 'error');
}

// Hapus dokumen dari database (khusus Admin)
async function hapusDokumenLaporan(docId, jadwalId) {
  const konfirm = await Swal.fire({
    title: 'Hapus Dokumen?',
    text: 'Dokumen akan dihapus permanen dari database.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444'
  });
  if (!konfirm.isConfirmed) return;

  const res = await fetchAPI('hapusDokumenLaporan', { id: docId });
  if (res && res.status === 'success') {
    Swal.fire({ icon: 'success', title: 'Dihapus!', timer: 1500, showConfirmButton: false });
    renderDokumenList(jadwalId);
  } else {
    Swal.fire('Gagal', (res && res.message) ? res.message : 'Gagal menghapus dokumen.', 'error');
  }
}

// Fungsi untuk melihat pratinjau dokumen laporan yang diupload (bukan daftar hadir)
function lihatDokumenLaporan(dataUrl, fileName) {
  const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(fileName);
  const isPdf   = /\.pdf$/i.test(fileName);

  let modal = document.getElementById('modal-pratinjau-dokumen');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-pratinjau-dokumen';
    modal.style = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:12px;width:100%;max-width:900px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--border-color,#eee);gap:12px;">
          <strong id="modal-pratinjau-judul" style="font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;color:var(--text-main,#111);"></strong>
          <div style="display:flex;align-items:center;gap:10px;">
            <a id="modal-pratinjau-btn-unduh" href="#" download class="btn btn-sm btn-primary" style="display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-download"></i> Unduh</a>
            <button onclick="document.getElementById('modal-pratinjau-dokumen').remove()" style="background:none;border:none;font-size:1.6rem;cursor:pointer;color:var(--text-muted);line-height:1;">&times;</button>
          </div>
        </div>
        <div id="modal-pratinjau-konten" style="flex:1;overflow:auto;padding:12px;display:flex;align-items:center;justify-content:center;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('modal-pratinjau-judul').textContent = fileName;
  const downBtn = document.getElementById('modal-pratinjau-btn-unduh');
  if (downBtn) {
    downBtn.href = dataUrl;
    downBtn.setAttribute('download', fileName || 'dokumen');
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      downBtn.target = '_blank';
    } else {
      downBtn.removeAttribute('target');
    }
  }

  const konten = document.getElementById('modal-pratinjau-konten');

  if (isPdf) {
    konten.innerHTML = `<iframe src="${dataUrl}" style="width:100%;height:70vh;border:none;border-radius:6px;"></iframe>`;
  } else if (isImage) {
    konten.innerHTML = `<img src="${dataUrl}" style="max-width:100%;max-height:70vh;border-radius:8px;object-fit:contain;" />`;
  } else {
    konten.innerHTML = `<div style="padding:30px;text-align:center;"><i class="fas fa-file" style="font-size:3rem;margin-bottom:15px;color:var(--primary-color);"></i><br><p style="margin-bottom:12px;">Pratinjau langsung tidak tersedia untuk format file ini.</p><a href="${dataUrl}" download="${fileName}" class="btn btn-primary" target="_blank"><i class="fa-solid fa-download"></i> Unduh File</a></div>`;
  }
  modal.style.display = 'flex';
}



// ============================================================
// Handle Upload Dokumen Laporan — Simpan ke SQLite
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const formUpload = document.getElementById("form-upload-laporan");
  if (formUpload) {
    formUpload.addEventListener("submit", async function(e) {
      e.preventDefault();
      const select    = document.getElementById("upload-laporan-jenis");
      const jenis     = select.options[select.selectedIndex].text.replace(/^\d+\.\s*/, '');
      const fileInput = document.getElementById("upload-laporan-file");

      if (!fileInput.files.length) return;
      const file     = fileInput.files[0];
      const fileName = file.name;
      const jadwalId = currentJadwalContext && currentJadwalContext.id;

      if (!jadwalId) {
        Swal.fire("Error", "Jadwal tidak terdeteksi, coba buka detail laporan kembali.", "error");
        return;
      }

      // Validasi ukuran (SQLite mendukung BLOB besar, tetapi beri batas wajar)
      const MAX_SIZE_MB = 50;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        Swal.fire("File Terlalu Besar", `Ukuran file maksimal ${MAX_SIZE_MB}MB.`, "warning");
        return;
      }

      // Baca file sebagai Data URL (base64) lalu simpan ke SQLite via fetchAPI
      const reader = new FileReader();
      reader.onload = async function(ev) {
        const dataUrl = ev.target.result;
        const res = await fetchAPI('saveDokumenLaporan', {
          jadwal_id: jadwalId,
          jenis,
          file_name: fileName,
          data_url:  dataUrl,
          file_size: file.size
        });

        if (res.status === 'success') {
          renderDokumenList(jadwalId);
          Swal.fire("Berhasil", `Dokumen '${fileName}' berhasil disimpan ke database SQLite!`, "success");
          fileInput.value = "";
        } else {
          Swal.fire("Gagal Simpan", res.message || "Terjadi kesalahan.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }
});

// (Semua fungsi sudah didefinisikan di atas. File selesai.)

