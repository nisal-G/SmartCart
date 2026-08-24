const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

/**
 * A single registered WebAuthn (Passkey) credential.
 * Only what the server needs to verify future assertions is stored —
 * never anything that could reconstruct the authenticator's private key.
 * See: https://www.w3.org/TR/webauthn-3/
 */
const passkeySchema = new Schema(
  {
    credentialId: { type: String, required: true }, // base64url, unique across ALL users
    publicKey: { type: Buffer, required: true }, // COSE public key
    counter: { type: Number, required: true, default: 0 }, // replay-attack guard
    transports: [{ type: String }], // e.g. ['internal', 'hybrid']
    deviceType: { type: String, enum: ['singleDevice', 'multiDevice'] },
    backedUp: { type: Boolean, default: false },
    nickname: { type: String, trim: true, maxlength: 60 },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
  },
  { _id: false }
);

/**
 * A hashed, rotating refresh token issued to one device/session.
 * The raw token is never stored — only its SHA-256 hash — so a DB leak
 * alone cannot be used to mint sessions.
 */
const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ip: { type: String },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    avatarUrl: {
      type: String,
      trim: true,
    },

    // Only ever populated for admin accounts created via the seed script.
    // Regular shoppers authenticate via Google, Facebook, or Passkey only
    // (per SRS §1.1/§3.1) and never have a password set.
    password: {
      type: String,
      select: false,
    },

    // Linked OAuth identities. A user may have one, both, or neither
    // (passkey-only accounts are valid).
    providers: {
      google: {
        id: { type: String },
        email: { type: String },
      },
      facebook: {
        id: { type: String },
        email: { type: String },
      },
    },

    passkeys: [passkeySchema],

    refreshTokens: [refreshTokenSchema],

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },

    // 'pending' = passkey registration was started but never completed
    // (see authController.passkeyRegisterOptions); such accounts cannot log in.
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'active',
      required: true,
    },

    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// --- Indexes -----------------------------------------------------------
// email already gets a unique index from `unique: true` above.
userSchema.index(
  { 'providers.google.id': 1 },
  { unique: true, sparse: true }
);
userSchema.index(
  { 'providers.facebook.id': 1 },
  { unique: true, sparse: true }
);
// Sparse + unique multikey index: enforces a credentialId can belong to
// only one user document across the whole collection.
userSchema.index(
  { 'passkeys.credentialId': 1 },
  { unique: true, sparse: true }
);

// --- Hooks ---------------------------------------------------------------
// Mongoose awaits async pre-hooks automatically — no `next` callback needed
// (and declaring one changes how Mongoose's Kareem library invokes this fn).
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// --- Instance methods ------------------------------------------------------
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

// Strip everything that should never leave the server, even accidentally
// (e.g. a stray `res.json(user)` instead of a controller-built DTO).
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.refreshTokens;
    if (ret.passkeys) {
      ret.passkeys = ret.passkeys.map((pk) => ({
        credentialId: pk.credentialId,
        nickname: pk.nickname,
        transports: pk.transports,
        createdAt: pk.createdAt,
        lastUsedAt: pk.lastUsedAt,
      }));
    }
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
