// Bloom settings for your own hosting.
// Leave supabaseUrl and supabaseAnonKey empty and Bloom keeps everything on each
// visitor's device, with example AI replies. Fill them in to turn on accounts.
// The anon key is meant to be public: row-level security in supabase/schema.sql
// is what keeps each student's data private. Never put your Anthropic API key here.
window.BLOOM_CONFIG = {
  supabaseUrl: "https://zplxhpiyxkdlvmcrcfjq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwbHhocGl5eGtkbHZtY3JjZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzU4NDQsImV4cCI6MjEwNzk1MTg0NH0.ON8fiRhXqq_vawN1GiBaEAZZ0y0td_MelHXC3IEPRrU",
  aiEndpoint: "/api/ai" // the Netlify function in netlify/functions/ai.mjs
};
