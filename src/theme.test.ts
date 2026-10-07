import { describe, expect, it } from "vitest"
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  THEME_KEY,
  loadThemeChoice,
  paletteOf,
  parseTheme,
  resolveTheme,
  saveThemeChoice,
  themeToggleTitle,
  toggledTheme,
} from "./theme"
import type { Palette, Theme } from "./theme"
import { contrast, isDarkColor, isLightColor, memoryStorage } from "./theme.test-utils"

// Тесты change dark-theme: выбор схемы и палитры (spec color-theme, design D1).

const THEMES: Theme[] = ["light", "dark"]
const KEYS: (keyof Palette)[] = [
  "paper",
  "grid",
  "ink",
  "muted",
  "square",
  "handleStroke",
  "labelBg",
  "angle",
  "track",
  "selection",
  "selectedDim",
  "marqueeWall",
  "marqueeDim",
  "erase",
  "snap",
  "sill",
]

describe("parseTheme", () => {
  it("PARSE-1: «light» и «dark» распознаются", () => {
    expect(parseTheme("light")).toBe("light")
    expect(parseTheme("dark")).toBe("dark")
  })

  it.each([null, undefined, "", "Dark", " dark", "dark ", "auto", "system", "1", 1, true, {}, ["dark"]])(
    "PARSE-2: %j — не схема",
    (value) => {
      expect(parseTheme(value)).toBeNull()
    },
  )
})

describe("resolveTheme — системная схема по умолчанию", () => {
  it("RES-1: выбора нет, ОС тёмная — тёмная", () => {
    expect(resolveTheme(null, true)).toBe("dark")
  })

  it("RES-2: выбора нет, ОС не тёмная — светлая", () => {
    expect(resolveTheme(null, false)).toBe("light")
  })

  it.each([
    ["light", true],
    ["light", false],
    ["dark", true],
    ["dark", false],
  ] as const)("RES-3: выбор %s при системной тёмной=%s — побеждает выбор", (choice, systemDark) => {
    expect(resolveTheme(choice, systemDark)).toBe(choice)
  })
})

describe("кнопка переключения", () => {
  it("TOGGLE-1: переключает на противоположную", () => {
    expect(toggledTheme("light")).toBe("dark")
    expect(toggledTheme("dark")).toBe("light")
  })

  it("TOGGLE-2: двойное переключение возвращает исходную схему", () => {
    for (const t of THEMES) expect(toggledTheme(toggledTheme(t))).toBe(t)
  })

  it("TITLE-1: подсказка называет схему, на которую переключит", () => {
    expect(themeToggleTitle("light")).toBe("Тёмная тема")
    expect(themeToggleTitle("dark")).toBe("Светлая тема")
  })
})

describe("запоминание выбора", () => {
  it("STORE-KEY-1: ключ хранилища", () => {
    expect(THEME_KEY).toBe("draw-repair:theme")
  })

  it("STORE-1: сохранённый выбор читается после «перезагрузки»", () => {
    for (const t of THEMES) {
      const storage = memoryStorage()
      expect(saveThemeChoice(storage, t)).toBe(true)
      expect(storage.data.get("draw-repair:theme")).toBe(t)
      expect(loadThemeChoice(memoryStorage(Object.fromEntries(storage.data)))).toBe(t)
    }
  })

  it("STORE-2: пустое хранилище — выбора нет", () => {
    expect(loadThemeChoice(memoryStorage())).toBeNull()
  })

  it.each(["", "auto", "DARK", "{\"theme\":\"dark\"}", "null"])("STORE-3: повреждённое значение %j — выбора нет", (raw) => {
    expect(loadThemeChoice(memoryStorage({ "draw-repair:theme": raw }))).toBeNull()
  })

  it("STORE-4: значение под чужим ключом не читается", () => {
    expect(loadThemeChoice(memoryStorage({ "draw-repair:drawing": "dark", theme: "dark" }))).toBeNull()
  })

  it("STORE-5: чтение бросает — выбора нет, без исключения", () => {
    const storage = memoryStorage({ "draw-repair:theme": "dark" }, { failGet: true })
    expect(() => loadThemeChoice(storage)).not.toThrow()
    expect(loadThemeChoice(storage)).toBeNull()
  })

  it("STORE-6: запись бросает — false, без исключения", () => {
    const storage = memoryStorage({}, { failSet: true })
    expect(() => saveThemeChoice(storage, "dark")).not.toThrow()
    expect(saveThemeChoice(storage, "dark")).toBe(false)
  })

  it("STORE-7: после повреждённого значения и сбоя хранилища действует системная схема", () => {
    expect(resolveTheme(loadThemeChoice(memoryStorage({ "draw-repair:theme": "blue" })), true)).toBe("dark")
    expect(resolveTheme(loadThemeChoice(memoryStorage({}, { failGet: true })), false)).toBe("light")
  })

  it("STORE-8: перезапись выбора", () => {
    const storage = memoryStorage()
    saveThemeChoice(storage, "dark")
    saveThemeChoice(storage, "light")
    expect(loadThemeChoice(storage)).toBe("light")
  })
})

describe("палитры", () => {
  it("LIGHT-EXACT-1: светлая палитра — прежние цвета отрисовки", () => {
    expect(LIGHT_PALETTE).toEqual({
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
    })
  })

  it("PAL-OF-1: paletteOf выдаёт палитру схемы", () => {
    expect(paletteOf("light")).toBe(LIGHT_PALETTE)
    expect(paletteOf("dark")).toBe(DARK_PALETTE)
  })

  it("DARK-KEYS-1: в тёмной палитре заданы все цвета", () => {
    expect(Object.keys(DARK_PALETTE).sort()).toEqual([...KEYS].sort())
    for (const k of KEYS) expect(DARK_PALETTE[k]).toMatch(/^(#[0-9a-f]{3,6}|rgba?\(.+\))$/i)
  })

  it("DARK-BG-1: фон тёмный, линии светлые", () => {
    expect(isDarkColor(DARK_PALETTE.paper)).toBe(true)
    expect(isLightColor(DARK_PALETTE.ink)).toBe(true)
  })

  it("DARK-INK-1: линии и подписи контрастны к фону (≥ 7:1)", () => {
    expect(contrast(DARK_PALETTE.ink, DARK_PALETTE.paper)).toBeGreaterThanOrEqual(7)
  })

  it("DARK-GRID-1: сетка видна, но слабее линий (контраст к фону 1.1…2)", () => {
    const c = contrast(DARK_PALETTE.grid, DARK_PALETTE.paper)
    expect(c).toBeGreaterThanOrEqual(1.1)
    expect(c).toBeLessThanOrEqual(2)
  })

  it.each(["angle", "track", "snap", "handleStroke", "muted"] as const)("DARK-ACCENT-1: %s различим на фоне (≥ 3:1)", (k) => {
    expect(contrast(DARK_PALETTE[k], DARK_PALETTE.paper)).toBeGreaterThanOrEqual(3)
  })

  it.each(["selection", "selectedDim", "marqueeWall", "marqueeDim", "erase", "square"] as const)(
    "DARK-ACCENT-2: %s отличим от фона (≥ 1.5:1 с учётом прозрачности)",
    (k) => {
      expect(contrast(DARK_PALETTE[k], DARK_PALETTE.paper)).toBeGreaterThanOrEqual(1.5)
    },
  )

  it("DARK-LABEL-1: подложка подписи угла — тёмная, под цвет фона, не белая", () => {
    expect(contrast(DARK_PALETTE.labelBg, DARK_PALETTE.paper)).toBeLessThan(1.2)
    expect(contrast(DARK_PALETTE.angle, DARK_PALETTE.labelBg.replace(/,\s*[\d.]+\)$/, ")").replace("rgba", "rgb"))).toBeGreaterThanOrEqual(3)
  })

  it("DARK-DIFF-1: тёмная палитра отличается от светлой фоном, сеткой, линиями и подложками", () => {
    for (const k of ["paper", "grid", "ink", "muted", "labelBg", "handleStroke"] as const)
      expect(DARK_PALETTE[k]).not.toBe(LIGHT_PALETTE[k])
  })
})
