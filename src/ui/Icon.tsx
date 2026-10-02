const PATHS = {
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  download: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  back: <path d="M15 18l-6-6 6-6" />,
  print: <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />,
};

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{PATHS[name]}</svg>
  );
}
