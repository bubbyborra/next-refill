// Small pieces shared by the start page, the call screen, the footer and the phone list.

export function Mark({ className = "nr-mark" }: { className?: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className={className}>
      <rect x="2" y="9" width="36" height="22" rx="11" className="nr-mark__a" />
      <rect x="20" y="9" width="18" height="22" rx="0" className="nr-mark__b" />
      <rect x="20" y="9" width="18" height="22" rx="11" className="nr-mark__b" />
      <rect x="2" y="9" width="36" height="22" rx="11" fill="none" strokeWidth="2" className="nr-mark__line" />
      <path d="M20 9v22" strokeWidth="2" className="nr-mark__line" />
    </svg>
  );
}

// Era-style window chrome: a thin bar with three small dots.
export function WindowBar() {
  return (
    <div className="nr-winbar" aria-hidden>
      <span className="nr-winbar__dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

// A pack as people say it: "10" for a pack listed as "10's", or the listed size ("60 ml").
export const packOf = (ja: { packCount: number | null; unit: string }) => (ja.packCount ? String(ja.packCount) : ja.unit);
