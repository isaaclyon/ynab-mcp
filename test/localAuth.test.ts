import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { isLocalRequest, isLoopbackUrl } from "../src/http/local.js";

describe("isLocalRequest", () => {
  it("allows loopback socket addresses", () => {
    expect(isLocalRequest(requestWithRemoteAddress("127.0.0.1", "evil.example"))).toBe(true);
    expect(isLocalRequest(requestWithRemoteAddress("::1", "evil.example"))).toBe(true);
    expect(isLocalRequest(requestWithRemoteAddress("::ffff:127.0.0.1", "evil.example"))).toBe(true);
  });

  it("does not trust spoofable hostname headers for dev auth bypass", () => {
    expect(isLocalRequest(requestWithRemoteAddress("203.0.113.10", "localhost"))).toBe(false);
    expect(isLocalRequest(requestWithRemoteAddress("203.0.113.10", "127.0.0.1"))).toBe(false);
  });

  it("does not allow bypass for forwarded tunnel/proxy traffic", () => {
    expect(isLocalRequest(requestWithRemoteAddress("127.0.0.1", "localhost", { "x-forwarded-for": "203.0.113.10" }))).toBe(false);
    expect(isLocalRequest(requestWithRemoteAddress("127.0.0.1", "localhost", { "cf-connecting-ip": "203.0.113.10" }))).toBe(false);
  });

  it("identifies loopback public base URLs", () => {
    expect(isLoopbackUrl(new URL("http://localhost:3000"))).toBe(true);
    expect(isLoopbackUrl(new URL("http://127.0.0.1:3000"))).toBe(true);
    expect(isLoopbackUrl(new URL("https://ynab.example.test"))).toBe(false);
  });
});

function requestWithRemoteAddress(
  remoteAddress: string,
  hostname: string,
  headers: Record<string, string> = {},
): Request {
  return {
    hostname,
    socket: { remoteAddress },
    header: (name: string) => headers[name.toLowerCase()],
  } as Request;
}
