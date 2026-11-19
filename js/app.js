// QR Studio — app.js
// Generador de códigos QR basado en qr-code-styling (offline).
// Exporta PNG, JPG, WebP, SVG y PDF con varias calidades de resolución.
const $ = (id) => document.getElementById(id);
const BASE_SIZE = 320; // tamaño de la vista previa (px)
const EXPORT_BASE = 150; // tamaño de exportación a calidad 1x (px)
const DEBOUNCE_MS = 320;

let qrInstance = null;
let logoDataUrl = "";
const fileIcons = { text: "\u{1F4DD}", url: "\u{1F517}", wifi: "\u{1F4F6}", vcard: "\u{1F464}", sms: "\u{1F4E8}", tel: "\u{1F4DE}", mailto: "\u2709\uFE0F", whatsapp: "\u{1F4AC}" };

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
function sanitizeFilename(name, ext) {
  const base = (name || "codigo-qr").trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\.[^.]+$/, "") || "codigo-qr";
  return base + "." + ext;
}
function downloadUrl(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); if (url.startsWith("blob:")) URL.revokeObjectURL(url); }, 1200);
}
function downloadBlob(blob, name) {
  downloadUrl(URL.createObjectURL(blob), name);
}
function updatePills() {
  $("marginVal").textContent = $("margin").value;
  $("logoSizeVal").textContent = $("logoSize").value + "%";
}
// construye el string de datos según el tipo de contenido seleccionado
function buildData() {
  const type = $("contentType").value;
  const raw = ($("dataText").value || "").trim();
  switch (type) {
    case "text": return { data: raw || " ", label: "Texto", icon: fileIcons.text };
    case "url": {
      let u = raw || "https://ejemplo.com";
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      return { data: u, label: "URL", icon: fileIcons.url };
    }
    case "wifi": {
      const ssid = ($("wifiSsid")?.value || "").trim();
      if (!ssid) return { data: "", label: "WiFi (requiere SSID)", icon: fileIcons.wifi, invalid: true };
      const pass = ($("wifiPass")?.value || "").trim();
      const enc = ($("wifiEnc")?.value || "WPA");
      let s = "WIFI:S:" + ssid + ";";
      if (pass) s += "P:" + pass + ";";
      if (enc && enc !== "nopass") s += "T:" + enc + ";";
      s += ";";
      return { data: s, label: "WiFi: " + ssid, icon: fileIcons.wifi };
    }
    case "vcard": {
      const name = ($("vName")?.value || "").trim();
      const org = ($("vOrg")?.value || "").trim();
      const tel = ($("vTel")?.value || "").trim();
      const email = ($("vEmail")?.value || "").trim();
      if (!name && !tel && !email) return { data: raw, label: "Contacto", icon: fileIcons.vcard };
      const lines = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + name];
      if (org) lines.push("ORG:" + org);
      if (tel) lines.push("TEL:" + tel);
      if (email) lines.push("EMAIL:" + email);
      lines.push("END:VCARD");
      return { data: lines.join("\n"), label: "Contacto: " + name, icon: fileIcons.vcard };
    }
    case "sms": {
      const tel = ($("smsTel")?.value || "").trim();
      const msg = ($("smsMsg")?.value || "").trim();
      if (!tel) return { data: "", label: "SMS (requiere móvil)", icon: fileIcons.sms, invalid: true };
      return { data: "SMSTO:" + tel + ":" + msg, label: "SMS a " + tel, icon: fileIcons.sms };
    }
    case "tel":
      return { data: "TEL:" + raw, label: "Llamada: " + raw, icon: fileIcons.tel };
    case "mailto": {
      const email = raw || "hola@ejemplo.com";
      const subj = ($("mailSubj")?.value || "").trim();
      const body = ($("mailBody")?.value || "").trim();
      let url = "mailto:" + email;
      const params = new URLSearchParams();
      if (subj) params.set("subject", subj);
      if (body) params.set("body", body);
      if (params.toString()) url += "?" + params.toString();
      return { data: url, label: "Email", icon: fileIcons.mailto };
    }
    case "whatsapp": {
      const tel = (raw || "5215551234567").replace(/[^\d]/g, "");
      let url = "https://wa.me/" + tel;
      const pre = ($("waPre")?.value || "").trim();
      if (pre) url += "?text=" + encodeURIComponent(pre);
      return { data: url, label: "WhatsApp", icon: fileIcons.whatsapp };
    }
    default: return { data: raw || " ", label: "Texto", icon: fileIcons.text };
  }
}

// ---------- UI dinámica ----------
const extraTemplates = {
  wifi: () =>
    `<div class="row-gap"><input type="text" id="wifiSsid" class="input-control" placeholder="Nombre de red (SSID)" style="flex:1.2"><input type="password" id="wifiPass" class="input-control" placeholder="Contraseña" style="flex:1"></div><select id="wifiEnc" class="input-control"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">Sin contraseña</option></select>`,
  vcard: '<div class="grid2"><input type="text" id="vName" class="input-control" placeholder="Nombre y apellido"><input type="text" id="vOrg" class="input-control" placeholder="Organización"><input type="tel" id="vTel" class="input-control" placeholder="Teléfono"><input type="email" id="vEmail" class="input-control" placeholder="Email"></div>',
  sms: '<div class="row-gap"><input type="tel" id="smsTel" class="input-control" placeholder="Móvil (+52...)" style="flex:1.2"><input type="text" id="smsMsg" class="input-control" placeholder="Mensaje" style="flex:1"></div>',
  mailto: '<div class="row-gap"><input type="text" id="mailSubj" class="input-control" placeholder="Asunto" style="flex:1.2"><input type="text" id="mailBody" class="input-control" placeholder="Cuerpo del mensaje" style="flex:1"></div>',
  whatsapp: '<input type="text" id="waPre" class="input-control" placeholder="Texto previo al chat">'
};
function rebuildExtra() {
  const type = $("contentType").value;
  const wrap = $("extraFields");
  wrap.innerHTML = extraTemplates[type] ? (typeof extraTemplates[type] === "function" ? extraTemplates[type]() : extraTemplates[type]) : "";
}
const DOT_TYPES = { square: "square", rounded: "rounded", dots: "dots", extraRounded: "extra-rounded" };
const EYE_TYPES = {
  default: { square: "square", dot: "square" },
  circle: { square: "dot", dot: "dot" },
  rounded: { square: "rounded", dot: "dot" },
  extraRounded: { square: "extra-rounded", dot: "dot" }
};

// ---------- opciones del motor ----------
function buildOptions(size = BASE_SIZE, type = "canvas") {
  const fg = $("fgColor").value;
  const bg = $("bgColor").value;
  const eye = EYE_TYPES[$("eyeShape").value] || EYE_TYPES.default;
  const quiet = parseInt($("margin").value, 10) || 0; // en módulos
  const { data } = buildData();
  const opts = {
    width: size,
    height: size,
    type,
    data: data || " ",
    margin: Math.round(quiet * size / 45),
    qrOptions: { errorCorrectionLevel: $("ecc").value, typeNumber: 0 },
    dotsOptions: { color: fg, type: DOT_TYPES[$("dotShape").value] || "square" },
    backgroundOptions: { color: bg },
    cornersSquareOptions: { color: fg, type: eye.square },
    cornersDotOptions: { color: fg, type: eye.dot }
  };
  if (logoDataUrl) {
    opts.image = logoDataUrl;
    opts.imageOptions = { hideBackgroundDots: true, imageSize: parseInt($("logoSize").value, 10) / 100, margin: 4, crossOrigin: "anonymous" };
  }
  return opts;
}
function setPreviewState(label, icon, invalid) {
  if (invalid) {
    qrInstance = null;
    $("qrCanvasWrap").innerHTML = '<div class="empty-preview">⚠️ ' + (label || "Datos inválidos") + "</div>";
    $("qrVersion").textContent = "—";
  }
  $("qrMeta").textContent = (icon || "") + " " + (label || "—");
  $("qrMeta").style.opacity = invalid ? 0.6 : 1;
}

// ---------- render ----------
function render() {
  const { label, icon, invalid } = buildData();
  setPreviewState(label, icon, invalid);
  if (invalid) return;
  try {
    if (qrInstance) {
      qrInstance.update(buildOptions());
    } else {
      $("qrCanvasWrap").innerHTML = "";
      qrInstance = new QRCodeStyling(buildOptions());
      qrInstance.append($("qrCanvasWrap"));
    }
    refreshVersion();
  } catch (e) {
    console.error(e);
    qrInstance = null;
    $("qrCanvasWrap").innerHTML = '<div class="empty-preview">Error al generar el código QR.</div>';
  }
}
function refreshVersion() {
  const qr = qrInstance && qrInstance._qr;
  const n = qr && typeof qr.getModuleCount === "function" ? qr.getModuleCount() : 0;
  $("qrVersion").textContent = n ? ("Versión " + ((n - 17) / 4) + " · " + n + "×" + n + " módulos") : "—";
}

// ---------- exportación ----------
async function rawData(ext, size) {
  const type = ext === "svg" ? "svg" : "canvas";
  const tmp = new QRCodeStyling(buildOptions(size, type));
  return tmp.getRawData(ext);
}
async function exportQr() {
  const { invalid } = buildData();
  if (invalid) { alert("Corrija los datos antes de exportar."); return; }
  const fmt = $("exportFormat").value;
  const size = EXPORT_BASE * (parseInt($("quality").value, 10) || 1);
  const name = sanitizeFilename($("fileName").value || "codigo-qr", fmt);
  try {
    if (fmt === "pdf") {
      await exportPdf(size, name);
    } else {
      const blob = await rawData(fmt === "jpg" ? "jpeg" : fmt, size);
      downloadBlob(blob, name);
    }
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar. Abra la consola para más detalle.");
  }
}
async function exportPdf(size, name) {
  const { jsPDF } = window.jspdf;
  const blob = await rawData("png", size);
  const imgData = await readFileAsDataURL(blob);
  const pt = (size / 96) * 72; // px -> pt
  const pdf = new jsPDF({ unit: "pt", format: [pt, pt] });
  pdf.addImage(imgData, "PNG", 0, 0, pt, pt);
  downloadBlob(pdf.output("blob"), name.replace(/\.[^.]+$/, ".pdf"));
}

// ---------- logo ----------
$("logoUpload").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith("image/")) { alert("Seleccione una imagen (PNG/JPG/SVG)."); return; }
  logoDataUrl = await readFileAsDataURL(f);
  $("logoPreview").src = logoDataUrl;
  $("logoPreview").style.display = "block";
  render();
});
$("logoClear").addEventListener("click", () => {
  logoDataUrl = "";
  $("logoPreview").src = "";
  $("logoPreview").style.display = "none";
  $("logoUpload").value = "";
  render();
});

// ---------- wiring ----------
let renderDebounced = debounce(render, DEBOUNCE_MS);
function assignSlider(id, target) {
  $(id).addEventListener("input", () => { $(target).textContent = $(id).value; renderDebounced(); });
}
function boot() {
  updatePills();
  rebuildExtra();
  let saved = "";
  try { saved = localStorage.getItem("qrStudio.data") || ""; } catch {}
  $("dataText").value = saved || "https://github.com/Matthew-Garay";
  ["contentType","dataText","fgColor","bgColor","dotShape","eyeShape","ecc","margin","logoSize","exportFormat","fileName"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", renderDebounced);
    if (el.tagName === "SELECT") el.addEventListener("change", renderDebounced);
  });
  $("generateBtn").addEventListener("click", render);
  $("downloadBtn").addEventListener("click", exportQr);
  $("contentType").addEventListener("change", () => { rebuildExtra(); render(); });
  assignSlider("margin", "marginVal");
  assignSlider("logoSize", "logoSizeVal");
  $("dataText").addEventListener("input", () => {
    try { localStorage.setItem("qrStudio.data", $("dataText").value); } catch {}
  });
  $("downloadBtn").disabled = false;
  render();
}
document.addEventListener("DOMContentLoaded", boot);
