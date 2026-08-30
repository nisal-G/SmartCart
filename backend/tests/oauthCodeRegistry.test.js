const oauthCodeRegistry = require('../src/services/oauthCodeRegistry');

afterEach(() => {
  oauthCodeRegistry.reset();
});

describe('oauthCodeRegistry (one exchange per authorization code)', () => {
  test('the first claim on a code owns it; every later one is a duplicate', () => {
    const first = oauthCodeRegistry.claim('facebook', 'CODE_A');
    const second = oauthCodeRegistry.claim('facebook', 'CODE_A');
    const third = oauthCodeRegistry.claim('facebook', 'CODE_A');

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(third.duplicate).toBe(true);
  });

  test('a duplicate arriving mid-exchange waits for the owner instead of starting its own', async () => {
    // The proxy-retry case: a second request for the same code arrives
    // while the first is still talking to the provider. It must not race
    // ahead with an exchange of its own — it resolves from the owner's.
    const owner = oauthCodeRegistry.claim('facebook', 'CODE_B');
    const retry = oauthCodeRegistry.claim('facebook', 'CODE_B');

    let settled = false;
    const waiting = retry.outcome().then((outcome) => {
      settled = true;
      return outcome;
    });

    await Promise.resolve();
    expect(settled).toBe(false); // still blocked on the owner

    owner.settle({ ok: true, userId: 'user-1' });

    await expect(waiting).resolves.toEqual({ ok: true, userId: 'user-1' });
  });

  test('the owner settling twice keeps the first outcome', async () => {
    const owner = oauthCodeRegistry.claim('facebook', 'CODE_C');
    owner.settle({ ok: true, userId: 'user-1' });
    owner.settle({ ok: false, reason: 'incomplete' });

    const duplicate = oauthCodeRegistry.claim('facebook', 'CODE_C');
    await expect(duplicate.outcome()).resolves.toEqual({ ok: true, userId: 'user-1' });
  });

  test('the same code string for different providers is tracked separately', () => {
    oauthCodeRegistry.claim('facebook', 'SHARED');
    expect(oauthCodeRegistry.claim('google', 'SHARED').duplicate).toBe(false);
  });

  test('reset clears every claim', () => {
    oauthCodeRegistry.claim('facebook', 'CODE_D');
    oauthCodeRegistry.reset();
    expect(oauthCodeRegistry.claim('facebook', 'CODE_D').duplicate).toBe(false);
  });
});
