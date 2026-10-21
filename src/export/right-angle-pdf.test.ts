import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { drawing, plaster, rectWalls } from "../rough/rough.test-utils"
import type { RoughParts } from "../rough/rough.test-utils"
import type { Drawing, RightAngleMark } from "../types"
import { legendEntries } from "./legend"
import { buildPdfPages, pagesOf } from "./pdf"
import { parseColoredStrokes } from "./pdf-colors.test-utils"
import { PDF_METRICS } from "../render"

// change plaster-right-angle: знак прямого угла на странице «Черновые работы» (spec pdf-export «Прямые углы в PDF»)
// Комната 4×5 м, штукатурка 30 мм по всем граням внутрь; угол k1/k2 — внутренний, вершина (408; 12 + 1,8)

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const NOW = new Date(2026, 8, 5, 14, 32, 7)
const ROOM_FACES = [
  plaster("a", "k1", 1, "a", 0, 420, 30),
  plaster("b", "k2", 1, "a", 0, 520, 30),
  plaster("c", "k3", 1, "a", 0, 420, 30),
  plaster("d", "k4", 1, "a", 0, 520, 30),
]
const mark: RightAngleMark = { id: "r1", corner: [{ markId: "a", at: "to" }, { markId: "b", at: "from" }] }
const room = (parts: RoughParts = {}): Drawing => drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: ROOM_FACES, ...parts })

const build = (d: Drawing, scale = 50): jsPDF => buildPdfPages(pagesOf(d), "cm", scale, "A3", font, d.name, NOW)

const ROUGH_PAGE = 4
const ARM_MM = PDF_METRICS.labelPx * 1.6

// скобка знака: ломаная из трёх точек с плечами по ARM_MM
const brackets = (doc: jsPDF, page = ROUGH_PAGE) =>
  parseColoredStrokes(doc, page).filter((s) =>
    s.subpaths.some((p) => p.length === 3 && Math.abs(Math.hypot((p[0]?.x ?? 0) - (p[1]?.x ?? 0), (p[0]?.y ?? 0) - (p[1]?.y ?? 0)) - ARM_MM) < 0.01),
  )

describe("знак прямого угла в PDF", () => {
  it("RA-100: на странице «Черновые работы» нарисована одна скобка с плечами постоянной длины на бумаге", () => {
    expect(brackets(build(room()))).toEqual([])
    const withMark = brackets(build(room({ roughAngles: [mark] })))
    expect(withMark.length).toBeGreaterThan(0)
    for (const s of withMark) {
      const path = s.subpaths.find((p) => p.length === 3)
      const arm2 = Math.hypot((path?.[2]?.x ?? 0) - (path?.[1]?.x ?? 0), (path?.[2]?.y ?? 0) - (path?.[1]?.y ?? 0))
      expect(arm2).toBeCloseTo(ARM_MM, 2)
    }
  })

  it("RA-100: длина плеч на бумаге не зависит от масштаба чертежа", () => {
    for (const scale of [50, 100]) {
      const found = brackets(build(room({ roughAngles: [mark] }), scale))
      expect(found.length).toBeGreaterThan(0)
    }
  })

  it("RA-101: цвет знака не зависит от схемы — чернила светлой схемы #333 и бумага под ними", () => {
    const colors = brackets(build(room({ roughAngles: [mark] }))).map((s) => s.color.map((c) => Math.round(c * 255)).join(","))
    expect(colors).toContain("51,51,51")
    expect(colors).toContain("255,255,255")
  })

  it("RA-102: недействующая пометка в PDF не попадает", () => {
    const dormant = room({ roughPlaster: ROOM_FACES.slice(1), roughAngles: [mark] })
    expect(brackets(build(dormant))).toEqual([])
  })

  it("RA-103: остальные страницы и легенда страницы не меняются", () => {
    const plain = build(room())
    const marked = build(room({ roughAngles: [mark] }))
    for (const page of [1, 2, 3, 5]) expect(parseColoredStrokes(marked, page)).toEqual(parseColoredStrokes(plain, page))
    const [plainPage, markedPage] = [pagesOf(room())[3], pagesOf(room({ roughAngles: [mark] }))[3]]
    if (!plainPage || !markedPage) throw new Error("нет страницы «Черновые работы»")
    expect(legendEntries(markedPage)).toEqual(legendEntries(plainPage))
  })
})
