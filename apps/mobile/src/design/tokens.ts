export const tokens = {
  postAuth: {
    primary: "#F7FBFB",
    secondary: "#B8CED3",
    tertiary: "#87A1A8",
    smallText: {
      fontFamily: "Michroma_400Regular",
      fontWeight: "400",
      includeFontPadding: false,
      textShadowColor: "rgba(0, 0, 0, 0.68)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  },
  specimen: {
    background: "#03080d",
    primary: "#f3f5f6",
    secondary: "#a3abb2",
    mint: "#b5eee2",
    outline: "rgba(181, 238, 226, 0.72)",
    overlay: "rgba(0, 4, 8, 0.16)"
  },
  colors: {
    background: "#040605",
    surface: "#080c0a",
    surfaceSubtle: "#0d1411",
    textPrimary: "#f4f7f4",
    textSecondary: "#b2bcb6",
    textMuted: "#66716b",
    border: "rgba(244, 247, 244, 0.1)",
    accent: "#b8e6d2",
    accentSoft: "rgba(184, 230, 210, 0.14)"
  },
  typography: {
    display: {
      fontSize: 42,
      lineHeight: 48,
      fontWeight: "700"
    },
    title: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "700"
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "400"
    },
    metadata: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600"
    },
    label: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700"
    },
    identifier: {
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600"
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48
  },
  radii: {
    sm: 4,
    md: 8,
    full: 999
  },
  border: {
    width: 0.2
  },
  opacity: {
    disabled: 0.42,
    faint: 0.28,
    muted: 0.62
  },
  motion: {
    quick: 140,
    breathe: 4200
  }
} as const;
