export function BuildingArt({
  variant = "sage",
  compact = false,
}: {
  variant?: string;
  compact?: boolean;
}) {
  const colors: Record<
    string,
    { bg: string; main: string; side: string; dark: string; window: string }
  > = {
    sage: {
      bg: "#e9efe4",
      main: "#c0cdb1",
      side: "#acbea0",
      dark: "#71866b",
      window: "#91a485",
    },
    sand: {
      bg: "#f0ece1",
      main: "#dbcfb8",
      side: "#c9bda5",
      dark: "#948974",
      window: "#b0a38c",
    },
    slate: {
      bg: "#e7edf0",
      main: "#c0cdd2",
      side: "#a8bcc4",
      dark: "#748a94",
      window: "#94aab4",
    },
    rose: {
      bg: "#f1eae4",
      main: "#d9c6b8",
      side: "#c7b2a2",
      dark: "#9b8174",
      window: "#b39a88",
    },
  };
  const c = colors[variant] ?? colors.sage;
  return (
    <svg
      viewBox="0 0 440 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="440" height="240" fill={c.bg} />
      <circle cx="342" cy="56" r="28" fill="#ffffff" opacity=".45" />
      <path d="M0 218L440 196V240H0Z" fill={c.side} opacity=".2" />
      <path d="M100 221V84L206 49V211Z" fill={c.side} />
      <path d="M206 49L293 75V219L206 211Z" fill={c.main} />
      <path d="M100 84L206 49L293 75L186 108Z" fill={c.main} />
      <path d="M123 219V127L186 108V215Z" fill={c.main} />
      <path d="M293 125L353 141V224L293 219Z" fill={c.side} />
      <path d="M293 125L353 141L313 150L255 134Z" fill={c.main} />
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => ({
          id: `front-${row}-${col}`,
          x: 113 + col * 20,
          y: 98 + row * 23 - col * 6,
        })),
      )
        .flat()
        .map((w) => (
          <path
            key={w.id}
            d={`M${w.x} ${w.y}l11 -3v12l-11 3z`}
            fill={c.window}
          />
        ))}
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 3 }, (_, col) => ({
          id: `side-${row}-${col}`,
          x: 219 + col * 23,
          y: 83 + row * 21 + col * 6,
        })),
      )
        .flat()
        .map((w) => (
          <rect
            key={w.id}
            x={w.x}
            y={w.y}
            width="12"
            height="13"
            fill={c.window}
          />
        ))}
      <path d="M185 215V179L206 176V217Z" fill={c.dark} />
      <path d="M228 218V184L251 188V219Z" fill={c.dark} opacity=".65" />
      <path d="M51 228H389" stroke={c.dark} strokeWidth="1" opacity=".25" />
      <g fill={c.dark} opacity=".55">
        <path d="M67 228V191h2v37z" />
        <ellipse cx="68" cy="185" rx="12" ry="20" />
        <path d="M372 228V199h2v29z" />
        <ellipse cx="373" cy="193" rx="10" ry="17" />
      </g>
      <path d="M82 228H101V222H82ZM332 229H354V222H332Z" fill={c.side} />
      {!compact && (
        <>
          <path
            d="M30 227L78 218M363 219L414 226"
            stroke={c.dark}
            opacity=".12"
          />
          <rect x="306" y="159" width="8" height="13" fill={c.window} />
          <rect x="323" y="164" width="8" height="13" fill={c.window} />
          <rect x="306" y="183" width="8" height="13" fill={c.window} />
          <rect x="323" y="188" width="8" height="13" fill={c.window} />
        </>
      )}
    </svg>
  );
}
