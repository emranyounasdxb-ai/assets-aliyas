"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  UploadSimple,
  ClockCounterClockwise,
  DownloadSimple,
  FilePdf,
  Image as ImageIcon,
  LockKey,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  dateLabel,
  documentCategories,
  unitLabel,
  type DocumentRecord,
} from "@/lib/domain";
import { useApp } from "./provider";
import {
  Badge,
  Button,
  Empty,
  ErrorText,
  Field,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeader,
  useList,
} from "./ui";
type Target = DocumentRecord["target_type"];
function fileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
export function UploadModal({
  targetType,
  targetId,
  replace,
  onClose,
}: {
  targetType?: Target;
  targetId?: string;
  replace?: DocumentRecord;
  onClose: () => void;
}) {
  const { data, notify } = useApp();
  const router = useRouter();
  const [type, setType] = useState<Target>(
    replace?.target_type ?? targetType ?? "tenant",
  );
  const choices = (t: Target) =>
    t === "building"
      ? data.buildings.map((b) => ({ id: b.id, name: b.name }))
      : t === "floor"
        ? data.floors.map((f) => ({
            id: f.id,
            name: `${data.buildings.find((b) => b.id === f.building_id)?.name} · ${f.name}`,
          }))
        : t === "unit"
          ? data.units.map((u) => ({
              id: u.id,
              name: `${data.buildings.find((b) => b.id === u.building_id)?.code} · ${unitLabel(u)} ${u.code}`,
            }))
          : t === "lease"
            ? data.leases.map((l) => ({ id: l.id, name: l.reference }))
            : data.tenants.map((t) => ({ id: t.id, name: t.name }));
  const [target, setTarget] = useState(
    replace?.target_id ?? targetId ?? choices(type)[0]?.id ?? "",
  );
  const [category, setCategory] = useState(
    replace?.category ??
      (["building", "floor", "unit"].includes(type) ? "Photo" : "Other"),
  );
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("This file is over 20 MB. Choose a smaller file.");
      return;
    }
    setError("");
    setPending(true);
    setProgress(0);
    const form = new FormData();
    form.set("file", file);
    form.set("target_type", type);
    form.set("target_id", target);
    form.set("category", category);
    form.set("request_key", requestKey);
    if (replace) form.set("replaces", replace.id);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/documents");
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setPending(false);
      let result: { error?: string } = {};
      try {
        result = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        notify(
          replace
            ? "New document version saved. The original is preserved."
            : "Document scanned and saved privately.",
        );
        router.refresh();
        onClose();
      } else setError(result.error ?? "Upload failed. Please try again.");
    };
    xhr.onerror = () => {
      setPending(false);
      setError("The connection was interrupted. Try the upload again.");
    };
    xhr.ontimeout = () => {
      setPending(false);
      setError("The upload took too long. Please try again.");
    };
    xhr.send(form);
  }
  return (
    <Modal
      title={replace ? "Upload a new version" : "Upload a document"}
      description={
        replace
          ? "The previous version will remain available in document history."
          : "Scanned, stored privately and linked to the right record."
      }
      onClose={pending ? () => {} : onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {!targetId && !replace && (
            <>
              <Field label="Link to">
                <select
                  value={type}
                  onChange={(e) => {
                    const t = e.target.value as Target;
                    setType(t);
                    setTarget(choices(t)[0]?.id ?? "");
                    setRequestKey(crypto.randomUUID());
                    setCategory(
                      ["building", "floor", "unit"].includes(t)
                        ? "Photo"
                        : "Other",
                    );
                  }}
                >
                  {["tenant", "building", "floor", "unit", "lease"].map((t) => (
                    <option key={t} value={t}>
                      {
                        {
                          tenant: "Tenant",
                          building: "Property",
                          floor: "Floor",
                          unit: "Flat or shop",
                          lease: "Agreement",
                        }[t]
                      }
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Record">
                <select
                  required
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setRequestKey(crypto.randomUUID());
                  }}
                >
                  <option value="">Choose a record</option>
                  {choices(type).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field wide label="Document category">
            <select
              disabled={!!replace}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setRequestKey(crypto.randomUUID());
              }}
            >
              {documentCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="span-2">
            <label className="upload-drop">
              <UploadSimple size={30} />
              <strong>{file ? file.name : "Choose your file"}</strong>
              <span>PDF, JPG, PNG or WebP · Up to 20 MB</span>
              <input
                type="file"
                aria-label="Choose document file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setRequestKey(crypto.randomUUID());
                }}
              />
            </label>
          </div>
          <p className="form-note span-2">
            <ShieldCheck
              size={16}
              style={{ verticalAlign: "middle", marginRight: 8 }}
            />
            Files are checked before they become available. Only permitted team
            members can access them.
          </p>
        </div>
        {pending && (
          <div className="upload-progress" role="status">
            {progress < 100
              ? `Uploading… ${progress}%`
              : "Scanning and saving your file…"}
            <progress max={100} value={progress} aria-label="Upload progress" />
          </div>
        )}
        <ErrorText message={error} />
        <div className="modal-footer">
          <Button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending || !target}>
            {pending ? (
              "Please wait…"
            ) : (
              <>
                <UploadSimple size={17} />
                Upload document
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function PreviewModal({
  doc,
  onClose,
}: {
  doc: DocumentRecord;
  onClose: () => void;
}) {
  return (
    <Modal
      title={doc.name}
      description={`${doc.category} · Version ${doc.version} · ${fileSize(doc.size)}`}
      wide
      onClose={onClose}
    >
      <div className="file-preview-dialog">
        {doc.mime.startsWith("image/") ? (
          <img src={`/api/documents/${doc.id}/file`} alt={doc.name} />
        ) : (
          <iframe
            title={doc.name}
            src={`/api/documents/${doc.id}/file`}
            sandbox="allow-same-origin allow-scripts"
          />
        )}
        <div className="document-actions">
          <a
            href={`/api/documents/${doc.id}/file?download=1`}
            className="button secondary"
            target="_blank"
            rel="noreferrer"
          >
            <DownloadSimple size={16} />
            Download original
          </a>
          <a
            href={`/api/documents/${doc.id}/file`}
            className="button secondary"
            target="_blank"
            rel="noreferrer"
          >
            <ArrowSquareOut size={16} />
            Open file
          </a>
        </div>
      </div>
    </Modal>
  );
}
export function DocumentPanel({
  targetType,
  targetId,
  title = "Documents",
  compact = false,
}: {
  targetType: Target;
  targetId: string;
  title?: string;
  compact?: boolean;
}) {
  const { data } = useApp();
  const [upload, setUpload] = useState(false);
  const [preview, setPreview] = useState<DocumentRecord | null>(null);
  const [replace, setReplace] = useState<DocumentRecord | null>(null);
  const [history, setHistory] = useState(false);
  const docs = data.documents.filter(
    (d) =>
      d.target_type === targetType &&
      d.target_id === targetId &&
      (history || d.status === "current"),
  );
  const canUpload = ["owner", "manager", "accountant"].includes(
    data.membership.role,
  );
  const content = (
    <>
      <SectionHeader title={title}>
        {canUpload && (
          <Button onClick={() => setUpload(true)}>
            <Plus size={16} />
            Upload
          </Button>
        )}
      </SectionHeader>
      {docs.length ? (
        <>
          <div>
            {docs.map((doc) => (
              <div className="document-row" key={doc.id}>
                {doc.mime.startsWith("image/") ? (
                  <ImageIcon size={25} />
                ) : (
                  <FilePdf size={25} />
                )}
                <div>
                  <strong>{doc.name}</strong>
                  <small>
                    {doc.category} · {fileSize(doc.size)} · Version{" "}
                    {doc.version}
                    {doc.status === "superseded" ? " · Previous version" : ""}
                  </small>
                </div>
                <Button
                  variant="ghost"
                  className="icon-button"
                  aria-label={`Preview ${doc.name}`}
                  onClick={() => setPreview(doc)}
                >
                  <ArrowSquareOut size={17} />
                </Button>
                {canUpload && doc.status === "current" && (
                  <Button
                    variant="ghost"
                    className="icon-button"
                    aria-label={`Replace ${doc.name}`}
                    onClick={() => setReplace(doc)}
                  >
                    <ClockCounterClockwise size={17} />
                  </Button>
                )}
                <a
                  className="button ghost icon-button"
                  href={`/api/documents/${doc.id}/file?download=1`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Download ${doc.name}`}
                >
                  <DownloadSimple size={17} />
                </a>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            style={{ marginTop: 12, fontSize: 12 }}
            onClick={() => setHistory(!history)}
          >
            <ClockCounterClockwise size={14} />
            {history ? "Show current files" : "Include version history"}
          </Button>
        </>
      ) : (
        <Empty
          title="No documents"
          description={
            targetType === "tenant"
              ? "Add a passport, Emirates ID, bank statement or supporting document."
              : "Add photos, floor plans or supporting documents for this record."
          }
        />
      )}
    </>
  );
  return (
    <>
      <section className={compact ? "" : "panel padded"}>{content}</section>
      {upload && (
        <UploadModal
          targetType={targetType}
          targetId={targetId}
          onClose={() => setUpload(false)}
        />
      )}{" "}
      {replace && (
        <UploadModal replace={replace} onClose={() => setReplace(null)} />
      )}{" "}
      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
export function Documents() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [upload, setUpload] = useState(false);
  const [preview, setPreview] = useState<DocumentRecord | null>(null);
  const [replace, setReplace] = useState<DocumentRecord | null>(null);
  function owner(doc: DocumentRecord) {
    return doc.target_type === "tenant"
      ? data.tenants.find((t) => t.id === doc.target_id)?.name
      : doc.target_type === "building"
        ? data.buildings.find((b) => b.id === doc.target_id)?.name
        : doc.target_type === "lease"
          ? data.leases.find((l) => l.id === doc.target_id)?.reference
          : doc.target_type === "unit"
            ? `${unitLabel(data.units.find((u) => u.id === doc.target_id))} ${data.units.find((u) => u.id === doc.target_id)?.code}`
            : data.floors.find((f) => f.id === doc.target_id)?.name;
  }
  const list = useList(
    data.documents,
    (d) =>
      d.status === "current" &&
      `${d.name} ${owner(d)}`.toLowerCase().includes(query.toLowerCase()) &&
      (category === "all" || d.category === category),
    12,
  );
  return (
    <>
      <PageHeader title="Documents">
        {["owner", "manager", "accountant"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => setUpload(true)}>
            <UploadSimple size={18} />
            Upload document
          </Button>
        )}
      </PageHeader>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            list.setPage(1);
          }}
          placeholder="Search documents or owners…"
        />
        <select
          className="filter-select"
          aria-label="Filter document category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="all">All categories</option>
          {documentCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="toolbar-spacer" />
        <span className="filter-label">
          <LockKey
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
          {list.total} private files
        </span>
      </div>
      {list.total ? (
        <>
          <div className="document-grid">
            {list.visible.map((doc) => (
              <article className="document-card" key={doc.id}>
                <button
                  type="button"
                  className="document-preview full-width"
                  style={{ border: 0 }}
                  aria-label={`Preview ${doc.name}`}
                  onClick={() => setPreview(doc)}
                >
                  {doc.mime.startsWith("image/") ? (
                    <img
                      src={`/api/documents/${doc.id}/file?preview=1`}
                      alt={doc.name}
                      loading="lazy"
                    />
                  ) : (
                    <FilePdf size={42} weight="duotone" />
                  )}
                  <span className="document-type">
                    {doc.mime.startsWith("image/") ? "IMAGE" : "PDF"}
                  </span>
                </button>
                <div className="document-card-body">
                  <h3 title={doc.name}>{doc.name}</h3>
                  <p>
                    {owner(doc)} · {fileSize(doc.size)}
                  </p>
                  <p>
                    {dateLabel(doc.created_at)} · v{doc.version}
                  </p>
                  <div className="document-actions">
                    <Badge tone="mint">{doc.category}</Badge>
                    <div>
                      {["owner", "manager", "accountant"].includes(
                        data.membership.role,
                      ) && (
                        <Button
                          variant="ghost"
                          className="icon-button"
                          aria-label={`New version of ${doc.name}`}
                          onClick={() => setReplace(doc)}
                        >
                          <ClockCounterClockwise size={16} />
                        </Button>
                      )}
                      <a
                        className="button ghost icon-button"
                        aria-label={`Download ${doc.name}`}
                        href={`/api/documents/${doc.id}/file?download=1`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <DownloadSimple size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination {...list} pageSize={12} />
        </>
      ) : (
        <div className="panel">
          <Empty
            title={
              data.documents.length
                ? "No matching files"
                : "Your documents belong here"
            }
            description={
              data.documents.length
                ? "Try another name or category."
                : "Upload a property photo, a floor plan, a tenant document or a signed agreement. Originals stay private."
            }
          >
            {["owner", "manager", "accountant"].includes(
              data.membership.role,
            ) && (
              <Button onClick={() => setUpload(true)}>
                <UploadSimple size={16} />
                Upload your first document
              </Button>
            )}
          </Empty>
        </div>
      )}
      {upload && <UploadModal onClose={() => setUpload(false)} />}{" "}
      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      )}{" "}
      {replace && (
        <UploadModal replace={replace} onClose={() => setReplace(null)} />
      )}
    </>
  );
}
