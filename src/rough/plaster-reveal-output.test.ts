import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { legendEntries } from "../export/legend"
import { buildPdfPages, pagesOf } from "../export/pdf"
import { parsePaint } from "../export/pdf-paint.test-utils"
import { plasterObstacles } from "../reconstruction/plaster-obstacles"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing } from "../types"
import { plasterPieces } from "./plaster"
import { plasterColors, drawRoughScene } from "./rough-render"
import type { RoughSceneView } from "./rough-render"
import { roughScene } from "./rough-scene"
import { drawing, plaster, reveal, wall, windowOn } from "./rough.test-utils"

// change plaster-opening-reveals: откос на холсте, в PDF, в легенде и на плане «Реконструкция»
// (spec rough-works-plan «Штукатурка откосов проёма», pdf-export «Страница плана «Черновые работы»»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WIN = windowOn("win", "W", 100, 120) // откосы x = 100 и 220 на стене W (0,0)-(500,0), 20 см

const viewOf = (d: Drawing): RoughSceneView => {
  const s = roughScene(d)
  return { walls: s.base.walls, doorways: s.base.doorways, batteries: s.base.batteries, pieces: s.pieces, screeds: [], blocks: [] }
}

describe("откос на холсте", () => {
  it("RV-30: откос нарисован цветом штукатурки поверх закраски проёма бумагой", () => {
    const fill = plasterColors("light").fill
    const rec = recordingContext()
    drawRoughScene(rec.ctx, 800, 600, viewOf(drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] })), "cm", VIEW, { grid: false })
    const fills = rec.ops.filter((o): o is FillOp => o.kind === "fill")
    const at = fills.findIndex((o) => o.fillStyle === fill)
    expect(fills.filter((o) => o.fillStyle === fill)).toHaveLength(1)
    expect(at).toBeGreaterThan(-1)
    const lastPaper = fills.map((o) => o.fillStyle).lastIndexOf(LIGHT_PALETTE.paper)
    expect(lastPaper).toBeGreaterThan(-1)
    expect(at).toBeGreaterThan(lastPaper)
  })

  it("RV-30: размер откоса (толщина стены) выводится как число", () => {
    const withReveal = recordingContext()
    drawRoughScene(withReveal.ctx, 800, 600, viewOf(drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] })), "cm", VIEW, { grid: false })
    const without = recordingContext()
    drawRoughScene(without.ctx, 800, 600, viewOf(drawing({ doorways: [WIN] })), "cm", VIEW, { grid: false })
    const texts = (ops: typeof withReveal.ops): string[] => ops.flatMap((o) => (o.kind === "fillText" ? [String(o.text)] : []))
    expect(texts(withReveal.ops).length - texts(without.ops).length).toBe(1)
    expect(texts(withReveal.ops)).toContain("20")
  })

  it("RV-31: подсветка цели-откоса — одна заливка цвета штукатурки без размеров", () => {
    const fill = plasterColors("light").fill
    const none = recordingContext()
    const scene = viewOf(drawing({ doorways: [WIN] }))
    drawRoughScene(none.ctx, 800, 600, scene, "cm", VIEW, { grid: false })
    const ghost = recordingContext()
    const [element] = scene.doorways
    if (!element) throw new Error("нет окна")
    const piece = { wall: scene.walls[0] ?? wall("W", 0, 0, 500, 0), face: "reveal" as const, element, jamb: "a" as const, from: 100, to: 100 }
    drawRoughScene(ghost.ctx, 800, 600, { ...scene, ghost: { pieces: [piece], thicknessMm: 20 } }, "cm", VIEW, { grid: false })
    expect(ghost.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(1)
    expect(ghost.ops.filter((o) => o.kind === "fillText")).toHaveLength(none.ops.filter((o) => o.kind === "fillText").length)
  })
})

describe("откос в PDF и легенде", () => {
  const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
  const PURPLE: readonly [number, number, number] = [0xa4 / 255, 0x4e / 255, 0xa8 / 255]
  const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
  const d = drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] })

  it("RV-32: на странице «Черновые работы» откос — фиолетовая полоса 0,4 × 4 мм при 1:50", () => {
    const doc = buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, new Date(2026, 8, 5, 14, 32, 7))
    const boxes = parsePaint(doc, 4).flatMap((op) => (op.kind === "fill" && near(op.color, PURPLE) && op.box ? [op.box] : []))
    expect(boxes.some((b) => Math.abs(b.w - 0.4) < 0.02 && Math.abs(b.h - 4) < 0.05)).toBe(true)
  })

  it("RV-32: запись «Штукатурка» есть в легенде, когда на странице только откос", () => {
    const page = pagesOf(d)[3]
    expect(page && legendEntries(page).some((e) => e.kind === "plaster")).toBe(true)
  })
})

describe("откос на плане «Реконструкция»", () => {
  it("RV-33: откос поверхностью привязки не является, полоса грани — является", () => {
    const withBoth = drawing({ doorways: [WIN], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20), reveal("r", "win", "a", 20)] })
    const pieces = plasterPieces(withBoth)
    expect(pieces).toHaveLength(2)
    expect(plasterObstacles(pieces)).toHaveLength(1)
  })
})
