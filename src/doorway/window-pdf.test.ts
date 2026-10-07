import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Doorway, Unit, Wall, WallWindow } from "../types"
import type { Op } from "./doorway.test-utils"
import { colorRecorder, win } from "./window.test-utils"
import type { ColoredText } from "./window.test-utils"

// change add-window: окна в PDF (spec pdf-export «Окна в PDF»; design D5, D6).
// drawScene подменяется обёрткой: запоминает опции и дополнительно рисует сцену в записывающий контекст.

const calls = vi.hoisted((): { opts: RenderOptions | undefined; ops: Op[]; texts: ColoredText[] }[] => [])

vi.mock("../render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../render")>()
  return {
    ...mod,
    drawScene: (...args: Parameters<typeof mod.drawScene>): void => {
      const { ctx, ops, texts } = colorRecorder()
      const [, w, h, walls, preview, unit, view, selected, opts] = args
      mod.drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)
      calls.push({ opts, ops, texts })
      mod.drawScene(...args)
    },
  }
})

const { buildPdf, wallsBBox } = await import("../export/pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const x: WallWindow = win("W", "a", 100)

function exportOps(unit: Unit): { opts: RenderOptions | undefined; ops: Op[]; texts: ColoredText[] } {
  calls.length = 0
  buildPdf([W], [], unit, 100, "A4", font, [x])
  expect(calls).toHaveLength(1)
  return calls[0]
}

describe("окна в PDF", () => {
  it("WP-01: сцена PDF получает окно; подпись «H=150» и синее «H под.=85», рамка и квадраты нарисованы", () => {
    const { opts, ops, texts } = exportOps("cm")
    expect(opts?.doorways).toEqual([x])
    const h = texts.find((t) => t.text === "H=150")
    const sill = texts.find((t) => t.text === "H под.=85")
    expect(h).toBeDefined()
    expect(sill).toBeDefined()
    expect(typeof LIGHT_PALETTE.sill).toBe("string")
    expect(sill?.fillStyle).toBe(LIGHT_PALETTE.sill)
    expect(h?.fillStyle).toBe(LIGHT_PALETTE.ink)
    // обводки: контур стен, квадраты окна, рамка подписи — заметно больше, чем у стены без окна
    calls.length = 0
    buildPdf([W], [], "cm", 100, "A4", font, [])
    const plain = calls[0].ops.filter((o) => o.kind === "stroke").length
    expect(ops.filter((o) => o.kind === "stroke").length).toBeGreaterThan(plain)
  })

  it("WP-02: размеры окна, призрак и выделение в PDF не попадают", () => {
    const { opts, texts } = exportOps("cm")
    expect(opts?.selectedDoorways ?? []).toEqual([])
    expect(opts?.doorwayGhost ?? null).toBeNull()
    expect(texts.filter((t) => /^\d/.test(t.text))).toEqual([])
  })

  it("WP-03: габариты учитывают подпись окна — она шире подписи проёма", () => {
    // вертикальная стена: подпись горизонтальна и выходит за стену по x (слева на экране от a → b — сторона +x)
    const V: Wall = { id: "V", a: { x: 0, y: 0 }, b: { x: 0, y: 500 }, thicknessCm: 20, type: "brick" }
    const door: Doorway = { id: "d0", wallId: "V", anchor: "a", offsetCm: 100, widthCm: 120, heightCm: 150 }
    const window: WallWindow = { ...door, kind: "window", id: "w0", sillCm: 85 }
    const plain = wallsBBox([V], [], 0)
    const withDoor = wallsBBox([V], [], 0, [door])
    const withWindow = wallsBBox([V], [], 0, [window])
    expect(withDoor.maxX).toBeGreaterThan(plain.maxX)
    expect(withWindow.maxX).toBeGreaterThan(withDoor.maxX)
    expect(withWindow.minX).toBe(plain.minX)
  })
})
