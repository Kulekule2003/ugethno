import test from "node:test";
import assert from "node:assert/strict";
const base=process.env.TEST_BASE_URL||"http://localhost:3000";
test("unauthenticated protected pages redirect to login",async()=>{for(const path of ["/","/species","/upload","/download","/admin"]){const r=await fetch(base+path,{redirect:"manual"});assert.ok([307,308].includes(r.status),`${path} should redirect`);assert.match(r.headers.get("location")||"",/\/login/);}});
test("unauthenticated APIs and image downloads are rejected",async()=>{for(const path of ["/api/images","/api/admin/users","/api/download?format=training","/api/images/example/file"]){const r=await fetch(base+path);assert.equal(r.status,401,`${path} should return 401`);}});
