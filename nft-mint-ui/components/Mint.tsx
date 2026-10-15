"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BaseError, ContractFunctionRevertedError, createWalletClient, custom, formatEther,
  getAddress, isAddress, zeroAddress, type Address, type Hex, type WalletClient,
} from "viem";
import { abi, chain, configError, ERROR_TEXT, explorer, NFT, publicClient } from "@/lib/nft";
import { useWallets, type Wallet } from "@/lib/wallets";

type Stats = { fee: bigint; cap: bigint; minted: bigint; supply: bigint; owner: Address; fees: bigint; balance: bigint; name: string; symbol: string };
type Note = { ok: boolean; text: string };
type Panel = { kind: "transfer" | "burn"; id: bigint; to: string };

const GRADS = ["from-violet-500 to-fuchsia-600", "from-sky-500 to-indigo-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-cyan-500 to-blue-600", "from-lime-500 to-green-600", "from-fuchsia-500 to-purple-600"];
const eth = (v: bigint) => `${formatEther(v)} ETH`;

function friendly(e: unknown): string {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (r instanceof ContractFunctionRevertedError && r.data?.errorName) return ERROR_TEXT[r.data.errorName] ?? "The contract rejected this action.";
    if (e.name === "UserRejectedRequestError" || e.shortMessage.includes("User rejected")) return "You cancelled the request in your wallet.";
    return e.shortMessage;
  }
  return "Something went wrong. Please try again.";
}

const btn = "rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";
const primary = `${btn} bg-violet-600 text-white hover:bg-violet-500`;
const plain = `${btn} border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800`;
const danger = `${btn} border border-red-800 bg-red-950 text-red-200 hover:bg-red-900`;
const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-violet-400";
const card = "rounded-xl border border-zinc-800 bg-zinc-900 p-5";

// Only people who accepted the warning page reach the mint page.
export default function Mint() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let ok = false;
    try { ok = sessionStorage.getItem("jtk-ack") === "1"; } catch { /* treated as not accepted */ }
    if (ok) setReady(true); else router.replace("/");
  }, [router]);
  return ready ? <App /> : null;
}

function App() {
  const wallets = useWallets();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [picker, setPicker] = useState(false);
  const [account, setAccount] = useState<Address | null>(null);
  const [rightChain, setRightChain] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ids, setIds] = useState<bigint[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [mintTo, setMintTo] = useState("");

  const refresh = useCallback(async (acct: Address | null) => {
    if (!publicClient) return;
    const c = { address: NFT, abi } as const;
    const [fee, cap, minted, supply, owner, fees, name, symbol, balance] = await Promise.all([
      publicClient.readContract({ ...c, functionName: "FEE" }),
      publicClient.readContract({ ...c, functionName: "NFT_CAP" }),
      publicClient.readContract({ ...c, functionName: "mintedTokens" }),
      publicClient.readContract({ ...c, functionName: "totalSupply" }),
      publicClient.readContract({ ...c, functionName: "owner" }),
      publicClient.readContract({ ...c, functionName: "totalFeesPaid" }),
      publicClient.readContract({ ...c, functionName: "name" }),
      publicClient.readContract({ ...c, functionName: "symbol" }),
      publicClient.getBalance({ address: NFT }),
    ]);
    setStats({ fee, cap, minted, supply, owner, fees, balance, name, symbol });
    if (acct) { const [, list] = await publicClient.readContract({ ...c, functionName: "seeTokens", args: [acct] }); setIds([...list]); }
    else setIds([]);
  }, []);

  useEffect(() => {
    refresh(null).catch(() => setNote({ ok: false, text: "Could not read the contract. Check your RPC URL and contract address." }));
  }, [refresh]);

  useEffect(() => {
    if (!wallet) return;
    const p = wallet.provider;
    const onAccounts = (a: Address[]) => {
      const x = a[0] && isAddress(a[0]) ? getAddress(a[0]) : null;
      setAccount(x); setPanel(null);
      if (!x) setWallet(null);
      refresh(x).catch(() => {});
    };
    const onChain = (id: string) => { try { setRightChain(Number(BigInt(id)) === chain.id); } catch { /* ignore */ } };
    p.on("accountsChanged", onAccounts);
    p.on("chainChanged", onChain);
    return () => { p.removeListener("accountsChanged", onAccounts); p.removeListener("chainChanged", onChain); };
  }, [wallet, refresh]);

  const isOwner = !!account && !!stats && account.toLowerCase() === stats.owner.toLowerCase();
  const soldOut = !!stats && stats.minted >= stats.cap;

  async function connect(w: Wallet) {
    setPicker(false);
    try {
      const [a] = await createWalletClient({ chain, transport: custom(w.provider) }).requestAddresses();
      const id = Number(BigInt(await w.provider.request({ method: "eth_chainId" })));
      setWallet(w); setRightChain(id === chain.id); setAccount(a);
      await refresh(a);
    } catch (e) { setNote({ ok: false, text: friendly(e) }); }
  }
  function onConnectClick() {
    if (wallets.length === 0) setNote({ ok: false, text: "No wallet found. Install a browser wallet such as MetaMask." });
    else if (wallets.length === 1) connect(wallets[0]);
    else setPicker(true);
  }
  function disconnect() { setWallet(null); setAccount(null); setIds([]); setPanel(null); }
  async function switchNetwork() {
    if (!wallet) return;
    try { await createWalletClient({ chain, transport: custom(wallet.provider) }).switchChain({ id: chain.id }); setRightChain(true); }
    catch (e) { setNote({ ok: false, text: friendly(e) }); }
  }

  // Each action is simulated first so a revert becomes a readable message, then the wallet signs.
  function act(done: string, fn: (a: Address, w: WalletClient) => Promise<Hex>, after?: () => void) {
    return async () => {
      if (!account || !wallet || !publicClient) return;
      setBusy(true); setNote(null);
      try {
        const w = createWalletClient({ account, chain, transport: custom(wallet.provider) });
        const hash = await fn(account, w);
        const r = await publicClient.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error("reverted");
        setNote({ ok: true, text: done }); after?.();
        await refresh(account);
      } catch (e) { setNote({ ok: false, text: friendly(e) }); }
      finally { setBusy(false); }
    };
  }
  const sim = publicClient!;
  const doMint = () => { if (stats) act("Minted! Your new token is below.", async (a, w) => {
    const { request } = await sim.simulateContract({ address: NFT, abi, account: a, functionName: "mint", value: stats.fee });
    return w.writeContract(request);
  })(); };
  const validAddr = (s: string) => isAddress(s) && s.toLowerCase() !== zeroAddress;
  const doTransfer = () => {
    if (!panel || !account) return;
    if (!validAddr(panel.to)) return setNote({ ok: false, text: "Enter a valid wallet address (0x followed by 40 characters)." });
    if (panel.to.toLowerCase() === account.toLowerCase()) return setNote({ ok: false, text: "That is your own address." });
    const to = getAddress(panel.to), id = panel.id;
    act(`Token #${id} sent.`, async (a, w) => {
      const { request } = await sim.simulateContract({ address: NFT, abi, account: a, functionName: "safeTransferFrom", args: [a, to, id] });
      return w.writeContract(request);
    }, () => setPanel(null))();
  };
  const doBurn = () => { if (panel) { const id = panel.id; act(`Token #${id} burned.`, async (a, w) => {
    const { request } = await sim.simulateContract({ address: NFT, abi, account: a, functionName: "burn", args: [id] });
    return w.writeContract(request);
  }, () => setPanel(null))(); } };
  const doWithdraw = () => act("Funds withdrawn to the owner wallet.", async (a, w) => {
    const { request } = await sim.simulateContract({ address: NFT, abi, account: a, functionName: "withdraw" });
    return w.writeContract(request);
  })();
  const doMintTo = () => {
    if (!validAddr(mintTo)) return setNote({ ok: false, text: "Enter a valid wallet address." });
    const to = getAddress(mintTo);
    act("Token minted to that address.", async (a, w) => {
      const { request } = await sim.simulateContract({ address: NFT, abi, account: a, functionName: "mintTo", args: [to] });
      return w.writeContract(request);
    }, () => setMintTo(""))();
  };

  if (configError) return <div role="alert" className={`${card} border-amber-700 text-amber-200`}><b>Setup needed.</b> {configError} See README.md.</div>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">{stats ? `${stats.name} (${stats.symbol})` : "Jude Tokens"}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber-700 bg-amber-950 px-3 py-1 text-xs text-amber-200">Sepolia testnet</span>
          {account ? (<>
            <span className="rounded-full bg-violet-950 px-3 py-1 text-xs text-violet-200">{account.slice(0, 6)}…{account.slice(-4)}</span>
            <button className={`${plain} px-3 py-1`} onClick={disconnect}>Disconnect</button></>)
            : <button className={primary} onClick={onConnectClick}>Connect wallet</button>}
        </div>
      </header>

      {picker && (
        <div className={card} role="dialog" aria-label="Choose a wallet">
          <h2 className="mb-3 font-semibold">Choose a wallet</h2>
          <ul className="space-y-2">{wallets.map((w) => (
            <li key={w.id}><button className={`${plain} flex w-full items-center gap-3 text-left`} onClick={() => connect(w)}>
              {w.icon && <img src={w.icon} alt="" width={24} height={24} className="h-6 w-6 rounded" />}{w.name}</button></li>))}</ul>
          <button className={`${plain} mt-3`} onClick={() => setPicker(false)}>Cancel</button>
        </div>
      )}

      {note && <p role="status" className={`rounded-lg px-4 py-2 text-sm ${note.ok ? "bg-emerald-950 text-emerald-200" : "bg-amber-950 text-amber-200"}`}>{note.text}</p>}
      {account && !rightChain && <div role="alert" className={`${card} flex items-center justify-between gap-3 border-amber-700`}><span className="text-sm text-amber-200">Your wallet is not on Sepolia.</span><button className={primary} onClick={switchNetwork}>Switch to Sepolia</button></div>}

      <section className="grid grid-cols-3 divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900 text-center" aria-label="Collection stats">
        {[["Minted", stats ? `${stats.minted} / ${stats.cap}` : "…"], ["Price", stats ? eth(stats.fee) : "…"], ["Your tokens", account ? String(ids.length) : "-"]].map(([k, v]) => (
          <div key={k} className="p-4"><div className="text-lg font-semibold sm:text-2xl">{v}</div><div className="text-xs text-zinc-400">{k}</div></div>))}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Mint a token</h2>
        {stats && <progress className="mb-3 h-2 w-full accent-violet-500" value={Number(stats.minted)} max={Number(stats.cap)} aria-label="Minted so far" />}
        {!account ? <p className="text-sm text-zinc-400">Connect a test wallet to mint.</p> : (<>
          <button className={`${primary} w-full py-3`} disabled={busy || !rightChain || !stats || soldOut} onClick={doMint}>
            {soldOut ? "Sold out" : busy ? "Waiting for confirmation…" : `Mint for ${stats ? eth(stats.fee) : "…"}`}</button>
          <p className="mt-2 text-xs text-zinc-400">The price is exact, plus network gas, in Sepolia test ETH. Burned tokens do not reopen supply.</p></>)}
      </section>

      {account && (
        <section className={card}>
          <h2 className="mb-3 font-semibold">Your tokens</h2>
          {ids.length === 0 ? <p className="py-4 text-center text-sm text-zinc-400">You do not own any tokens yet.</p> : (
            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {ids.map((id) => (
                <li key={String(id)} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${GRADS[Number(id % 8n)]} text-3xl font-bold text-white`}>#{String(id)}</div>
                  <div className="flex gap-2 p-3">
                    <button className={`${plain} flex-1`} disabled={busy} onClick={() => setPanel({ kind: "transfer", id, to: "" })}>Send</button>
                    <button className={`${danger} flex-1`} disabled={busy} onClick={() => setPanel({ kind: "burn", id, to: "" })}>Burn</button>
                  </div>
                </li>))}
            </ul>)}
          {panel?.kind === "transfer" && (
            <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950 p-4" role="group" aria-label="Send token">
              <label htmlFor="to" className="text-sm text-zinc-300">Send token #{String(panel.id)} to</label>
              <input id="to" className={`${input} my-2`} placeholder="0x…" value={panel.to} onChange={(e) => setPanel({ ...panel, to: e.target.value.trim() })} />
              <div className="flex gap-2"><button className={primary} disabled={busy} onClick={doTransfer}>Confirm send</button><button className={plain} onClick={() => setPanel(null)}>Cancel</button></div>
            </div>)}
          {panel?.kind === "burn" && (
            <div className="mt-4 rounded-lg border border-red-800 bg-red-950 p-4" role="alertdialog" aria-label="Confirm burn">
              <p className="text-sm text-red-100">Burn token #{String(panel.id)}? It is destroyed permanently and cannot be recovered.</p>
              <div className="mt-3 flex gap-2"><button className={danger} disabled={busy} onClick={doBurn}>Burn permanently</button><button className={plain} onClick={() => setPanel(null)}>Keep it</button></div>
            </div>)}
        </section>)}

      {isOwner && stats && (
        <section className={card} aria-label="Owner controls">
          <h2 className="mb-3 font-semibold">Owner controls</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><p className="text-sm text-zinc-400">Held by the contract</p><p className="mb-2 text-xl font-semibold">{eth(stats.balance)}</p>
              <button className={primary} disabled={busy || stats.balance === 0n} onClick={doWithdraw}>Withdraw to owner</button></div>
            <div><label htmlFor="mt" className="text-sm text-zinc-300">Mint a free token to an address</label>
              <div className="mt-1 flex gap-2"><input id="mt" className={input} placeholder="0x…" value={mintTo} onChange={(e) => setMintTo(e.target.value.trim())} /><button className={plain} disabled={busy || soldOut} onClick={doMintTo}>Mint</button></div>
              <p className="mt-1 text-xs text-zinc-500">Counts toward the {String(stats.cap)} cap.</p></div>
          </div>
        </section>)}

      <footer className="pb-4 text-center text-xs text-zinc-500">
        Contract <a className="text-violet-300 underline" href={explorer} target="_blank" rel="noopener noreferrer">{NFT.slice(0, 8)}…{NFT.slice(-6)}</a> on Sepolia. Test network only. <a className="text-violet-300 underline" href="/">Show the warnings again</a>
      </footer>
    </div>
  );
}
