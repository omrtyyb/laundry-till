const svgProps = {
  viewBox: "0 0 64 64",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function WasherIcon() {
  return (
    <svg {...svgProps}>
      <rect x="10" y="6" width="44" height="52" rx="6" />
      <line x1="10" y1="18" x2="54" y2="18" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="32" cy="38" r="13" />
      <path d="M23 40c3-3 6 3 9 0s6 3 9 0" />
      <circle cx="46" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function DryCleaningIcon() {
  return (
    <svg {...svgProps}>
      <path d="M32 18a5 5 0 1 1 5-5" />
      <path d="M32 18v4L8 40h48L32 22" />
      <path d="M14 40l4 18h28l4-18" />
    </svg>
  );
}

export function SoapIcon() {
  return (
    <svg {...svgProps}>
      <path d="M22 6h12v8H22z" />
      <path d="M34 9h8" />
      <path d="M20 14h16l4 10v32a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V24z" />
      <circle cx="28" cy="40" r="6" />
      <circle cx="50" cy="20" r="4" />
      <circle cx="54" cy="32" r="2.5" />
    </svg>
  );
}

export function SpendCoinIcon() {
  return (
    <svg {...svgProps}>
      <ellipse cx="24" cy="46" rx="14" ry="5" />
      <path d="M10 46v6c0 3 6 5 14 5s14-2 14-5v-6" />
      <ellipse cx="24" cy="36" rx="14" ry="5" />
      <path d="M10 36v5M38 36v5" />
      <path d="M46 30V8M38 16l8-8 8 8" />
    </svg>
  );
}

export function TicketIcon() {
  return (
    <svg {...svgProps}>
      <path d="M8 18h48v9a5 5 0 0 0 0 10v9H8v-9a5 5 0 0 0 0-10z" />
      <line x1="40" y1="20" x2="40" y2="44" strokeDasharray="3 4" />
      <circle cx="22" cy="28" r="4" />
      <circle cx="30" cy="36" r="3" />
      <circle cx="20" cy="38" r="2" />
    </svg>
  );
}

export function CashDrawerIcon() {
  return (
    <svg {...svgProps}>
      <rect x="6" y="30" width="52" height="24" rx="3" />
      <path d="M6 40h52M26 47h12" />
      <rect x="16" y="12" width="32" height="14" rx="2" />
      <circle cx="32" cy="19" r="3" />
    </svg>
  );
}
