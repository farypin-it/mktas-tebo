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
  ul.innerHTML = '<li style="color: var(--text-muted); padding: 10px;">Memuat dokumen...</li>';

  const res  = await fetchAPI('getDokumenLaporan', { jadwal_id: jadwalId });
  const list = (res.status === 'success') ? res.data : [];

  ul.innerHTML = '';
  if (list.length === 0) {
    ul.innerHTML = '<li style="color: var(--text-muted); padding: 10px;">Belum ada dokumen diupload.</li>';
    return;
  }

  list.forEach((doc) => {
    const li       = document.createElement("li");
    li.style       = "padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;";
    const sizeText = doc.file_size ? ` (${(doc.file_size / 1024).toFixed(1)} KB)` : '';
    const tglText  = doc.uploaded_at ? ` \u2014 ${new Date(doc.uploaded_at).toLocaleDateString('id-ID')}` : '';
    li.innerHTML = `
      <div>
        <strong>${doc.jenis || '-'}</strong><br>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${doc.file_name}${sizeText}${tglText}</span>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-sm btn-info"  onclick="lihatDokumenLaporanById('${doc.id}')">Lihat</button>
        <button class="btn btn-sm btn-danger" onclick="hapusDokumenLaporan('${doc.id}', '${jadwalId}')">Hapus</button>
      </div>
    `;
    ul.appendChild(li);
  });
}

// Lihat dokumen — ambil data_url dari SQLite berdasarkan id
async function lihatDokumenLaporanById(docId) {
  const jadwalId = currentJadwalContext && currentJadwalContext.id;
  if (!jadwalId) return;
  const resAll = await fetchAPI('getDokumenLaporan', { jadwal_id: jadwalId });
  if (resAll.status === 'success') {
    const doc = resAll.data.find(d => d.id === docId);
    if (doc && doc.data_url) {
      lihatDokumenLaporan(doc.data_url, doc.file_name);
      return;
    }
  }
  Swal.fire('Error', 'Dokumen tidak ditemukan.', 'error');
}

// Hapus dokumen dari SQLite
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
  if (res.status === 'success') {
    Swal.fire({ icon: 'success', title: 'Dihapus!', timer: 1500, showConfirmButton: false });
    renderDokumenList(jadwalId);
  } else {
    Swal.fire('Gagal', res.message, 'error');
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
      <div style="background:var(--bg-card,#fff);border-radius:12px;width:100%;max-width:900px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:15px 20px;border-bottom:1px solid var(--border-color,#eee);">
          <strong id="modal-pratinjau-judul" style="font-size:1rem;"></strong>
          <button onclick="document.getElementById('modal-pratinjau-dokumen').remove()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);">&times;</button>
        </div>
        <div id="modal-pratinjau-konten" style="flex:1;overflow:auto;padding:10px;display:flex;align-items:center;justify-content:center;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('modal-pratinjau-judul').textContent = fileName;
  const konten = document.getElementById('modal-pratinjau-konten');

  if (isPdf) {
    konten.innerHTML = `<iframe src="${dataUrl}" style="width:100%;height:70vh;border:none;"></iframe>`;
  } else if (isImage) {
    konten.innerHTML = `<img src="${dataUrl}" style="max-width:100%;max-height:70vh;border-radius:8px;" />`;
  } else {
    konten.innerHTML = `<div style="padding:30px;text-align:center;"><i class="fas fa-file" style="font-size:3rem;margin-bottom:15px;"></i><br><p>Pratinjau tidak tersedia untuk jenis file ini.</p><a href="${dataUrl}" download="${fileName}" class="btn btn-primary" style="margin-top:10px;">Unduh File</a></div>`;
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

