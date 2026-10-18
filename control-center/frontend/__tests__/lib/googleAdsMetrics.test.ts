import { aggregateSearchStream, fetchAdsSummary, missingAdsEnv, normalizeCustomerId } from '@/lib/googleAdsMetrics';

const FULL_ENV = {
    GOOGLE_ADS_DEVELOPER_TOKEN: 'dev-token',
    GOOGLE_ADS_CLIENT_ID: 'client-id',
    GOOGLE_ADS_CLIENT_SECRET: 'client-secret',
    GOOGLE_ADS_REFRESH_TOKEN: 'refresh',
    GOOGLE_ADS_CUSTOMER_ID: '123-456-7890',
} as unknown as NodeJS.ProcessEnv;

function jsonResponse(body: unknown, ok = true, status = 200) {
    return { ok, status, json: async () => body } as Response;
}

describe('googleAdsMetrics', () => {
    it('lista las variables que faltan', () => {
        expect(missingAdsEnv({} as NodeJS.ProcessEnv)).toHaveLength(5);
        expect(missingAdsEnv(FULL_ENV)).toEqual([]);
    });

    it('no llama a Google si faltan credenciales', async () => {
        const doFetch = jest.fn();
        const res = await fetchAdsSummary({} as NodeJS.ProcessEnv, doFetch as unknown as typeof fetch);
        expect(res.configured).toBe(false);
        expect(res.missing).toContain('GOOGLE_ADS_DEVELOPER_TOKEN');
        expect(doFetch).not.toHaveBeenCalled();
    });

    it('normaliza el ID de cliente quitando guiones', () => {
        expect(normalizeCustomerId('123-456-7890')).toBe('1234567890');
    });

    it('agrega las filas de searchStream con CTR, CPC y coste en euros', () => {
        const out = aggregateSearchStream([
            { results: [{ metrics: { impressions: '1000', clicks: '50', costMicros: '25000000', conversions: 2 } }] },
            { results: [{ metrics: { impressions: '1000', clicks: '50', costMicros: '25000000', conversions: 3 } }] },
        ]);
        expect(out.impressions).toBe(2000);
        expect(out.clicks).toBe(100);
        expect(out.costEur).toBe(50);
        expect(out.conversions).toBe(5);
        expect(out.ctrPct).toBe(5);
        expect(out.cpcEur).toBe(0.5);
    });

    it('sin impresiones devuelve CTR y CPC nulos', () => {
        const out = aggregateSearchStream([]);
        expect(out.ctrPct).toBeNull();
        expect(out.cpcEur).toBeNull();
    });

    it('pide OAuth y luego searchStream con la cabecera developer-token', async () => {
        const doFetch = jest
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
            .mockResolvedValueOnce(
                jsonResponse([{ results: [{ metrics: { impressions: '10', clicks: '1', costMicros: '2000000', conversions: 0 } }] }]),
            );
        const res = await fetchAdsSummary(FULL_ENV, doFetch as unknown as typeof fetch);

        expect(res.configured).toBe(true);
        expect(res.clicks).toBe(1);
        expect(res.costEur).toBe(2);
        const [url, init] = doFetch.mock.calls[1];
        expect(url).toContain('/customers/1234567890/googleAds:searchStream');
        expect(init.headers['developer-token']).toBe('dev-token');
        expect(init.headers.Authorization).toBe('Bearer at');
    });

    it('devuelve error legible si el OAuth falla, sin lanzar', async () => {
        const doFetch = jest.fn().mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, false, 400));
        const res = await fetchAdsSummary(FULL_ENV, doFetch as unknown as typeof fetch);
        expect(res.configured).toBe(true);
        expect(res.error).toContain('HTTP 400');
    });
});
