/**
 * Creates (or updates the password of) an admin account.
 *
 * There is deliberately no public "register as admin" HTTP endpoint —
 * admin accounts are provisioned out-of-band by whoever controls the
 * server/database, via this script.
 *
 * Usage:
 *   node src/scripts/seedAdmin.js --email admin@example.com --password "Str0ng!Pass" --name "Site Admin"
 *
 * Or set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in the environment and
 * run with no flags.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    out[key] = args[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const email = (args.email || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = args.password || process.env.ADMIN_PASSWORD;
  const name = args.name || process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error(
      'Missing required admin email/password. Pass --email/--password or set ADMIN_EMAIL/ADMIN_PASSWORD.'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Admin password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  let user = await User.findOne({ email });
  if (user) {
    if (user.role !== 'admin') {
      console.error(
        `A user with email ${email} already exists with role "${user.role}". Refusing to overwrite silently.`
      );
      process.exit(1);
    }
    user.password = password; // pre-save hook hashes it
    user.status = 'active';
    user.name = name;
    await user.save();
    console.log(`Updated existing admin: ${email}`);
  } else {
    user = await User.create({
      name,
      email,
      password,
      role: 'admin',
      status: 'active',
    });
    console.log(`Created admin: ${email}`);
  }

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
