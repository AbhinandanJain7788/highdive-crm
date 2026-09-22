/** @type {import('next').NextConfig} */
const nextConfig = {
  // Every tab's data comes from a server component (page.tsx) fetching Supabase
  // directly, with client components only splicing their own local state after a
  // mutation. Next's default Client Router Cache (staleTime: 30s for dynamic
  // routes) then serves that stale server-rendered payload when you navigate away
  // and back to a tab within 30s of adding/editing something elsewhere — the exact
  // "only a manual browser refresh shows the change" symptom. Forcing dynamic
  // routes to staleTime 0 makes every tab navigation re-fetch from the server.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
