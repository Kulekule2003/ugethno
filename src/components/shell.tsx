import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export async function Shell({ children, active = "Dataset" }: { children: React.ReactNode; active?: string }) {
  const user = await getSessionUser(); if (!user) redirect("/login");
  const nav = [["Dataset", "/", "01"], ["Editor", "/edit", "02"], ["Species", "/species", "03"], ["Upload", "/upload", "04"], ["Download", "/download", "05"]];
  return <div className="app"><header className="topbar"><Link href="/" className="brand"><span className="brandmark"><span>✦</span></span> UgEthnoFish</Link><nav className="nav">{nav.map(([label, href, n]) => <Link key={href} className={active === label ? "active" : ""} href={href}><span style={{opacity:.4,marginRight:6,fontSize:9}}>{n}</span>{label}</Link>)}{user.role === "ADMIN" && <Link className={active === "Admin" ? "active" : ""} href="/admin">Admin</Link>}</nav><div className="topright"><span className="muted" style={{fontSize:11}}>{user.name || user.email}</span><span className="avatar">{(user.name || user.email).slice(0,1).toUpperCase()}</span><form action="/api/auth/logout" method="post"><button className="btn" style={{padding:"8px 10px"}}>Sign out</button></form></div></header>{children}</div>;
}
