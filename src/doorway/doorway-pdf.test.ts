import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { RenderOptions } from "../render"
import type { Doorway, Unit, Wall } from "../types"
import { recorder } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"

// change add-doorway: проёмы в PDF (spec pdf-export «Проёмы в PDF»; design D2, D10).
// drawScene подменяется обёрткой: запоминает опции и дополнительно рисует сцену в записывающий
// контекст, чтобы проверить вывод PDF теми же средствами, что и холст.

const calls = vi.hoisted((): { opts: RenderOptions | undefined; ops: Op[] }[] => [])

vi.mock("../render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../render")>()
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

const { buildPdf, wallsBBox } = await import("../export/pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const d: Doorway = { id: "d0", wallId: "W", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 }

function exportOps(unit: Unit): { opts: RenderOptions | undefined; ops: Op[] } {
  calls.length = 0
  buildPdf([W], [], unit, 100, "A4", font, [d])
  expect(calls).toHaveLength(1)
  return calls[0]
}

describe("проёмы в PDF", () => {
  it("DP-01: сцена PDF получает проёмы, у проёма подпись «H=210» в см", () => {
    const { opts, ops } = exportOps("cm")
    expect(opts?.doorways).toEqual([d])
    expect(ops.filter((o): o is Extract<Op, { kind: "text" }> => o.kind === "text").map((o) => o.text)).toContain("H=210")
  })

  it("DP-02: размеры проёма, призрак и выделение в PDF не попадают", () => {
    const { opts, ops } = exportOps("cm")
    expect(opts?.selectedDoorways ?? []).toEqual([])
    expect(opts?.doorwayGhost ?? null).toBeNull()
    const numbers = ops.filter((o): o is Extract<Op, { kind: "text" }> => o.kind === "text" && /^\d/.test(o.text))
    expect(numbers).toEqual([])
  })

  it("DP-03: габариты чертежа учитывают подпись высоты", () => {
    const plain = wallsBBox([W], [], 0)
    const withLabel = wallsBBox([W], [], 0, [d])
    // без помещения подпись слева на экране от a → b — над стеной (spec doorway, test-change-request.md)
    expect(withLabel.minY).toBeLessThan(plain.minY)
    expect(withLabel.maxY).toBe(plain.maxY)
    expect(withLabel.minX).toBe(plain.minX)
    expect(withLabel.maxX).toBe(plain.maxX)
  })
})
