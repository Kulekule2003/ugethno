import sharp from "sharp";
import { db } from "@/lib/db";
export async function hashImage(buffer:Buffer){const {data}=await sharp(buffer).resize(8,8,{fit:"fill"}).greyscale().raw().toBuffer({resolveWithObject:true});const avg=data.reduce((a,b)=>a+b,0)/data.length;return [...data].map(x=>x>=avg?"1":"0").join("");}
export async function findNearDuplicate(buffer:Buffer){const hash=await hashImage(buffer);const rows=await db.imageRecord.findMany({where:{deletedAt:null,phash:{not:null}},select:{id:true,shortName:true,canonicalName:true,phash:true},take:10000});for(const row of rows){const old=row.phash||"";if(old.length!==64)continue;let distance=0;for(let i=0;i<64;i++)if(hash[i]!==old[i])distance++;if(distance<=5)return row;}return null;}
