// QR Studio — app.js
// Generador de códigos QR basado en qr-code-styling (offline).
// Exporta PNG, JPG, WebP, SVG y PDF con varias calidades de resolución.
const $ = (id) => document.getElementById(id);
const BASE_SIZE = 320; // tamaño base del canvas de renderizado (px)
const DEBOUNCE_MS = 320;

let qrInstance = null;
let logoDataUrl = "";
const mimeTypes = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const fileIcons = { text: "\U0001F4DD", url: "\U0001F517", wifi: "\U0001F4F6", vcard: "\U0001F912", sms: "\U0001F4E8", tel: "\U0001F4DE", mailto: "\u2709\uFE0F", whatsapp: "\U0001F44D" };

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
  $("pixelSizeVal").textContent = $("pixelSize").value;
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
    default: return { data: raw || " ", label: "Texto", icon: "\U0001F4DD" };
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
function eyeShapeMap(v) {
  const fg = $("fgColor").value;
  switch (v) {
    case "circle": return { type: "circle", color: fg };
    case "rounded": return { type: "rounded", color: fg };
    case "extraRounded": return { type: "extraRounded", color: fg };
    case "default":
    default: return { type: "default", color: fg };
  }
}

// ---------- opciones del motor ----------
function buildOptions() {
  const dotType = $("dotShape").value;
  const fg = $("fgColor").value;
  const bg = $("bgColor").value;
  const ecc = $("ecc").value;
  const margin = parseInt($("margin").value, 10) || 0;
  const { data } = buildData();
  const opts = {
    width: BASE_SIZE,
    height: BASE_SIZE,
    type: "canvas",
    data: data || " ",
    qrOptions: { errorCorrectionLevel: ecc, typeNumber: 0 },
    margin: margin,
    dotsOptions: { color: fg, type: dotType, padding: parseInt($("pixelSize").value, 10) / 10 },
    backgroundOptions: { color: bg },
    cornersSquareOptions: { color: fg, type: $("eyeShape").value },
    cornersDotOptions: eyeShapeMap($("eyeShape").value)
  };
  if (logoDataUrl) {
    opts.image = logoDataUrl;
    opts.imageOptions = { hideBackgroundDots: true, imageSize: parseInt($("logoSize").value, 10) / 100, margin: parseInt($("logoSize").value, 10) / 20 };
  }
  return opts;
}
function setPreviewState(label, icon, invalid) {
  if (invalid) {
    $("qrCanvasWrap").innerHTML = '<div class="empty-preview">\u26A0\uFE0F ' + (label || "Datos inv\u00E1lidos") + "</div>";
    $("qrVersion").textContent = "\u2014";
  }
  $("qrMeta").textContent = (icon || "") + " " + (label || "\u2014");
  $("qrMeta").style.opacity = invalid ? 0.6 : 1;
}

// ---------- render ----------
async function render() {
  const { label, icon, invalid } = buildData();
  setPreviewState(label, icon, invalid);
  if (invalid) return;
  try {
    if (qrInstance) {
      qrInstance.update(buildOptions());
      await qrInstance.getCanvas();
      await refreshVersion();
      return;
    }
    qrInstance = new QRCodeStyling(buildOptions());
    $("qrCanvasWrap").append(qrInstance);
    await qrInstance.getCanvas();
    await refreshVersion();
  } catch (e) {
    console.error(e);
    $("qrCanvasWrap").innerHTML = '<div class="empty-preview">Error al generar el c\u00F3digo QR.</div>';
  }
}
async function refreshVersion() {
  try {
    const raw = await qrInstance.getRawData();
    const count = (raw || []).length;
    $("qrVersion").textContent = count ? ("m\u00F3dulos: " + count) : "\u2014";
  } catch { $("qrVersion").textContent = "\u2014"; }
}
// ---------- exportación ----------
async function exportQr() {
  if (!qrInstance) return;
  const { invalid } = buildData();
  if (invalid) { alert("Corrija los datos antes de exportar."); return; }
  const fmt = $("exportFormat").value;
  const scale = parseInt($("quality").value, 10) || 1;
  const name = sanitizeFilename($("fileName").value || "codigo-qr", fmt);
  try {
    if (fmt === "svg") {
      const svg = await qrInstance.getSVGString();
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, name);
    } else if (fmt === "pdf") {
      await exportPdf(scale, name);
    } else {
      const src = await qrInstance.getPlainCanvas();
      const out = document.createElement("canvas");
      out.width = src.width * scale;
      out.height = src.height * scale;
      const ctx = out.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, out.width, out.height);
      const quality = fmt === "png" ? 1 : 0.95;
      out.toBlob((b) => downloadUrl(URL.createObjectURL(b), name), mimeTypes[fmt], quality);
    }
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar. Abra la consola para m\u00E1s detalle.");
  }
}
async function exportPdf(scale, name) {
  const { jsPDF } = window.jspdf;
  const src = await qrInstance.getPlainCanvas();
  const wPx = src.width * scale;
  const hPx = src.height * scale;
  const out = document.createElement("canvas");
  out.width = wPx; out.height = hPx;
  out.getContext("2d").drawImage(src, 0, 0, wPx, hPx);
  const imgData = out.toDataURL("image/png");
  const dpi = 96; // css px -> pt
  const wPt = (wPx / dpi) * 72;
  const hPt = (hPx / dpi) * 72;
  const pdf = new jsPDF({ unit: "pt", format: [wPt, hPt] });
  pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);
  const blob = pdf.output("blob");
  downloadBlob(blob, name.replace(/\.[^.]+$/, ".pdf"));
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
  const saved = localStorage.getItem("qrStudio.data");
  if (saved) { $("dataText").value = saved; }
  ["contentType","dataText","fgColor","bgColor","dotShape","eyeShape","ecc","margin","pixelSize","logoSize","exportFormat","fileName"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", renderDebounced);
    if (el.tagName === "SELECT") el.addEventListener("change", renderDebounced);
  });
  $("generateBtn").addEventListener("click", render);
  $("downloadBtn").addEventListener("click", exportQr);
  $("contentType").addEventListener("change", () => { rebuildExtra(); render(); });
  assignSlider("margin", "marginVal");
  assignSlider("pixelSize", "pixelSizeVal");
  assignSlider("logoSize", "logoSizeVal");
  $("dataText").addEventListener("input", () => {
    localStorage.setItem("qrStudio.data", $("dataText").value);
  });
  $("downloadBtn").disabled = false;
  render();
}
document.addEventListener("DOMContentLoaded", boot);
