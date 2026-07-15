import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FilePlus2,
  FileText,
  LoaderCircle,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { bridge } from "../../services/bridge";
import type {
  PromptExportMode,
  PromptMutationOutcome,
  PromptSummary,
  PromptVersionRecord,
} from "../../types/domain";

type EditorMode = "view" | "new" | "edit";

export function PromptLibraryView() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [selected, setSelected] = useState<PromptSummary | null>(null);
  const [version, setVersion] = useState<PromptVersionRecord | null>(null);
  const [mode, setMode] = useState<EditorMode>("view");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [exportMode, setExportMode] = useState<PromptExportMode>("original");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPrompts = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const next = await bridge.listPrompts(query);
      setPrompts(next);
      setSelected((current) => current
        ? next.find((prompt) => prompt.profileId === current.profileId) ?? current
        : current);
    } catch (caught) {
      setError(errorMessage(caught, "The prompt library could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPrompts(search), 180);
    return () => window.clearTimeout(timer);
  }, [loadPrompts, search]);

  async function openPrompt(prompt: PromptSummary) {
    if (!canLeaveEditor(mode, document, version?.rawDocument ?? "")) return;
    setError(null);
    setBusy("open");
    try {
      const nextVersion = await bridge.getPromptVersion(prompt.latestVersionId);
      setSelected(prompt);
      setVersion(nextVersion);
      setName(prompt.stableName);
      setDocument(nextVersion.rawDocument);
      setMode("view");
    } catch (caught) {
      setError(errorMessage(caught, `${prompt.stableName} could not be opened.`));
    } finally {
      setBusy(null);
    }
  }

  function beginCreate() {
    if (!canLeaveEditor(mode, document, version?.rawDocument ?? "")) return;
    setSelected(null);
    setVersion(null);
    setName("");
    setDocument("");
    setMode("new");
    setError(null);
    setNotice(null);
  }

  async function importPrompt() {
    const path = await bridge.choosePromptFile();
    if (!path) return;
    setBusy("import");
    setError(null);
    try {
      const outcome = await bridge.importPrompt(path);
      await acceptMutation(outcome, outcome.alreadyExists ? "Prompt already up to date" : "Prompt imported");
    } catch (caught) {
      setError(errorMessage(caught, "The selected prompt could not be imported."));
    } finally {
      setBusy(null);
    }
  }

  async function savePrompt() {
    if (!document.trim() || (mode === "new" && !name.trim()) || busy) return;
    setBusy("save");
    setError(null);
    try {
      const outcome = mode === "new"
        ? await bridge.createPrompt(name, document)
        : selected && version
          ? await bridge.savePrompt(selected.profileId, version.id, document)
          : null;
      if (!outcome) return;
      await acceptMutation(
        outcome,
        outcome.alreadyExists ? "No content changes to save" : mode === "new" ? "Prompt created" : `Version ${outcome.version.version} saved`,
      );
    } catch (caught) {
      setError(errorMessage(caught, "The prompt version could not be saved."));
    } finally {
      setBusy(null);
    }
  }

  async function acceptMutation(outcome: PromptMutationOutcome, message: string) {
    setSearch("");
    const next = await bridge.listPrompts();
    setPrompts(next);
    setSelected(outcome.prompt);
    setVersion(outcome.version);
    setName(outcome.prompt.stableName);
    setDocument(outcome.version.rawDocument);
    setMode("view");
    setNotice(message);
  }

  async function togglePinned() {
    if (!selected || busy) return;
    setBusy("pin");
    setError(null);
    try {
      const updated = await bridge.setPromptPinned(selected.profileId, !selected.pinned);
      setSelected(updated);
      await loadPrompts(search);
    } catch (caught) {
      setError(errorMessage(caught, "The prompt pin could not be updated."));
    } finally {
      setBusy(null);
    }
  }

  async function duplicatePrompt() {
    if (!version || busy) return;
    setBusy("duplicate");
    setError(null);
    try {
      await acceptMutation(await bridge.duplicatePrompt(version.id), "Prompt duplicated");
    } catch (caught) {
      setError(errorMessage(caught, "The prompt could not be duplicated."));
    } finally {
      setBusy(null);
    }
  }

  async function exportPrompt() {
    if (!version || busy) return;
    setBusy("export");
    setError(null);
    try {
      const exported = await bridge.exportPrompt(version.id, exportMode);
      downloadText(exported.fileName, exported.content);
      setNotice(`${exported.fileName} export started`);
    } catch (caught) {
      setError(errorMessage(caught, "The prompt could not be exported."));
    } finally {
      setBusy(null);
    }
  }

  async function deletePrompt() {
    if (!selected || busy || !(await bridge.confirmDeletePrompt(selected.stableName))) return;
    setBusy("delete");
    setError(null);
    try {
      await bridge.deletePrompt(selected.profileId);
      setSelected(null);
      setVersion(null);
      setDocument("");
      setMode("view");
      await loadPrompts(search);
      setNotice("Prompt removed from the library");
    } catch (caught) {
      setError(errorMessage(caught, "The prompt could not be deleted."));
    } finally {
      setBusy(null);
    }
  }

  return <div className="prompt-library-workspace">
    <div className="section-toolbar">
      <div><h2>System prompts</h2><p>{prompts.length.toLocaleString()} {prompts.length === 1 ? "profile" : "profiles"} in the local library</p></div>
      <div className="toolbar-actions">
        <button className="secondary-button" disabled={busy !== null} onClick={() => void importPrompt()} type="button">
          {busy === "import" ? <LoaderCircle className="spin" size={16} /> : <FilePlus2 size={16} />} Import
        </button>
        <button className="primary-button" disabled={busy !== null} onClick={beginCreate} type="button"><Plus size={16} /> New prompt</button>
      </div>
    </div>

    <div className="prompt-alerts">
      {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError(null)} type="button"><X size={15} /></button></div>}
      {notice && <div className="notice-banner"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice(null)} type="button"><X size={15} /></button></div>}
    </div>

    <div className="prompt-library-body">
      <aside className="prompt-library-rail">
        <div className="prompt-search"><Search size={15} /><input aria-label="Search prompts" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, tags, collection" value={search} /></div>
        <div className="prompt-list-heading"><span>Prompts</span><small>{loading ? "Loading" : prompts.length.toLocaleString()}</small></div>
        <div className="prompt-list">
          {loading && prompts.length === 0
            ? <div className="loading-state"><LoaderCircle className="spin" size={16} /> Loading prompts</div>
            : prompts.length === 0
              ? <div className="prompt-list-empty"><FileText size={23} /><strong>No prompts found</strong><button onClick={beginCreate} type="button">Create prompt</button></div>
              : prompts.map((prompt) => <button
                  className={`prompt-list-item ${selected?.profileId === prompt.profileId ? "active" : ""}`}
                  key={prompt.profileId}
                  onClick={() => void openPrompt(prompt)}
                  type="button"
                >
                  <span className="prompt-list-icon"><FileText size={16} /></span>
                  <span className="prompt-list-copy"><strong>{prompt.stableName}</strong><small>{prompt.collection ?? "Uncollected"} / v{prompt.latestVersion}</small></span>
                  {prompt.pinned && <Pin aria-label="Pinned" size={13} />}
                </button>)}
        </div>
      </aside>

      <section className="prompt-detail">
        {mode === "new" || mode === "edit"
          ? <PromptEditor
              busy={busy === "save"}
              document={document}
              mode={mode}
              name={name}
              onCancel={() => {
                setMode("view");
                setDocument(version?.rawDocument ?? "");
              }}
              onDocumentChange={setDocument}
              onNameChange={setName}
              onSave={() => void savePrompt()}
            />
          : selected && version
            ? <PromptDetail
                busy={busy}
                exportMode={exportMode}
                prompt={selected}
                version={version}
                onDelete={() => void deletePrompt()}
                onDuplicate={() => void duplicatePrompt()}
                onEdit={() => setMode("edit")}
                onExport={() => void exportPrompt()}
                onExportModeChange={setExportMode}
                onPin={() => void togglePinned()}
              />
            : <div className="prompt-detail-empty"><FileText size={28} /><h2>Select a prompt</h2></div>}
      </section>
    </div>
  </div>;
}

function PromptEditor({
  busy,
  document,
  mode,
  name,
  onCancel,
  onDocumentChange,
  onNameChange,
  onSave,
}: {
  busy: boolean;
  document: string;
  mode: "new" | "edit";
  name: string;
  onCancel: () => void;
  onDocumentChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
}) {
  const documentBytes = new Blob([document]).size;
  return <div className="prompt-editor">
    <header className="prompt-detail-header">
      <div><span>{mode === "new" ? "New profile" : "New immutable version"}</span><h2>{mode === "new" ? "Create prompt" : name}</h2></div>
      <div className="prompt-detail-actions"><button className="secondary-button" disabled={busy} onClick={onCancel} type="button">Cancel</button><button className="primary-button" disabled={busy || !document.trim() || documentBytes > 1024 * 1024 || (mode === "new" && !name.trim())} onClick={onSave} type="button">{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save</button></div>
    </header>
    <div className="prompt-editor-fields">
      {mode === "new" && <label>Name<input maxLength={120} onChange={(event) => onNameChange(event.target.value)} placeholder="Prompt name" value={name} /></label>}
      <label className="prompt-document-field">Document<textarea autoFocus maxLength={1024 * 1024} onChange={(event) => onDocumentChange(event.target.value)} placeholder="Write system instructions or paste Markdown with YAML front matter" spellCheck value={document} /></label>
      <small>{documentBytes.toLocaleString()} / 1,048,576 bytes</small>
    </div>
  </div>;
}

function PromptDetail({
  busy,
  exportMode,
  prompt,
  version,
  onDelete,
  onDuplicate,
  onEdit,
  onExport,
  onExportModeChange,
  onPin,
}: {
  busy: string | null;
  exportMode: PromptExportMode;
  prompt: PromptSummary;
  version: PromptVersionRecord;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onExport: () => void;
  onExportModeChange: (mode: PromptExportMode) => void;
  onPin: () => void;
}) {
  return <div className="prompt-detail-content">
    <header className="prompt-detail-header">
      <div><span>{prompt.collection ?? "System prompt"}</span><h2>{prompt.stableName}</h2></div>
      <div className="prompt-detail-actions">
        <button className="icon-button" disabled={busy !== null} onClick={onPin} title={prompt.pinned ? "Unpin prompt" : "Pin prompt"} type="button">{prompt.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
        <button className="icon-button" disabled={busy !== null} onClick={onDuplicate} title="Duplicate prompt" type="button"><Copy size={16} /></button>
        <button className="icon-button" disabled={busy !== null} onClick={onEdit} title="Create a new version" type="button"><Pencil size={16} /></button>
        <button className="icon-button danger-action" disabled={busy !== null} onClick={onDelete} title="Delete prompt" type="button"><Trash2 size={16} /></button>
      </div>
    </header>
    <dl className="prompt-metadata-grid">
      <div><dt>Version</dt><dd>v{version.version}</dd></div>
      <div><dt>Updated</dt><dd>{formatDate(prompt.updatedAt)}</dd></div>
      <div><dt>Source</dt><dd title={version.sourcePath ?? "Created locally"}>{version.sourcePath ? "Imported file" : "Local editor"}</dd></div>
      <div><dt>Hash</dt><dd title={version.sourceHash}>{version.sourceHash.slice(0, 12)}</dd></div>
    </dl>
    {version.metadata.description && <p className="prompt-description">{version.metadata.description}</p>}
    {version.metadata.tags.length > 0 && <div className="prompt-tags">{version.metadata.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
    <div className="prompt-source-heading"><span>Exact source</span><div><select aria-label="Export format" disabled={busy !== null} onChange={(event) => onExportModeChange(event.target.value as PromptExportMode)} value={exportMode}><option value="original">Original</option><option value="normalized">Normalized</option></select><button className="icon-button" disabled={busy !== null} onClick={onExport} title="Export prompt" type="button">{busy === "export" ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}</button></div></div>
    <pre className="prompt-source">{version.rawDocument}</pre>
  </div>;
}

function canLeaveEditor(mode: EditorMode, document: string, original: string): boolean {
  if (mode === "view" || document === original || !document) return true;
  return window.confirm("Discard the unsaved prompt changes?");
}

function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function errorMessage(caught: unknown, fallback: string): string {
  if (typeof caught === "string") return caught;
  if (caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string") return caught.message;
  return fallback;
}
