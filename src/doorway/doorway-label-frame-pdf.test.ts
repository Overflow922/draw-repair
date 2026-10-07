import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Doorway, Wall } from "../types"
import { strokes } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"
import { colorRecorder } from "./window.test-utils"
import type { ColoredText } from "./window.test-utils"

// change add-window: подпись проёма в рамке в PDF (spec pdf-export «Проёмы в PDF»; design D6).
// drawScene подменяется обёрткой: запоминает вывод сцены PDF в записывающем контексте.

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

const { buildPdf } = await import("../export/pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const d: Doorway = { id: "d0", wallId: "W", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 }

describe("подпись проёма в рамке в PDF", () => {
  it("LF-PDF-01: вокруг «H=210» в PDF — рамка чернилами с центром в подписи", () => {
    calls.length = 0
    buildPdf([W], [], "cm", 100, "A4", font, [d])
    expect(calls).toHaveLength(1)
    const { ops, texts } = calls[0]
    const t = texts.find((x) => x.text === "H=210")
    if (!t) throw new Error("нет подписи")
    const frames = strokes(ops).flatMap((op) =>
      op.subpaths
        .filter((sp) => sp.length >= 4)
        .map((sp) => ({ op, c: sp.slice(0, 4) }))
        .filter(({ c }) => {
          const mid = { x: c.reduce((s, p) => s + p.x, 0) / 4, y: c.reduce((s, p) => s + p.y, 0) / 4 }
          const xs = c.map((p) => p.x)
          const ys = c.map((p) => p.y)
          return Math.hypot(mid.x - t.at.x, mid.y - t.at.y) < 0.1 && Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys)
        }),
    )
    expect(frames).toHaveLength(1)
    expect(frames[0].op.strokeStyle).toBe(LIGHT_PALETTE.ink)
  })
})
