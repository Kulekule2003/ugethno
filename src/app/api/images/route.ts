import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { requireUser, isSameOrigin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { putImage } from "@/lib/storage";
import { findNearDuplicate } from "@/lib/phash";
export const runtime="nodejs";
export async function POST(request:Request){
 try { const user=await requireUser(); if(!isSameOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403}); const form=await request.formData(); const files=form.getAll("files").filter((x):x is File=>x instanceof File); const speciesId=String(form.get("speciesId")||""); if(!files.length)return NextResponse.json({error:"Choose at least one image."},{status:400});
 const species=await db.species.findUnique({where:{id:speciesId}}); if(!species||species.deletedAt)return NextResponse.json({error:"Choose an active species."},{status:400}); const results=[];
 for(const file of files){if(!["image/jpeg","image/png","image/webp"].includes(file.type)) {results.push({name:file.name,error:"Use JPG, PNG or WebP."});continue;}if(file.size>(Number(process.env.MAX_UPLOAD_MB||15)*1024*1024)){results.push({name:file.name,error:"File is too large."});continue;} const input=Buffer.from(await file.arrayBuffer());let meta;try{meta=await sharp(input).metadata();}catch{results.push({name:file.name,error:"Image could not be read."});continue;} if(!meta.width||!meta.height||meta.width*meta.height<90000||Math.max(meta.width,meta.height)/Math.min(meta.width,meta.height)>4){results.push({name:file.name,error:"Image is too small or has an extreme aspect ratio."});continue;}
 const duplicate=await findNearDuplicate(input);if(duplicate){results.push({name:file.name,error:"Near-duplicate image detected.",duplicate:{id:duplicate.id,shortName:duplicate.shortName,canonicalName:duplicate.canonicalName}});continue;}
 const normalized=await sharp(input).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).jpeg({quality:90}).toBuffer();const id=randomUUID(),key=`${species.canonicalName}/${id}.jpg`;await putImage(key,normalized);const row=await db.imageRecord.create({data:{id,category:species.category,canonicalName:species.canonicalName,shortName:species.shortName,objectKey:key,originalFileName:file.name,speciesId:species.id,uploaderId:user.id,phash:await (await import("@/lib/phash")).hashImage(normalized)}});await audit(user.id,"IMAGE",id,"CREATE",undefined,undefined,{originalFileName:file.name,canonicalName:species.canonicalName});results.push({name:file.name,id:row.id,ok:true}); }
 return NextResponse.json({results}); } catch(e){if(e instanceof Response)return NextResponse.json({error:e.status===401?"Unauthorized":"Forbidden"},{status:e.status});return NextResponse.json({error:"Upload failed."},{status:500});}
}
