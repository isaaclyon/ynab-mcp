import type { Request } from "express";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const FORWARDING_HEADERS = [
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "cf-connecting-ip",
  "cf-ray",
] as const;

export function isLocalRequest(req: Request): boolean {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? "") && !hasForwardingHeaders(req);
}

export function isLoopbackUrl(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
}

function hasForwardingHeaders(req: Request): boolean {
  return FORWARDING_HEADERS.some((header) => req.header(header) !== undefined);
}
