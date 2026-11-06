import { Shell } from "@/components/shell";
import { ColumnCreate } from "@/components/column-create";
import { db } from "@/lib/db";
import { Image, Fish, CircleAlert, ArrowDownToLine, SlidersHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { signedImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [rows, species, pending, columns, total] = await Promise.all([
    db.imageRecord.findMany({ where: { deletedAt: null }, orderBy: { uploadedAt: "desc" }, take: 50, include: { uploader: true } }),
    db.species.count({ where: { deletedAt: null } }),
    db.imageRecord.count({ where: { deletedAt: null, OR: [{ creator: "" }, { license: "" }] } }),
    db.columnDefinition.findMany({ where: { entity: "IMAGE", archivedAt: null }, orderBy: { createdAt: "asc" } }),
    db.imageRecord.count({ where: { deletedAt: null } })
  ]);
  const imageRows = await Promise.all(rows.map(async row => ({ ...row, imageUrl: await signedImage(row.objectKey) })));
  const speciesCoverage = await db.species.findMany({ where: { deletedAt: null }, orderBy: { canonicalName: "asc" }, take: 5, include: { images: { where: { deletedAt: null, creator: { not: "" }, license: { not: "" } } } } });
  return <Shell><main className="wrap">
    <div className="heading"><div><div className="eyebrow">FIELD COLLECTION · 2026</div><h1>Image dataset</h1><div className="sub">A living catalogue of Uganda’s freshwater fish.</div></div><div className="actions"><Link className="btn" href="/download"><ArrowDownToLine size={15}/> Export</Link><Link className="btn primary" href="/upload"><Plus size={15}/> Add images</Link></div></div>
    <div className="stats">
      <Stat label="IMAGE RECORDS" value={total.toLocaleString()} foot="Across all collections" icon={<Image size={15}/>}/>
      <Stat label="SPECIES" value={String(species)} foot="Documented so far" icon={<Fish size={15}/>}/>
      <Stat label="NEEDS ATTENTION" value={String(pending)} foot="Missing creator or licence" icon={<CircleAlert size={15}/>}/>
      <Stat label="YOUR ROLE" value="Shared" foot="Team dataset" icon={<span className="pill">TEAM</span>}/>
    </div>
    {pending > 0 && <div className="notice">✳ &nbsp;{pending} image{pending === 1 ? " is" : "s are"} incomplete and won’t appear in training exports until creator and licence are added.</div>}
    <div className="page-grid"><section className="panel"><div className="panelbar"><div className="grid-title"><Image size={15}/><strong style={{fontSize:12}}>All images</strong></div><input className="search" placeholder="Search species, source, creator…"/><button className="filter"><SlidersHorizontal size={13}/> &nbsp;Filter</button><ColumnCreate/><span className="count">{total} records</span></div>
      <div className="table-scroll"><table><thead><tr><th>Preview</th><th>Species</th><th>Question</th><th>Creator</th><th>Licence</th><th>Uploaded by</th><th>Status</th><th></th>{columns.map(c=><th key={c.id}>{c.label}</th>)}</tr></thead><tbody>{imageRows.map(r=><tr key={r.id}><td><img className="thumb" src={r.imageUrl} alt="Fish record" loading="lazy"/></td><td><Link href={`/images/${r.id}`} className="species">{r.shortName}</Link><div className="latin">{r.canonicalName.replaceAll("_"," ")}</div></td><td>{r.question}</td><td>{r.creator || <span className="muted">—</span>}</td><td>{r.license || <span className="muted">—</span>}</td><td>{r.uploader.name || r.uploader.email.split("@")[0]}</td><td><span className={`pill ${r.creator && r.license ? "complete" : "incomplete"}`}>{r.creator && r.license ? "Complete" : "Incomplete"}</span></td><td className="row-actions">···</td>{columns.map(c=><td key={c.id}>{String((r.custom as Record<string, unknown>)[c.key] ?? "—")}</td>)}</tr>)}</tbody></table>{rows.length===0&&<div className="empty"><Image size={25}/><p>No image records yet</p><Link className="small-link" href="/upload">Upload the first images →</Link></div>}</div>
      <div className="tablefoot"><span>Showing {rows.length} of {total} records</span><span>Changes are saved to the team dataset</span></div>
    </section><aside className="sidecard"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3>Species coverage</h3><Link className="small-link" href="/species">View all →</Link></div><p className="muted" style={{fontSize:11,marginTop:-7}}>Complete images toward the 5-image goal</p>{speciesCoverage.map(s=><div className="fish-card" key={s.id}><div style={{width:57,height:47,borderRadius:5,background:"#eef2ee",display:"grid",placeItems:"center",color:"#6f8b77"}}><Fish size={19}/></div><div style={{flex:1}}><strong>{s.shortName}</strong><small>{s.images.length} / 5 images</small><div className="progress"><span style={{width:`${Math.min(s.images.length*20,100)}%`}}/></div></div></div>)}{species===0&&<div className="empty" style={{padding:20}}>Species will appear as the dataset is added.</div>}<div style={{borderTop:"1px solid var(--line)",marginTop:15,paddingTop:14,fontSize:11,color:"#8d9990"}}>Dataset last updated <strong style={{color:"#526359"}}>just now</strong></div></aside></div>
  </main></Shell>;
}

function Stat({label,value,foot,icon}:{label:string;value:string;foot:string;icon:React.ReactNode}){return <div className="stat"><div className="stat-top"><span>{label}</span>{icon}</div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;}
