'use strict';

const fxService = require('../../services/fxService');

const ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
                 xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube><Cube time='2026-06-18'>
    <Cube currency='USD' rate='1.0857'/>
    <Cube currency='JPY' rate='171.23'/>
  </Cube></Cube>
</gesmes:Envelope>`;

function fakeFetch(impl) {
  const calls = { n: 0 };
  const fn = async (url, opts) => { calls.n++; return impl(url, opts); };
  fn.calls = calls;
  return fn;
}

describe('fxService.getEurUsdRate', () => {
  beforeEach(() => fxService._resetCache());

  it('parses the EUR→USD rate from the ECB feed', () => {
    expect(fxService.parseEurUsd(ECB_XML)).toBe(1.0857);
  });

  it('fetches the live ECB rate', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: true, text: async () => ECB_XML }));
    const out = await fxService.getEurUsdRate({ fallback: 1.08, fetchImpl });
    expect(out).toMatchObject({ rate: 1.0857, source: 'ecb' });
  });

  it('serves a second call from cache (no second fetch)', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: true, text: async () => ECB_XML }));
    await fxService.getEurUsdRate({ fallback: 1.08, fetchImpl });
    const out = await fxService.getEurUsdRate({ fallback: 1.08, fetchImpl });
    expect(fetchImpl.calls.n).toBe(1);
    expect(out.source).toBe('cache');
  });

  it('falls back to the static rate when the feed fails', async () => {
    const fetchImpl = fakeFetch(() => { throw new Error('network down'); });
    const out = await fxService.getEurUsdRate({ fallback: 1.08, fetchImpl });
    expect(out).toMatchObject({ rate: 1.08, source: 'fallback' });
  });
});
