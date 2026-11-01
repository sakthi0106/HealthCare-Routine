/**
 * MedicalReports.jsx
 * Upload, browse, preview, download and delete medical report files.
 * Files are stored via the backend (/api/medical-reports) which persists them
 * in a Google Sheets "Medical_Reports" tab (metadata) + base64 content in the sheet.
 * Accessible to both Father and Admin from the nav.
 */
import { useRef, useState } from "react";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { Card, ErrorBox, Field, Loading, Modal } from "../components/ui";

const CATEGORIES = [
  "Blood Sugar Tests",
  "Blood Pressure",
  "Blood Tests / Lab Reports",
  "Medical Prescriptions",
  "Doctor Consultations",
  "Water Consumption",
  "Walking / Exercise",
  "Medication Records",
  "Other Medical Reports",
];

const ACCEPT = ".pdf,.jpg,.jpeg,.png";

function fileIcon(type) {
  if (!type) return "📄";
  if (type.includes("pdf"))  return "📕";
  if (type.includes("image")) return "🖼️";
  return "📄";
}

function humanSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MedicalReports() {
  const toast    = useToast();
  const reports  = useFetch("/api/medical-reports", { interval: 0 });
  const fileRef  = useRef(null);

  // Filters
  const [search,   setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [form, setForm] = useState({ title: "", category: CATEGORIES[0], date: "", description: "" });
  const [uploading, setUploading] = useState(false);

  // Preview
  const [preview, setPreview] = useState(null);

  // ── Filter logic ───────────────────────────────────────────
  const items = (reports.data?.reports || []).filter((r) => {
    const q = search.toLowerCase();
    if (q && !r.title.toLowerCase().includes(q) && !r.category.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q)) return false;
    if (catFilter && r.category !== catFilter) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo   && r.date > dateTo)   return false;
    return true;
  });

  // ── Upload ─────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadFile(file);
  };

  const submit = async () => {
    if (!uploadFile || !form.title || !form.date) {
      toast("Please fill in title, date and choose a file.", "error"); return;
    }
    const MAX = 8 * 1024 * 1024; // 8 MB limit
    if (uploadFile.size > MAX) {
      toast("File is too large (max 8 MB).", "error"); return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const b64 = await new Promise((res, rej) => {
        reader.onload  = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(uploadFile);
      });
      await api("/api/medical-reports", {
        method: "POST",
        body: {
          title:       form.title,
          category:    form.category,
          date:        form.date,
          description: form.description,
          filename:    uploadFile.name,
          mime_type:   uploadFile.type,
          size_bytes:  uploadFile.size,
          content_b64: b64,
        },
      });
      toast("Report uploaded ✓");
      setShowUpload(false);
      setUploadFile(null);
      setForm({ title: "", category: CATEGORIES[0], date: "", description: "" });
      reports.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  // ── Download ───────────────────────────────────────────────
  const download = async (r) => {
    try {
      const data = await api(`/api/medical-reports/${r.report_id}/download`);
      const bytes = Uint8Array.from(atob(data.content_b64), (c) => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: data.mime_type || "application/octet-stream" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href = url; a.download = data.filename || r.title;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      toast("Download failed. Please try again.", "error");
    }
  };

  // ── Preview ────────────────────────────────────────────────
  const openPreview = async (r) => {
    try {
      const data = await api(`/api/medical-reports/${r.report_id}/download`);
      setPreview({ ...r, ...data });
    } catch (e) {
      toast("Cannot load preview.", "error");
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    try {
      await api(`/api/medical-reports/${r.report_id}`, { method: "DELETE" });
      toast("Report deleted");
      reports.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  return (
    <>
      {/* ── Header ─────────────────────────────────── */}
      <div className="reports-header">
        <h1>🗂️ Medical Reports</h1>
        <button className="btn" onClick={() => { setForm({ ...form, date: todayISO() }); setShowUpload(true); }}>
          + Upload Report
        </button>
      </div>

      {/* ── Filters ───────────────────────────────── */}
      <div className="report-filters">
        <input
          type="text" placeholder="🔍 Search reports…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
        <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   title="To date" />
        {(search || catFilter || dateFrom || dateTo) && (
          <button className="btn btn-outline btn-small" onClick={() => { setSearch(""); setCatFilter(""); setDateFrom(""); setDateTo(""); }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Error / Loading ───────────────────────── */}
      {reports.error   && <ErrorBox message={reports.error} onRetry={reports.reload} />}
      {!reports.data && !reports.error && <Loading text="Loading reports…" />}

      {/* ── Report list ───────────────────────────── */}
      {reports.data && (
        items.length === 0 ? (
          <Card icon="🗂️" title="No Reports">
            <p className="muted" style={{ textAlign: "center", padding: "1rem 0" }}>
              {search || catFilter ? "No reports match your filters." : "No reports uploaded yet. Click \"Upload Report\" to add one."}
            </p>
          </Card>
        ) : (
          <div className="report-list">
            {items.map((r) => (
              <div className="report-item" key={r.report_id}>
                <div className="report-item-header">
                  <div>
                    <div className="report-item-title">
                      {fileIcon(r.mime_type)} {r.title}
                    </div>
                    <div className="report-item-meta">
                      {r.date} · {humanSize(r.size_bytes)}
                    </div>
                    <span className="report-category-chip">{r.category}</span>
                    {r.description && (
                      <p className="small muted" style={{ marginTop: ".3rem" }}>{r.description}</p>
                    )}
                  </div>
                  <div className="report-item-actions">
                    <button className="btn btn-small btn-outline" onClick={() => openPreview(r)}>View</button>
                    <button className="btn btn-small btn-outline" onClick={() => download(r)}>⬇ Download</button>
                    <button className="btn btn-small btn-outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => remove(r)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Upload modal ──────────────────────────── */}
      {showUpload && (
        <Modal title="Upload Medical Report" onClose={() => { setShowUpload(false); setUploadFile(null); }}>
          {/* Drop zone */}
          <div
            className={`upload-zone ${dragging ? "active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setUploadFile(e.target.files[0])}
            />
            {uploadFile ? (
              <p>✅ <strong>{uploadFile.name}</strong> ({humanSize(uploadFile.size)})</p>
            ) : (
              <>
                <p style={{ fontSize: "2rem", margin: 0 }}>📁</p>
                <p style={{ margin: ".3rem 0 0" }}>Drop a file here or click to browse</p>
                <p className="small muted">PDF, JPG, JPEG or PNG · max 8 MB</p>
              </>
            )}
          </div>

          <Field label="Report Title *">
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Blood Sugar – October 2026" maxLength={200} />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Date *">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea
              rows={2} maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional notes about this report"
            />
          </Field>
          <button
            className="btn btn-block"
            disabled={uploading || !uploadFile || !form.title || !form.date}
            onClick={submit}
          >
            {uploading ? "Uploading…" : "Upload Report"}
          </button>
        </Modal>
      )}

      {/* ── Preview modal ─────────────────────────── */}
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <p className="small muted">{preview.category} · {preview.date}</p>
          {preview.description && <p className="small">{preview.description}</p>}
          <div style={{ marginTop: ".8rem", textAlign: "center" }}>
            {preview.mime_type?.includes("image") ? (
              <img
                src={`data:${preview.mime_type};base64,${preview.content_b64}`}
                alt={preview.title}
                style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 10 }}
              />
            ) : preview.mime_type?.includes("pdf") ? (
              <iframe
                src={`data:application/pdf;base64,${preview.content_b64}`}
                title={preview.title}
                style={{ width: "100%", height: "60vh", border: 0, borderRadius: 10 }}
              />
            ) : (
              <p className="muted">Preview not available for this file type.</p>
            )}
          </div>
          <button className="btn btn-block" style={{ marginTop: "1rem" }} onClick={() => download(preview)}>
            ⬇ Download File
          </button>
        </Modal>
      )}
    </>
  );
}
