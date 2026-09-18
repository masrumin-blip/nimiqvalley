import { ed25519 } from "@noble/curves/ed25519";
import { blake2b } from "@noble/hashes/blake2";
import { sha256 } from "@noble/hashes/sha2";

const NIMIQ_BASE32_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVXY";
const SIGNED_MESSAGE_PREFIX = "\u0016Nimiq Signed Message:\n";

function decodeKeyMaterial(raw: string): Uint8Array {
  const value = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    const output = new Uint8Array(value.length / 2);
    for (let index = 0; index < output.length; index += 1) {
      output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return output;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeNimiqAddress(address: string): Uint8Array {
  const compact = address.replace(/\s/g, "").toUpperCase();
  if (!/^NQ[0-9]{2}[0-9A-Z]{32}$/.test(compact)) throw new Error("Invalid Nimiq address");

  const encoded = compact.slice(4);
  let shift = 8;
  let carry = 0;
  const output: number[] = [];

  for (const character of encoded) {
    const symbol = NIMIQ_BASE32_ALPHABET.indexOf(character);
    if (symbol < 0) throw new Error("Invalid Nimiq address");
    shift -= 5;
    if (shift > 0) {
      carry |= symbol << shift;
    } else if (shift < 0) {
      output.push(carry | (symbol >> -shift));
      shift += 8;
      carry = (symbol << shift) & 0xff;
    } else {
      output.push(carry | symbol);
      shift = 8;
      carry = 0;
    }
  }

  return Uint8Array.from(output);
}

function equalBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }
  return difference === 0;
}

export function publicKeyMatchesAddress(publicKey: Uint8Array, address: string): boolean {
  if (publicKey.length !== 32) return false;
  const derivedAddress = blake2b(publicKey, { dkLen: 32 }).subarray(0, 20);
  return equalBytes(derivedAddress, decodeNimiqAddress(address));
}

export function verifyNimiqLoginSignature(
  publicKeyEncoded: string,
  signatureEncoded: string,
  message: string,
): string | null {
  const publicKey = decodeKeyMaterial(publicKeyEncoded);
  const signature = decodeKeyMaterial(signatureEncoded);
  if (publicKey.length !== 32 || signature.length !== 64) {
    throw new Error("Invalid wallet key material length");
  }

  const encoder = new TextEncoder();
  const raw = encoder.encode(message);
  const payloads: Array<[string, Uint8Array]> = [
    ["prefix+len", encoder.encode(`${SIGNED_MESSAGE_PREFIX}${raw.length}${message}`)],
    ["prefix", encoder.encode(`${SIGNED_MESSAGE_PREFIX}${message}`)],
    ["raw", raw],
  ];

  for (const [label, payload] of payloads) {
    const candidates: Array<[string, Uint8Array]> = [
      [`sha256(${label})`, sha256(payload)],
      [`blake2b(${label})`, blake2b(payload, { dkLen: 32 })],
      [label, payload],
    ];
    for (const [candidateLabel, candidate] of candidates) {
      if (ed25519.verify(signature, candidate, publicKey, { zip215: false })) return candidateLabel;
    }
  }

  return null;
}

export function decodeNimiqPublicKey(encoded: string): Uint8Array {
  return decodeKeyMaterial(encoded);
}