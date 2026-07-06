'use strict';

// Region-based currency acceptance for the bank webhook.
// European-region IBANs settle in EUR, the rest of the world in USD; EUR is
// converted to USD cents via the explicit configured FX rate.

const webhooks = require('../../routes/webhooks');
const { regionCurrencyForIban, toUsdCents } = webhooks;

describe('bank webhook — region currency', () => {
  it('maps European IBAN countries to EUR', () => {
    expect(regionCurrencyForIban('ES7714650100911766376210')).toBe('EUR');
    expect(regionCurrencyForIban('DE89370400440532013000')).toBe('EUR');
    expect(regionCurrencyForIban('fr1420041010050500013m02606')).toBe('EUR'); // case-insensitive
  });

  it('maps the rest of the world to USD', () => {
    expect(regionCurrencyForIban('US64SVBKUS6S3300958879')).toBe('USD');
    expect(regionCurrencyForIban('AE070331234567890123456')).toBe('USD');
    expect(regionCurrencyForIban('')).toBe('USD'); // unknown → USD default
  });

  it('passes USD through unchanged (rate irrelevant)', () => {
    expect(toUsdCents(150000, 'USD', 1.08)).toBe(150000);
  });

  it('converts EUR to USD cents via the supplied rate', () => {
    expect(toUsdCents(100000, 'EUR', 1.0857)).toBe(Math.round(100000 * 1.0857));
  });

  it('rejects an unsupported currency', () => {
    expect(toUsdCents(100000, 'GBP', 1.08)).toBeNull();
  });
});
