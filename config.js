// Bloom settings for your own hosting.
// Leave supabaseUrl and supabaseAnonKey empty and Bloom keeps everything on each
// visitor's device, with example AI replies. Fill them in to turn on accounts.
// The anon key is meant to be public: row-level security in supabase/schema.sql
// is what keeps each student's data private. Never put your Anthropic API key here.
window.BLOOM_CONFIG = {
  supabaseUrl: "",      // e.g. "https://abcdefghijkl.supabase.co"
  supabaseAnonKey: "",  // Supabase dashboard → Project Settings → API → anon public key
  aiEndpoint: "/api/ai" // the Netlify function in netlify/functions/ai.mjs
};
