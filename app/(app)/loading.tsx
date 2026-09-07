import Spinner from "@/components/Spinner";

// One Suspense boundary for every route under the signed-in app shell — Next.js
// shows this automatically on any tab switch or navigation whose target page is
// still fetching data, so every "open a tab / open a record" transition gets a
// loading indicator without needing a loading.tsx in every single route folder.
// A route with its own loading.tsx (e.g. candidates/[id]) overrides this one.
export default function AppLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 0" }}>
      <Spinner size={40} />
    </div>
  );
}
