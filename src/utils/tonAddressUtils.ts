
/**
 * Utility for converting TON addresses between formats.
 * Only user-friendly (base64, UQ.../EQ...) should ever be saved/used.
 */
import { Address } from '@ton/core';

export function toUserFriendlyAddress(address: string): string {
  try {
    if (!address) return "";
    // Already user-friendly (UQ.../EQ...)
    if (/^(UQ|EQ)[A-Za-z0-9_-]{40,}$/.test(address)) {
      return address;
    }
    // If it's a raw (0:...) format, convert
    if (/^0:[a-fA-F0-9]{64}$/.test(address)) {
      const addr = Address.parse(address);
      return addr.toString({ testOnly: false });
    }
    // Unknown or already friendly
    return address;
  } catch (e) {
    console.warn("[TON-ADDR] Invalid TON address for conversion:", address, e);
    return address;
  }
}
