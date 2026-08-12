import { describe, expect, it } from "vitest";
import { createInstallationSession, readInstallationSession } from "./installation-session";

const SECRET = "a-secure-installation-secret-for-tests";

describe("installation session", () => {
  it("encrypts the installation id and restores it before expiry", () => {
    const session = createInstallationSession("loc_private", {
      secret: SECRET,
      now: new Date("2026-08-12T10:00:00.000Z"),
      lifetimeMs: 60_000
    });

    expect(session).not.toContain("loc_private");
    expect(
      readInstallationSession(session, {
        secret: SECRET,
        now: new Date("2026-08-12T10:00:59.000Z")
      })
    ).toBe("loc_private");
  });

  it("rejects an expired session", () => {
    const session = createInstallationSession("loc_expired", {
      secret: SECRET,
      now: new Date("2026-08-12T10:00:00.000Z"),
      lifetimeMs: 60_000
    });

    expect(() =>
      readInstallationSession(session, {
        secret: SECRET,
        now: new Date("2026-08-12T10:01:00.000Z")
      })
    ).toThrow("Installation session has expired");
  });

  it("rejects a tampered session", () => {
    const session = createInstallationSession("loc_private", { secret: SECRET });
    const parts = session.split(".");
    const ciphertext = parts[3] ?? "";
    const replacement = ciphertext.startsWith("A") ? "B" : "A";
    parts[3] = `${replacement}${ciphertext.slice(1)}`;

    expect(() => readInstallationSession(parts.join("."), { secret: SECRET })).toThrow(
      "Installation session is invalid"
    );
  });

  it("requires the production installation secret", () => {
    expect(() => createInstallationSession("loc_private", { secret: "short" })).toThrow(/24 characters/);
  });
});
