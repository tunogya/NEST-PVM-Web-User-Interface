import { createTheme } from "@mui/material/styles";

export const whiteTheme = createTheme({
  palette: {
    mode: "light",
  },
  normal: {
    primary: "#EAAA00",
    primary_hover: "#F7C728",
    primary_active: "#FFDC52",
    primary_light_hover: "rgba(234, 170, 0, 0.4)",
    primary_light_active: "rgba(234, 170, 0, 0.3)",
    success: "#2ECD3C",
    success_hover: "#25AB33",
    success_active: "#1C8929",
    success_light_hover: "#CFF5D0",
    success_light_active: "#A2EBA5",
    danger: "#FF1B00",
    danger_hover: "#DB1000",
    danger_active: "#B80700",
    danger_light_hover: "#FFD8CC",
    danger_light_active: "#FFAE99",
    bg0: "#FFFFFF",
    bg1: "#F0F1F5",
    bg2: "#FFFFFF",
    bg3: "#F0F1F5",
    bg4: "#FFFFFF",
    text0: "#030308",
    text1: "rgba(3, 3, 8, 0.8)",
    text2: "rgba(3, 3, 8, 0.6)",
    text3: "rgba(3, 3, 8, 0.35)",
    highLight: "#FFFFFF",
    highDark: "#030308",
    border: "rgba(28, 28, 35, 0.08)",
    disabled_bg: "#E6E7EA",
    disabled_text: "rgba(28, 28, 35, 0.35)",
    disabled_border: "#E6E7EA",
    grey: "#F0F1F5",
    grey_hover: "#E4E5EC",
    grey_active: "#C2C5DA",
    grey_light_hover: "#E4E5EC",
    grey_light_active: "#F0F1F5",
    overlay_bg: "rgba(0, 0, 0, 0.7)",
  },
  isLight: true,
  breakpoints: {
    values: {
      xs: 0,
      ssm: 400,
      sm: 768,
      md: 992,
      lg: 1200,
      xl: 1600,
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
  normal: {
    primary: "#EAAA00",
    primary_hover: "#F7C728",
    primary_active: "#FFDC52",
    primary_light_hover: "rgba(234, 170, 0, 0.3)",
    primary_light_active: "rgba(234, 170, 0, 0.4)",
    success: "#36C56E",
    success_hover: "#61D48B",
    success_active: "#90E2AD",
    success_light_hover: "rgba(54, 197, 110, 0.3)",
    success_light_active: "rgba(54, 197, 110, 0.4)",
    danger: "#FF4F33",
    danger_hover: "#FF8066",
    danger_active: "#FFAE99",
    danger_light_hover: "rgba(255, 79, 51, 0.3)",
    danger_light_active: "rgba(255, 79, 51, 0.4)",
    bg0: "#0B0C0D",
    bg1: "#1D1E22",
    bg2: "#1D1E22",
    bg3: "#313236",
    bg4: "#313236",
    text0: "#F9F9F9",
    text1: "rgba(249, 249, 249, 0.8)",
    text2: "rgba(249, 249, 249, 0.6)",
    text3: "rgba(249, 249, 249, 0.35)",
    highLight: "#FFFFFF",
    highDark: "#030308",
    border: "rgba(255, 255, 255, 0.08)",
    disabled_bg: "#2E2E38",
    disabled_text: "rgba(249, 249, 249, 0.35)",
    disabled_border: "#2E2E38",
    grey: "#1C1C23",
    grey_hover: "#2E2E38",
    grey_active: "#41424C",
    grey_light_hover: "rgba(30, 32, 39, 0.3)",
    grey_light_active: "rgba(47, 50, 59, 0.4)",
    overlay_bg: "rgba(0, 0, 0, 0.7)",
  },
  isLight: false,
  breakpoints: {
    values: {
      xs: 0,
      ssm: 420,
      sm: 768,
      md: 992,
      lg: 1200,
      xl: 1600,
    },
  },
});