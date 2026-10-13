import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { RenderOptions } from "./render"
import type { Dimension, Unit, Wall, WallElement } from "./types"
import { numberTexts, recorder } from "./doorway/doorway.test-utils"
import type { Op } from "./doorway/doorway.test-utils"
import { jambDimension, jambPoint, win } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: размер с откосами в PDF (spec dimension-tool «Привязка размеров к стенам»,
// pdf-export «Размеры в PDF»; design D4). drawScene подменяется обёрткой: запоминает опции и рисует сцену
// в записывающий контекст — вывод PDF проверяется теми же средствами, что и холст.

const calls = vi.hoisted((): { opts: RenderOptions | undefined; ops: Op[] }[] => [])

vi.mock("./render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./render")>()
  return {
    ...mod,
    drawScene: (...args: Parameters<typeof mod.drawScene>): void => {
      const { ctx, ops } = recorder()
      const [, w, h, walls, preview, unit, view, selected, opts] = args
      mod.drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)
      calls.push({ opts, ops })
      mod.drawScene(...args)
    },
  }
})

const { buildPdf, wallsBBox } = await import("./export/pdf")

const font = readFileSync(new URL("./assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const e1: WallElement = win("W", "a", 100, 120, 150, 85, "e1")
const e2: WallElement = win("W", "a", 300, 120, 150, 85, "e2")
const gap: Dimension = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1), 30)

function exportOps(unit: Unit, dimensions: Dimension[], elements: WallElement[]): { opts: RenderOptions | undefined; ops: Op[] } {
  calls.length = 0
  buildPdf([W], dimensions, unit, 100, "A4", font, elements)
  expect(calls).toHaveLength(1)
  return calls[0]
}

describe("размер с откосами в PDF", () => {
  it("DA-35: сцена PDF получает размеры и элементы и рисует число между откосами", () => {
    const { opts, ops } = exportOps("cm", [gap], [e1, e2])
    expect(opts?.dimensions).toEqual([gap])
    expect(opts?.doorways).toEqual([e1, e2])
    expect(numberTexts(ops).map((t) => t.text)).toContain("80")
  })

  it("DA-35b: число в PDF следует единицам — в мм 800", () => {
    const { ops } = exportOps("mm", [gap], [e1, e2])
    expect(numberTexts(ops).map((t) => t.text)).toContain("800")
  })

  it("DA-35c: размер на откосе отсутствующего элемента не рисуется и экспорт не падает", () => {
    const dangling = jambDimension(jambPoint("ghost", "a", 1), jambPoint("e2", "a", 1), 30)
    const { ops } = exportOps("cm", [dangling], [e1, e2])
    expect(numberTexts(ops).map((t) => t.text)).not.toContain("80")
  })

  it("DA-35d: габарит листа включает размерную линию размера с откосами, вынесенную далеко от стены", () => {
    const far = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1), 200)
    const withElements = wallsBBox([W], [far], 0, [e1, e2])
    // грань +1 на y = 10, смещение 200 → размерная линия на y = 210, концы по x = 220…300
    expect(withElements.maxY).toBeGreaterThanOrEqual(210)
    expect(wallsBBox([W], [], 0, [e1, e2]).maxY).toBeLessThan(210)
  })

  it("DA-35e: размер на откосе отсутствующего элемента габарит не расширяет", () => {
    const dangling = jambDimension(jambPoint("ghost", "a", 1), jambPoint("e2", "a", 1), 200)
    expect(wallsBBox([W], [dangling], 0, [e1, e2])).toEqual(wallsBBox([W], [], 0, [e1, e2]))
  })
})
