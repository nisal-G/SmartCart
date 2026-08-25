const crypto = require('crypto');
const payhereService = require('../src/services/payhereService');

// A hand-computed reference value (independent of the implementation under
// test) so a bug that breaks the formula still fails this test, rather than
// generateHash and this test both agreeing with the same wrong formula.
function referenceHash({ merchantId, orderId, amount, currency, merchantSecret }) {
  const md5Upper = (input) =>
    crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
  const hashedSecret = md5Upper(merchantSecret);
  return md5Upper(`${merchantId}${orderId}${amount}${currency}${hashedSecret}`);
}

describe('payhereService.formatAmount', () => {
  test('formats a whole number with two decimal places', () => {
    expect(payhereService.formatAmount(1000)).toBe('1000.00');
  });

  test('formats a value that already has two decimal places', () => {
    expect(payhereService.formatAmount(1050.5)).toBe('1050.50');
  });

  test('rounds a value with more than two decimal places', () => {
    expect(payhereService.formatAmount(99.995)).toBe('100.00');
  });

  test('formats a string amount', () => {
    expect(payhereService.formatAmount('75')).toBe('75.00');
  });
});

describe('payhereService.generateHash', () => {
  const base = {
    merchantId: '1211149',
    orderId: '65a1f1e1e1e1e1e1e1e1e1e1',
    amount: 1050,
    currency: 'LKR',
    merchantSecret: 'MjkxOTQ0ODMzMTQ3MjkyMzQ4MjM0OTgyMzQ5',
  };

  test('matches an independently computed reference hash', () => {
    expect(payhereService.generateHash(base)).toBe(
      referenceHash({ ...base, amount: payhereService.formatAmount(base.amount) })
    );
  });

  test('is a 32-character uppercase hex string', () => {
    const hash = payhereService.generateHash(base);
    expect(hash).toMatch(/^[0-9A-F]{32}$/);
  });

  test('formats the amount to two decimal places before hashing (500 and 500.00 hash identically)', () => {
    expect(payhereService.generateHash({ ...base, amount: 500 })).toBe(
      payhereService.generateHash({ ...base, amount: '500.00' })
    );
  });

  test('changing the amount changes the hash', () => {
    const h1 = payhereService.generateHash(base);
    const h2 = payhereService.generateHash({ ...base, amount: 1051 });
    expect(h1).not.toBe(h2);
  });

  test('changing the currency changes the hash', () => {
    const h1 = payhereService.generateHash(base);
    const h2 = payhereService.generateHash({ ...base, currency: 'USD' });
    expect(h1).not.toBe(h2);
  });

  test('changing the order id changes the hash', () => {
    const h1 = payhereService.generateHash(base);
    const h2 = payhereService.generateHash({ ...base, orderId: 'a-different-order-id' });
    expect(h1).not.toBe(h2);
  });

  test('changing the merchant secret changes the hash (secret is actually mixed into the digest)', () => {
    const h1 = payhereService.generateHash(base);
    const h2 = payhereService.generateHash({ ...base, merchantSecret: 'a-different-secret' });
    expect(h1).not.toBe(h2);
  });
});

describe('payhereService.verifyNotificationSignature', () => {
  const merchantSecret = 'MjkxOTQ0ODMzMTQ3MjkyMzQ4MjM0OTgyMzQ5';
  const notification = {
    merchantId: '1211149',
    orderId: '65a1f1e1e1e1e1e1e1e1e1e1',
    payhereAmount: '1050.00',
    payhereCurrency: 'LKR',
    statusCode: '2',
  };

  // Build a correct md5sig the same way PayHere is documented to.
  function correctMd5sig() {
    const md5Upper = (input) =>
      crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
    const hashedSecret = md5Upper(merchantSecret);
    return md5Upper(
      `${notification.merchantId}${notification.orderId}${notification.payhereAmount}${notification.payhereCurrency}${notification.statusCode}${hashedSecret}`
    );
  }

  test('accepts a correctly-signed notification', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      merchantSecret,
      md5sig: correctMd5sig(),
    });
    expect(valid).toBe(true);
  });

  test('accepts a correctly-signed notification even if md5sig arrives lowercase', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      merchantSecret,
      md5sig: correctMd5sig().toLowerCase(),
    });
    expect(valid).toBe(true);
  });

  test('rejects a tampered amount', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      payhereAmount: '1.00',
      merchantSecret,
      md5sig: correctMd5sig(), // signed for the ORIGINAL amount
    });
    expect(valid).toBe(false);
  });

  test('rejects a tampered status code', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      statusCode: '-1',
      merchantSecret,
      md5sig: correctMd5sig(), // signed for status_code '2'
    });
    expect(valid).toBe(false);
  });

  test('rejects the wrong merchant secret', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      merchantSecret: 'wrong-secret',
      md5sig: correctMd5sig(),
    });
    expect(valid).toBe(false);
  });

  test('rejects a garbage md5sig', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      merchantSecret,
      md5sig: 'not-a-real-signature',
    });
    expect(valid).toBe(false);
  });

  test('rejects a missing md5sig', () => {
    const valid = payhereService.verifyNotificationSignature({
      ...notification,
      merchantSecret,
      md5sig: undefined,
    });
    expect(valid).toBe(false);
  });
});

describe('payhereService.mapStatusCode', () => {
  test.each([
    ['2', 'paid'],
    [2, 'paid'],
    ['0', 'pending'],
    ['-1', 'cancelled'],
    ['-2', 'failed'],
    ['-3', 'charged_back'],
  ])('maps status_code %p to %p', (code, expected) => {
    expect(payhereService.mapStatusCode(code)).toBe(expected);
  });

  test('returns null for an unrecognized status code', () => {
    expect(payhereService.mapStatusCode('99')).toBeNull();
    expect(payhereService.mapStatusCode(undefined)).toBeNull();
  });
});

describe('payhereService.amountsMatch', () => {
  test('matches equal amounts regardless of string/number formatting', () => {
    expect(payhereService.amountsMatch(500, '500.00')).toBe(true);
    expect(payhereService.amountsMatch('225.00', 225)).toBe(true);
  });

  test('does not match different amounts', () => {
    expect(payhereService.amountsMatch(450, 100)).toBe(false);
  });

  test('is tolerant of binary floating point representation, not of real differences', () => {
    expect(payhereService.amountsMatch(0.1 + 0.2, 0.3)).toBe(true);
    expect(payhereService.amountsMatch(10.01, 10.02)).toBe(false);
  });
});
