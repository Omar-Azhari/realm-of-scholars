/**
 * Private/loopback/link-local/multicast/reserved IP range checks (Phase
 * 18C, Part 3). Used both to reject a literal IP address used as a
 * hostname, and to check every address a hostname resolves to via DNS —
 * an allowlisted *name* isn't enough if its DNS record points at an
 * internal address.
 */

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    octets.push(n);
  }
  return octets;
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

/** Reasonably thorough, not exhaustive: loopback, unique-local, link-local, multicast, IPv4-mapped. */
function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local fe80::/10
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique-local fc00::/7
  if (normalized.startsWith("ff")) return true; // multicast ff00::/8
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (mapped) {
    const octets = parseIPv4(mapped[1]);
    return octets ? isPrivateIPv4(octets) : true; // unparsable mapped address: refuse rather than risk it
  }
  return false;
}

export function isLiteralIpAddress(host: string): boolean {
  const bare = host.toLowerCase().replace(/^\[|\]$/g, "");
  return parseIPv4(bare) !== null || bare.includes(":");
}

/** True if this address (v4 or v6, as returned by DNS or used directly as a hostname) is private/loopback/link-local/multicast/reserved and must never be fetched. */
export function isPrivateOrReservedAddress(address: string): boolean {
  const bare = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (bare.includes(":")) return isPrivateIPv6(bare);
  const octets = parseIPv4(bare);
  return octets ? isPrivateIPv4(octets) : true; // unparsable: refuse rather than risk it
}

export function isLocalhostName(host: string): boolean {
  const bare = host.toLowerCase();
  return bare === "localhost" || bare.endsWith(".localhost");
}
