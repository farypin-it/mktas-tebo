// Kelola Akun (Admin) Logic
// ==========================================

let cachedAdmins = safeReadJsonStorage('mktas_admins', []);

function renderAdminTable(adminList) {
  const tableBody = document.querySelector("#table-admin tbody");
  if (!tableBody) return;
  let html = "";
  adminList.forEach(admin => {
    let roleBadge = '';
    if (admin.role === 'Superadmin') {
      roleBadge = '<span class="badge badge-primary">Superadmin</span>';
    } else if (admin.role === 'Sekolah') {
      roleBadge = '<span class="badge badge-secondary" style="background: #10b981; color: #fff">Sekolah</span>';
    } else {
      roleBadge = '<span class="badge badge-secondary" style="background: #e5e7eb; color: #374151">Admin</span>';
    }
      
    html += `
    <tr>
      <td>${admin.nama || admin.username}</td>
      <td>${admin.username}</td>
      <td>${roleBadge}</td>
      <td>
        <button type="button" class="btn-icon" style="color: var(--primary-color)" onclick="editAdminUI('${admin.id}')">✏️</button>
        <button type="button" class="btn-icon" style="color: var(--danger-color)" onclick="deleteAdminUI('${admin.id}')">🗑️</button>
      </td>
    </tr>
    `;
  });
  tableBody.innerHTML = html;
  if (adminList.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>Belum ada data admin</td></tr>";
  }
}

async function loadAdmins() {
  const tableBody = document.querySelector("#table-admin tbody");
  if (!tableBody) return;

  // Stale-While-Revalidate: render cache seketika
  if (cachedAdmins && cachedAdmins.length > 0) {
    renderAdminTable(cachedAdmins);
  } else {
    tableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>Memuat data...</td></tr>";
  }

  try {
    const res = await fetchAPI("getAdmins");
    if (res.status === "success" && Array.isArray(res.data)) {
      cachedAdmins = res.data;
      try { localStorage.setItem('mktas_admins', JSON.stringify(cachedAdmins)); } catch(e) {}
      renderAdminTable(cachedAdmins);
    } else if (!cachedAdmins || cachedAdmins.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='4' style='text-align: center; color: red;'>Gagal memuat data</td></tr>";
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteAdminUI(id) {
  const confirm = await Swal.fire({
    title: 'Hapus Akun?',
    text: "Akun ini akan dihapus secara permanen.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  });

  if (confirm.isConfirmed) {
    Swal.fire({
      title: 'Menghapus akun...',
      text: 'Mohon tunggu sebentar.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAPI("deleteAdmin", { id });
    if (res.status === "success") {
      Swal.close();
      Swal.fire({ icon: 'success', text: 'Admin berhasil dihapus' });
      loadAdmins();
    } else {
      Swal.close();
      Swal.fire({ icon: 'error', text: res.message });
    }
  }
}

window.editAdminUI = function(id) {
  // Buka modal seketika (0 ms)!
  window.showModal('modal-edit-admin');

  const admin = (cachedAdmins || []).find(a => String(a.id) === String(id));
  if (admin) {
    document.getElementById('edit-admin-id').value = admin.id;
    document.getElementById('edit-admin-nama').value = admin.nama || admin.username;
    document.getElementById('edit-admin-username').value = admin.username;
    document.getElementById('edit-admin-role').value = admin.role;
    document.getElementById('edit-admin-password').value = '';
  } else {
    fetchAPI('getAdmins').then(res => {
      if (res.status === 'success' && Array.isArray(res.data)) {
        cachedAdmins = res.data;
        const a = cachedAdmins.find(item => String(item.id) === String(id));
        if (a) {
          document.getElementById('edit-admin-id').value = a.id;
          document.getElementById('edit-admin-nama').value = a.nama || a.username;
          document.getElementById('edit-admin-username').value = a.username;
          document.getElementById('edit-admin-role').value = a.role;
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const formEditAdmin = document.getElementById('form-edit-admin');
  if (formEditAdmin) {
    formEditAdmin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-admin-id').value;
      const nama = document.getElementById('edit-admin-nama').value;
      const username = document.getElementById('edit-admin-username').value;
      const role = document.getElementById('edit-admin-role').value;
      const password = document.getElementById('edit-admin-password').value;
      
      const data = { id, nama, username, role };
      if (password) data.password = password;
      
      Swal.fire({
        title: 'Memperbarui akun...',
        text: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetchAPI('editAdmin', data);
      if (res.status === 'success') {
        Swal.close();
        window.closeModal('modal-edit-admin');
        Swal.fire({ icon: 'success', text: 'Admin berhasil diupdate' });
        loadAdmins();
      } else {
        Swal.close();
        Swal.fire({ icon: 'error', text: res.message });
      }
    });
  }
});
