export default function Spinner({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${Math.max(2, size / 10)}px solid #EEF0F5`,
        borderTopColor: "#1A56DB",
        animation: "highdive-spin 0.7s linear infinite",
      }}
    >
      <style>{`@keyframes highdive-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
