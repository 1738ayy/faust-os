export function FaustLogo({ className = "" }: { className?: string }) {
  return (
    <div
      aria-label="Faust Snow Leopard"
      role="img"
      className={`bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: "url('/brand/faust-snow-leopard.png')" }}
    />
  );
}
