import { NextResponse } from "next/server";
export async function POST(request:Request){const response=NextResponse.redirect(new URL("/login",request.url),303);response.cookies.set("ugfish_session","",{path:"/",maxAge:0,httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production"});return response;}
