import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { createSession, isSameOrigin } from "@/lib/auth";
export async function POST(request:Request) {
  if(!isSameOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  const data=await request.formData(); const email=String(data.get("email")||"").trim().toLowerCase(),password=String(data.get("password")||"");
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
  const key=createHash("sha256").update(`${ip}:${email}`).digest("hex");
  const throttle=await db.loginThrottle.findUnique({where:{key}}); if(throttle&&throttle.expiresAt.getTime()>Date.now()&&throttle.count>=8)return NextResponse.json({error:"Try again later"},{status:429});
  const user=await db.user.findUnique({where:{email}}); const ok=!!user&&!user.disabledAt&&await argon2.verify(user.passwordHash,password).catch(()=>false);
  if(!ok){const active=!!throttle&&throttle.expiresAt.getTime()>Date.now();const expiresAt=active?throttle!.expiresAt:new Date(Date.now()+15*60*1000);await db.loginThrottle.upsert({where:{key},create:{key,count:1,expiresAt},update:{count:active?{increment:1}:1,expiresAt}});return NextResponse.redirect(new URL("/login?error=1",request.url),303);}
  await db.loginThrottle.deleteMany({where:{key}}); await createSession(user.id); return NextResponse.redirect(new URL("/",request.url),303);
}
