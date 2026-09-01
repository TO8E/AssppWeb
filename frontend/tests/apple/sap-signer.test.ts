import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlist } from '../../src/apple/plist';
import { Signer } from '../../src/apple/sap/signer';
import { Machine, type AssetBundle } from '../../src/apple/sap/machine';

vi.mock('../../src/apple/sap/machine', () => ({ Machine: { open: vi.fn() } }));

describe('SAP setup response parsing', () => {
  const machine = {
    initialize: vi.fn(), exchange: vi.fn(), sign: vi.fn(),
    teardown: vi.fn(), close: vi.fn(),
  };
  const config = {
    version: 200,
    hardwareID: new Uint8Array([1, 2, 3, 4, 5, 6]),
    certificateURL: 'https://s.mzstatic.com/sap/setupCert.plist',
    setupURL: 'https://fpinit.itunes.apple.com/v1/signSapSetup/legacy',
  };
  const encode = (xml: string) => new TextEncoder().encode(xml);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(Machine.open).mockResolvedValue(machine as unknown as Machine);
    machine.initialize.mockReturnValue(42n);
    machine.exchange.mockReturnValueOnce({ state: 1, output: new Uint8Array([7, 8]) })
      .mockReturnValueOnce({ state: 0, output: new Uint8Array() });
  });

  it('accepts whitespace in Apple certificate and setup plists', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(encode('<plist><dict>\n<key>sign-sap-setup-cert</key>\n<data>\n AQID\n</data></dict></plist>'))
      .mockResolvedValueOnce(encode(buildPlist({ 'sign-sap-setup-buffer': new Uint8Array([4, 5, 6]) })));
    await Signer.create({} as AssetBundle, config, transport);
    expect(machine.exchange).toHaveBeenNthCalledWith(1, 200, config.hardwareID, 42n, new Uint8Array([1, 2, 3]));
    expect(machine.exchange).toHaveBeenNthCalledWith(2, 200, config.hardwareID, 42n, new Uint8Array([4, 5, 6]));
    expect(machine.close).not.toHaveBeenCalled();
  });

  it('closes the emulator when the certificate response has no data', async () => {
    const transport = vi.fn().mockResolvedValue(encode('<plist><dict /></plist>'));
    await expect(Signer.create({} as AssetBundle, config, transport))
      .rejects.toThrow('Apple plist is missing sign-sap-setup-cert');
    expect(machine.close).toHaveBeenCalledOnce();
    expect(machine.exchange).not.toHaveBeenCalled();
  });
});
