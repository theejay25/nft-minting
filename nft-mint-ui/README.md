# Jude Tokens NFT Mint UI (Sepolia testnet)

A dark-themed Next.js frontend for the deployed `nftOZ` ERC-721 contract ("Jude Tokens", symbol JTK). Visitors first see a warning page, then reach the mint page where they can mint, view, send and burn tokens. The contract owner also gets withdraw and free-mint controls.

**Sepolia testnet only.** Nothing here has real value. Use a test account and never send real ETH to the contract.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, viem 2, TypeScript. Versions are pinned exactly in `package.json` and locked in `package-lock.json`. No wallet SDKs or UI kits are used, which keeps the dependency tree small.

## Requirements

Node.js 20.9 or newer and npm 10 or newer.

## Setup

```bash
npm ci
cp .env.example .env.local
# edit .env.local: put your real Infura Sepolia URL in NEXT_PUBLIC_RPC_URL
npm run dev
```

Open http://localhost:3000.

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_NFT_ADDRESS` | Address of the deployed `nftOZ` contract on Sepolia (already filled in `.env.example`) |
| `NEXT_PUBLIC_RPC_URL` | Your Sepolia JSON-RPC URL, for example `https://sepolia.infura.io/v3/<key>`. Must be https (http only for localhost) |

These values are public because they ship in the browser bundle. Never put private keys or secrets in them. Restrict your Infura key to your site's domain in the Infura dashboard before going live. The chain is fixed to Sepolia in `lib/nft.ts`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run audit:prod` | Audit runtime dependencies only |

## How it works

- **Warning page (`/`)**: lists the testnet warnings. The visitor must tick the confirmation box before "Continue" works. The choice is remembered for the browser session, and visiting `/mint` directly sends people back to the warning page. This gate is a safety prompt, not access control. The footer link on the mint page shows the warnings again.
- **Wallet selection**: wallets are discovered with EIP-6963. If more than one wallet extension is installed (for example MetaMask and Phantom), the visitor picks one from a list, so extensions do not clash over `window.ethereum`.
- **Minting**: the Mint button sends exactly the contract's `FEE` (0.005 ETH), read live from the contract.
- **Every write is simulated first** with `simulateContract`, so reverts appear as readable messages before the wallet is asked to sign.
- **Your tokens** come from `seeTokens(address)`. Sending uses `safeTransferFrom`, so tokens cannot be sent to contracts that cannot hold them.

## Security measures

- Content Security Policy with a per-request nonce (`proxy.ts`), `object-src 'none'`, `frame-ancestors 'none'`, and `connect-src` limited to the app and your RPC origin.
- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` and `Permissions-Policy` (`next.config.ts`). `X-Powered-By` is disabled.
- Startup validation of the contract address (including its checksum) and the RPC URL. A setup message is shown instead of running with bad values.
- Strict address validation for send and owner mint inputs; the zero address and your own address are rejected for sends.
- Wallet icons are accepted only as `data:image/` URIs. No `dangerouslySetInnerHTML`, no `eval`, and all wallet and chain text is rendered as escaped text.
- Wrong-network guard: the mint button is disabled until the wallet is on Sepolia, with a one-click switch.
- Burn needs an explicit confirmation. External links use `rel="noopener noreferrer"`.
- The app never handles private keys. Signing happens only in the user's wallet.

### Limits to be aware of

- Hiding the owner panel is a convenience only. The contract's `onlyOwner` checks are the real protection.
- A frontend cannot protect users from a faulty contract. This contract is a student project and has not been professionally audited.

## Contract notes

- `mint()` needs exactly 0.005 ETH. Sending more or less reverts (`ExcessFunds`, `NotEnoughFunds`). The contract has no `receive` function, so plain ETH transfers to it fail.
- The contract sets no base URI, so `tokenURI` is empty and there is no image or metadata. The site shows generated placeholder cards. To show real art, add a `_baseURI` override to the contract and redeploy.
- `mintedTokens` never decreases, so burning a token does not free up supply. The cap of 40 counts every mint ever made, including `mintTo`.
- `mintTo` is owner-only, free, and uses the same cap. `withdraw` sends the whole contract balance to the owner. `renounceOwnership` is disabled.

## Dependency hygiene and audits

The lockfile is committed and the install reports 0 vulnerabilities. To keep it that way: install with `npm ci`, run `npm audit` before each release, enable Dependabot or Renovate, and after any update re-run `npm run typecheck`, `npm run build` and `npm audit`.

## Deployment

The nonce-based CSP is created per request, so the app needs a Node runtime (for example Vercel) and cannot be a static export. Serve it over HTTPS. Set the **root directory** to the folder containing `package.json` (`nft-mint-ui` if it is a subfolder of your repo). Add both environment variables in the host's settings before building, since `NEXT_PUBLIC_*` values are inlined at build time.

## If you redeploy the contract

Paste the new ABI array into `lib/abi.ts` (keep `as const`) and update `NEXT_PUBLIC_NFT_ADDRESS`.

## Project structure

```
app/page.tsx, app/mint/page.tsx     Warning page and mint page
components/Warning.tsx              Warning gate
components/Mint.tsx                 Wallet, reads, writes, UI
lib/abi.ts                          Contract ABI from Remix
lib/nft.ts                          Config validation, read client, error messages
lib/wallets.ts                      EIP-6963 wallet discovery
proxy.ts, next.config.ts            CSP and security headers
```

## Troubleshooting

- "Setup needed" banner: the address or RPC URL is missing, invalid, or still the placeholder.
- Stats show "…" or a read error: the RPC URL is wrong or not a Sepolia endpoint.
- Changed `.env.local` but nothing happened: restart the dev server (or rebuild for production).
