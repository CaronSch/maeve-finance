export function Skeleton({ className = "", width }: { className?: string; width?: string | number }) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-base-300 animate-pulse rounded align-middle ${className}`}
      style={{ width: width ?? "4rem", height: "1em" }}
    >
      &nbsp;
    </span>
  );
}
