const express = require("express");
const multer  = require("multer");
const cors    = require("cors");
const path    = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 3002;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

const CERT_FOLDERS = {
  toolbox_talks:     "certificates/toolbox_talks",
  soc_cards:         "certificates/soc_cards",
  hse_inspections:   "certificates/hse_inspections",
  incidents:         "certificates/incidents",
  safety_drills:     "certificates/safety_drills",
  monthly_toolbox:   "monthly/toolbox_talks",
  monthly_soc:       "monthly/soc_cards",
  monthly_hse:       "monthly/hse_inspections",
  monthly_incidents: "monthly/incidents",
  monthly_drills:    "monthly/safety_drills",
  monthly_report:    "monthly/reports"
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
    const allowed = [
      "application/pdf","image/jpeg","image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("نوع الملف غير مدعوم"));
  }
});

/* POST /upload_certificate  (يومي) */
app.post("/upload_certificate", upload.fields([
  { name: "certificates", maxCount: 20 },
  { name: "file", maxCount: 1 }
]), async (req, res) => {
  try {
    let files = (req.files["certificates"] || []).concat(req.files["file"] || []);
    if (!files.length) return res.status(400).json({ status:"error", message:"لم يتم إرفاق أي ملف" });

    const weekParam  = req.body["week"]  || "";
    const singleType = req.body["type"]  || "";
    const singleNote = req.body["note"]  || "";

    let types, notes;
    if (singleType && files.length === 1) {
      types = [singleType]; notes = [singleNote];
    } else {
      types = req.body["types[]"] || req.body["types"] || [];
      if (!Array.isArray(types)) types = [types];
      types = types.filter(Boolean);
      notes = req.body["notes[]"] || req.body["notes"] || [];
      if (!Array.isArray(notes)) notes = [notes];
      if (types.length === 1 && files.length > 1) types = Array(files.length).fill(types[0]);
    }

    if (types.length !== files.length)
      return res.status(400).json({ status:"error", message:`عدد الأنواع (${types.length}) لا يتطابق مع عدد الملفات (${files.length})` });

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]; const certType = types[i];
      const note = Array.isArray(notes) ? (notes[i]||"") : (notes||"");

      if (!CERT_FOLDERS[certType]) { results.push({ status:"error", message:`نوع غير صحيح: ${certType}` }); continue; }
      const folder   = weekParam ? `${CERT_FOLDERS[certType]}/${weekParam}` : CERT_FOLDERS[certType];
      const ext      = file.originalname.substring(file.originalname.lastIndexOf("."));
      const safeName = Date.now()+"_"+i+ext;
      const filePath = `${folder}/${safeName}`;

      const { error: ue } = await supabase.storage.from(process.env.SUPABASE_BUCKET)
        .upload(filePath, file.buffer, { contentType:file.mimetype, upsert:false, duplex:"half" });
      if (ue) { results.push({ status:"error", message:"فشل رفع: "+file.originalname+" — "+ue.message }); continue; }

      const { error: de } = await supabase.from("certificates").insert({
        file_name:file.originalname.substring(0,file.originalname.lastIndexOf("."))+Date.now()+i+ext,
        display_name:file.originalname, cert_type:certType, folder, note
      });
      // use safeName for consistency
      const { error: de2 } = de ? { error: de } : await supabase.from("certificates").upsert({
        file_name:safeName, display_name:file.originalname, cert_type:certType, folder, note
      },{ onConflict:"file_name" });

      if (de) {
        await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([filePath]);
        results.push({ status:"error", message:"فشل حفظ البيانات: "+de.message }); continue;
      }
      const { data:u } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(filePath);
      results.push({ status:"success", url:u.publicUrl });
    }

    const failed=results.filter(r=>r.status==="error"), success=results.filter(r=>r.status==="success");
    if (!failed.length)       return res.status(200).json({ status:"success", message:`تم رفع ${success.length} تقرير ✅`, results });
    else if (!success.length) return res.status(500).json({ status:"error",   message:"فشل رفع جميع الملفات", results });
    else                      return res.status(207).json({ status:"partial",  message:`تم رفع ${success.length} وفشل ${failed.length}`, results });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message||"خطأ داخلي" }); }
});

/* POST /upload_monthly  — body: file, month (YYYY-MM), week (1-4), note */
app.post("/upload_monthly", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ status:"error", message:"لم يتم إرفاق أي ملف" });

    const month = req.body["month"] || "";
    const week  = req.body["week"]  || "";
    const note  = req.body["note"]  || "";

    if (!month || !week)
      return res.status(400).json({ status:"error", message:"الشهر والأسبوع مطلوبان" });

    const folder   = `monthly/reports/${month}/week${week}`;
    const ext      = file.originalname.substring(file.originalname.lastIndexOf("."));
    const safeName = Date.now() + ext;
    const filePath = `${folder}/${safeName}`;

    const { error: ue } = await supabase.storage.from(process.env.SUPABASE_BUCKET)
      .upload(filePath, file.buffer, { contentType:file.mimetype, upsert:false, duplex:"half" });
    if (ue) return res.status(500).json({ status:"error", message:"فشل رفع الملف: "+ue.message });

    const { error: de } = await supabase.from("certificates").insert({
      file_name: safeName, display_name: file.originalname,
      cert_type: "monthly_report", folder, note
    });

    if (de) {
      await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([filePath]);
      return res.status(500).json({ status:"error", message:"فشل حفظ البيانات: "+de.message });
    }

    const { data:u } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(filePath);
    return res.status(200).json({ status:"success", url:u.publicUrl });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message }); }
});

/* GET /list_monthly_months — قائمة الشهور المتاحة */
app.get("/list_monthly_months", async (req, res) => {
  try {
    const { data, error } = await supabase.from("certificates").select("folder")
      .eq("cert_type","monthly_report").order("folder",{ ascending:false });
    if (error) return res.status(500).json({ status:"error", message:error.message });

    const months = [...new Set(
      (data||[]).map(f=>{ const m=f.folder.match(/reports\/(\d{4}-\d{2})/); return m?m[1]:null; }).filter(Boolean)
    )];
    return res.status(200).json({ status:"success", months });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message }); }
});

/* GET /list_monthly?month=2025-01 */
app.get("/list_monthly", async (req, res) => {
  try {
    const month = req.query.month || "";
    let query = supabase.from("certificates").select("*")
      .eq("cert_type","monthly_report").order("created_at",{ ascending:true });
    if (month) query = query.like("folder", `monthly/reports/${month}/%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ status:"error", message:error.message });

    const files = (data||[]).map(f => {
      const { data:u } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(`${f.folder}/${f.file_name}`);
      const wm = f.folder.match(/week(\d)/);
      const mm = f.folder.match(/reports\/(\d{4}-\d{2})/);
      return { id:f.id, name:f.file_name, displayName:f.display_name, folder:f.folder,
               created_at:f.created_at, note:f.note||"", publicUrl:u.publicUrl,
               week: wm?wm[1]:"1", month: mm?mm[1]:"" };
    });
    return res.status(200).json({ status:"success", files });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message }); }
});

/* GET /list_certificates */
app.get("/list_certificates", async (req, res) => {
  try {
    const certType = req.query.type;
    let query = supabase.from("certificates").select("*").order("created_at",{ ascending:false });
    if (certType && CERT_FOLDERS[certType]) query = query.eq("cert_type",certType);
    const { data, error } = await query;
    if (error) return res.status(500).json({ status:"error", message:error.message });
    const allFiles = (data||[]).map(f => {
      const { data:u } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(`${f.folder}/${f.file_name}`);
      return { id:f.id, name:f.file_name, displayName:f.display_name, certType:f.cert_type,
               folder:f.folder, created_at:f.created_at, note:f.note||"", publicUrl:u.publicUrl, size:0 };
    });
    return res.status(200).json({ status:"success", files:allFiles });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message }); }
});

/* DELETE /delete_certificate */
app.delete("/delete_certificate", async (req, res) => {
  try {
    const { fileName, folder, id } = req.body;
    if (!fileName) return res.status(400).json({ status:"error", message:"اسم الملف مطلوب" });
    const fullPath = folder ? `${folder}/${fileName}` : `certificates/${fileName}`;
    const { error: se } = await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([fullPath]);
    if (se) return res.status(500).json({ status:"error", message:"فشل الحذف: "+se.message });
    if (id) await supabase.from("certificates").delete().eq("id",id);
    else    await supabase.from("certificates").delete().eq("file_name",fileName);
    return res.status(200).json({ status:"success", message:"تم حذف الملف بنجاح" });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message }); }
});

/* POST /rename_certificate */
app.post("/rename_certificate", async (req, res) => {
  try {
    const { oldName, newName, id } = req.body;
    if (!oldName||!newName) return res.status(400).json({ status:"error", message:"الاسم القديم والجديد مطلوبان" });
    let q = supabase.from("certificates").update({ display_name:newName.trim() });
    if (id) q = q.eq("id",id); else q = q.eq("file_name",oldName);
    const { error: de } = await q;
    if (de) return res.status(500).json({ status:"error", message:"فشل: "+de.message });
    return res.status(200).json({ status:"success", message:"تم تغيير الاسم بنجاح" });
  } catch(err) { return res.status(500).json({ status:"error", message:err.message }); }
});

app.get("/", (_req,res) => res.sendFile(path.join(__dirname, "..", "frontend", "index.html")));
app.listen(PORT, () => console.log(`✅ Server → http://localhost:${PORT}`))
  .on("error", err => { if(err.code==="EADDRINUSE"){ console.error(`❌ البورت ${PORT} مشغول!`); process.exit(1); }});