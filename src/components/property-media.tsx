"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowSquareOut,
  DownloadSimple,
  FilePdf,
  Image as ImageIcon,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { dateLabel, propertyCover, type DocumentRecord } from "@/lib/domain";
import { useApp } from "./provider";
import { fileSize, PreviewModal, UploadModal } from "./documents";
import {
  Badge,
  Button,
  Empty,
  ErrorText,
  Field,
  Modal,
  Pagination,
  SectionHeader,
  StableRegion,
  useList,
} from "./ui";

export function PropertyMedia({ buildingId }: { buildingId: string }) {
  const { data, mutate, notify } = useApp();
  const [tab, setTab] = useState("photos");
  const [upload, setUpload] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    doc: DocumentRecord;
    archive: boolean;
  } | null>(null);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const docs = data.documents.filter(
    (d) =>
      d.target_type === "building" &&
      d.target_id === buildingId &&
      d.status === "current",
  );
  const photos = docs.filter((d) => d.category === "Photo");
  const cover = propertyCover(data, buildingId);
  const manage = ["owner", "manager", "accountant"].includes(
    data.membership.role,
  );
  const preview = data.documents.find(
    (d) => d.id === previewId && d.status !== "archived",
  );
  const list = useList(
    docs,
    (d) => (tab === "photos" ? d.category === "Photo" : d.category !== "Photo"),
    8,
  );
  async function setCover(doc: DocumentRecord) {
    setPending(doc.id);
    setError("");
    try {
      await mutate("property_cover", { building_id: buildingId, id: doc.id });
      notify("Property cover updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the cover.");
    } finally {
      setPending("");
    }
  }
  return (
    <section
      className="panel padded property-media"
      id="property-media"
      aria-label="Property photos and documents"
    >
      <SectionHeader
        title="Photos & documents"
        description="Choose a photo as the cover thumbnail. Maps and supporting files stay linked to this property."
      >
        {manage && (
          <>
            <Button onClick={() => setUpload("Other")}>
              <UploadSimple size={17} />
              Add documents
            </Button>
            <Button variant="primary" onClick={() => setUpload("Photo")}>
              <Plus size={17} />
              Add photos
            </Button>
          </>
        )}
      </SectionHeader>
      <div className="media-tabs" role="tablist" aria-label="Property files">
        {[
          { id: "photos", name: "Photos", count: photos.length },
          {
            id: "documents",
            name: "Maps & documents",
            count: docs.length - photos.length,
          },
        ].map((item, index) => (
          <button
            type="button"
            key={item.id}
            role="tab"
            id={`media-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="property-media-content"
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => {
              setTab(item.id);
              list.setPage(1);
            }}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? "photos"
                    : e.key === "End"
                      ? "documents"
                      : index === 0
                        ? "documents"
                        : "photos";
                setTab(next);
                list.setPage(1);
                document.getElementById(`media-tab-${next}`)?.focus();
              }
            }}
          >
            {item.name}
            <span>{item.count}</span>
          </button>
        ))}
      </div>
      <ErrorText message={error} />
      <StableRegion>
        <div
          id="property-media-content"
          role="tabpanel"
          aria-labelledby={`media-tab-${tab}`}
        >
          {list.total ? (
            <>
              <div className="property-media-grid">
                {list.visible.map((doc) => (
                  <article className="document-card property-file" key={doc.id}>
                    <button
                      type="button"
                      className="document-preview full-width"
                      aria-label={`Preview ${doc.name}`}
                      onClick={() => setPreviewId(doc.id)}
                    >
                      {doc.mime.startsWith("image/") ? (
                        <img
                          src={`/api/documents/${doc.id}/file?preview=1`}
                          loading="lazy"
                          alt={doc.name}
                          width={720}
                          height={480}
                        />
                      ) : (
                        <FilePdf size={40} weight="duotone" />
                      )}
                      {doc.id === cover?.id && (
                        <span className="media-cover-badge">
                          Cover thumbnail
                        </span>
                      )}
                      {doc.category !== "Photo" && (
                        <span className="document-type">{doc.category}</span>
                      )}
                    </button>
                    <div className="document-card-body">
                      <h3 title={doc.name}>{doc.name}</h3>
                      <p>
                        {fileSize(doc.size)} · {dateLabel(doc.created_at)} · v
                        {doc.version}
                      </p>
                      <div className="media-file-actions">
                        {manage && doc.category === "Photo" ? (
                          <Button
                            variant="ghost"
                            disabled={doc.id === cover?.id || !!pending}
                            onClick={() => setCover(doc)}
                            aria-label={`Set ${doc.name} as cover`}
                          >
                            <ImageIcon size={16} />
                            {pending === doc.id
                              ? "Saving…"
                              : doc.id === cover?.id
                                ? "Current cover"
                                : "Set cover"}
                          </Button>
                        ) : (
                          <Badge tone="neutral">{doc.category}</Badge>
                        )}
                        <span>
                          <Button
                            variant="ghost"
                            className="icon-button"
                            aria-label={`Open ${doc.name}`}
                            onClick={() => setPreviewId(doc.id)}
                          >
                            <ArrowSquareOut size={17} />
                          </Button>
                          <a
                            className="button ghost icon-button"
                            href={`/api/documents/${doc.id}/file?download=1`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Download ${doc.name}`}
                          >
                            <DownloadSimple size={17} />
                          </a>
                        </span>
                      </div>
                      {manage && (
                        <div className="media-manage-actions">
                          <Button
                            variant="ghost"
                            onClick={() => setEditing({ doc, archive: false })}
                            aria-label={`Edit ${doc.name}`}
                          >
                            <PencilSimple size={16} />
                            Edit name
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setEditing({ doc, archive: true })}
                            aria-label={`Archive ${doc.name}`}
                          >
                            <Trash size={16} />
                            Archive
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <Pagination {...list} pageSize={8} />
            </>
          ) : (
            <Empty
              title={
                tab === "photos"
                  ? "No property photos yet"
                  : "No maps or documents yet"
              }
              description={
                tab === "photos"
                  ? "Add building photos, then choose the cover shown on property cards."
                  : "Upload floor plans, property maps, contracts or supporting documents."
              }
            >
              {manage && (
                <Button
                  onClick={() =>
                    setUpload(tab === "photos" ? "Photo" : "Floor plan")
                  }
                >
                  <UploadSimple size={17} />
                  {tab === "photos" ? "Upload photos" : "Upload documents"}
                </Button>
              )}
            </Empty>
          )}
        </div>
      </StableRegion>
      {upload && (
        <UploadModal
          targetType="building"
          targetId={buildingId}
          defaultCategory={upload}
          onUploaded={(category) =>
            setTab(category === "Photo" ? "photos" : "documents")
          }
          onClose={() => {
            setUpload(null);
          }}
        />
      )}
      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreviewId(null)} />
      )}
      {editing && (
        <FileEditModal
          key={editing.doc.id + editing.archive}
          {...editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function FileEditModal({
  doc,
  archive,
  onClose,
}: {
  doc: DocumentRecord;
  archive: boolean;
  onClose: () => void;
}) {
  const { mutate, notify } = useApp();
  const [name, setName] = useState(doc.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await mutate(archive ? "document_archive" : "document_rename", {
        id: doc.id,
        name,
      });
      notify(archive ? "File archived." : "File name updated.");
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The change could not be saved.",
      );
      setPending(false);
    }
  }
  return (
    <Modal
      title={archive ? "Archive file" : "Edit file name"}
      description={
        archive
          ? "The file will be removed from the gallery and downloads. Its original and audit history are retained privately."
          : "This name is shown in the gallery and downloads."
      }
      onClose={pending ? () => {} : onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {archive ? (
            <p className="span-2 media-archive-name">{doc.name}</p>
          ) : (
            <Field wide label="File name">
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </Field>
          )}
        </div>
        <ErrorText message={error} />
        <div className="modal-footer">
          <Button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : archive ? "Archive file" : "Save name"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
