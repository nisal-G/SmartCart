const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'SmartCart';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

/**
 * Builds the options object the frontend passes to
 * `@simplewebauthn/browser`'s startRegistration().
 */
async function buildRegistrationOptions(user, excludeCredentials = []) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new Uint8Array(Buffer.from(user._id.toString(), 'hex')),
    attestationType: 'none', // we don't need attestation provenance, only a verifiable key
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
}

async function verifyRegistration(response, expectedChallenge) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });
}

/**
 * Builds the options object for `startAuthentication()`. `allowCredentials`
 * should be omitted (undefined) for a fully usernameless/discoverable flow;
 * we pass it explicitly since we ask for an email first (see authController).
 */
async function buildAuthenticationOptions(allowCredentials = []) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'preferred',
  });
}

async function verifyAuthentication(response, expectedChallenge, credential) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential,
  });
}

module.exports = {
  buildRegistrationOptions,
  verifyRegistration,
  buildAuthenticationOptions,
  verifyAuthentication,
};
