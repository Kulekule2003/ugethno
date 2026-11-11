import Link from "next/link";
import { Shell } from "@/components/shell";
import { DatasetSheet } from "@/components/dataset-sheet";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { signedImage } from "@/lib/storage";
import { imageAnswer } from "@/lib/answers";
import type { EntityType } from "@prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

// The most recent person to create or edit each row, from the audit log.
async function lastEditors(entity: EntityType, ids: string[]) {
  const entries = await db.auditEntry.findMany({ where: { entity, entityId: { in: ids }, action: { in: ["CREATE", "EDIT", "UNDO"] } }, orderBy: { createdAt: "desc" }, select: { entityId: true, createdAt: true, actor: { select: { name: true, email: true } } } });
  const latest = new Map<string, { name: string; at: string }>();
  for (const e of entries) if (!latest.has(e.entityId)) latest.set(e.entityId, { name: e.actor.name || e.actor.email.split("@")[0], at: e.createdAt.toISOString() });
  return latest;
}

export default async function EditPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  const p = await searchParams, user = await getSessionUser();
  const tab = p.tab === "knowledge" ? "knowledge" : "images", q = (p.q || "").trim(), page = Math.max(1, Number(p.page) || 1);
  const contains = { contains: q, mode: "insensitive" as const };
  const species = await db.species.findMany({ where: { deletedAt: null }, orderBy: { shortName: "asc" }, select: { id: true, shortName: true } });

  let total = 0, sheet: React.ReactNode;
  if (tab === "images") {
    const where = { deletedAt: null, ...(q ? { OR: [{ shortName: contains }, { canonicalName: contains }, { question: contains }, { answer: contains }] } : {}) };
    const [rows, count] = await Promise.all([db.imageRecord.findMany({ where, orderBy: [{ canonicalName: "asc" }, { createdAt: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }), db.imageRecord.count({ where })]);
    const editors = await lastEditors("IMAGE", rows.map(r => r.id));
    total = count;
    sheet = <DatasetSheet key={`images-${page}-${q}`} tab="images" userName={user?.name || ""} species={species} offset={(page - 1) * PAGE_SIZE} images={await Promise.all(rows.map(async r => ({ id: r.id, version: r.version, category: r.category, shortName: r.shortName, question: r.question, answer: imageAnswer(r), imageUrl: await signedImage(r.objectKey), editedBy: editors.get(r.id) || null })))} />;
  } else {
    const where = { deletedAt: null, species: { deletedAt: null }, ...(q ? { OR: [{ question: contains }, { answer: contains }, { species: { shortName: contains } }, { species: { canonicalName: contains } }] } : {}) };
    const [rows, count] = await Promise.all([db.story.findMany({ where, include: { species: { select: { shortName: true } } }, orderBy: [{ species: { shortName: "asc" } }, { createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }), db.story.count({ where })]);
    const editors = await lastEditors("STORY", rows.map(r => r.id));
    total = count;
    sheet = <DatasetSheet key={`knowledge-${page}-${q}`} tab="knowledge" userName={user?.name || ""} species={species} offset={(page - 1) * PAGE_SIZE} stories={rows.map(r => ({ id: r.id, version: r.version, speciesId: r.speciesId, shortName: r.species.shortName, question: r.question, answer: r.answer, editedBy: editors.get(r.id) || null }))} />;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (next: { tab?: string; page?: number }) => { const s = new URLSearchParams(); const t = next.tab || tab; if (t !== "images") s.set("tab", t); if (q && !next.tab) s.set("q", q); if (next.page && next.page > 1) s.set("page", String(next.page)); const qs = s.toString(); return qs ? `/edit?${qs}` : "/edit"; };
  return <Shell active="Editor"><main className="wrap">
    <div className="heading"><div><div className="eyebrow">DATASET EDITOR</div><h1>Edit the dataset</h1><div className="sub">Click a cell, type, then press Enter or click away. Each change is saved to the team dataset under your name.</div></div></div>
    <div className="tabs"><Link href={href({ tab: "images" })} className={tab === "images" ? "active" : ""}>Image questions</Link><Link href={href({ tab: "knowledge" })} className={tab === "knowledge" ? "active" : ""}>Fish knowledge</Link></div>
    <section className="panel">
      <form className="panelbar" action="/edit"><input type="hidden" name="tab" value={tab} /><input className="search" name="q" defaultValue={q} placeholder={tab === "images" ? "Search fish name, question or answer…" : "Search fish name, question or answer…"} /><button className="btn">Search</button>{q && <Link className="small-link" href={href({ tab })}>Clear</Link>}<span className="count">{total.toLocaleString()} row{total === 1 ? "" : "s"}</span></form>
      {sheet}
      <div className="tablefoot"><span>Page {page} of {pages}</span><span style={{ display: "flex", gap: 14 }}>{page > 1 && <Link className="small-link" href={href({ page: page - 1 })}>← Previous</Link>}{page < pages && <Link className="small-link" href={href({ page: page + 1 })}>Next →</Link>}</span></div>
    </section>
  </main></Shell>;
}
