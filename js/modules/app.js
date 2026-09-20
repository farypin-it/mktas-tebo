let allPegawaiData = [];
let filteredPegawaiData = [];
let currentPegawaiPage = 1;
const ITEMS_PER_PAGE = 10;
let attendanceData = {}; // Tracks attendance per school: { schoolId: boolean }
let currentKehadiranSchoolId = null;
let currentJadwalContext = null;
let currentPdfZoom = 1;
let currentJadwalTahun = null;
