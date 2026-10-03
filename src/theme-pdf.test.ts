import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { RenderOptions } from "./render"
import { LIGHT_PALETTE } from "./theme"
import type { Wall } from "./types"

// Тест change dark-theme: PDF не зависит от схемы (spec color-theme «PDF не зависит от схемы», design D2).
// drawScene подменяется обёрткой, которая запоминает переданные опции и рисует как обычно.

const calls = vi.hoisted((): { opts: RenderOptions | undefined }[] => [])

vi.mock("./render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./render")>()
  return {
    ...mod,
    drawScene: (...args: Parameters<typeof mod.drawScene>): void => {
      calls.push({ opts: args[8] })
      mod.drawScene(...args)
    },
  }
})

const { buildPdf } = await import("./export/pdf")

const walls: Wall[] = [
  { id: "a", a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm: 20, type: "brick" },
  { id: "b", a: { x: 400, y: 0 }, b: { x: 400, y: 300 }, thicknessCm: 20, type: "concrete" },
]

describe("PDF и цветовая схема", () => {
  it("PDF-LIGHT-1: экспорт рисует сцену светлой палитрой без сетки", () => {
    const font = readFileSync(new URL("./assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
    calls.length = 0
    buildPdf(walls, [], "mm", 100, "A4", font)
    expect(calls).toHaveLength(1)
    const opts = calls[0].opts
    expect(opts?.grid).toBe(false)
    expect(opts?.palette === undefined || opts.palette === LIGHT_PALETTE).toBe(true)
  })
})
