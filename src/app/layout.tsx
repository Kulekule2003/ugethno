import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "UgEthnoFish · Dataset", description: "Private Ugandan freshwater fish dataset workspace", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
