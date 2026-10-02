import type { Species } from "./types";

/** Деревце в viewBox 64x80. grow 0..1 — стадия роста, масштаб от корня. */
export function TreeSvg({ kind, grow = 1, className }: { kind: Species; grow?: number; className?: string }) {
  const g = Math.max(0.06, grow);
  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden="true">
      <g transform={`translate(32 78) scale(${g}) translate(-32 -78)`}>
        {kind === "pine" && (<>
          <rect x="30" y="62" width="4" height="16" rx="1" fill="#6b4f3a" />
          <polygon points="32,36 6,68 58,68" fill="#2f6b45" />
          <polygon points="32,22 10,52 54,52" fill="#3e8555" />
          <polygon points="32,6 14,34 50,34" fill="#56a06a" />
        </>)}
        {kind === "oak" && (<>
          <rect x="29" y="50" width="6" height="28" rx="2" fill="#6b4f3a" />
          <circle cx="20" cy="42" r="15" fill="#5d9b4f" /><circle cx="44" cy="42" r="15" fill="#5d9b4f" />
          <circle cx="32" cy="28" r="18" fill="#79b45f" /><circle cx="32" cy="46" r="14" fill="#4b8a44" />
        </>)}
        {kind === "birch" && (<>
          <rect x="30" y="34" width="4" height="44" rx="1.5" fill="#efece2" />
          <rect x="30" y="46" width="4" height="2" fill="#3a3a3a" /><rect x="30" y="58" width="3" height="2" fill="#3a3a3a" /><rect x="31" y="68" width="3" height="2" fill="#3a3a3a" />
          <ellipse cx="32" cy="26" rx="17" ry="22" fill="#b7cc5a" /><ellipse cx="26" cy="30" rx="9" ry="13" fill="#9fb845" />
        </>)}
        {kind === "sakura" && (<>
          <path d="M32 78 C31 62 30 52 24 42 M32 60 C36 52 42 46 48 40" stroke="#5a4033" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="22" cy="32" r="12" fill="#f4b4c4" /><circle cx="44" cy="32" r="13" fill="#f7c6d2" />
          <circle cx="32" cy="20" r="14" fill="#f2a3b8" /><circle cx="34" cy="38" r="10" fill="#f8d0da" />
        </>)}
        {kind === "dead" && (
          <path d="M32 78 L32 46 M32 58 L20 44 M32 52 L44 38 M20 44 L14 40 M44 38 L48 30" stroke="#8a7462" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        )}
      </g>
    </svg>
  );
}
