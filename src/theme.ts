export type Theme = "light" | "dark"

export interface Palette {
  paper: string // фон холста, заливка помещений, подложки текста размеров, ручек и точки привязки
  grid: string
  ink: string // стены, штриховка, размеры, подписи площади, рамка выделения
  muted: string // резинка и черновик размера
  square: string // квадрат установки
  handleStroke: string // контур ручек
  labelBg: string // полупрозрачная подложка подписи угла
  angle: string // угол построения и замеры линейки
  track: string
  selection: string // обводка выделенной стены
  selectedDim: string
  marqueeWall: string
  marqueeDim: string
  erase: string // подсветка ластика
  snap: string // точка привязки размера
  sill: string // «H под.» в подписи окна
}

export const LIGHT_PALETTE: Palette = {
  paper: "#fff",
  grid: "#e0e0e0",
  ink: "#333",
  muted: "#555",
  square: "#999",
  handleStroke: "#0f172a",
  labelBg: "rgba(255, 255, 255, 0.9)",
  angle: "#2563eb",
  track: "#db2777",
  selection: "rgba(8, 145, 178, 0.5)",
  selectedDim: "rgba(8, 145, 178, 0.9)",
  marqueeWall: "rgba(8, 145, 178, 0.25)",
  marqueeDim: "rgba(8, 145, 178, 0.4)",
  erase: "rgba(220, 38, 38, 0.5)",
  snap: "#dc2626",
  sill: "#2b7fd4",
}

export const DARK_PALETTE: Palette = {
  paper: "#1e1f22", // совпадает с --paper тёмной схемы в style.css
  grid: "#2e3035",
  ink: "#d4d4d8",
  muted: "#a1a1aa",
  square: "#71717a",
  handleStroke: "#e4e4e7",
  labelBg: "rgba(30, 31, 34, 0.9)",
  angle: "#60a5fa",
  track: "#f472b6",
  selection: "rgba(34, 211, 238, 0.5)",
  selectedDim: "rgba(34, 211, 238, 0.9)",
  marqueeWall: "rgba(34, 211, 238, 0.25)",
  marqueeDim: "rgba(34, 211, 238, 0.4)",
  erase: "rgba(248, 113, 113, 0.6)",
  snap: "#f87171",
  sill: "#60a5fa",
}

export const paletteOf = (theme: Theme): Palette => (theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE)

export const THEME_KEY = "draw-repair:theme"

export const parseTheme = (value: unknown): Theme | null => (value === "light" || value === "dark" ? value : null)

// выбор пользователя важнее системной настройки
export const resolveTheme = (choice: Theme | null, systemDark: boolean): Theme => choice ?? (systemDark ? "dark" : "light")

export const toggledTheme = (theme: Theme): Theme => (theme === "dark" ? "light" : "dark")

// подсказка кнопки называет схему, на которую она переключит
export const themeToggleTitle = (theme: Theme): string => (theme === "dark" ? "Светлая тема" : "Тёмная тема")

export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function loadThemeChoice(storage: ThemeStorage): Theme | null {
  try {
    return parseTheme(storage.getItem(THEME_KEY))
  } catch {
    return null
  }
}

export function saveThemeChoice(storage: ThemeStorage, theme: Theme): boolean {
  try {
    storage.setItem(THEME_KEY, theme)
    return true
  } catch {
    return false
  }
}
