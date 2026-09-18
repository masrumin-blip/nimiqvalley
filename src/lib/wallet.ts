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
