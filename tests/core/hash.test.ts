import { describe, it, expect } from "vitest";
import { canonicalize, contentHash, verifyHash } from "../../src/core/hash.js";

describe("canonicalize", () => {
  it("sorts keys recursively", () => {
    const obj = { z: 1, a: { c: 3, b: 2 } };
    const result = JSON.parse(canonicalize(obj));
    expect(Object.keys(result)).toEqual(["a", "z"]);
    expect(Object.keys(result.a)).toEqual(["b", "c"]);
  });

  it("strips the hash field", () => {
    const obj = { name: "test", hash: { content_hash: "sha256:abc" } };
    const result = JSON.parse(canonicalize(obj));
    expect(result.hash).toBeUndefined();
  });

  it("handles arrays", () => {
    const obj = { items: [{ z: 1, a: 2 }, { y: 3, b: 4 }] };
    const result = JSON.parse(canonicalize(obj));
    expect(Object.keys(result.items[0])).toEqual(["a", "z"]);
    expect(Object.keys(result.items[1])).toEqual(["b", "y"]);
  });

  it("handles null and undefined values", () => {
    const obj = { a: null, b: undefined, c: 1 };
    const result = canonicalize(obj);
    expect(result).toContain('"a":null');
    expect(result).toContain('"c":1');
  });
});

describe("contentHash", () => {
  it("produces deterministic hashes", () => {
    const obj = { name: "test", value: 42 };
    const hash1 = contentHash(obj);
    const hash2 = contentHash(obj);
    expect(hash1).toBe(hash2);
  });

  it("is deterministic over 100 iterations", () => {
    const obj = {
      spectra: { type: "feature", id: "feat:test" },
      identity: { title: "Test", domain: ["security"] },
    };
    const first = contentHash(obj);
    for (let i = 0; i < 100; i++) {
      expect(contentHash(obj)).toBe(first);
    }
  });

  it("produces same hash regardless of key order", () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    expect(contentHash(obj1)).toBe(contentHash(obj2));
  });

  it("produces different hashes for different content", () => {
    const obj1 = { name: "test1" };
    const obj2 = { name: "test2" };
    expect(contentHash(obj1)).not.toBe(contentHash(obj2));
  });

  it("returns sha256: prefixed string", () => {
    const hash = contentHash({ test: true });
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("ignores hash field in computation", () => {
    const obj1 = { name: "test" };
    const obj2 = { name: "test", hash: { content_hash: "sha256:old" } };
    expect(contentHash(obj1)).toBe(contentHash(obj2));
  });
});

describe("verifyHash", () => {
  it("returns true for matching hash", () => {
    const obj = { name: "test" };
    const hash = contentHash(obj);
    expect(verifyHash(obj, hash)).toBe(true);
  });

  it("returns false for non-matching hash", () => {
    const obj = { name: "test" };
    expect(verifyHash(obj, "sha256:0000000000000000000000000000000000000000000000000000000000000000")).toBe(false);
  });
});
