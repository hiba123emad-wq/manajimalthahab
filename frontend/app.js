/* ═══════════════════════════════════════════════════════════════
   app.js — مشترك بين index.html و files.html
   Sorooh Albasrah Co. — HSE Daily Reports System v5.0
   ═══════════════════════════════════════════════════════════════ */

"use strict";

/* ─── ثوابت مشتركة ─────────────────────────────────────────── */

const API_BASE = window.location.origin;

const REPORT_TYPES = [
  { value:"toolbox_talks",    icon:"🧰", name:"Tool Box Talks",                      tag:"Toolbox",  cls:"c1" },
  { value:"soc_cards",        icon:"🪪", name:"SOC Cards",                           tag:"SOC",      cls:"c2" },
  { value:"hse_inspections",  icon:"🔍", name:"HSE Site Inspections",                tag:"HSE",      cls:"c3" },
  { value:"incidents",        icon:"⚠️", name:"Accident / Incidents / Near Misses",  tag:"Incident", cls:"c4" },
  { value:"safety_drills",    icon:"🚨", name:"Safety Drills",                       tag:"Drills",   cls:"c5" }
];

const MONTHLY_TYPES = [
  { value:"monthly_toolbox",   icon:"🧰", name:"Tool Box Talks — شهري",              tag:"Toolbox",  cls:"c1" },
  { value:"monthly_soc",       icon:"🪪", name:"SOC Cards — شهري",                   tag:"SOC",      cls:"c2" },
  { value:"monthly_hse",       icon:"🔍", name:"HSE Site Inspections — شهري",        tag:"HSE",      cls:"c3" },
  { value:"monthly_incidents", icon:"⚠️", name:"Incidents — شهري",                   tag:"Incident", cls:"c4" },
  { value:"monthly_drills",    icon:"🚨", name:"Safety Drills — شهري",               tag:"Drills",   cls:"c5" }
];

const TYPE_MAP = Object.fromEntries(
  [...REPORT_TYPES, ...MONTHLY_TYPES].map(t => [t.value, { label:t.name, cls:t.cls, icon:t.icon }])
);

const TAB_TO_TYPE = {
  c1:"toolbox_talks", c2:"soc_cards",
  c3:"hse_inspections", c4:"incidents", c5:"safety_drills"
};

const FILE_ICONS = { pdf:"📄", jpg:"🖼️", jpeg:"🖼️", png:"🖼️", doc:"📝", docx:"📝" };

/* ─── أدوات مشتركة ──────────────────────────────────────────── */

function formatSize(b) {
  if (!b || b < 0) return "—";
  if (b < 1024)    return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("ar-IQ", {
      year:"numeric", month:"short", day:"numeric"
    });
  } catch { return ts; }
}

function getFileIcon(name) {
  const ext = (name || "").split(".").pop().toLowerCase();
  return FILE_ICONS[ext] || "📎";
}

/* ═══════════════════════════════════════════════════════════════
   صفحة الرفع  (index.html)
   ═══════════════════════════════════════════════════════════════ */

function initUploadPage() {
  const reportsContainer = document.getElementById("reportsContainer");
  const btnAddRow        = document.getElementById("btnAddRow");
  const uploadBtn        = document.getElementById("uploadBtn");
  const alertBox         = document.getElementById("alertBox");
  const alertText        = document.getElementById("alertText");
  const alertIcon        = document.getElementById("alertIcon");
  const summaryBar       = document.getElementById("summaryBar");
  const summaryChips     = document.getElementById("summaryChips");

  if (!reportsContainer) return;

  let rows = [];
  let rowCounter = 0;

  addRow();
  btnAddRow.addEventListener("click", addRow);
  document.addEventListener("click", closeAllMenus);

  function addRow() {
    const id = ++rowCounter;
    rows.push({ id, type:null, file:null, note:"" });

    const el = document.createElement("div");
    el.className = "report-row";
    el.dataset.id = id;
    el.innerHTML = buildRowHTML(id, rows.length);
    reportsContainer.appendChild(el);

    bindRow(id);
    updateRowNumbers();
    updateSummary();
  }

  function buildRowHTML(id, num) {
    const isMonthly = window.location.pathname.includes('monthly');
    const types = isMonthly ? MONTHLY_TYPES : REPORT_TYPES;
    const opts = types.map(t => `
      <div class="mini-opt" data-rid="${id}" data-value="${t.value}"
           data-icon="${t.icon}" data-name="${t.name}"
           data-tag="${t.tag}" data-cls="${t.cls}">
        <div class="mini-opt-icon ${t.cls}">${t.icon}</div>
        <div style="flex:1">
          <div class="mini-opt-name">${t.name}</div>
          <span class="mini-opt-tag ${t.cls}">${t.tag}</span>
        </div>
        <span class="mini-opt-check ${t.cls}">✓</span>
      </div>`).join("");

    const delBtn = num > 1
      ? `<button class="row-delete" data-rid="${id}" title="حذف">🗑</button>`
      : `<div style="width:26px"></div>`;

    return `
      <div class="report-row-header">
        <div class="row-num">${num}</div>
        <div class="row-label">تقرير #${num}</div>
        ${delBtn}
      </div>
      <div class="report-row-body">
        <div class="mini-dropdown-wrapper">
          <div class="mini-trigger" id="trig-${id}">
            <div class="mini-trigger-content">
              <span class="mini-trigger-icon" id="ticon-${id}">📋</span>
              <span class="mini-trigger-text ph" id="ttext-${id}">اختر نوع التقرير...</span>
              <span class="mini-tag" id="ttag-${id}" style="display:none"></span>
            </div>
            <svg class="mini-chevron" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div class="mini-menu" id="menu-${id}">${opts}</div>
        </div>

        <div class="row-file-zone" id="zone-${id}">
          <input type="file" id="finput-${id}" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"/>
          <div class="row-file-zone-icon">☁️</div>
          <div class="row-file-zone-text">اسحب الملف هنا أو <span>انقر للاختيار</span></div>
        </div>

        <div class="row-file-chip" id="chip-${id}">
          <div class="rfc-icon" id="cicon-${id}">📎</div>
          <div class="rfc-info">
            <div class="rfc-name" id="cname-${id}"></div>
            <div class="rfc-meta" id="cmeta-${id}"></div>
          </div>
          <button class="rfc-remove" data-rid="${id}">✕</button>
        </div>

        <div class="row-note-wrap">
          <div class="row-note-label">
            📝 ملاحظات
            <span style="font-weight:400;opacity:.6">(اختياري)</span>
          </div>
          <textarea class="row-note" id="note-${id}"
            placeholder="أضف ملاحظة أو وصفاً لهذا التقرير..."></textarea>
        </div>
      </div>`;
  }

  function bindRow(id) {
    const trig  = document.getElementById(`trig-${id}`);
    const menu  = document.getElementById(`menu-${id}`);
    const finput= document.getElementById(`finput-${id}`);
    const zone  = document.getElementById(`zone-${id}`);
    const noteEl= document.getElementById(`note-${id}`);
    const rowEl = document.querySelector(`.report-row[data-id="${id}"]`);

    trig.addEventListener("click", e => {
      e.stopPropagation();
      closeAllMenusExcept(id);
      const isOpen = trig.classList.toggle("open");
      menu.classList.toggle("open", isOpen);
      setRowZ(id, isOpen ? 100 : 1);
    });

    menu.querySelectorAll(".mini-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        menu.querySelectorAll(".mini-opt").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");

        const row = rows.find(r => r.id === id);
        if (row) row.type = opt.dataset.value;

        document.getElementById(`ticon-${id}`).textContent = opt.dataset.icon;
        const tt = document.getElementById(`ttext-${id}`);
        tt.textContent = opt.dataset.name;
        tt.classList.remove("ph");
        const tg = document.getElementById(`ttag-${id}`);
        tg.textContent  = opt.dataset.tag;
        tg.className    = "mini-tag " + opt.dataset.cls;
        tg.style.display= "inline-block";

        trig.classList.remove("open");
        menu.classList.remove("open");
        setRowZ(id, 1);
        updateSummary();
      });
    });

    finput.addEventListener("change", () => {
      if (finput.files[0]) attachFile(id, finput.files[0]);
      finput.value = "";
    });
    zone.addEventListener("dragover",  e => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", ()  => zone.classList.remove("dragover"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer.files[0]) attachFile(id, e.dataTransfer.files[0]);
    });

    rowEl.querySelector(".rfc-remove")?.addEventListener("click", () => detachFile(id));
    rowEl.querySelector(".row-delete")?.addEventListener("click", () => deleteRow(id));

    noteEl?.addEventListener("input", () => {
      const row = rows.find(r => r.id === id);
      if (row) row.note = noteEl.value;
    });
  }

  function attachFile(id, file) {
    if (file.size > 10 * 1024 * 1024) {
      showAlert("error", "⚠️", `الملف "${file.name}" يتجاوز 10 MB`);
      return;
    }
    const row = rows.find(r => r.id === id);
    if (row) row.file = file;

    const ext = file.name.split(".").pop().toLowerCase();
    document.getElementById(`cicon-${id}`).textContent = FILE_ICONS[ext] || "📎";
    document.getElementById(`cname-${id}`).textContent = file.name;
    document.getElementById(`cmeta-${id}`).textContent =
      formatSize(file.size) + " · " + ext.toUpperCase();
    document.getElementById(`zone-${id}`).style.display = "none";
    document.getElementById(`chip-${id}`).classList.add("visible");

    const rowEl = document.querySelector(`.report-row[data-id="${id}"]`);
    if (rowEl && row?.type) rowEl.classList.add("has-file");

    updateSummary();
    hideAlert();
  }

  function detachFile(id) {
    const row = rows.find(r => r.id === id);
    if (row) row.file = null;
    document.getElementById(`zone-${id}`).style.display = "";
    document.getElementById(`chip-${id}`).classList.remove("visible");
    document.querySelector(`.report-row[data-id="${id}"]`)?.classList.remove("has-file");
    updateSummary();
  }

  function deleteRow(id) {
    rows = rows.filter(r => r.id !== id);
    document.querySelector(`.report-row[data-id="${id}"]`)?.remove();
    updateRowNumbers();
    updateSummary();
    if (rows.length === 0) addRow();
  }

  function updateRowNumbers() {
    document.querySelectorAll(".report-row").forEach((el, i) => {
      el.querySelector(".row-num").textContent   = i + 1;
      el.querySelector(".row-label").textContent = `تقرير #${i + 1}`;
      const delBtn = el.querySelector(".row-delete");
      if (delBtn) delBtn.style.display = rows.length === 1 ? "none" : "";
    });
  }

  function updateSummary() {
    const ready = rows.filter(r => r.type && r.file);
    summaryChips.innerHTML = "";
    if (!ready.length) { summaryBar.classList.remove("visible"); return; }
    summaryBar.classList.add("visible");
    ready.forEach(r => {
      const t = REPORT_TYPES.find(x => x.value === r.type);
      if (!t) return;
      const chip = document.createElement("span");
      chip.className   = `summary-chip ${t.cls}`;
      chip.textContent = `${t.icon} ${t.tag}`;
      summaryChips.appendChild(chip);
    });
  }

  function closeAllMenus() {
    rows.forEach(r => {
      document.getElementById(`trig-${r.id}`)?.classList.remove("open");
      document.getElementById(`menu-${r.id}`)?.classList.remove("open");
    });
    document.querySelectorAll(".report-row").forEach(r => r.style.zIndex = "1");
  }
  function closeAllMenusExcept(exceptId) {
    rows.forEach(r => {
      if (r.id === exceptId) return;
      document.getElementById(`trig-${r.id}`)?.classList.remove("open");
      document.getElementById(`menu-${r.id}`)?.classList.remove("open");
      setRowZ(r.id, 1);
    });
  }
  function setRowZ(id, z) {
    const el = document.querySelector(`.report-row[data-id="${id}"]`);
    if (el) el.style.zIndex = z;
  }

  function showAlert(type, icon, msg) {
    alertBox.className     = `alert visible ${type}`;
    alertIcon.textContent  = icon;
    alertText.textContent  = msg;
  }
  function hideAlert() { alertBox.className = "alert"; }

  window.uploadAll = async function () {
    const ready      = rows.filter(r => r.type && r.file);
    const incomplete = rows.filter(r => (r.type && !r.file) || (!r.type && r.file));

    if (!ready.length) {
      showAlert("error", "⚠️",
        rows.every(r => !r.type && !r.file)
          ? "الرجاء إضافة تقرير واحد على الأقل"
          : "الرجاء اختيار النوع والملف");
      return;
    }
    if (incomplete.length) {
      showAlert("error", "⚠️", "يوجد تقرير ناقص — تأكد من اختيار النوع والملف لكل صف");
      return;
    }

    uploadBtn.classList.add("loading");
    uploadBtn.disabled = true;
    hideAlert();

    const formData = new FormData();
    ready.forEach(r => {
      formData.append("types[]",      r.type);
      formData.append("certificates", r.file, r.file.name);
      formData.append("notes[]",      r.note || "");
    });

    try {
      const res    = await fetch(`${API_BASE}/upload_certificate`, { method:"POST", body:formData });
      const result = await res.json();

      if (result.status === "success") {
        showAlert("success", "✅", result.message || `تم رفع ${ready.length} تقرير بنجاح`);
        rows = []; reportsContainer.innerHTML = ""; rowCounter = 0;
        addRow();
        summaryBar.classList.remove("visible");
      } else {
        showAlert("error", "❌", result.message || "فشل الرفع، يرجى المحاولة مجدداً");
      }
    } catch {
      showAlert("error", "❌", "تعذّر الاتصال بالخادم، تحقق من الشبكة وأعد المحاولة");
    } finally {
      uploadBtn.classList.remove("loading");
      uploadBtn.disabled = false;
    }
  };
}

/* ═══════════════════════════════════════════════════════════════
   صفحة الملفات  (files.html)
   ═══════════════════════════════════════════════════════════════ */

function initFilesPage() {
  const fileList    = document.getElementById("fileList");
  const searchInput = document.getElementById("searchInput");

  if (!fileList) return;

  let allFiles    = [];
  let activeTab   = "all";
  let pendingFile = null;

  const isMonthly = window.location.pathname.includes('monthly');
  const DAILY_TYPES   = ["toolbox_talks","soc_cards","hse_inspections","incidents","safety_drills"];
  const MONTHLY_KEYS  = ["monthly_toolbox","monthly_soc","monthly_hse","monthly_incidents","monthly_drills"];
  const PAGE_TYPES    = isMonthly ? MONTHLY_KEYS : DAILY_TYPES;

  const TAB_MAP = isMonthly ? {
    c1:"monthly_toolbox", c2:"monthly_soc",
    c3:"monthly_hse", c4:"monthly_incidents", c5:"monthly_drills"
  } : TAB_TO_TYPE;

  async function loadFiles() {
    try {
      const res  = await fetch(`${API_BASE}/list_certificates`);
      const data = await res.json();
      if (data.status === "success") {
        // فلتر حسب نوع الصفحة (يومي أو شهري)
        allFiles = (data.files || []).filter(f => PAGE_TYPES.includes(f.certType));
        updateCounts();
        renderFiles();
      } else {
        showError(data.message || "فشل التحميل");
      }
    } catch {
      showError("تعذّر الاتصال بالخادم");
    }
  }

  function updateCounts() {
    const counts = { c1:0, c2:0, c3:0, c4:0, c5:0 };
    allFiles.forEach(f => {
      Object.entries(TAB_MAP).forEach(([tab, type]) => {
        if (f.certType === type) counts[tab]++;
      });
    });

    document.getElementById("statAll").textContent = allFiles.length;
    document.getElementById("statC1").textContent  = counts.c1;
    document.getElementById("statC2").textContent  = counts.c2;
    document.getElementById("statC3").textContent  = counts.c3;
    document.getElementById("statC4").textContent  = counts.c4;
    document.getElementById("cntAll").textContent  = allFiles.length;
    document.getElementById("cntC1").textContent   = counts.c1;
    document.getElementById("cntC2").textContent   = counts.c2;
    document.getElementById("cntC3").textContent   = counts.c3;
    document.getElementById("cntC4").textContent   = counts.c4;
    document.getElementById("cntC5").textContent   = counts.c5;
  }

  function renderFiles() {
    const query    = (searchInput?.value || "").toLowerCase().trim();
    let   filtered = [...allFiles];

    if (activeTab !== "all") {
      const typeKey = TAB_MAP[activeTab];
      filtered = filtered.filter(f => f.certType === typeKey);
    }
    if (query) {
      filtered = filtered.filter(f =>
        (f.displayName || f.name || "").toLowerCase().includes(query)
      );
    }

    if (!filtered.length) {
      fileList.innerHTML = `
        <div class="status-block">
          <span class="s-icon">${query ? "🔎" : "📭"}</span>
          <p>${query ? "لا توجد نتائج مطابقة" : "لا توجد تقارير في هذا القسم"}</p>
          <span>${query ? "جرب كلمة بحث مختلفة" : "ارفع تقريراً جديداً من الصفحة الرئيسية"}</span>
        </div>`;
      return;
    }

    fileList.innerHTML = filtered.map((f, i) => {
      const type  = TYPE_MAP[f.certType] || { label:f.certType, cls:"", icon:"📋" };
      const delay = Math.min(i * 30, 250);
      const name  = f.displayName || f.name || "—";
      const note  = f.note ? `<div class="file-note"><span class="file-note-icon">📝</span>${f.note}</div>` : "";

      return `
        <div class="file-row" style="animation-delay:${delay}ms">
          <div class="file-type-stripe ${type.cls}"></div>
          <div class="file-icon-box">${getFileIcon(name)}</div>
          <div class="file-info">
            <div class="file-name">${name}</div>
            <div class="file-meta">
              <span class="file-badge ${type.cls}">${type.icon} ${type.label}</span>
              <span>${formatDate(f.created_at)}</span>
              <span>${formatSize(f.size)}</span>
            </div>
            ${note}
          </div>
          <div class="file-actions">
            <a class="btn-action btn-open" href="${f.publicUrl}" target="_blank">🔗 فتح</a>
            <button class="btn-action btn-rename" data-index="${i}" onclick="openRename(this)">✏️ تسمية</button>
            <button class="btn-action btn-delete" data-index="${i}" onclick="openDelete(this)">🗑️ حذف</button>
          </div>
        </div>`;
    }).join("");

    window._filteredFiles = filtered;
  }

  function showError(msg) {
    fileList.innerHTML = `
      <div class="status-block">
        <span class="s-icon">⚠️</span>
        <p>خطأ في التحميل</p>
        <span>${msg}</span>
      </div>`;
  }

  window.switchTab = function(tab) {
    activeTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );
    renderFiles();
  };

  function openModal(id)  { document.getElementById(id)?.classList.add("visible"); }

  window.closeModal = function(id) {
    document.getElementById(id)?.classList.remove("visible");
    pendingFile = null;
  };

  window.openRename = function(btn) {
    const index = parseInt(btn.dataset.index, 10);
    pendingFile = window._filteredFiles[index];
    if (!pendingFile) return;
    const inp = document.getElementById("renameInput");
    if (inp) inp.value = pendingFile.displayName || pendingFile.name;
    openModal("renameModal");
  };

  window.openDelete = function(btn) {
    const index = parseInt(btn.dataset.index, 10);
    pendingFile = window._filteredFiles[index];
    if (!pendingFile) return;
    openModal("deleteModal");
  };

  window.confirmRename = async function() {
    if (!pendingFile) return;
    const newName = document.getElementById("renameInput")?.value.trim();
    if (!newName) return;
    try {
      const res  = await fetch(`${API_BASE}/rename_certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:       pendingFile.id,        // ✅ إرسال الـ id من الجدول
          oldName:  pendingFile.name,
          newName:  newName,
          certType: pendingFile.certType
        })
      });
      const data = await res.json();
      window.closeModal("renameModal");
      if (data.status === "success") loadFiles();
      else alert("فشل: " + data.message);
    } catch { alert("خطأ في الاتصال"); }
  };

  window.confirmDelete = async function() {
    if (!pendingFile) return;
    try {
      const res  = await fetch(`${API_BASE}/delete_certificate`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:       pendingFile.id,        // ✅ إرسال الـ id من الجدول
          fileName: pendingFile.name,
          certType: pendingFile.certType
        })
      });
      const data = await res.json();
      window.closeModal("deleteModal");
      if (data.status === "success") loadFiles();
      else alert("فشل: " + data.message);
    } catch { alert("خطأ في الاتصال"); }
  };

  document.querySelectorAll(".modal-overlay").forEach(o =>
    o.addEventListener("click", e => { if (e.target === o) window.closeModal(o.id); })
  );

  searchInput?.addEventListener("input", renderFiles);

  loadFiles();
}

/* ═══════════════════════════════════════════════════════════════
   تشغيل تلقائي حسب الصفحة
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  initUploadPage();
  initFilesPage();
});