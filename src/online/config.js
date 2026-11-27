// PUBLIC settings for the online features. Both values are safe to publish: the anon key only allows what the
// database's Row Level Security rules allow. NEVER put the service_role key here (it goes in Netlify's
// environment variables). Leave both empty to keep the game fully offline.
export const ONLINE_CONFIG = {
  url: '', // for example 'https://abcdxyz.supabase.co'
  anonKey: '',
};
