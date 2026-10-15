import { createPublicClient, http, isAddress, type Address } from "viem";
import { sepolia } from "viem/chains";
import { abi } from "./abi";

export { abi };
export const chain = sepolia; // this site works on Sepolia only

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
const address = process.env.NEXT_PUBLIC_NFT_ADDRESS ?? "";
const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "";

function rpcOk(url: string) {
  try {
    const u = new URL(url);
    return !url.includes("YOUR_") && (u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)));
  } catch { return false; }
}

export const configError: string | null = !isAddress(address)
  ? "NEXT_PUBLIC_NFT_ADDRESS is missing or is not a valid address (a wrong capital letter also fails). Paste it again from Remix."
  : !rpcOk(rpc)
    ? "NEXT_PUBLIC_RPC_URL must be your real https Sepolia endpoint (for example from Infura)."
    : null;

export const NFT = address as Address;
export const publicClient = configError ? null : createPublicClient({ chain, transport: http(rpc) });
export const explorer = `https://sepolia.etherscan.io/address/${address}`;

export const ERROR_TEXT: Record<string, string> = {
  NotEnoughFunds: "Not enough ETH was sent. The mint price is exact.",
  ExcessFunds: "Too much ETH was sent. The mint price is exact.",
  MintingFinished: "All tokens have been minted.",
  NotYourToken: "You can only burn tokens you own.",
  ZeroAmount: "There is nothing to withdraw.",
  OwnableUnauthorizedAccount: "Only the contract owner can do that.",
  ERC721InvalidReceiver: "That address cannot receive this token.",
  ERC721IncorrectOwner: "You do not own that token.",
  ERC721InsufficientApproval: "You are not approved to move that token.",
  ERC721NonexistentToken: "That token does not exist.",
};
