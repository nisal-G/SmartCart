const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET;

const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SECRET_KEY && BUCKET
);

let supabase = null;
if (isSupabaseConfigured) {
  // The secret key (Supabase's current server-side API key, replacing the
  // legacy service_role key) bypasses Row Level Security and must only
  // ever live on the server. It is never sent to the frontend and never
  // included in any API response or log line — see imageStorageService.js.
  supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} else {
  console.warn(
    '[storage] Supabase Storage is not configured (missing SUPABASE_URL/SUPABASE_SECRET_KEY/SUPABASE_STORAGE_BUCKET) — image upload endpoints will return 503.'
  );
}

module.exports = { supabase, isSupabaseConfigured, BUCKET };
