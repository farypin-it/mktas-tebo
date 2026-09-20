let dataWilayah = {};

// Load data immediately
(async () => {
  try {
    const res = await fetch('js/kode_wilayah.json');
    dataWilayah = await res.json();
  } catch (err) {
    console.error("Gagal memuat data kode wilayah:", err);
  }
})();

async function ensureWilayahLoaded() {
  if (Object.keys(dataWilayah).length > 0) return;
  try {
    const res = await fetch('js/kode_wilayah.json');
    dataWilayah = await res.json();
  } catch (err) {}
}

async function getProvinsi() {
  await ensureWilayahLoaded();
  const result = [];
  for (const [code, name] of Object.entries(dataWilayah)) {
    if (code.length === 2) {
      result.push({ id: code, nama: name });
    }
  }
  return result;
}

async function getKabupatenByProvinsiId(provId) {
  await ensureWilayahLoaded();
  const result = [];
  for (const [code, name] of Object.entries(dataWilayah)) {
    if (code.length === 5 && code.startsWith(provId + '.')) {
      result.push({ id: code, nama: name });
    }
  }
  return result;
}

async function getKecamatanByKabupatenId(kabId) {
  await ensureWilayahLoaded();
  const result = [];
  for (const [code, name] of Object.entries(dataWilayah)) {
    if (code.length === 9 && code.startsWith(kabId + '.')) {
      result.push({ id: code, nama: name });
    }
  }
  return result;
}
