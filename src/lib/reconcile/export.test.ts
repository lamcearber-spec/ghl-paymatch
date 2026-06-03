import { describe, expect, it } from "vitest";
import { toCsv } from "./export";

describe("toCsv", () => {
  it("writes stable headers and escapes commas, quotes, and new lines", () => {
    const csv = toCsv([
      {
        customer: "Acme, GmbH",
        note: "Needs \"review\"\nwith bookkeeper",
        amountCents: 12000
      }
    ]);

    expect(csv).toBe(
      "customer,note,amountCents\r\n\"Acme, GmbH\",\"Needs \"\"review\"\"\nwith bookkeeper\",12000"
    );
  });
});
