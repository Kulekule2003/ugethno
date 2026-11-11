"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { questionsFor } from "@/lib/questions";

type Editor = { name: string; at: string } | null;
type ImageRow = { id: string; version: number; category: string; shortName: string; question: string; answer: string; imageUrl: string; editedBy: Editor };
type StoryRow = { id: string; version: number; speciesId: string; shortName: string; question: string; answer: string; editedBy: Editor };
type Status = { text: string; error?: boolean };
type Props = { tab: "images" | "knowledge"; userName: string; species: { id: string; shortName: string }[]; offset: number; images?: ImageRow[]; stories?: StoryRow[] };

// One editable text cell. Enter or clicking away saves; Shift+Enter adds a line; Esc cancels.
function Cell({ value, disabled, label, onSave }: { value: string; disabled: boolean; label: string; onSave: (next: string) => void }) {
  const [draft, setDraft] = useState(value), [seen, setSeen] = useState(value);
  if (value !== seen) { setSeen(value); setDraft(value); }
  return <textarea className="cell" aria-label={label} rows={1} value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)}
    onBlur={() => { const next = draft.trim(); if (!next) setDraft(value); else if (next !== value) onSave(next); else setDraft(value); }}
    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } else if (e.key === "Escape") { setDraft(value); const el = e.currentTarget; setTimeout(() => el.blur()); } }} />;
}

function EditedBy({ editor, status }: { editor: Editor; status?: Status }) {
  if (status) return <span className={status.error ? "sheet-error" : "sheet-ok"}>{status.text}{status.error && <> · <button className="small-link" style={{ border: 0, background: "none", padding: 0 }} onClick={() => location.reload()}>Reload</button></>}</span>;
  return editor ? <span>{editor.name}<small className="muted" style={{ display: "block" }}>{new Date(editor.at).toLocaleDateString()}</small></span> : <span className="muted">—</span>;
}

export function DatasetSheet({ tab, userName, species, offset, images = [], stories = [] }: Props) {
  const router = useRouter();
  const [name, setName] = useState(userName), [nameDraft, setNameDraft] = useState(userName), [nameMessage, setNameMessage] = useState("");
  const [imageRows, setImageRows] = useState(images), [storyRows, setStoryRows] = useState(stories), [status, setStatus] = useState<Record<string, Status>>({});
  const [adding, setAdding] = useState(false), [draft, setDraft] = useState({ speciesId: "", question: "", answer: "" }), [addMessage, setAddMessage] = useState("");
  const locked = !name;
  const mark = (id: string, s: Status) => setStatus(prev => ({ ...prev, [id]: s }));
  const me = () => ({ name, at: new Date().toISOString() });

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameDraft }) }), data = await res.json();
    if (!res.ok) { setNameMessage(data.error || "Could not save your name"); return; }
    setName(data.name); setNameDraft(data.name); setNameMessage("Saved"); router.refresh();
  }
  async function send(url: string, id: string, body: object) {
    mark(id, { text: "Saving…" });
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), data = await res.json();
      if (res.status === 409) { mark(id, { text: "Someone else changed this row", error: true }); return null; }
      if (!res.ok) { mark(id, { text: data.error || "Not saved", error: true }); return null; }
      mark(id, { text: "Saved" }); return data;
    } catch { mark(id, { text: "Not saved — check your connection", error: true }); return null; }
  }
  async function saveImage(row: ImageRow, change: { question?: string; answer?: string }) {
    const data = await send(`/api/images/${row.id}`, row.id, { ...change, version: row.version });
    if (data) setImageRows(rows => rows.map(r => r.id === row.id ? { ...r, ...change, version: data.record.version, editedBy: me() } : r));
  }
  async function saveStory(row: StoryRow, change: { question?: string; answer?: string }) {
    const data = await send(`/api/stories/${row.id}`, row.id, { ...change, version: row.version });
    if (data) setStoryRows(rows => rows.map(r => r.id === row.id ? { ...r, ...change, version: data.story.version, editedBy: me() } : r));
  }
  async function addStory(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/species/${draft.speciesId}/stories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: draft.question, answer: draft.answer }) }), data = await res.json();
    if (!res.ok) { setAddMessage(data.error || "Could not add the row"); return; }
    const s = data.story; setStoryRows(rows => [{ id: s.id, version: s.version, speciesId: s.speciesId, shortName: species.find(x => x.id === s.speciesId)?.shortName || "", question: s.question, answer: s.answer, editedBy: me() }, ...rows]);
    setDraft({ speciesId: draft.speciesId, question: "", answer: "" }); setAddMessage(""); mark(s.id, { text: "Added" });
  }
  async function removeStory(row: StoryRow) {
    if (!confirm("Delete this row? An admin can restore it.")) return;
    const res = await fetch(`/api/stories/${row.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: row.version }) });
    if (res.ok) setStoryRows(rows => rows.filter(r => r.id !== row.id)); else mark(row.id, { text: "Could not delete", error: true });
  }

  return <>
    <form className="namebar" onSubmit={saveName}><label htmlFor="editor-name">Your name</label><input id="editor-name" value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="e.g. Sarah N." maxLength={80} required /><button className="btn" disabled={!nameDraft.trim() || nameDraft.trim() === name}>{name ? "Update" : "Save name"}</button><span className={locked ? "sheet-error" : "muted"} style={{ fontSize: 11 }}>{nameMessage || (locked ? "Enter your name to start editing." : "Your edits are recorded under this name.")}</span>{tab === "knowledge" && <button type="button" className="btn primary" style={{ marginLeft: "auto" }} disabled={locked} onClick={() => setAdding(!adding)}><Plus size={14} /> Add row</button>}{tab === "images" && <Link className="btn primary" style={{ marginLeft: "auto" }} href="/upload"><Plus size={14} /> Add images</Link>}</form>
    {adding && tab === "knowledge" && <form className="addrow" onSubmit={addStory}><select aria-label="Fish name" value={draft.speciesId} onChange={e => setDraft({ ...draft, speciesId: e.target.value })} required><option value="">Fish name…</option>{species.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}</select><input aria-label="Question" placeholder="Question" value={draft.question} onChange={e => setDraft({ ...draft, question: e.target.value })} required maxLength={500} /><input aria-label="Answer" placeholder="Answer" value={draft.answer} onChange={e => setDraft({ ...draft, answer: e.target.value })} required maxLength={5000} /><button className="btn primary">Add</button><button type="button" className="btn" onClick={() => setAdding(false)}>Close</button>{addMessage && <span className="sheet-error">{addMessage}</span>}</form>}
    <div className="table-scroll"><table className="sheet">
      {tab === "images" ? <>
        <thead><tr><th className="num">#</th><th style={{ width: 92 }}>Image</th><th style={{ width: "16%" }}>Fish name</th><th style={{ width: "24%" }}>Question</th><th>Answer</th><th style={{ width: 150 }}>Edited by</th></tr></thead>
        <tbody>{imageRows.map((r, i) => { const options = questionsFor(r.category); return <tr key={r.id}><td className="num">{offset + i + 1}</td><td className="pad"><Link href={`/images/${r.id}`}><img className="thumb" style={{ width: 72, height: 52 }} src={r.imageUrl} alt={r.shortName} loading="lazy" /></Link></td><td className="pad"><Link className="species" href={`/images/${r.id}`}>{r.shortName}</Link></td><td><select className="cell" aria-label="Question" value={r.question} disabled={locked} onChange={e => saveImage(r, { question: e.target.value })}>{(options.includes(r.question) ? options : [r.question, ...options]).map(x => <option key={x}>{x}</option>)}</select></td><td><Cell label="Answer" value={r.answer} disabled={locked} onSave={answer => saveImage(r, { answer })} /></td><td className="pad"><EditedBy editor={r.editedBy} status={status[r.id]} /></td></tr>; })}</tbody>
      </> : <>
        <thead><tr><th className="num">#</th><th style={{ width: "17%" }}>Fish name</th><th style={{ width: "28%" }}>Question</th><th>Answer</th><th style={{ width: 150 }}>Edited by</th><th style={{ width: 40 }} /></tr></thead>
        <tbody>{storyRows.map((r, i) => <tr key={r.id}><td className="num">{offset + i + 1}</td><td className="pad"><Link className="species" href={`/species/${r.speciesId}`}>{r.shortName}</Link></td><td><Cell label="Question" value={r.question} disabled={locked} onSave={question => saveStory(r, { question })} /></td><td><Cell label="Answer" value={r.answer} disabled={locked} onSave={answer => saveStory(r, { answer })} /></td><td className="pad"><EditedBy editor={r.editedBy} status={status[r.id]} /></td><td className="pad"><button className="iconbtn" title="Delete row" aria-label="Delete row" disabled={locked} onClick={() => removeStory(r)}><Trash2 size={14} /></button></td></tr>)}</tbody>
      </>}
    </table>{(tab === "images" ? imageRows : storyRows).length === 0 && <div className="empty">No rows match.</div>}</div>
  </>;
}
