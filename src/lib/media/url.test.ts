import { describe, expect, it } from "vitest";
import {
  isMediaBucket,
  mediaProxyUrl,
  rewriteStorageUrlForBrowser,
} from "./url";

describe("mediaProxyUrl", () => {
  it("builds a same-origin query URL", () => {
    expect(mediaProxyUrl("household-media", "hh/recipes/a.jpg")).toBe(
      "/api/media?bucket=household-media&path=hh%2Frecipes%2Fa.jpg",
    );
  });
});

describe("isMediaBucket", () => {
  it("allows known buckets only", () => {
    expect(isMediaBucket("household-media")).toBe(true);
    expect(isMediaBucket("community-media")).toBe(true);
    expect(isMediaBucket("other")).toBe(false);
  });
});

describe("rewriteStorageUrlForBrowser", () => {
  it("leaves relative URLs alone", () => {
    expect(rewriteStorageUrlForBrowser("/api/media?path=x")).toBe("/api/media?path=x");
  });

  it("proxies loopback signed URLs when path is known", () => {
    const signed =
      "http://127.0.0.1:54321/storage/v1/object/sign/household-media/hh/a.jpg?token=abc";
    expect(
      rewriteStorageUrlForBrowser(signed, {
        bucket: "household-media",
        path: "hh/a.jpg",
      }),
    ).toBe("/api/media?bucket=household-media&path=hh%2Fa.jpg");
  });

  it("upgrades remote http storage to https", () => {
    const url =
      "http://xyzcompany.supabase.co/storage/v1/object/sign/household-media/a.jpg?token=1";
    expect(rewriteStorageUrlForBrowser(url)).toMatch(/^https:\/\//);
  });
});
