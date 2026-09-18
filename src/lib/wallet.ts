import { encodeFunctionData, decodeAbiParameters, erc20Abi, parseAbiParameters } from "viem";

export const POLYGON_CHAIN_ID = "0x89";
export const USDT_POLYGON = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
export const USDT_DECIMALS = 6;

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isNimiqPay?: boolean;
}

export function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null;
}

export function isInsideNimiqPay(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { nimiqPay?: unknown }).nimiqPay);
}

/** Connect the Nimiq wallet and return the first address. */
export async function connectNimiq(): Promise<string> {
  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init({ timeout: 5000 });
  const accounts = (await nimiq.listAccounts()) as unknown;
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string")
    throw new Error("No Nimiq address was shared.");
  return accounts[0];
}

/** Ask the wallet to sign a login challenge. Returns the signature. */
export async function signNimiqMessage(message: string): Promise<string> {
  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = (await init({ timeout: 5000 })) as unknown as {
    signMessage?: (args: { message: string }) => Promise<unknown>;
  };
  if (typeof nimiq.signMessage !== "function")
    throw new Error("This wallet cannot sign messages.");
  const result = await nimiq.signMessage({ message });
  if (typeof result === "string") return result;
  const sig = (result as { signature?: string })?.signature;
  if (typeof sig !== "string") throw new Error("The wallet did not return a signature.");
  return sig;
}

/** Send NIM through the wallet approval dialog. Returns the transaction hash. */
export async function sendNim(recipient: string, nimAmount: number): Promise<string> {
  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init({ timeout: 5000 });
  const result = (await nimiq.sendBasicTransaction({
    recipient,
    value: Math.round(nimAmount * 100_000),
    fee: 0,
  })) as unknown;
  if (typeof result !== "string") throw new Error("The wallet did not confirm the transaction.");
  return result;
}

/* ------------------------------------------------------------------ */
/* Nimiq browser wallet (Hub) — used when the app is not inside Nimiq Pay */
/* ------------------------------------------------------------------ */

const APP_NAME = "NimiqValley";
const HUB_URL = "https://hub.nimiq.com";

async function hub() {
  const mod = await import("@nimiq/hub-api");
  const HubApi = (mod as unknown as { default: new (url: string) => unknown }).default;
  return new HubApi(HUB_URL) as {
    chooseAddress: (o: { appName: string }) => Promise<{ address: string }>;
    signMessage: (o: {
      appName: string;
      message: string;
      signer?: string;
    }) => Promise<{ signer: string; signature: { toHex?: () => string } | string }>;
    checkout: (o: {
      appName: string;
      recipient: string;
      value: number;
      extraData?: string;
    }) => Promise<{ hash: string }>;
  };
}

function toHex(signature: { toHex?: () => string } | string): string {
  if (typeof signature === "string") return signature;
  if (typeof signature?.toHex === "function") return signature.toHex();
  return JSON.stringify(signature);
}

export type WalletKind = "pay" | "hub";

/** Which wallet the app should talk to by default. */
export function preferredWallet(): WalletKind {
  return isInsideNimiqPay() ? "pay" : "hub";
}

/** Connect either Nimiq Pay or the Nimiq browser wallet and return the address. */
export async function connectWallet(kind: WalletKind = preferredWallet()): Promise<string> {
  if (kind === "pay") return connectNimiq();
  const api = await hub();
  const picked = await api.chooseAddress({ appName: APP_NAME });
  if (!picked?.address) throw new Error("No Nimiq address was shared.");
  return picked.address;
}

/** Sign the login challenge with either wallet. */
export async function signLoginMessage(
  kind: WalletKind,
  message: string,
  address: string,
): Promise<string> {
  if (kind === "pay") return signNimiqMessage(message);
  const api = await hub();
  const signed = await api.signMessage({ appName: APP_NAME, message, signer: address });
  return toHex(signed.signature);
}

/** Pay NIM with either wallet. Returns the transaction hash. */
export async function payNim(
  recipient: string,
  nimAmount: number,
  note: string,
  kind: WalletKind = preferredWallet(),
): Promise<string> {
  const value = Math.round(nimAmount * 100_000);
  if (kind === "pay") {
    const { init } = await import("@nimiq/mini-app-sdk");
    const nimiq = (await init({ timeout: 5000 })) as unknown as {
      sendBasicTransactionWithData?: (a: {
        recipient: string;
        value: number;
        fee: number;
        data: string;
      }) => Promise<unknown>;
      sendBasicTransaction: (a: {
        recipient: string;
        value: number;
        fee: number;
      }) => Promise<unknown>;
    };
    const result =
      typeof nimiq.sendBasicTransactionWithData === "function"
        ? await nimiq.sendBasicTransactionWithData({ recipient, value, fee: 0, data: note })
        : await nimiq.sendBasicTransaction({ recipient, value, fee: 0 });
    if (typeof result === "string") return result;
    const hash = (result as { hash?: string })?.hash;
    if (typeof hash !== "string") throw new Error("The wallet did not confirm the payment.");
    return hash;
  }
  const api = await hub();
  const receipt = await api.checkout({
    appName: APP_NAME,
    recipient: recipient.replace(/\s+/g, ""),
    value,
    extraData: note,
  });
  if (!receipt?.hash) throw new Error("The wallet did not confirm the payment.");
  return receipt.hash;
}

/** Connect an EVM wallet on Polygon and return the address. */
export async function connectPolygon(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("No Ethereum wallet found in this browser.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const first = accounts?.[0];
  if (!first) throw new Error("No Ethereum address was shared.");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_CHAIN_ID }],
    });
  } catch {
    // Some wallets stay on their current chain; balance reads below still target Polygon.
  }
  return first;
}

/** Read the USDT (Polygon) balance for an address, in whole USDT. */
export async function readUsdtBalance(address: string): Promise<number> {
  const eth = getEthereum();
  if (!eth) throw new Error("No Ethereum wallet found in this browser.");
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
  const raw = (await eth.request({
    method: "eth_call",
    params: [{ to: USDT_POLYGON, data }, "latest"],
  })) as string;
  if (!raw || raw === "0x") return 0;
  const [value] = decodeAbiParameters(parseAbiParameters("uint256"), raw as `0x${string}`);
  return Number(value) / 10 ** USDT_DECIMALS;
}
