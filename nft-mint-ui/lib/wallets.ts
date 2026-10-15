"use client";

import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";

declare global { interface Window { ethereum?: EIP1193Provider } }

export type Wallet = { id: string; name: string; icon: string | null; provider: EIP1193Provider };
type Announce = { info?: { uuid?: unknown; name?: unknown; icon?: unknown }; provider?: unknown };

// Finds installed wallets with EIP-6963, so several extensions (for example MetaMask and Phantom)
// can coexist and the user picks one, instead of fighting over window.ethereum.
export function useWallets(): Wallet[] {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  useEffect(() => {
    const found = new Map<string, Wallet>();
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<Announce>).detail;
      const p = d?.provider as EIP1193Provider | undefined;
      const { uuid, name, icon } = d?.info ?? {};
      if (typeof uuid !== "string" || typeof name !== "string" || typeof p?.request !== "function") return;
      found.set(uuid, { id: uuid, name: name.slice(0, 40), icon: typeof icon === "string" && icon.startsWith("data:image/") ? icon : null, provider: p });
      setWallets([...found.values()]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const t = setTimeout(() => {
      if (found.size === 0 && window.ethereum) { found.set("injected", { id: "injected", name: "Browser wallet", icon: null, provider: window.ethereum }); setWallets([...found.values()]); }
    }, 800);
    return () => { clearTimeout(t); window.removeEventListener("eip6963:announceProvider", onAnnounce); };
  }, []);
  return wallets;
}
