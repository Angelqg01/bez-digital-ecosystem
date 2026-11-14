/**
 * services/rwaUsd — equivalencias en USD con el precio real del BEZ (0,0075 USD).
 */
const { ethers } = require('ethers');
const { usdDeBez, usdDeBezWei, precioBezUsd } = require('../../services/rwaUsd');

describe('rwaUsd', () => {
    const env = { BEZ_PRICE_USD: '0.0075' };

    it('usa el precio real de la fase semilla, 0,0075 USD por BEZ', () => {
        expect(precioBezUsd({})).toBe(0.0075);
        expect(usdDeBez('1', env)).toBe('0.01'); // 0,0075 redondea al céntimo
        expect(usdDeBez('100', env)).toBe('0.75');
        expect(usdDeBez('133333.333333333333333333', env)).toBe('1000.00');
    });

    it('1.333,33 BEZ ≈ 10 USD y 13.333,33 BEZ ≈ 100 USD', () => {
        expect(usdDeBez('1333.333333333333333333', env)).toBe('10.00');
        expect(usdDeBez('13333.333333333333333333', env)).toBe('100.00');
    });

    it('trabaja en wei, sin coma flotante, y cero es cero', () => {
        expect(usdDeBezWei(0n, env)).toBe('0.00');
        expect(usdDeBezWei(ethers.parseEther('2000000'), env)).toBe('15000.00');
        expect(usdDeBezWei(ethers.parseEther('0.000000000000000001'), env)).toBe('0.00');
    });

    it('respeta BEZ_PRICE_USD si cambia, y rechaza uno mal escrito', () => {
        expect(usdDeBez('100', { BEZ_PRICE_USD: '0.1' })).toBe('10.00');
        expect(() => usdDeBez('100', { BEZ_PRICE_USD: '0,0075' })).toThrow();
    });
});
