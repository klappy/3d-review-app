/** S27 (0.24.1 persona A): a passage link added without a title showed as "example.org". */
import { describe, expect, it } from "vitest";
import { linkTitle } from "../src/link-title";

describe("default title of an untitled passage link", () => {
  it("is the link's host and path, never the bare host", () => {
    expect(linkTitle("https://example.org/sample-genesis-1")).toBe("example.org/sample-genesis-1");
    expect(linkTitle("https://www.example.org/bible/GEN/1/")).toBe("example.org/bible/GEN/1");
    expect(linkTitle("https://example.org/Juan%201")).toBe("example.org/Juan 1");
    expect(linkTitle("https://example.org/bad%E0%A4")).toBe("example.org/bad%E0%A4");
  });
  it("is \"Link\" when there is no path to show, and stays within the title limit", () => {
    expect(linkTitle("https://example.org")).toBe("Link");
    expect(linkTitle("https://example.org/")).toBe("Link");
    expect(linkTitle("not a url")).toBe("Link");
    const long = linkTitle(`https://example.org/${"a".repeat(300)}`);
    expect(long).toHaveLength(120);
    expect(long.endsWith("…")).toBe(true);
  });
});
