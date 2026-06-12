const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient() {
  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('[Supabase] Missing credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).');
  }

  // Handle accidental inclusion of /rest/v1/ path in SUPABASE_URL
  if (supabaseUrl.endsWith('/rest/v1/')) {
    supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 9);
  } else if (supabaseUrl.endsWith('/rest/v1')) {
    supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 8);
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = {
  createSupabaseClient,
};
