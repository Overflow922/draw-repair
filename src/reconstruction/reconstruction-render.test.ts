import { describe, expect, it } from "vitest"
import { plasterColors } from "../rough/rough-render"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp, StrokeOp } from "../room-area.test-utils"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import { PX_PER_CM } from "../types"
import type { Drawing, DrywallWall, Point } from "../types"
import { plasterPieces } from "../rough/plaster"
import { drawReconstructionScene, drywallColors } from "./reconstruction-render"
import type { ReconstructionView } from "./reconstruction-render"
import { reconstructionScene } from "./reconstruction-scene"
import { W, content, drawing, drywall, plaster, rectWalls, screed } from "./reconstruction.test-utils"

// change reconstruction-plan: отображение плана — слои, цвета, реальный масштаб толщины
// (spec reconstruction-plan «Отображение плана «Реконструкция»», «Цвет гипсокартона»; pdf-export «Страница плана «Реконструкция»»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const K = PX_PER_CM

const viewOf = (d: Drawing, extra: Partial<ReconstructionView> = {}): ReconstructionView => {
  const s = reconstructionScene(d)
  return { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, ...extra }
}

const draw = (view: ReconstructionView, opts: { theme?: "light" | "dark" } = {}) => {
  const rec = recordingContext()
  const palette = opts.theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE
  drawReconstructionScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette, ...opts })
  return rec.ops
}

const fills = (ops: ReturnType<typeof draw>, style: string): FillOp[] => ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === style)
const strokes = (ops: ReturnType<typeof draw>, style: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === style)
const box = (pts: readonly Point[]) => ({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)) })

const PLASTERED = (): Drawing => drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] })

describe("цвета", () => {
  it("RC-100: зелёный гипсокартона различим на светлой и тёмной схемах: от бумаги, серой подложки и контура", () => {
    for (const [theme, palette] of [["light", LIGHT_PALETTE], ["dark", DARK_PALETTE]] as const) {
      const c = drywallColors(theme)
      expect(c.fill).not.toBe(palette.paper)
      expect(c.fill).not.toBe(palette.muted)
      expect(c.fill).not.toBe(c.stroke)
    }
  })

  it("RC-100: цвета светлой и тёмной схем различны", () => {
    expect(drywallColors("light").fill).not.toBe(drywallColors("dark").fill)
  })

  it("RC-101: цвет — зелёный: зелёная составляющая преобладает над красной и синей в обеих схемах", () => {
    for (const theme of ["light", "dark"] as const) {
      const hex = drywallColors(theme).fill.replace("#", "")
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
      expect(g).toBeGreaterThan(r ?? 0)
      expect(g).toBeGreaterThan(b ?? 0)
    }
  })
})

describe("слои и цвета на холсте", () => {
  it("RC-102: штукатурка подложки — серая заливка цвета подложки; фиолетового нет ни в одной схеме", () => {
    const ops = draw(viewOf(PLASTERED()))
    const strip = fills(ops, LIGHT_PALETTE.muted)
    expect(strip.length).toBeGreaterThan(0)
    // полоса 100–300 × y 10…12 (в px — умножить на K)
    expect(strip.some((f) => { const b = box(f.subpaths.flat()); return Math.abs(b.minX - 100 * K) < 1e-6 && Math.abs(b.maxX - 300 * K) < 1e-6 && Math.abs(b.maxY - b.minY - 2 * K) < 1e-6 })).toBe(true)
    for (const theme of ["light", "dark"] as const) expect(fills(ops, plasterColors(theme).fill)).toEqual([])
  })

  it("RC-103: стена ГКЛ — зелёная заливка в реальном масштабе толщины и тёмный контур, без штриховки", () => {
    const g = drywall("g", 0, 40, 300, 40, 10, 250)
    const ops = draw(viewOf(drawing({ reconstruction: content([g]) })))
    const c = drywallColors("light")
    const f = fills(ops, c.fill)
    expect(f).toHaveLength(1)
    const b = box(f[0]?.subpaths.flat() ?? [])
    expect(b.maxY - b.minY).toBeCloseTo(10 * K, 6)
    expect(b.maxX - b.minX).toBeCloseTo(300 * K, 6)
    const s = strokes(ops, c.stroke)
    expect(s).toHaveLength(1)
    expect(s[0]?.subpaths).toHaveLength(1)
  })

  it("RC-104: по заливке на каждую стену ГКЛ", () => {
    const ops = draw(viewOf(drawing({ reconstruction: content([drywall("g", 0, 40, 300, 40), drywall("h", 0, 80, 300, 80)]) })))
    expect(fills(ops, drywallColors("light").fill)).toHaveLength(2)
  })

  it("RC-105: ГКЛ над штукатуркой: заливки стены нарисованы после заливки полосы штукатурки", () => {
    const g = drywall("g", 100, 17, 300, 17, 10)
    const ops = draw(viewOf({ ...PLASTERED(), reconstruction: content([g]) }))
    const plasterIdx = Math.min(...fills(ops, LIGHT_PALETTE.muted).map((o) => o.index))
    const wallIdx = Math.min(...fills(ops, drywallColors("light").fill).map((o) => o.index))
    expect(wallIdx).toBeGreaterThan(plasterIdx)
  })

  it("RC-106: тёмная схема — цвета тёмной схемы", () => {
    const ops = draw(viewOf(drawing({ reconstruction: content([drywall("g", 0, 40, 300, 40)]) })), { theme: "dark" })
    expect(fills(ops, drywallColors("dark").fill)).toHaveLength(1)
    expect(fills(ops, drywallColors("light").fill)).toEqual([])
  })

  it("RC-107: стена ГКЛ у стены подложки не обрезается: торец внутри W остаётся на y = 0 (геометрия — по стенам ГКЛ)", () => {
    const g = drywall("g", 250, 0, 250, 200, 10)
    const ops = draw(viewOf(drawing({ reconstruction: content([g]) })))
    const b = box(fills(ops, drywallColors("light").fill)[0]?.subpaths.flat() ?? [])
    expect(b.minY).toBeCloseTo(0, 6)
    expect(b.maxY).toBeCloseTo(200 * K, 6)
  })

  it("RC-108: цепочка ГКЛ образует угол по общим правилам стен: две стены — один угловой контур без перекрытия", () => {
    const g = drywall("g", 0, 40, 300, 40, 10)
    const h = drywall("h", 300, 40, 300, 240, 10)
    const ops = draw(viewOf(drawing({ reconstruction: content([g, h]) })))
    const f = fills(ops, drywallColors("light").fill)
    expect(f).toHaveLength(2)
    const area = (pts: readonly Point[]): number => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length] as Point; return s + (p.x * q.y - q.x * p.y) }, 0) / 2)
    const total = f.reduce((s, o) => s + o.subpaths.reduce((a, sp) => a + area(sp), 0), 0) / (K * K)
    // угловой стык осей в (300, 40): L-образная фигура — горизонтальное плечо x 0…305, y 35…45 и вертикальное x 295…305, y 45…240:
    // 305·10 + 10·195 = 5000 см²
    expect(total).toBeCloseTo(5000, 3)
  })

  it("RC-109: стяжка в чертеже на холсте не рисуется: штриховки стяжки и подписи «h = …мм» нет", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260, 65)] })
    const ops = draw(viewOf(d))
    expect(ops.filter((o) => o.kind === "fillText" && /h = /.test(String((o as { text?: string }).text ?? "")))).toEqual([])
  })

  it("RC-110: подложка серая: контур стены подложки цветом muted", () => {
    const ops = draw(viewOf(drawing()))
    expect(strokes(ops, LIGHT_PALETTE.muted).length).toBeGreaterThan(0)
    expect(W().id).toBe("W")
  })

  it("RC-111: куски штукатурки сцены совпадают с кусками «Черновых работ»", () => {
    const d = PLASTERED()
    expect(viewOf(d).pieces).toEqual(plasterPieces(d))
  })
})

describe("тип ГКЛ", () => {
  it("RC-112: стена ГКЛ не считается материалом «ГКЛ» подложки: в сцене подложки стен ГКЛ нет", () => {
    const g: DrywallWall = drywall("g", 0, 40, 300, 40)
    const s = reconstructionScene(drawing({ reconstruction: content([g]) }))
    expect(s.underlay.map((w) => w.id)).not.toContain("g")
  })
})
