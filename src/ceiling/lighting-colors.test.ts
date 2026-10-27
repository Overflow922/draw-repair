import { describe, expect, it } from "vitest"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Palette } from "../theme"
import { contrast, over, parseColor } from "../theme.test-utils"
import { CEILING_ALPHA } from "./ceiling-render"

// change add-ceiling-lighting: цвета освещения в схемах (spec ceiling-lighting «Цвета освещения»; design D8)

// заливка натяжного потолка поверх бумаги схемы — фон, на котором стоят знаки в помещении с потолком
const ceilingOver = (p: Palette): string => {
  const c = over({ ...parseColor(p.ceiling), a: CEILING_ALPHA }, parseColor(p.paper))
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
}

describe("цвета освещения", () => {
  it.each([
    ["светлая", LIGHT_PALETTE],
    ["тёмная", DARK_PALETTE],
  ] as const)("CL-C1: %s схема — красный и оранжевый заданы и различимы на бумаге (≥ 3:1) и на заливке потолка (≥ 2,5:1)", (_name, p) => {
    for (const color of [p.lightingRed, p.lightingOrange]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(contrast(color, p.paper)).toBeGreaterThanOrEqual(3)
      expect(contrast(color, ceilingOver(p))).toBeGreaterThanOrEqual(2.5)
    }
  })

  it("CL-C2: красный и оранжевый различаются между собой", () => {
    expect(LIGHT_PALETTE.lightingRed).not.toBe(LIGHT_PALETTE.lightingOrange)
    expect(DARK_PALETTE.lightingRed).not.toBe(DARK_PALETTE.lightingOrange)
  })
})
