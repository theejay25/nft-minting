import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = { title: "Jude Tokens (Sepolia testnet)", description: "NFT minting demo on the Sepolia test network" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // opts into dynamic rendering so the CSP nonce is applied per request
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
