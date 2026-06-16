const SPREADSHEET_ID = "1FXRMdKnlKbuwZ-clhEXTzTMKu3hU-dInxQ6tgeCt1Bg";
const FOLDER_ID = "1hkOv8EsoVHnpKpDtMleKDpKDlfkIJIrW";

const SHEET_NAMES = {
  driver: "MASTER_DRIVER",
  armada: "MASTER_ARMADA",
  logBbm: "LOG_BBM",
  rekapHarian: "REKAP_HARIAN_BBM"
};

const LOG_BBM_HEADERS = [
  "TIMESTAMP",
  "DRIVER_ID",
  "DRIVER_NAME",
  "NOPOL",
  "JENIS_ARMADA",
  "KM_AWAL",
  "KM_AKHIR",
  "KM_JALAN",
  "NOMINAL_BBM",
  "LITER_BBM",
  "KM_PER_LITER_NORMAL",
  "ESTIMASI_LITER",
  "SELISIH_LITER",
  "STATUS_AUDIT",
  "LATITUDE",
  "LONGITUDE",
  "LINK_MAPS",
  "FOTO_KM_AWAL_URL",
  "FOTO_KM_AKHIR_URL",
  "FOTO_NOTA_URL",
  "KETERANGAN"
];

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var request = JSON.parse(body);
    var action = request.action;
    var data = request.data || {};

    if (!action) {
      return jsonResponse({
        success: false,
        message: "Action wajib diisi."
      });
    }

    if (action === "login") {
      return jsonResponse(login(data));
    }

    if (action === "getDashboard") {
      return jsonResponse(getDashboard(data));
    }

    if (action === "uploadBBM") {
      return jsonResponse(uploadBBM(data));
    }

    if (action === "getHistory") {
      return jsonResponse(getHistory(data));
    }

    if (action === "getArmadaList") {
      return jsonResponse(getArmadaList());
    }

    return jsonResponse({
      success: false,
      message: "Action tidak dikenal: " + action
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
}

function login(data) {
  var username = String(data.username || "").trim();
  var password = String(data.password || "").trim();
  var nopol = String(data.nopol || "").trim();

  if (!username || !password || !nopol) {
    return {
      success: false,
      message: "Username, password, dan nopol wajib diisi."
    };
  }

  var driver = findDriver(username, password);
  if (!driver) {
    return {
      success: false,
      message: "Driver tidak ditemukan atau status tidak aktif."
    };
  }

  var armada = findArmada(nopol);
  if (!armada) {
    return {
      success: false,
      message: "Armada tidak ditemukan atau status tidak aktif."
    };
  }

  var driverNopol = getField(driver, ["NOPOL", "PLAT_NOMOR", "PLAT", "NO_POLISI"]);
  if (driverNopol && normalizeText(driverNopol) !== normalizeText(nopol)) {
    return {
      success: false,
      message: "Nopol tidak sesuai dengan data driver."
    };
  }

  return {
    success: true,
    user: {
      driverId: getField(driver, ["DRIVER_ID", "ID_DRIVER", "ID"]),
      username: getField(driver, ["USERNAME", "USER_NAME"]),
      name: getField(driver, ["DRIVER_NAME", "NAMA_DRIVER", "NAMA"]),
      role: getField(driver, ["ROLE", "JABATAN"]) || "Driver Team",
      nopol: getField(armada, ["NOPOL", "PLAT_NOMOR", "PLAT", "NO_POLISI"]),
      armada: getField(armada, ["JENIS_ARMADA", "ARMADA", "TIPE_ARMADA"]),
      kmPerLiterNormal: parseNumber(getField(armada, ["KM_PER_LITER_NORMAL", "KM_PER_LITER", "KPL_NORMAL"])) || 10
    }
  };
}

function uploadBBM(data) {
  var driverId = String(data.driverId || "").trim();
  var driverName = String(data.driverName || "").trim();
  var nopol = String(data.nopol || "").trim();
  var jenisArmada = String(data.jenisArmada || "").trim();
  var timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  if (!driverId || !driverName || !nopol) {
    return {
      success: false,
      message: "Data driver belum lengkap."
    };
  }

  var kmAwal = parseNumber(data.kmAwalOcr);
  var kmAkhir = parseNumber(data.kmAkhirOcr);
  var nominalBbm = parseNumber(data.nominalBbm);
  var literBbm = parseNumber(data.literBbm);
  var latitude = parseNumber(data.latitude);
  var longitude = parseNumber(data.longitude);
  var armada = findArmada(nopol) || {};
  var kmPerLiterNormal = parseNumber(getField(armada, ["KM_PER_LITER_NORMAL", "KM_PER_LITER", "KPL_NORMAL"])) || 10;

  if (isNaN(kmAwal) || isNaN(kmAkhir)) {
    return {
      success: false,
      message: "KM awal dan KM akhir wajib berupa angka."
    };
  }

  if (isNaN(nominalBbm) || isNaN(literBbm)) {
    return {
      success: false,
      message: "Nominal BBM dan liter BBM wajib berupa angka."
    };
  }

  if (!isValidBase64Image(data.fotoKmAwalBase64) || !isValidBase64Image(data.fotoKmAkhirBase64) || !isValidBase64Image(data.fotoNotaBase64)) {
    return {
      success: false,
      message: "Foto KM Awal, Foto KM Akhir, dan Foto Nota BBM wajib dikirim dalam format base64."
    };
  }

  var kmJalan = Math.max(kmAkhir - kmAwal, 0);
  var estimasiLiter = kmPerLiterNormal > 0 ? kmJalan / kmPerLiterNormal : 0;
  var selisihLiter = literBbm - estimasiLiter;
  var statusAudit = literBbm <= estimasiLiter * 1.15 ? "NORMAL" : "TIDAK NORMAL";
  var linkMaps = !isNaN(latitude) && !isNaN(longitude)
    ? "https://www.google.com/maps?q=" + latitude + "," + longitude
    : "";

  var safeTime = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  var fotoKmAwalUrl = saveBase64ToDrive(data.fotoKmAwalBase64, driverId + "_KM_AWAL_" + safeTime + ".jpg");
  var fotoKmAkhirUrl = saveBase64ToDrive(data.fotoKmAkhirBase64, driverId + "_KM_AKHIR_" + safeTime + ".jpg");
  var fotoNotaUrl = saveBase64ToDrive(data.fotoNotaBase64, driverId + "_NOTA_BBM_" + safeTime + ".jpg");
  var fotoAwalUrl = fotoKmAwalUrl;
  var fotoAkhirUrl = fotoKmAkhirUrl;

  Logger.log({
    hasFotoAwal: !!data.fotoKmAwalBase64,
    hasFotoAkhir: !!data.fotoKmAkhirBase64,
    hasFotoNota: !!data.fotoNotaBase64,
    fotoAwalUrl: fotoAwalUrl,
    fotoAkhirUrl: fotoAkhirUrl,
    fotoNotaUrl: fotoNotaUrl
  });

  var row = [
    timestamp,
    driverId,
    driverName,
    nopol,
    jenisArmada,
    kmAwal,
    kmAkhir,
    kmJalan,
    nominalBbm,
    literBbm,
    kmPerLiterNormal,
    estimasiLiter,
    selisihLiter,
    statusAudit,
    isNaN(latitude) ? "" : latitude,
    isNaN(longitude) ? "" : longitude,
    linkMaps,
    fotoKmAwalUrl,
    fotoKmAkhirUrl,
    fotoNotaUrl,
    data.keterangan || ""
  ];

  var sheet = getSheet(SHEET_NAMES.logBbm);
  ensureLogBbmHeader(sheet);
  sheet.appendRow(row);

  return {
    success: true,
    message: "Data Berhasil Di Upload",
    data: {
      kmJalan: kmJalan,
      estimasiLiter: estimasiLiter,
      selisihLiter: selisihLiter,
      statusAudit: statusAudit,
      fotoKmAwalUrl: fotoKmAwalUrl,
      fotoKmAkhirUrl: fotoKmAkhirUrl,
      fotoNotaUrl: fotoNotaUrl
    }
  };
}

function getDashboard(data) {
  var driverId = String(data.driverId || "").trim();
  if (!driverId) {
    return {
      success: false,
      message: "driverId wajib diisi."
    };
  }

  var logRows = getRecords(SHEET_NAMES.logBbm);
  var now = new Date();
  var currentMonth = now.getMonth();
  var currentYear = now.getFullYear();
  var totalNominal = 0;
  var totalKm = 0;
  var lastUpdate = "";

  logRows.forEach(function(row) {
    if (String(getField(row, ["DRIVER_ID"])) !== driverId) return;

    var timestamp = new Date(getField(row, ["TIMESTAMP"]));
    if (isNaN(timestamp.getTime())) return;
    if (timestamp.getMonth() !== currentMonth || timestamp.getFullYear() !== currentYear) return;

    totalNominal += parseNumber(getField(row, ["NOMINAL_BBM"])) || 0;
    totalKm += parseNumber(getField(row, ["KM_JALAN"])) || 0;

    if (!lastUpdate || timestamp > lastUpdate) {
      lastUpdate = timestamp;
    }
  });

  return {
    success: true,
    summary: {
      totalNominal: formatRupiah(totalNominal),
      totalKm: totalKm + " Km",
      gpsStatus: "Aktif",
      lastUpdate: lastUpdate ? Utilities.formatDate(lastUpdate, Session.getScriptTimeZone(), "HH:mm") : "-"
    }
  };
}

function getHistory(data) {
  var driverId = String(data.driverId || "").trim();
  if (!driverId) {
    return {
      success: false,
      message: "driverId wajib diisi."
    };
  }

  var rows = getRecords(SHEET_NAMES.logBbm)
    .filter(function(row) {
      return String(getField(row, ["DRIVER_ID"])) === driverId;
    })
    .sort(function(a, b) {
      return new Date(getField(b, ["TIMESTAMP"])) - new Date(getField(a, ["TIMESTAMP"]));
    })
    .slice(0, 20)
    .map(function(row) {
      return {
        timestamp: getField(row, ["TIMESTAMP"]),
        tanggal: formatTanggal(getField(row, ["TIMESTAMP"])),
        nopol: getField(row, ["NOPOL"]),
        nominal: formatRupiah(parseNumber(getField(row, ["NOMINAL_BBM"])) || 0),
        km: (parseNumber(getField(row, ["KM_JALAN"])) || 0) + " Km",
        statusAudit: getField(row, ["STATUS_AUDIT"]),
        fotoNotaUrl: getField(row, ["FOTO_NOTA_URL"]),
        linkMaps: getField(row, ["LINK_MAPS"])
      };
    });

  return {
    success: true,
    data: rows
  };
}

function getArmadaList() {
  var rows = getRecords(SHEET_NAMES.armada);
  var data = [];

  rows.forEach(function(row) {
    var status = normalizeText(getField(row, ["STATUS"]));
    if (status !== "aktif") return;

    var nopol = String(getField(row, ["NOPOL", "PLAT_NOMOR", "PLAT", "NO_POLISI"]) || "").trim();
    if (!nopol) return;

    data.push({
      nopol: nopol,
      jenisArmada: String(getField(row, ["JENIS_ARMADA", "ARMADA", "TIPE_ARMADA"]) || "").trim(),
      kmPerLiterNormal: parseNumber(getField(row, ["KM_PER_LITER_NORMAL", "KM_PER_LITER", "KPL_NORMAL"])) || 0
    });
  });

  return {
    success: true,
    data: data
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    throw new Error("Sheet tidak ditemukan: " + name);
  }

  return sheet;
}

function saveBase64ToDrive(base64, filename) {
  if (!isValidBase64Image(base64)) {
    throw new Error("Base64 foto tidak valid untuk file: " + filename);
  }

  var cleanBase64 = String(base64);
  var mimeType = "image/jpeg";

  if (cleanBase64.indexOf("data:") === 0) {
    var parts = cleanBase64.split(",");
    var meta = parts[0];
    cleanBase64 = parts[1];
    var match = meta.match(/data:(.*);base64/);
    if (match && match[1]) {
      mimeType = match[1];
    }
  }

  var bytes = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(bytes, mimeType, filename);
  var file = Drive.Files.create({
    name: filename,
    parents: [FOLDER_ID]
  }, blob, {
    fields: "id"
  });

  return "https://drive.google.com/file/d/" + file.id + "/view";
}

function isValidBase64Image(base64) {
  if (!base64 || base64 === "DUMMY_BASE64_IMAGE") {
    return false;
  }

  var value = String(base64);
  if (value.indexOf("data:image/") === 0 && value.indexOf(";base64,") > -1) {
    return value.split(",")[1].length > 0;
  }

  return value.length > 100;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }

  if (typeof value === "number") {
    return value;
  }

  var cleaned = String(value)
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return parseFloat(cleaned);
}

function findDriver(username, password) {
  var rows = getRecords(SHEET_NAMES.driver);
  var targetUsername = normalizeText(username);
  var targetPassword = String(password);

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowUsername = normalizeText(getField(row, ["USERNAME", "USER_NAME"]));
    var rowPassword = String(getField(row, ["PASSWORD", "PASS"]));
    var status = normalizeText(getField(row, ["STATUS"]));

    if (rowUsername === targetUsername && rowPassword === targetPassword && status === "aktif") {
      return row;
    }
  }

  return null;
}

function findArmada(nopol) {
  var rows = getRecords(SHEET_NAMES.armada);
  var targetNopol = normalizeText(nopol);

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowNopol = normalizeText(getField(row, ["NOPOL", "PLAT_NOMOR", "PLAT", "NO_POLISI"]));
    var status = normalizeText(getField(row, ["STATUS"]));

    if (rowNopol === targetNopol && status === "aktif") {
      return row;
    }
  }

  return null;
}

function getRecords(sheetName) {
  var sheet = getSheet(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(header) {
    return normalizeHeader(header);
  });

  return values.slice(1).filter(function(row) {
    return row.join("") !== "";
  }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });
    return record;
  });
}

function getField(record, possibleHeaders) {
  if (!record) return "";

  for (var i = 0; i < possibleHeaders.length; i++) {
    var key = normalizeHeader(possibleHeaders[i]);
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }

  return "";
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function ensureLogBbmHeader(sheet) {
  var firstRow = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, LOG_BBM_HEADERS.length).getValues()[0]
    : [];

  var hasHeader = firstRow.join("") !== "";
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, LOG_BBM_HEADERS.length).setValues([LOG_BBM_HEADERS]);
  }
}

function formatRupiah(value) {
  var number = Math.round(Number(value) || 0);
  return "Rp. " + number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatTanggal(value) {
  var date = new Date(value);
  if (isNaN(date.getTime())) return "";

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd MMMM yyyy");
}
