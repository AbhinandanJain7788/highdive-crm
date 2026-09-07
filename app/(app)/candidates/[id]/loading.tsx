import Spinner from "@/components/Spinner";

export default function LoadingCandidateDetail() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
      <Spinner size={36} />
    </div>
  );
}
