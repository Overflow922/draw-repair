import { describe, expect, it } from "vitest"
import { drawDemolitionScene } from "./demolition/demolition-render"
import { effectiveMarks } from "./demolition/marks"
import { drawPatternPreview, drawScene, SCREEN_METRICS } from "./render"
import { DARK_PALETTE, LIGHT_PALETTE } from "./theme"
import type { Palette } from "./theme"
import { contrast } from "./theme.test-utils"
import { PX_PER_CM } from "./types"
import type { Material, View, Wall } from "./types"
import {
  angleGap,
  dominantDirection,
  fallingConstant,
  hatchRecorder,
  isFalling,
  isRising,
  onLattice,
  pitchOf,
  risingConstant,
  segmentsOf,
} from "./wall-hatch.test-utils"
import type { HOp, HPoint, HSeg } from "./wall-hatch.test-utils"

// change new-wall-materials: штриховки материалов на холсте — записанные операции 2D-контекста
// (spec wall-types «Штриховка стены по материалу», wall-joints «Непрерывность штриховки через стык»;
// test-plan WM-H1, WM-H7, WM-H8, WM-H9, WM-J1, WM-J2, WM-J4, WM-J6, WM-U1 превью образцов).
// Штриховка в потоке не обрезана клиппингом (длиннее стены); контур стены — штрих толщиной contourPx (2 px).

const MM = SCREEN_METRICS.mmPx
const CONTOUR_PX = SCREEN_METRICS.contourPx
const LINEAR: readonly Material[] = ["blocks", "brick", "concrete", "gkl"]
const ALL: readonly Material[] = ["blocks", "brick", "concrete", "gkl", "wood-long"]
const VIEW0: View = { zoom: 1, pan: { x: 0, y: 0 } }

const wall = (type: Material, ax: number, ay: number, bx: number, by: number, id = "w1", thicknessCm = 60): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm, type })
const H = (type: Material, id = "w1"): Wall => wall(type, 0, 0, 600, 0, id)

function draw(walls: Wall[], view: View = VIEW0, palette: Palette = LIGHT_PALETTE): HOp[] {
  const { ctx, ops } = hatchRecorder()
  drawScene(ctx, 1600, 1200, walls, null, "mm", view, [], { grid: false, palette })
  return ops
}

const isContour = (op: HOp): boolean => op.kind === "stroke" && op.width >= CONTOUR_PX - 0.01
const isHatch = (op: HOp): boolean => op.kind === "stroke" && op.width < CONTOUR_PX - 0.01 && op.width > 0.1
const hatchOf = (ops: readonly HOp[]): HOp[] => ops.filter(isHatch)
const fillsOf = (ops: readonly HOp[]): HOp[] => ops.filter((op) => op.kind === "fill")

const risingPitchPx = (ops: readonly HOp[]): number | null => pitchOf(segmentsOf(hatchOf(ops)).filter(isRising).map((s) => risingConstant(s)), 1e-3)
const fallingPitchPx = (ops: readonly HOp[]): number | null => pitchOf(segmentsOf(hatchOf(ops)).filter(isFalling).map((s) => fallingConstant(s)), 1e-3)
const must = <T>(v: T | null | undefined, what: string): T => {
  if (v === null || v === undefined) throw new Error(what)
  return v
}

const signatureOf = (ops: readonly HOp[]): string => {
  const hatch = hatchOf(ops)
  const s = segmentsOf(hatch)
  const round = (v: number | null): number | null => (v === null ? null : Math.round(v * 100) / 100)
  return JSON.stringify({
    rising: s.some((g) => isRising(g)),
    falling: s.some((g) => isFalling(g)),
    dashed: hatch.some((h) => h.dash.length > 0),
    irregular: s.some((g) => !isRising(g) && !isFalling(g) && Math.abs(g.b.x - g.a.x) > 0.01 && Math.abs(g.b.y - g.a.y) > 0.01),
    filled: fillsOf(ops).length > 0,
    pitch: round(risingPitchPx(ops) ?? fallingPitchPx(ops)),
    width: hatch.length === 0 ? null : Math.min(...hatch.map((h) => h.width)),
  })
}

describe("WM-H1: паттерны материалов на холсте различимы", () => {
  it("рисунки пяти материалов попарно различны", () => {
    expect(new Set(ALL.map((m) => signatureOf(draw([H(m)])))).size).toBe(ALL.length)
  })

  it("каждый материал реально штрихуется и стена обведена контуром", () => {
    for (const m of ALL) {
      const ops = draw([H(m)])
      expect(hatchOf(ops).length, m).toBeGreaterThan(0)
      expect(ops.filter(isContour).length, m).toBeGreaterThan(0)
    }
  })

  it("штриховка рисуется цветом ink схемы, контур — тоже", () => {
    for (const palette of [LIGHT_PALETTE, DARK_PALETTE]) {
      for (const m of ALL) {
        const ops = draw([H(m)], VIEW0, palette)
        for (const op of [...hatchOf(ops), ...ops.filter(isContour)]) expect(op.style, `${m}`).toBe(palette.ink)
      }
    }
  })
})

describe("WM-H9: заливка «Бетона» различима на светлой и тёмной схемах", () => {
  it.each([
    ["светлой", LIGHT_PALETTE],
    ["тёмной", DARK_PALETTE],
  ] as const)("на %s схеме заливка есть, отличается от бумаги и от цвета штрихов и не скрывает их", (_name, palette) => {
    const ops = draw([H("concrete")], VIEW0, palette)
    const fills = fillsOf(ops)
    expect(fills.length).toBeGreaterThan(0)
    for (const f of fills) {
      expect(f.style).not.toBe(palette.paper)
      expect(f.style).not.toBe(palette.ink)
      // штрихи ink читаются на заливке, а сама заливка отличима от бумаги
      expect(contrast(palette.ink, f.style)).toBeGreaterThanOrEqual(3)
      expect(contrast(f.style, palette.paper)).toBeGreaterThanOrEqual(1.1)
    }
  })

  it("цвет заливки зависит от схемы: на светлой и тёмной он разный", () => {
    const light = must(fillsOf(draw([H("concrete")], VIEW0, LIGHT_PALETTE))[0], "заливка на светлой").style
    const dark = must(fillsOf(draw([H("concrete")], VIEW0, DARK_PALETTE))[0], "заливка на тёмной").style
    expect(light).not.toBe(dark)
  })

  it("порядок операций: заливка раньше штрихов, штрихи раньше контура", () => {
    const ops = draw([H("concrete")])
    const fillAt = ops.findIndex((op) => op.kind === "fill")
    const hatchAt = ops.findIndex(isHatch)
    const contourAt = ops.findIndex(isContour)
    expect(fillAt).toBeGreaterThanOrEqual(0)
    expect(hatchAt).toBeGreaterThan(fillAt)
    expect(contourAt).toBeGreaterThan(hatchAt)
  })

  it("заливки нет ни у одного другого материала", () => {
    for (const m of ["blocks", "brick", "gkl", "wood-long"] as const) expect(fillsOf(draw([H(m)])), m).toEqual([])
  })

  it("штрихи «Бетона» — пунктир, метки короче 3 мм", () => {
    const dashed = hatchOf(draw([H("concrete")])).filter((h) => h.dash.length > 0)
    expect(dashed.length).toBeGreaterThan(0)
    for (const h of dashed) expect(h.dash[0] ?? 0).toBeLessThanOrEqual(3 * MM)
  })
})

describe("WM-H7: узор «Дерева» не зависит от наклона стены", () => {
  const dominant = (deg: number): { angleDeg: number; resultant: number } => {
    const len = 800
    const rad = (deg * Math.PI) / 180
    const w = wall("wood-long", 0, 0, Math.round(len * Math.cos(rad)), Math.round(len * Math.sin(rad)))
    return dominantDirection(segmentsOf(hatchOf(draw([w]))))
  }

  it("преобладающее направление линий узора одно и то же у горизонтальной, вертикальной и наклонной стен", () => {
    const flat = dominant(0)
    expect(flat.resultant).toBeGreaterThan(0.1)
    for (const deg of [90, 30, 137, 200]) expect(angleGap(dominant(deg).angleDeg, flat.angleDeg), `${deg}°`).toBeLessThan(8)
  })

  it("штриховка «Дерева» не диагональная сетка 45°: большинство отрезков узора не под 45°/135°", () => {
    const s = segmentsOf(hatchOf(draw([H("wood-long")])))
    const diagonal = s.filter((g) => isRising(g) || isFalling(g)).length
    expect(s.length).toBeGreaterThan(20)
    expect(diagonal / s.length).toBeLessThan(0.5)
  })
})

describe("WM-H8: шаг и размер узора не зависят от масштаба", () => {
  const zoomed = (zoom: number): View => ({ zoom, pan: { x: 0, y: 0 } })

  it.each(LINEAR)("«%s»: шаг линий на экране одинаков при масштабах 1 и 2 и равен целому числу мм листа", (m) => {
    const a = draw([H(m)], zoomed(1))
    const b = draw([H(m)], zoomed(2))
    const pa = must(risingPitchPx(a) ?? fallingPitchPx(a), "шаг при zoom 1")
    const pb = must(risingPitchPx(b) ?? fallingPitchPx(b), "шаг при zoom 2")
    expect(pb).toBeCloseTo(pa, 2)
    expect(pa / MM).toBeGreaterThanOrEqual(1)
    expect(pa / MM).toBeLessThanOrEqual(10)
    expect(hatchOf(a)[0]?.width).toBe(hatchOf(b)[0]?.width)
  })

  it("«ГКЛ»: у обеих серий шаг одинаков и не зависит от масштаба", () => {
    const a = draw([H("gkl")], zoomed(1))
    const b = draw([H("gkl")], zoomed(2))
    expect(must(risingPitchPx(a), "45°")).toBeCloseTo(must(fallingPitchPx(a), "135°"), 2)
    expect(must(risingPitchPx(b), "45° z2")).toBeCloseTo(must(risingPitchPx(a), "45° z1"), 2)
  })

  it("«Дерево»: медианная длина отрезка узора на экране не зависит от масштаба", () => {
    const median = (zoom: number): number => {
      const lengths = segmentsOf(hatchOf(draw([wall("wood-long", 0, 0, 1000, 0, "w1", 100)], zoomed(zoom)))).map((g) => Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y)).sort((p, q) => p - q)
      expect(lengths.length).toBeGreaterThan(20)
      return lengths[Math.floor(lengths.length / 2)] ?? 0
    }
    expect(median(2) / median(1)).toBeGreaterThan(0.95)
    expect(median(2) / median(1)).toBeLessThan(1.05)
  })
})

describe("WM-J4: фаза штриховки привязана к чертежу и не плывёт при панораме", () => {
  const panned = (x: number, y: number): View => ({ zoom: 1.7, pan: { x, y } })
  const k = PX_PER_CM * 1.7

  // константы линий в мировых координатах: (x + y)_экран / k + (pan.x + pan.y), (y − x)_экран / k + (pan.y − pan.x)
  const worldRising = (ops: readonly HOp[], pan: HPoint): number[] =>
    segmentsOf(hatchOf(ops)).filter(isRising).map((s) => risingConstant(s) / k + pan.x + pan.y)
  const worldFalling = (ops: readonly HOp[], pan: HPoint): number[] =>
    segmentsOf(hatchOf(ops)).filter(isFalling).map((s) => fallingConstant(s) / k + pan.y - pan.x)

  it.each(LINEAR)("«%s»: линии при разных панорамах лежат на одной решётке в мировых координатах", (m) => {
    const p1 = { x: -30, y: -20 }
    const p2 = { x: 41.37, y: 12.91 }
    const a = draw([H(m)], panned(p1.x, p1.y))
    const b = draw([H(m)], panned(p2.x, p2.y))
    const stepWorld = (must(risingPitchPx(a) ?? fallingPitchPx(a), "шаг") * Math.SQRT2) / k
    const rising = [...worldRising(a, p1), ...worldRising(b, p2)]
    expect(worldRising(a, p1).length, `${m} 45° при первой панораме`).toBeGreaterThan(0)
    expect(worldRising(b, p2).length, `${m} 45° при второй панораме`).toBeGreaterThan(0)
    expect(onLattice(rising, stepWorld, 0.02)).toBe(true)
    if (m === "gkl") {
      expect(worldFalling(a, p1).length, "gkl 135° при первой панораме").toBeGreaterThan(0)
      expect(worldFalling(b, p2).length, "gkl 135° при второй панораме").toBeGreaterThan(0)
      expect(onLattice([...worldFalling(a, p1), ...worldFalling(b, p2)], stepWorld, 0.02)).toBe(true)
    }
  })

  it("«Дерево»: узор в мировых координатах одинаков при разных панорамах", () => {
    const p1 = { x: -30, y: -20 }
    const p2 = { x: 41.37, y: 12.91 }
    // знак нуля не наблюдаем: шум плавающей арифметики даёт "-0.00" и "0.00" у одной и той же точки (test-change-request)
    const fmt = (v: number): string => (Math.round(v * 100) / 100 + 0).toFixed(2)
    const toWorld = (ops: readonly HOp[], pan: HPoint): string[] =>
      segmentsOf(hatchOf(ops))
        .map((s) => `${fmt(s.a.x / k + pan.x)},${fmt(s.a.y / k + pan.y)}|${fmt(s.b.x / k + pan.x)},${fmt(s.b.y / k + pan.y)}`)
        .sort()
    const a = toWorld(draw([H("wood-long")], panned(p1.x, p1.y)), p1)
    const b = toWorld(draw([H("wood-long")], panned(p2.x, p2.y)), p2)
    expect(a.length).toBeGreaterThan(20)
    expect(b).toEqual(a)
  })
})

describe("WM-J1, WM-J2, WM-J6: штриховка продолжается через стык", () => {
  const A = (m: Material): Wall => wall(m, 0, 0, 600, 0, "a")
  const B = (m: Material): Wall => wall(m, 600, 0, 600, 400, "b")
  const C = (m: Material): Wall => wall(m, 600, 0, 900, 250, "c") // стык под 45°

  it.each(LINEAR)("«%s»: линии двух стен стыка (прямой угол и 45°) лежат на общей решётке без сдвига фазы", (m) => {
    const alone = draw([A(m)])
    const stepConst = must(risingPitchPx(alone) ?? fallingPitchPx(alone), "шаг") * Math.SQRT2
    for (const second of [B(m), C(m)]) {
      const joint = draw([A(m), second])
      const rising = segmentsOf(hatchOf(joint)).filter(isRising).map((s) => risingConstant(s))
      expect(rising.length, `${m} 45°: линии есть`).toBeGreaterThan(0)
      expect(onLattice(rising, stepConst, 0.05), `${m} 45°`).toBe(true)
      if (m === "gkl") {
        const falling = segmentsOf(hatchOf(joint)).filter(isFalling).map((s) => fallingConstant(s))
        expect(falling.length, `${m} 135°: линии есть`).toBeGreaterThan(0)
        expect(onLattice(falling, stepConst, 0.05), `${m} 135°`).toBe(true)
      }
    }
  })

  it("«Дерево»: тайлы узора обеих стен стыка совпадают там, где перекрываются области штриховки", () => {
    const ops = draw([A("wood-long"), B("wood-long")])
    const firstContour = ops.findIndex(isContour)
    const secondContour = ops.findIndex((op, i) => i > firstContour && isContour(op))
    expect(firstContour).toBeGreaterThan(0)
    expect(secondContour).toBeGreaterThan(firstContour)
    const fromA = segmentsOf(hatchOf(ops.slice(0, firstContour)))
    const fromB = segmentsOf(hatchOf(ops.slice(firstContour + 1, secondContour)))
    const bContour = segmentsOf([ops[secondContour] as HOp])
    const xs = bContour.flatMap((s) => [s.a.x, s.b.x])
    const ys = bContour.flatMap((s) => [s.a.y, s.b.y])
    const inside = (p: HPoint): boolean => p.x >= Math.min(...xs) && p.x <= Math.max(...xs) && p.y >= Math.min(...ys) && p.y <= Math.max(...ys)
    const key = (s: HSeg): string => `${s.a.x.toFixed(1)},${s.a.y.toFixed(1)}|${s.b.x.toFixed(1)},${s.b.y.toFixed(1)}`
    const bKeys = new Set(fromB.map(key))
    const overlapping = fromA.filter((s) => inside({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }))
    expect(overlapping.length).toBeGreaterThan(5)
    for (const s of overlapping) expect(bKeys.has(key(s)), key(s)).toBe(true)
  })
})

describe("WM-U1: превью образцов материалов", () => {
  const previewOps = (m: Material, palette: Palette): HOp[] => {
    const { ctx, ops } = hatchRecorder()
    const canvas = { width: 36, height: 14, getContext: () => ctx } as unknown as HTMLCanvasElement
    drawPatternPreview(canvas, m, palette)
    return ops
  }

  it("превью пяти материалов штрихуются и попарно различны", () => {
    const signatures = ALL.map((m) => {
      const ops = previewOps(m, LIGHT_PALETTE)
      expect(ops.length, m).toBeGreaterThan(0)
      return signatureOf(ops)
    })
    expect(new Set(signatures).size).toBe(ALL.length)
  })

  it("превью «Бетона» залито, остальные превью — без заливки", () => {
    expect(fillsOf(previewOps("concrete", LIGHT_PALETTE)).length).toBeGreaterThan(0)
    for (const m of ["blocks", "brick", "gkl", "wood-long"] as const) expect(fillsOf(previewOps(m, LIGHT_PALETTE)), m).toEqual([])
  })

  it("превью рисуется цветами схемы: штрихи — ink, заливка «Бетона» отлична от бумаги", () => {
    for (const palette of [LIGHT_PALETTE, DARK_PALETTE]) {
      for (const m of ALL) {
        const ops = previewOps(m, palette)
        const strokes = ops.filter((o) => o.kind === "stroke")
        expect(strokes.length, `${m}: штрихи превью`).toBeGreaterThan(0)
        for (const op of strokes) expect(op.style, m).toBe(palette.ink)
        if (m === "concrete") expect(fillsOf(ops).length, "заливка превью бетона").toBeGreaterThan(0)
        for (const f of fillsOf(ops)) expect(f.style).not.toBe(palette.paper)
      }
    }
  })
})

describe("WM-D8: красная штриховка сноса и серая подложка плана «Демонтаж» на холсте", () => {
  const RED = "#d32f2f"
  const drawDemolition = (palette: Palette = LIGHT_PALETTE): HOp[] => {
    const walls = [wall("brick", 0, 0, 600, 0, "w1"), wall("concrete", 0, 300, 600, 300, "w2")]
    const marks = effectiveMarks([{ id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 400 }], walls)
    expect(marks.length).toBe(1)
    const { ctx, ops } = hatchRecorder()
    drawDemolitionScene(ctx, 1600, 1200, { walls, doorways: [], marks }, "mm", VIEW0, { color: RED, grid: false, palette })
    return ops
  }

  it("красная штриховка — линии 135° с шагом 3 мм листа", () => {
    const red = hatchOf(drawDemolition()).filter((op) => op.style === RED)
    expect(red.length).toBeGreaterThan(0)
    // длинные диагонали — штриховка (остальные красные штрихи — размерные линии и засечки пометки)
    const s = segmentsOf(red).filter((g) => (isRising(g) || isFalling(g)) && Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y) > 30)
    expect(s.length).toBeGreaterThan(5)
    expect(s.every((g) => isFalling(g))).toBe(true)
    expect(must(pitchOf(s.map((g) => fallingConstant(g)), 1e-3), "шаг красной штриховки") / MM).toBeCloseTo(3, 2)
  })

  it.each([
    ["светлой", LIGHT_PALETTE],
    ["тёмной", DARK_PALETTE],
  ] as const)("на %s схеме бетонная подложка: штрихи и контур — цветом muted, заливка — не ink, не muted и не бумага", (_name, palette) => {
    const ops = drawDemolition(palette)
    const concreteHatch = hatchOf(ops).filter((op) => op.dash.length > 0)
    expect(concreteHatch.length).toBeGreaterThan(0)
    for (const h of concreteHatch) expect(h.style).toBe(palette.muted)
    // заливки красных стрелок размеров и закраска бумагой области сноса — не заливка бетона
    const fills = ops.filter((op) => op.kind === "fill" && op.style !== palette.paper && op.style !== RED)
    expect(fills.length).toBeGreaterThan(0)
    for (const f of fills) {
      expect(f.style).not.toBe(palette.ink)
      expect(f.style).not.toBe(palette.muted)
    }
  })
})