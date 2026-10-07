import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { RenderOptions } from "../render"
import type { Point, View, Wall, WallDoor, WallElement } from "../types"
import { PX_PER_CM } from "../types"
import { segments, strokes, texts } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"
import { DR, arcPointAt, arcRecorder, dr, expectedLeaf, onPolylineArc, onStrokedArc } from "./door.test-utils"
import type { ArcCall } from "./door.test-utils"

// change add-door: двери в PDF (spec pdf-export «Двери в PDF»; design D8).
// drawScene подменяется обёрткой: запоминает опции и дополнительно рисует сцену в записывающий контекст.

const calls = vi.hoisted((): { opts: RenderOptions | undefined; ops: Op[]; arcs: ArcCall[]; view: View }[] => [])

vi.mock("../render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../render")>()
  return {
    ...mod,
    drawScene: (...args: Parameters<typeof mod.drawScene>): void => {
      const { ctx, ops, arcs } = arcRecorder()
      const [, w, h, walls, preview, unit, view, selected, opts] = args
      mod.drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)
      calls.push({ opts, ops, arcs, view })
      mod.drawScene(...args)
    },
  }
})

const { buildPdf, wallsBBox } = await import("../export/pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const d: WallDoor = DR("a", "left")

function exportOps(doorways: WallElement[]): { opts: RenderOptions | undefined; ops: Op[]; arcs: ArcCall[]; view: View } {
  calls.length = 0
  buildPdf([W], [], "cm", 100, "A4", font, doorways)
  expect(calls).toHaveLength(1)
  return calls[0]
}

const strokeCount = (ops: Op[]): number => ops.filter((o) => o.kind === "stroke").length

describe("двери в PDF", () => {
  it("DP-01: сцена PDF получает дверь; подпись «H=210», полотно и дуга нарисованы", () => {
    const withDoor = exportOps([d])
    expect(withDoor.opts?.doorways).toEqual([d])
    expect(texts(withDoor.ops).some((t) => t.text === "H=210")).toBe(true)
    // проём той же ширины — без полотна и дуги: у двери обводок больше (полотно, дуга)
    const asDoorway = exportOps([{ id: "d0", wallId: "W", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 }])
    expect(strokeCount(withDoor.ops)).toBeGreaterThan(strokeCount(asDoorway.ops))
    // дуга с центром в петле от закрытого положения ровно на 95°: точки у концов пролёта есть, сразу за ними и
    // со стороны, противоположной открыванию, — нет. Ломаная засчитывается, только если её вершины на окружности дуги
    const e = expectedLeaf({ x: 0, y: 0 }, { x: 500, y: 0 }, 100, 190, 20, "a", "left", 90)
    const k = PX_PER_CM * withDoor.view.zoom
    const dev = (p: Point): Point => ({ x: (p.x - withDoor.view.pan.x) * k, y: (p.y - withDoor.view.pan.y) * k })
    const tol = 0.5 * k
    const drawn = (p: Point): boolean =>
      onStrokedArc(withDoor.arcs, dev(p), tol) !== null ||
      onPolylineArc(strokes(withDoor.ops).flatMap(segments), dev(e.hinge), 90 * k, dev(p), tol)
    for (const deg of [3, 20, 47.5, 80, 93]) expect(drawn(arcPointAt(e, 90, deg)), `${deg}°`).toBe(true)
    for (const deg of [-45, -5, 100, 140]) expect(drawn(arcPointAt(e, 90, deg)), `${deg}°`).toBe(false)
  })

  it("DP-02: габариты учитывают полотно и дугу двери", () => {
    const plain = wallsBBox([W], [], 0)
    const withDoor = wallsBBox([W], [], 0, [d])
    // открытый конец полотна (92.16, −99.66) и точка дуги (100, −100)
    expect(withDoor.minY).toBeLessThanOrEqual(-99.6)
    expect(withDoor.minY).toBeLessThan(plain.minY - 80)
    const other = wallsBBox([W], [], 0, [DR("a", "right")])
    expect(other.maxY).toBeGreaterThanOrEqual(99.6)
  })

  it("DP-02b: габариты учитывают и полотно, и дугу по отдельности (дверь у конца a стены)", () => {
    // дверь a/left вплотную к концу a: петля (0, −10); полотно 4 см выходит за торец стены (x ≈ −11.83),
    // а дуга доходит до (0, −100) — ниже открытого конца полотна (y ≈ −99.66)
    const edge = dr("W", "a", 0, "a", "left")
    const b = wallsBBox([W], [], 0, [edge])
    expect(b.minX).toBeLessThanOrEqual(-11.5)
    expect(b.minY).toBeLessThanOrEqual(-99.9)
  })

  it("DP-03: размеры двери, призрак и выделение в PDF не попадают", () => {
    const { opts, ops } = exportOps([d])
    expect(opts?.selectedDoorways ?? []).toEqual([])
    expect(opts?.doorwayGhost ?? null).toBeNull()
    expect(texts(ops).filter((t) => /^\d/.test(t.text))).toEqual([])
  })
})
