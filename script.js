const APP_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbwOgBENeR7OHXxhGtVa9pKsWVOeF8qZhBEZXOUf47jRvN-LYf_IoNCFlwtlQEyTasaz/exec",
  appName: "J&T Cargo Smart Fuel",
  outletCode: "SUM001A"
};

let currentDriver = {
  id: "",
  name: "-",
  role: "Driver Team",
  nopol: "",
  armada: "",
  kmPerLiterNormal: "",
  barcodeMyPertaminaUrl: ""
};

let historyDummyData = [];
let armadaByNopol = {};

const inputDefaultValues = {
  kmAwal: "2783782 Km",
  kmAkhir: "2784016 Km",
  nominal: "Rp. 100.000",
  liter: "9,35 Liter",
  gpsCoordinate: "SPBU Sumedang Utara"
};

const SESSION_KEY = "jtCargoSmartFuelSession";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DUMMY_IMAGE_BASE64 = "DUMMY_BASE64_IMAGE";
let currentGpsLocation = {
  latitude: "",
  longitude: "",
  status: "Menunggu GPS"
};
let fotoKmAwalBase64 = "";
let fotoKmAkhirBase64 = "";
let fotoNotaBase64 = "";
let kmAwalOcrRequestId = 0;
let kmAkhirOcrRequestId = 0;

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
const barcodeMyPertaminaBtn = document.getElementById("barcodeMyPertaminaBtn");
const barcodeMyPertaminaModal = document.getElementById("barcodeMyPertaminaModal");
const barcodeMyPertaminaCloseBtn = document.getElementById("barcodeMyPertaminaCloseBtn");
const barcodeFullscreenModal = document.getElementById("barcodeFullscreenModal");
const barcodeFullscreenImage = document.getElementById("barcodeFullscreenImage");
const barcodeFullscreenCloseBtn = document.getElementById("barcodeFullscreenCloseBtn");

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

function extractKmFromOcrText(text) {
  const source = String(text || "");
  const candidates = [];
  const groupedMatches = source.match(/[0-9][0-9\s.,-]{2,}[0-9]/g) || [];
  const digitMatches = source.match(/[0-9]{4,8}/g) || [];

  [...groupedMatches, ...digitMatches].forEach((candidate) => {
    const digits = String(candidate).replace(/[^0-9]/g, "");
    if (digits.length >= 4 && digits.length <= 8) {
      candidates.push(digits);
    }
  });

  if (!candidates.length) return "";

  candidates.sort((first, second) => {
    if (second.length !== first.length) {
      return second.length - first.length;
    }
    return Number(second) - Number(first);
  });

  return candidates[0];
}

async function readKmWithOcr(base64, targetName) {
  const isKmAwal = targetName === "kmAwal";
  const inputId = isKmAwal ? "kmAwalOcrText" : "kmAkhirOcrText";
  const requestId = isKmAwal ? ++kmAwalOcrRequestId : ++kmAkhirOcrRequestId;
  const loadingText = isKmAwal ? "Membaca KM awal..." : "Membaca KM akhir...";

  if (!window.Tesseract || typeof window.Tesseract.recognize !== "function") {
    alert("KM tidak terbaca, silakan input manual.");
    setInputValue(inputId, "");
    return;
  }

  showLoading(loadingText);

  try {
    const result = await window.Tesseract.recognize(base64, "eng", {
      logger: () => {}
    });
    const text = result && result.data ? result.data.text : "";
    const kmValue = extractKmFromOcrText(text);
    const isLatestRequest = isKmAwal
      ? requestId === kmAwalOcrRequestId
      : requestId === kmAkhirOcrRequestId;

    if (!isLatestRequest) return;

    if (!kmValue) {
      setInputValue(inputId, "");
      alert("KM tidak terbaca, silakan input manual.");
      return;
    }

    setInputValue(inputId, kmValue);
  } catch (error) {
    console.error("KM_OCR_ERROR", error);
    setInputValue(inputId, "");
    alert("KM tidak terbaca, silakan input manual.");
  } finally {
    const isLatestRequest = isKmAwal
      ? requestId === kmAwalOcrRequestId
      : requestId === kmAkhirOcrRequestId;
    if (isLatestRequest) {
      hideLoading();
    }
  }
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
      await readKmWithOcr(base64, "kmAwal");
    }

    if (targetName === "kmAkhir") {
      fotoKmAkhirBase64 = base64;
      setPhotoPreview("fotoKmAkhirBtn", "fotoKmAkhirPreview", base64);
      console.log("fotoKmAkhirBase64 length", fotoKmAkhirBase64.length);
      await readKmWithOcr(base64, "kmAkhir");
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

function buildSession(user) {
  return {
    driverId: user.driverId || user.id || "",
    username: user.username || "",
    name: user.name || "-",
    role: user.role || "Driver Team",
    nopol: user.nopol || "",
    armada: user.armada || user.jenisArmada || "",
    kmPerLiterNormal: user.kmPerLiterNormal || "",
    barcodeMyPertaminaUrl: getBarcodeMyPertaminaUrl(user),
    loginAt: user.loginAt || new Date().toISOString()
  };
}

function isSessionValid(session) {
  if (!session || !session.driverId || !session.nopol || !session.loginAt) {
    return false;
  }

  const loginAt = new Date(session.loginAt).getTime();
  if (Number.isNaN(loginAt)) {
    return false;
  }

  return Date.now() - loginAt <= SESSION_MAX_AGE_MS;
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(buildSession(user)));
}

function getSession() {
  const rawSession = localStorage.getItem(SESSION_KEY);
  if (!rawSession) return null;

  try {
    const session = JSON.parse(rawSession);
    if (!isSessionValid(session)) {
      clearSession();
      return null;
    }
    return session;
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

function apiGetArmadaList() {
  return apiPost("getArmadaList", {});
}

function getBarcodeMyPertaminaUrl(data) {
  return String(
    (data && (
      data.barcodeMyPertaminaUrl
      || data.BARCODE_MYPERTAMINA_URL
      || data.BARCODE_URL
      || data.QR_MYPERTAMINA
    )) || ""
  ).trim();
}

function renderArmadaOptions(armadaList) {
  const armadaSelect = document.getElementById("armadaSelect");
  if (!armadaSelect) return;

  armadaSelect.innerHTML = "";
  armadaByNopol = {};

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pilih Armada / Plat Nomor Mobil";
  armadaSelect.appendChild(placeholder);

  armadaList.forEach((armada) => {
    const nopol = String(armada.nopol || "").trim();
    const jenisArmada = String(armada.jenisArmada || "").trim();
    if (!nopol) return;

    armadaByNopol[nopol] = {
      nopol,
      jenisArmada,
      barcodeMyPertaminaUrl: getBarcodeMyPertaminaUrl(armada)
    };

    const option = document.createElement("option");
    option.value = nopol;
    option.textContent = jenisArmada ? `${nopol} - ${jenisArmada}` : nopol;
    armadaSelect.appendChild(option);
  });
}

async function loadArmadaOptions() {
  const armadaSelect = document.getElementById("armadaSelect");
  if (!armadaSelect) return;

  armadaSelect.disabled = true;
  armadaSelect.innerHTML = '<option value="">Memuat data armada...</option>';

  try {
    const response = await apiGetArmadaList();
    if (!response.success) {
      throw new Error(response.message || "Gagal mengambil data armada.");
    }

    renderArmadaOptions(response.data || []);
  } catch (error) {
    console.error("GET_ARMADA_LIST_ERROR", error);
    armadaSelect.innerHTML = '<option value="">Gagal memuat data armada</option>';
    alert("Gagal memuat data armada dari MASTER_ARMADA. Cek deploy Apps Script terbaru.");
  } finally {
    armadaSelect.disabled = false;
  }
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
  const barcodeMyPertaminaUrl = getBarcodeMyPertaminaUrl(driver) || currentDriver.barcodeMyPertaminaUrl;

  currentDriver = {
    id: driver.id || driver.driverId || currentDriver.id,
    name: driver.name || currentDriver.name,
    role: driver.role || currentDriver.role,
    nopol: driver.nopol || currentDriver.nopol,
    armada: driver.armada || driver.jenisArmada || currentDriver.armada,
    kmPerLiterNormal: driver.kmPerLiterNormal || currentDriver.kmPerLiterNormal || "",
    barcodeMyPertaminaUrl
  };

  ["dashboard", "input", "success", "history", "setting"].forEach((screenName) => {
    setText(`${screenName}DriverNameText`, currentDriver.name);
    setText(`${screenName}DriverRoleText`, currentDriver.role);
    setText(`${screenName}NopolText`, currentDriver.nopol);
    setText(`${screenName}ArmadaText`, currentDriver.armada);
  });
}

function openBarcodeMyPertaminaModal() {
  const barcodeUrl = String(currentDriver.barcodeMyPertaminaUrl || "").trim();
  const barcodeImage = document.getElementById("barcodeMyPertaminaImage");
  const emptyText = document.getElementById("barcodeMyPertaminaEmptyText");
  const zoomHint = document.getElementById("barcodeZoomHintText");

  setText("barcodeNopolText", currentDriver.nopol || "-");
  setText("barcodeArmadaText", currentDriver.armada || "-");

  if (barcodeImage && emptyText && zoomHint) {
    if (barcodeUrl) {
      barcodeImage.src = barcodeUrl;
      barcodeImage.classList.add("is-active");
      zoomHint.classList.add("is-active");
      emptyText.classList.remove("is-active");
    } else {
      barcodeImage.removeAttribute("src");
      barcodeImage.classList.remove("is-active");
      zoomHint.classList.remove("is-active");
      emptyText.classList.add("is-active");
    }
  }

  barcodeMyPertaminaModal.classList.add("is-active");
  barcodeMyPertaminaModal.setAttribute("aria-hidden", "false");
}

function closeBarcodeMyPertaminaModal() {
  barcodeMyPertaminaModal.classList.remove("is-active");
  barcodeMyPertaminaModal.setAttribute("aria-hidden", "true");
}

function openBarcodeFullscreen() {
  const barcodeUrl = String(currentDriver.barcodeMyPertaminaUrl || "").trim();
  if (!barcodeUrl) return;

  barcodeFullscreenImage.src = barcodeUrl;
  barcodeFullscreenModal.classList.add("is-active");
  barcodeFullscreenModal.setAttribute("aria-hidden", "false");
}

function closeBarcodeFullscreen() {
  barcodeFullscreenModal.classList.remove("is-active");
  barcodeFullscreenModal.setAttribute("aria-hidden", "true");
  barcodeFullscreenImage.removeAttribute("src");
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
  const nopol = armadaSelect.value.trim();

  console.log("APP_CONFIG", APP_CONFIG);
  console.log("LOGIN_PAYLOAD", { username, password, nopol });

  const validationMessage = validateLoginForm(username, password, nopol);

  if (validationMessage) {
    alert(validationMessage);
    return;
  }

  showLoading("Memproses login...");
  setButtonLoading(loginBtn, true, "Loading...", "LOGIN");

  try {
    const response = await apiLogin(username, password, nopol);
    console.log("LOGIN_RESPONSE", response);

    if (!response.success) {
      alert(response.message || "Login gagal. Silakan cek data driver.");
      return;
    }

    const selectedArmada = armadaByNopol[nopol] || {};
    const loginUser = {
      ...response.user,
      nopol: response.user.nopol || nopol,
      armada: response.user.armada || response.user.jenisArmada || selectedArmada.jenisArmada || "",
      barcodeMyPertaminaUrl: getBarcodeMyPertaminaUrl(response.user) || selectedArmada.barcodeMyPertaminaUrl || "",
      loginAt: new Date().toISOString()
    };

    saveSession(loginUser);
    setDashboardDriverInfo(loginUser);
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

async function restoreSessionIfAvailable() {
  const session = getSession();
  if (!session) {
    window.setTimeout(() => {
      showScreen("login");
    }, 2000);
    return;
  }

  setDashboardDriverInfo(session);
  window.setTimeout(() => {
    showScreen("dashboard");
  }, 2000);

  try {
    await loadDashboardData();
  } catch (error) {
    // Tetap gunakan session lokal jika dashboard belum bisa disegarkan.
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
  loadArmadaOptions();
  restoreSessionIfAvailable();

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

  barcodeMyPertaminaBtn.addEventListener("click", openBarcodeMyPertaminaModal);
  barcodeMyPertaminaCloseBtn.addEventListener("click", closeBarcodeMyPertaminaModal);
  barcodeMyPertaminaModal.addEventListener("click", (event) => {
    if (event.target === barcodeMyPertaminaModal) {
      closeBarcodeMyPertaminaModal();
    }
  });
  document.getElementById("barcodeMyPertaminaImage").addEventListener("click", openBarcodeFullscreen);
  barcodeFullscreenCloseBtn.addEventListener("click", closeBarcodeFullscreen);
  barcodeFullscreenModal.addEventListener("click", (event) => {
    if (event.target === barcodeFullscreenModal) {
      closeBarcodeFullscreen();
    }
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
