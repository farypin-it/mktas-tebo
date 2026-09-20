function readStoredSessionUser() {
  try {
    const raw = localStorage.getItem('mktas_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.warn('[auth] Invalid session cache:', e);
    try { localStorage.removeItem('mktas_user'); } catch (removeErr) {}
    return null;
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

function saveStoredSessionUser(user) {
  if (!user || typeof user !== 'object') {
    localStorage.removeItem('mktas_user');
    return null;
  }
  localStorage.setItem('mktas_user', JSON.stringify(user));
  return user;
}

function clearStoredSessionUser() {
  localStorage.removeItem('mktas_user');
}

// --- Auth ---
async function handleLogin(username, password) {
  const alertBox = document.getElementById("login-alert");
  if (alertBox) {
    alertBox.classList.add("hidden");
    alertBox.innerText = "";
  }

  try {
    const result = await fetchAPI("login", { username, password });

    if (result && result.status === "success") {
      const sessionUser = result.user || {};
      if (!sessionUser.session_token) {
        throw new Error('Session token tidak diterima dari server.');
      }
      saveStoredSessionUser(sessionUser);

      // Jika akun masih menggunakan password default (123456), tampilkan modal ganti password langsung di halaman login!
      if (sessionUser.is_default_password === true) {
        if (typeof window.showWajibGantiPasswordModal === 'function') {
          window.showWajibGantiPasswordModal(sessionUser);
          return true;
        }
      }

      window.location.href = "dashboard.html";
      return true;
    } else {
      const msg = (result && result.message) ? result.message : "Username atau password yang Anda masukkan salah. Silakan periksa kembali.";
      if (alertBox) {
        alertBox.innerText = msg;
        alertBox.classList.remove("hidden");
        alertBox.style.display = "block";
      }
      if (typeof Swal !== "undefined") {
        Swal.fire({
          icon: 'error',
          title: 'Login Gagal',
          text: msg,
          confirmButtonColor: '#2563eb'
        });
      }
      return false;
    }
  } catch (err) {
    const errorMsg = "Gagal terhubung ke server: " + (err.message || err);
    if (alertBox) {
      alertBox.innerText = errorMsg;
      alertBox.classList.remove("hidden");
      alertBox.style.display = "block";
    }
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Jaringan',
        text: errorMsg,
        confirmButtonColor: '#2563eb'
      });
    }
    return false;
  }
}

function logout() {
  clearStoredSessionUser();
  window.location.href = "login.html";
}


