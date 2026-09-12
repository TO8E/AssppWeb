import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlist } from "../../src/apple/plist";
import { authenticate } from "../../src/apple/authenticate";
import { appleRequest } from "../../src/apple/request";
import { fetchBag } from "../../src/apple/bag";
import { prepareSigner, signAction } from "../../src/apple/sap/client";

vi.mock("../../src/apple/sap/client", () => ({
  prepareSigner: vi.fn(),
  signAction: vi.fn(),
}));

vi.mock("../../src/apple/request", () => ({
  appleRequest: vi.fn(),
}));

vi.mock("../../src/apple/bag", () => ({
  fetchBag: vi.fn(),
  defaultAuthURL:
    "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate",
}));

describe("apple/authenticate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prepareSigner).mockResolvedValue(undefined);
    vi.mocked(signAction).mockResolvedValue(new Uint8Array([1, 2, 3, 255]));
    vi.mocked(fetchBag).mockResolvedValue({
      authURL:
        "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate?foo=1&guid=old-value",
    });
    vi.mocked(appleRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      rawHeaders: [],
      body: buildPlist({
        accountInfo: {
          appleId: "test@example.com",
          address: {
            firstName: "Test",
            lastName: "User",
          },
        },
        passwordToken: "token",
        dsPersonId: "123",
      }),
    });

  });

  it("sets guid query exactly once from bag endpoint", async () => {
    await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    const requestCall = vi.mocked(appleRequest).mock.calls[0][0];
    const endpoint = new URL(`https://${requestCall.host}${requestCall.path}`);

    expect(endpoint.searchParams.get("guid")).toBe("aabbccddeeff");
    expect(endpoint.searchParams.getAll("guid")).toHaveLength(1);
    expect(endpoint.searchParams.get("foo")).toBe("1");
    expect(prepareSigner).toHaveBeenCalledWith("aabbccddeeff", undefined);
    expect(requestCall.headers?.["X-Apple-ActionSignature"]).toBe("AQID/w==");
    expect(new TextDecoder().decode(vi.mocked(signAction).mock.calls[0][0]))
      .toBe(requestCall.body);
  });

  it("preserves the complete storefront header for authenticated requests", async () => {
    vi.mocked(appleRequest).mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: { "x-set-apple-store-front": "143465-19,34" },
      rawHeaders: [],
      body: buildPlist({
        accountInfo: {
          appleId: "test@example.com",
          address: { firstName: "Test", lastName: "User" },
        },
        passwordToken: "token",
        dsPersonId: "123",
      }),
    });

    const account = await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    expect(account.store).toBe("143465");
    expect(account.storeFront).toBe("143465-19,34");
  });

  it("signs the updated body on a two-factor retry", async () => {
    // Reuse the successful response shape from the normal login path.
    await authenticate("test@example.com", "password", "123456", undefined, "aabbccddeeff");
    const request = vi.mocked(appleRequest).mock.calls[0][0];
    expect(request.body).toContain("password123456");
    expect(new TextDecoder().decode(vi.mocked(signAction).mock.calls[0][0]))
      .toBe(request.body);
    expect(request.headers?.["X-Apple-ActionSignature"]).toBe("AQID/w==");
  });

  it("does not send an unsigned login when signer setup fails", async () => {
    vi.mocked(prepareSigner).mockRejectedValueOnce(new Error("setup failed"));
    await expect(authenticate("test@example.com", "password", undefined, undefined, "aabbccddeeff"))
      .rejects.toThrow("setup failed");
    expect(appleRequest).not.toHaveBeenCalled();
  });
});
