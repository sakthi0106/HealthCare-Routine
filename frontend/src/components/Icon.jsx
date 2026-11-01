// Clean SVG icons for healthcare companion (Lucide-inspired)
export default function Icon({ name, size = 22, className = "icon" }) {
  const s = size;
  const props = {
    xmlns: "http://www.w3.org/2000/svg",
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true",
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "pill":
      return (
        <svg {...props}>
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      );
    case "droplet":
      return (
        <svg {...props}>
          <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
        </svg>
      );
    case "footprints":
      return (
        <svg {...props}>
          <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.5-2 8.5v2" />
          <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.5 2 8.5v2" />
          <circle cx="6" cy="20" r="2" />
          <circle cx="18" cy="22" r="2" />
        </svg>
      );
    case "wind":
      return (
        <svg {...props}>
          <path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2" />
          <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
          <path d="M9.8 4.6A2 2 0 1 1 11 8H2" />
        </svg>
      );
    case "stethoscope":
      return (
        <svg {...props}>
          <path d="M4.5 3v5a3.5 3.5 0 0 0 7 0V3" />
          <path d="M6 3h-3" />
          <path d="M13 3h-3" />
          <path d="M8 11.5v4a4.5 4.5 0 0 0 9 0V11" />
          <circle cx="17" cy="11" r="2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      );
    case "package":
      return (
        <svg {...props}>
          <path d="M16.5 9.4 7.55 4.24a1.78 1.78 0 0 0-1.8 0L2.5 6.18a1.8 1.8 0 0 0-.9 1.56v8.52a1.8 1.8 0 0 0 .9 1.56l3.25 1.94a1.78 1.78 0 0 0 1.8 0l8.95-5.16a1.8 1.8 0 0 0 .9-1.56V11a1.8 1.8 0 0 0-.9-1.6Z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" x2="12" y1="22.08" y2="12" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg {...props}>
          <line x1="12" x2="12" y1="20" y2="10" />
          <line x1="18" x2="18" y1="20" y2="4" />
          <line x1="6" x2="6" y1="20" y2="16" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...props}>
          <line x1="4" x2="4" y1="21" y2="14" />
          <line x1="4" x2="4" y1="10" y2="3" />
          <line x1="12" x2="12" y1="21" y2="12" />
          <line x1="12" x2="12" y1="8" y2="3" />
          <line x1="20" x2="20" y1="21" y2="16" />
          <line x1="20" x2="20" y1="12" y2="3" />
          <line x1="1" x2="7" y1="14" y2="14" />
          <line x1="9" x2="15" y1="8" y2="8" />
          <line x1="17" x2="23" y1="16" y2="16" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...props}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "moon":
      return (
        <svg {...props}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

export function iconForEmoji(emoji) {
  switch (emoji) {
    case "💊": return "pill";
    case "💧": return "droplet";
    case "🚶": return "footprints";
    case "🫁": return "wind";
    case "🏥": return "stethoscope";
    case "📋": return "file-text";
    case "📦": return "package";
    case "📊": return "bar-chart";
    case "⚙️": return "sliders";
    case "🩸": return "activity";
    case "📈": return "bar-chart";
    case "🗂️": return "file-text";
    default:   return null;
  }
}
