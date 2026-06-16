const APP_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbwOgBENeR7OHXxhGtVa9pKsWVOeF8qZhBEZXOUf47jRvN-LYf_IoNCFlwtlQEyTasaz/exec",
  appName: "J&T Cargo Smart Fuel",
  outletCode: "SUM001A"
};

let currentDriver = {
  id: "DRV001",
  name: "Yudi Mulyadi",
  role: "Driver Team",
  nopol: "B 2206 UBA",
  armada: "Grandmax Minibus 1.5"
};

let historyDummyData = [
  { id: 1, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "23 Km", audit: "NORMAL" },
  { id: 2, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "18 Km", audit: "NORMAL" },
  { id: 3, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "11 Km", audit: "TIDAK NORMAL" },
  { id: 4, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "27 Km", audit: "NORMAL" },
  { id: 5, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "20 Km", audit: "NORMAL" },
  { id: 6, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "9 Km", audit: "TIDAK NORMAL" },
  { id: 7, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "31 Km", audit: "NORMAL" },
  { id: 8, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "22 Km", audit: "NORMAL" },
  { id: 9, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "16 Km", audit: "NORMAL" },
  { id: 10, tanggal: "02 Juni 2026", nopol: "B 2206 UBA", nominal: "Rp. 100.000", km: "12 Km", audit: "TIDAK NORMAL" }
];

const inputDefaultValues = {
  kmAwal: "2783782 Km",
  kmAkhir: "2784016 Km",
  nominal: "Rp. 100.000",
  liter: "9,35 Liter",
  gpsCoordinate: "SPBU Sumedang Utara"
};

const SESSION_KEY = "jtCargoSmartFuelSession";
const DUMMY_IMAGE_BASE64 = "DUMMY_BASE64_IMAGE";
let currentGpsLocation = {
  latitude: "",
  longitude: "",
  status: "Menunggu GPS"
};
let fotoKmAwalBase64 = "";
let fotoKmAkhirBase64 = "";
let fotoNotaBase64 = "";

const screens = document.querySelectorAll(".screen");
const loginForm = document.getElementById("loginForm");
const fuelForm = document.getElementById("fuelForm");
const historyList = document.getElementById("historyList");
const historyCountText = document.getElementById("historyCountText");
const logoutBtn = document.getElementById("logoutBtn");
const loginBtn = document.getElementById("loginBtn");
const uploadBbmBtn = document.getElementById("uploadBbmBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingMessage = document.getElementById("loadingMessage");

function normalizeNumber(value) {
  const cleaned = String(value || "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number.parseFloat(cleaned);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(".", ":");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function showLoading(message) {
  loadingMessage.textContent = message || "Memproses...";
  loadingOverlay.classList.add("is-active");
  loadingOverlay.setAttribute("aria-hidden", "false");
}

function hideLoading() {
  loadingOverlay.classList.remove("is-active");
  loadingOverlay.setAttribute("aria-hidden", "true");
}

function setButtonLoading(button, isLoading, loadingText, normalText) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : normalText;
}

function setPhotoPreview(buttonId, previewId, base64) {
  const button = document.getElementById(buttonId);
  const preview = document.getElementById(previewId);

  if (!button || !preview) return;

  if (base64) {
    preview.src = base64;
    button.classList.add("has-preview");
    return;
  }

  preview.removeAttribute("src");
  button.classList.remove("has-preview");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca file foto."));
    reader.readAsDataURL(file);
  });
}

async function handlePhotoChange(event, targetName) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("File harus berupa gambar.");
    event.target.value = "";
    return;
  }

  try {
    const base64 = await fileToBase64(file);

    if (targetName === "kmAwal") {
      fotoKmAwalBase64 = base64;
      setPhotoPreview("fotoKmAwalBtn", "fotoKmAwalPreview", base64);
      console.log("fotoKmAwalBase64 length", fotoKmAwalBase64.length);
    }

    if (targetName === "kmAkhir") {
      fotoKmAkhirBase64 = base64;
      setPhotoPreview("fotoKmAkhirBtn", "fotoKmAkhirPreview", base64);
      console.log("fotoKmAkhirBase64 length", fotoKmAkhirBase64.length);
    }

    if (targetName === "nota") {
      fotoNotaBase64 = base64;
      setPhotoPreview("fotoNotaBtn", "fotoNotaPreview", base64);
      console.log("fotoNotaBase64 length", fotoNotaBase64.length);
    }
  } catch (error) {
    alert(error.message);
    event.target.value = "";
  }
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  const rawSession = localStorage.getItem(SESSION_KEY);
  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession);
  } catch (error) {
    clearSession();
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function apiPost(action, data) {
  const response = await fetch(APP_CONFIG.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      data
    })
  });

  if (!response.ok) {
    throw new Error(`API ${action} gagal: HTTP ${response.status}`);
  }

  return response.json();
}

function apiLogin(username, password, nopol) {
  return apiPost("login", {
    username,
    password,
    nopol
  });
}

function apiGetDashboard(driverId) {
  return apiPost("getDashboard", {
    driverId
  });
}

function apiUploadBBM(payload) {
  return apiPost("uploadBBM", payload);
}

function apiGetHistory(driverId) {
  return apiPost("getHistory", {
    driverId
  });
}

function showScreen(screenId) {
  screens.forEach((screen) => {
    const isActive = screen.dataset.screen === screenId;
    screen.classList.toggle("is-active", isActive);

    if (isActive) {
      screen.scrollTop = 0;
    }
  });

  if (screenId === "input") {
    requestGpsLocation();
  }
}

function updateGpsUi(status, latitude, longitude) {
  currentGpsLocation = {
    status,
    latitude: latitude || "",
    longitude: longitude || ""
  };

  setText("gpsStatusText", status);
  setText("inputGpsStatusText", status);

  if (latitude && longitude) {
    setInputValue("gpsCoordinateText", `${latitude}, ${longitude}`);
    return;
  }

  setInputValue("gpsCoordinateText", "");
}

function requestGpsLocation() {
  if (!navigator.geolocation) {
    updateGpsUi("GPS Gagal", "", "");
    return;
  }

  setText("inputGpsStatusText", "Mengambil GPS");
  setInputValue("gpsCoordinateText", "Mengambil lokasi...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = Number(position.coords.latitude.toFixed(6));
      const longitude = Number(position.coords.longitude.toFixed(6));
      updateGpsUi("GPS Aktif", latitude, longitude);
    },
    () => {
      updateGpsUi("GPS Gagal", "", "");
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    }
  );
}

function setDashboardDriverInfo(driver) {
  currentDriver = {
    id: driver.id || driver.driverId || currentDriver.id,
    name: driver.name,
    role: driver.role,
    nopol: driver.nopol,
    armada: driver.armada
  };

  ["dashboard", "input", "success", "history", "setting"].forEach((screenName) => {
    setText(`${screenName}DriverNameText`, currentDriver.name);
    setText(`${screenName}DriverRoleText`, currentDriver.role);
    setText(`${screenName}NopolText`, currentDriver.nopol);
    setText(`${screenName}ArmadaText`, currentDriver.armada);
  });
}

function setDashboardSummary(summary) {
  setText("periodNominalText", summary.totalNominal);
  setText("periodKmText", summary.totalKm);
  setText("gpsStatusText", summary.gpsStatus);
  setText("lastUpdateText", summary.lastUpdate);

  ["input", "success", "history", "setting"].forEach((screenName) => {
    setText(`${screenName}PeriodNominalText`, summary.totalNominal);
    setText(`${screenName}PeriodKmText`, summary.totalKm);
  });
}

async function loadDashboardData() {
  const session = getSession();
  if (!session) return;

  const dashboardResponse = await apiGetDashboard(session.driverId);
  if (!dashboardResponse.success) return;

  if (dashboardResponse.driver) {
    setDashboardDriverInfo(dashboardResponse.driver);
  }

  setDashboardSummary(dashboardResponse.summary);

  await loadHistory(false);
}

async function loadHistory(showOverlay = true) {
  const session = getSession();
  if (!session) return;

  if (showOverlay) {
    showLoading("Mengambil data history...");
  }

  try {
    const historyResponse = await apiGetHistory(session.driverId);
    if (!historyResponse.success) {
      alert(historyResponse.message || "Gagal mengambil data history.");
      return;
    }

    renderHistoryDummy(historyResponse.data || []);
  } catch (error) {
    alert("Gagal mengambil data history.");
  } finally {
    if (showOverlay) {
      hideLoading();
    }
  }
}

function validateLoginForm(username, password, nopol) {
  if (!username) return "Username wajib diisi.";
  if (!password) return "Password wajib diisi.";
  if (!nopol) return "Armada wajib dipilih.";
  return "";
}

function validateUploadForm(payload) {
  if (Number.isNaN(normalizeNumber(payload.nominalBbm))) {
    return "Nominal BBM wajib angka.";
  }

  if (Number.isNaN(normalizeNumber(payload.literBbm))) {
    return "Liter BBM wajib angka.";
  }

  if (!payload.kmAwalOcr && !payload.kmAkhirOcr) {
    return "Minimal salah satu KM OCR/manual wajib diisi.";
  }

  if (!payload.fotoKmAwalBase64) {
    return "Foto KM Awal wajib dipilih.";
  }

  if (!payload.fotoKmAkhirBase64) {
    return "Foto KM Akhir wajib dipilih.";
  }

  if (!payload.fotoNotaBase64) {
    return "Foto Nota BBM wajib dipilih.";
  }

  return "";
}

async function handleLogin(event) {
  if (event) {
    event.preventDefault();
  }

  const username = getInputValue("usernameInput");
  const password = getInputValue("passwordInput");
  const armadaSelect = document.getElementById("armadaSelect");
  const cleanNopol = armadaSelect.value.split("-")[0].trim();

  console.log("APP_CONFIG", APP_CONFIG);
  console.log("LOGIN_PAYLOAD", { username, password, nopol: cleanNopol });

  const validationMessage = validateLoginForm(username, password, cleanNopol);

  if (validationMessage) {
    alert(validationMessage);
    return;
  }

  showLoading("Memproses login...");
  setButtonLoading(loginBtn, true, "Loading...", "LOGIN");

  try {
    const response = await apiLogin(username, password, cleanNopol);
    if (!response.success) {
      alert(response.message || "Login gagal. Silakan cek data driver.");
      return;
    }

    saveSession(response.user);
    setDashboardDriverInfo(response.user);
    await loadDashboardData();
    showScreen("dashboard");
  } catch (error) {
    alert("Tidak bisa terhubung ke backend Apps Script. Cek deployment Web App dan aksesnya.");
  } finally {
    setButtonLoading(loginBtn, false, "Loading...", "LOGIN");
    hideLoading();
  }
}

async function handleUploadBBM(event) {
  if (event) {
    event.preventDefault();
  }

  const now = new Date();
  const payload = {
    driverId: currentDriver.id,
    driverName: currentDriver.name,
    nopol: currentDriver.nopol,
    jenisArmada: currentDriver.armada,
    kmAwalOcr: getInputValue("kmAwalOcrText"),
    kmAkhirOcr: getInputValue("kmAkhirOcrText"),
    nominalBbm: getInputValue("nominalBbmInput"),
    literBbm: getInputValue("literBbmInput"),
    latitude: currentGpsLocation.latitude,
    longitude: currentGpsLocation.longitude,
    fotoKmAwalBase64,
    fotoKmAkhirBase64,
    fotoNotaBase64,
    timestamp: now.toISOString()
  };

  const validationMessage = validateUploadForm(payload);
  if (validationMessage) {
    alert(validationMessage);
    return;
  }

  console.log("UPLOAD_BBM_PAYLOAD", JSON.stringify(payload, null, 2));
  console.log(payload);

  showLoading("Mengupload data BBM...");
  setButtonLoading(uploadBbmBtn, true, "Uploading...", "Upload");

  try {
    const response = await apiUploadBBM(payload);
    if (!response.success) {
      alert(response.message || "Upload gagal. Silakan coba kembali.");
      return;
    }

    setText("successKmAwalValueText", payload.kmAwalOcr || "-");
    setText("successKmAkhirValueText", payload.kmAkhirOcr || "-");
    setText("successNotaValueText", payload.nominalBbm);
    setText("successMessageText", response.message || "Data Berhasil Di Upload");
    setText("successTimestampText", formatDateTime(now));

    const kmAwal = normalizeNumber(payload.kmAwalOcr);
    const kmAkhir = normalizeNumber(payload.kmAkhirOcr);
    const jarakKm = !Number.isNaN(kmAwal) && !Number.isNaN(kmAkhir)
      ? `${Math.max(kmAkhir - kmAwal, 0)} Km`
      : "-";

    historyDummyData = [
      {
        id: historyDummyData.length + 1,
        tanggal: "02 Juli 2026",
        nopol: payload.nopol,
        nominal: payload.nominalBbm,
        km: jarakKm,
        audit: response.data && response.data.statusAudit ? response.data.statusAudit : "NORMAL"
      },
      ...historyDummyData
    ];

    renderHistoryDummy(historyDummyData);
    showScreen("success");
    resetInputForm();
  } catch (error) {
    alert("Upload belum berhasil terkirim ke backend Apps Script.");
  } finally {
    setButtonLoading(uploadBbmBtn, false, "Uploading...", "Upload");
    hideLoading();
  }
}

function renderHistoryDummy(data = historyDummyData) {
  historyCountText.textContent = `${data.length} Data Pengisian`;
  historyList.innerHTML = data.map((item, index) => {
    const itemId = item.id || index + 1;
    const tanggal = item.tanggal || "-";
    const audit = item.audit || item.statusAudit || "NORMAL";
    const auditClass = audit === "NORMAL" ? "audit" : "audit bad";

    return `
      <article class="history-item" id="historyItem${itemId}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14l-1.2-4H6.2ZM7 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm10 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM3 13V9l2-5h14l2 5v4h-1v3h-2v-3H6v3H4v-3Z"/></svg>
        <div id="historyInfo${itemId}">
          <span class="history-date" id="historyDate${itemId}">${tanggal}</span>
          <span class="history-nopol" id="historyNopol${itemId}">${item.nopol || "-"}</span>
        </div>
        <strong class="history-price" id="historyNominal${itemId}">${item.nominal || "-"}</strong>
        <div id="historyAuditCard${itemId}">
          <span class="history-km" id="historyKm${itemId}">${item.km || "-"}</span>
          <span class="${auditClass}" id="historyAudit${itemId}">${audit}</span>
        </div>
        <div class="row-actions" id="historyActionCard${itemId}">
          <button class="icon-action" type="button" id="historyEditBtn${itemId}" aria-label="Edit data ${tanggal}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.2V21h3.8L18.9 9.9l-3.8-3.8Zm17-10.4a1 1 0 0 0 0-1.4L18.6 3a1 1 0 0 0-1.4 0l-1.3 1.3 3.8 3.8Z"/></svg>
          </button>
          <button class="icon-action" type="button" id="historyDeleteBtn${itemId}" aria-label="Delete data ${tanggal}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21h12l1-14H5Zm3-17 1-1h4l1 1h5v2H4V4Z"/></svg>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function resetInputForm() {
  setInputValue("kmAwalOcrText", inputDefaultValues.kmAwal);
  setInputValue("kmAkhirOcrText", inputDefaultValues.kmAkhir);
  setInputValue("nominalBbmInput", inputDefaultValues.nominal);
  setInputValue("literBbmInput", inputDefaultValues.liter);
  setText("inputGpsStatusText", currentGpsLocation.status);
  setInputValue("gpsCoordinateText", currentGpsLocation.latitude && currentGpsLocation.longitude
    ? `${currentGpsLocation.latitude}, ${currentGpsLocation.longitude}`
    : "");
  setInputValue("fotoKmAwalInput", "");
  setInputValue("fotoKmAkhirInput", "");
  setInputValue("fotoNotaInput", "");
  fotoKmAwalBase64 = "";
  fotoKmAkhirBase64 = "";
  fotoNotaBase64 = "";
  setPhotoPreview("fotoKmAwalBtn", "fotoKmAwalPreview", "");
  setPhotoPreview("fotoKmAkhirBtn", "fotoKmAkhirPreview", "");
  setPhotoPreview("fotoNotaBtn", "fotoNotaPreview", "");
}

function bindPhotoButton(buttonId, inputId) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);

  if (button && input) {
    button.addEventListener("click", () => input.click());
  }
}

function initApp() {
  setDashboardDriverInfo(currentDriver);
  setDashboardSummary({
    totalNominal: "Rp. 1.300.000",
    totalKm: "234 Km",
    gpsStatus: "Aktif",
    lastUpdate: "09:32"
  });
  renderHistoryDummy();
  resetInputForm();

  window.setTimeout(() => {
    showScreen("login");
  }, 2000);

  loginForm.addEventListener("submit", handleLogin);
  fuelForm.addEventListener("submit", handleUploadBBM);
  logoutBtn.addEventListener("click", () => {
    showLoading("Keluar akun...");
    window.setTimeout(() => {
      clearSession();
      showScreen("login");
      hideLoading();
    }, 450);
  });

  bindPhotoButton("fotoKmAwalBtn", "fotoKmAwalInput");
  bindPhotoButton("fotoKmAkhirBtn", "fotoKmAkhirInput");
  bindPhotoButton("fotoNotaBtn", "fotoNotaInput");

  document.getElementById("fotoKmAwalInput").addEventListener("change", (event) => {
    handlePhotoChange(event, "kmAwal");
  });
  document.getElementById("fotoKmAkhirInput").addEventListener("change", (event) => {
    handlePhotoChange(event, "kmAkhir");
  });
  document.getElementById("fotoNotaInput").addEventListener("change", (event) => {
    handlePhotoChange(event, "nota");
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-go]");
    if (!button) return;

    showScreen(button.dataset.go);

    if (button.dataset.go === "history") {
      loadHistory(true);
    }
  });
}

initApp();
