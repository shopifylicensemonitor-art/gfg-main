import { describe, it, expect } from "vitest";
import { parseCSV, suggestFieldMapping, extractEmailsAndUrlsFromCell } from "../lib/csvParser";

describe("csvParser", () => {
  describe("parseCSV", () => {
    it("should parse standard CSV with headers correctly", () => {
      const csv = `Email,Name,Store
john@example.com,John Doe,John's Shop
jane@example.com,Jane Doe,Jane's Shop`;
      const result = parseCSV(csv);
      expect(result.headers).toEqual(["Email", "Name", "Store"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]["Email"]).toBe("john@example.com");
      expect(result.rows[0]["Name"]).toBe("John Doe");
      expect(result.rows[1]["Email"]).toBe("jane@example.com");
    });

    it("should parse single-column CSV with header", () => {
      const csv = `email
john@example.com
jane@example.com`;
      const result = parseCSV(csv);
      expect(result.headers).toEqual(["email"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]["email"]).toBe("john@example.com");
      expect(result.rows[1]["email"]).toBe("jane@example.com");
    });

    it("should detect and parse single-column headerless list of emails", () => {
      const csv = `john@example.com
jane@example.com
bob@example.com`;
      const result = parseCSV(csv);
      expect(result.headers).toEqual(["Email"]);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]["Email"]).toBe("john@example.com");
      expect(result.rows[1]["Email"]).toBe("jane@example.com");
      expect(result.rows[2]["Email"]).toBe("bob@example.com");
    });

    it("should detect and parse multi-column headerless CSV", () => {
      const csv = `john@example.com,John Doe,Shop A
jane@example.com,Jane Doe,Shop B`;
      const result = parseCSV(csv);
      expect(result.headers).toEqual(["Email", "Column_2", "Column_3"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]["Email"]).toBe("john@example.com");
      expect(result.rows[0]["Column_2"]).toBe("John Doe");
      expect(result.rows[1]["Email"]).toBe("jane@example.com");
      expect(result.rows[1]["Column_2"]).toBe("Jane Doe");
    });
  });

  describe("suggestFieldMapping", () => {
    it("should map email-like headers correctly", () => {
      expect(suggestFieldMapping("Email")).toBe("email");
      expect(suggestFieldMapping("Email Address")).toBe("email");
      expect(suggestFieldMapping("contact_email")).toBe("email");
      expect(suggestFieldMapping("Email_1")).toBe("email");
    });

    it("should map name-like headers correctly", () => {
      expect(suggestFieldMapping("First Name")).toBe("first_name");
      expect(suggestFieldMapping("Name")).toBe("first_name");
      expect(suggestFieldMapping("fname")).toBe("first_name");
    });

    it("should map store-like headers correctly", () => {
      expect(suggestFieldMapping("Store Name")).toBe("store_name");
      expect(suggestFieldMapping("Website")).toBe("store_name");
      expect(suggestFieldMapping("Brand")).toBe("store_name");
    });
  });

  describe("extractEmailsAndUrlsFromCell", () => {
    it("should parse multi-email strings with urls cleanly", () => {
      const cell = "accessibility@nepenthesamerica.com:shop@nepenthesla.com:shop@nepenthesny.com • https://nepenthesamerica.com";
      const result = extractEmailsAndUrlsFromCell(cell);
      expect(result.emails).toEqual([
        "accessibility@nepenthesamerica.com",
        "shop@nepenthesla.com",
        "shop@nepenthesny.com"
      ]);
      expect(result.url).toBe("https://nepenthesamerica.com");
    });

    it("should parse clean single emails without urls", () => {
      const cell = "john@example.com";
      const result = extractEmailsAndUrlsFromCell(cell);
      expect(result.emails).toEqual(["john@example.com"]);
      expect(result.url).toBe("");
    });

    it("should extract simple domain if no protocol in url", () => {
      const cell = "shop@nepenthesla.com • nepenthesla.com";
      const result = extractEmailsAndUrlsFromCell(cell);
      expect(result.emails).toEqual(["shop@nepenthesla.com"]);
      expect(result.url).toBe("nepenthesla.com");
    });
  });
});
