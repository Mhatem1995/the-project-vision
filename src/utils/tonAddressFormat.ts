
/**
 * Utility to convert raw TON address (0:...) to user-friendly (base64) TON address if possible.
 */
import { Address } from "@ton/core";

/**
 * Converts a raw TON address (0:...) to user-friendly (e.g. 'u...' or 'EQ...') format.
 * Returns the input if already user-friendly.
 */
export function toUserFriendlyTonAddress(address: string): string {
  try {
    // Accept raw and user-friendly formats.
    const addr = Address.parse(address);
    return addr.toString({ testOnly: false, bounceable: true, urlSafe: true });
  } catch {
    // Not a valid address
    return address;
  }
}
