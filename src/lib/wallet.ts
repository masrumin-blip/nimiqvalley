import { encodeFunctionData, decodeAbiParameters, erc20Abi, parseAbiParameters } from "viem";

export const POLYGON_CHAIN_ID = "0x89";
export const USDT_POLYGON = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
export const USDT_DECIMALS = 6;

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isNimiqPay?: boolean;
}

type WalletError = { error: { type: string; message: string } };
export type LoginSignature = {
  publicKey: string;
  signature: string;
};

function isWalletError(value: unknown): value is WalletError {
  return Boolean(value && typeof value === "object" && "error" in value);
}

/** Turn wallet provider errors into friendly English messages. */
function walletErrorMessage(err: WalletError): string {
  const { type, message } = err.error;
  if (/permissiondenied|denied|reject/i.test(`${type} ${message}`)) {
    return "You declined the wallet request.";
  }
  return message || "The wallet request failed.";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}


/** Reject instead of hanging when a wallet dialog never answers. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error as Error);
      },
    );
  });
}

const WALLET_TIMEOUT_MS = 3 * 60_000;

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
  if (isWalletError(accounts)) throw new Error(walletErrorMessage(accounts));
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string")
    throw new Error("No Nimiq address was shared.");
  return accounts[0];
}

/** Ask Nimiq Pay to sign a login challenge (plain text, wallet applies the Nimiq prefix). */
export async function signNimiqMessage(message: string): Promise<LoginSignature> {
  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init({ timeout: 5000 });
  const result = (await nimiq.sign(message)) as unknown;
  if (isWalletError(result)) throw new Error(walletErrorMessage(result));
  if (
    !result ||
    typeof result !== "object" ||
    !("signature" in result) ||
    !("publicKey" in result)
  ) {
    throw new Error("The sign request was rejected.");
  }
  const { publicKey, signature } = result as { publicKey: string; signature: string };
  return { publicKey, signature };
}

/** Send NIM through the wallet approval dialog. Returns the wallet receipt. */
export async function sendNim(recipient: string, nimAmount: number): Promise<string> {
  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init({ timeout: 5000 });
  const result = (await withTimeout(
    nimiq.sendBasicTransaction({
      recipient,
      value: Math.round(nimAmount * 100_000),
      fee: 0,
    }),
    WALLET_TIMEOUT_MS,
    "The wallet did not answer in time. Please try again.",
  )) as unknown;
  if (isWalletError(result)) throw new Error(walletErrorMessage(result));
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
    }) => Promise<{ signer: string; signerPublicKey: Uint8Array; signature: Uint8Array }>;
    checkout: (o: {
      appName: string;
      recipient: string;
      value: number;
      extraData?: string;
    }) => Promise<{ hash: string }>;
  };
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
): Promise<LoginSignature> {
  if (kind === "pay") return signNimiqMessage(message);
  const api = await hub();
  const signed = await api.signMessage({ appName: APP_NAME, message, signer: address });
  return {
    publicKey: bytesToHex(signed.signerPublicKey),
    signature: bytesToHex(signed.signature),
  };
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
    if (isWalletError(result)) throw new Error(walletErrorMessage(result));
    if (typeof result !== "string") throw new Error("The wallet did not confirm the payment.");
    return transactionHash(result);
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
  await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: POLYGON_CHAIN_ID }] });
  const chainId = await eth.request({ method: "eth_chainId" });
  if (chainId !== POLYGON_CHAIN_ID) throw new Error("Switch your EVM wallet to Polygon first.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const first = accounts?.[0];
  if (!first) throw new Error("No Ethereum address was shared.");
  return first;
}

/** Return an already-approved Polygon account without opening an approval dialog. */
export async function getConnectedPolygonAccount(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  const [chainId, accounts] = await Promise.all([
    eth.request({ method: "eth_chainId" }),
    eth.request({ method: "eth_accounts" }),
  ]);
  if (chainId !== POLYGON_CHAIN_ID || !Array.isArray(accounts)) return null;
  return typeof accounts[0] === "string" && accounts[0] ? accounts[0] : null;
}

/** Read the USDT (Polygon) balance for an address, in whole USDT. */
export async function readUsdtBalance(address: string): Promise<number> {
  const eth = getEthereum();
  if (!eth) throw new Error("No Ethereum wallet found in this browser.");
  const chainId = await eth.request({ method: "eth_chainId" });
  if (chainId !== POLYGON_CHAIN_ID) throw new Error("USDT balance requires Polygon.");
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
