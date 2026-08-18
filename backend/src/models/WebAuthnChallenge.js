const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Short-lived storage for the random challenge issued during a WebAuthn
 * ceremony (registration or authentication). Kept in its own TTL-indexed
 * collection rather than on the User document so:
 *   - it works for brand-new users who don't have a session yet, and
 *   - it never lingers: MongoDB automatically deletes the document
 *     `expiresAfterSeconds` after `createdAt`, no cron/cleanup job needed.
 */
const webAuthnChallengeSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  challenge: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['registration', 'authentication'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // TTL: document is removed 5 minutes after creation
  },
});

module.exports = mongoose.model('WebAuthnChallenge', webAuthnChallengeSchema);
