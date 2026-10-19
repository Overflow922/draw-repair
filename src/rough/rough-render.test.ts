import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp } from "../room-area.test-utils"
import { plasterColors, drawRoughScene } from "./rough-render"
import type { RoughSceneView } from "./rough-render"
import type { PlasterPiece } from "./plaster"
import { roughScene } from "./rough-scene"
import { drawing, plaster, rectWalls, screed, wall } from "./rough.test-utils"
import type { StrokeOp, TextOp } from "../room-area.test-utils"
import { SCREEN_METRICS } from "../render"
import { roomBlocksOf } from "../room-block"
import { LIGHT_PALETTE } from "../theme"
import { SCREED_HATCH } from "../wall-hatch"
import { PX_PER_CM } from "../types"
import type { Battery, Drawing, WallElement } from "../types"

// change add-rough-works-plan, plaster-click-whole-face: подсветка цели штукатурки и цвета (spec rough-works-plan «Постановка штукатурки кликом по грани», «Цвет штукатурки»)

const W = wall("W", 0, 0, 500, 0)
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const EMPTY = { walls: [W], doorways: [], pieces: [] as PlasterPiece[], screeds: [], blocks: [] }

describe("подсветка цели", () => {
  it("RW-220: подсветка — заливка цвета штукатурки (полупрозрачная) и контур; без наведения заливок цвета штукатурки нет", () => {
    const fill = plasterColors("light").fill
    const none = recordingContext()
    drawRoughScene(none.ctx, 800, 600, EMPTY, "cm", VIEW, { grid: false })
    expect(none.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toEqual([])
    const withGhost = recordingContext()
    drawRoughScene(withGhost.ctx, 800, 600, { ...EMPTY, ghost: { pieces: [{ wall: W, from: 0, to: 500, face: 1 }], thicknessMm: 20 } }, "cm", VIEW, { grid: false })
    expect(withGhost.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(1)
  })

  it("RW-220b: подсветка цели из двух кусков — по заливке на каждый кусок; размеров у подсветки нет", () => {
    const fill = plasterColors("light").fill
    const W2 = wall("W2", 500, 0, 900, 0)
    const none = recordingContext()
    drawRoughScene(none.ctx, 800, 600, { ...EMPTY, walls: [W, W2] }, "cm", VIEW, { grid: false })
    const ghost = recordingContext()
    const ghostScene = { ...EMPTY, walls: [W, W2], ghost: { pieces: [{ wall: W, from: 0, to: 500, face: 1 as const }, { wall: W2, from: 0, to: 400, face: 1 as const }], thicknessMm: 20 } }
    drawRoughScene(ghost.ctx, 800, 600, ghostScene, "cm", VIEW, { grid: false })
    expect(ghost.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(2)
    expect(ghost.ops.filter((o) => o.kind === "fillText")).toHaveLength(none.ops.filter((o) => o.kind === "fillText").length)
  })

  it("RW-221: цвета штукатурки различны на светлой и тёмной схемах, а заливка не совпадает с контуром", () => {
    const light = plasterColors("light")
    const dark = plasterColors("dark")
    expect(light.fill).not.toBe(dark.fill)
    expect(light.fill).not.toBe(light.stroke)
    expect(dark.fill).not.toBe(dark.stroke)
  })
})

// change screed-floor-layers: слои плана и порог проёма (spec rough-works-plan «Слои плана «Черновые работы»», «Стяжка на пороге проёма»)
// Сцена: комната 0..420 × 0..520, перегородка p по x = 210 (толщина 20) с проёмом на y 200..290; левая комната — x 10..200.

const K = PX_PER_CM
const INK = LIGHT_PALETTE.ink
const PAPER = LIGHT_PALETTE.paper
const ROOM_LABEL = "h = 65мм"

const viewOf = (d: Drawing, extra: Partial<RoughSceneView> = {}): RoughSceneView => {
  const s = roughScene(d)
  return {
    walls: s.base.walls,
    doorways: s.base.doorways,
    batteries: s.base.batteries,
    pieces: s.pieces,
    screeds: s.screeds.map(({ screed: sc, item }) => ({ screed: sc, room: item.room })),
    blocks: [],
    ...extra,
  }
}

const opening: WallElement = { id: "o", wallId: "p", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 210 }
const partitioned = (screeds: ReturnType<typeof screed>[]): Drawing => drawing({ walls: [...rectWalls("k", 0, 0, 420, 520), wall("p", 210, 0, 210, 520)], doorways: [opening], roughScreeds: screeds })

const draw = (scene: RoughSceneView) => {
  const rec = recordingContext()
  drawRoughScene(rec.ctx, 800, 600, scene, "cm", VIEW, { grid: false })
  return rec.ops
}

const strokes = (ops: ReturnType<typeof draw>): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke")
const texts = (ops: ReturnType<typeof draw>): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText")

// штриховка (несколько линий одной обводкой), целиком лежащая в полосе x ∈ [x0, x1] см: по одной обводке на половину порога
const hatchBetween = (ops: ReturnType<typeof draw>, x0: number, x1: number): StrokeOp[] =>
  strokes(ops).filter((s) => s.strokeStyle === INK && s.subpaths.length > 1 && s.subpaths.flat().every((p) => p.x >= x0 * K - 1e-6 && p.x <= x1 * K + 1e-6))

// линия по середине проёма: отрезок x = 210 от y = 200 до y = 290 см
const dividerIn = (ops: ReturnType<typeof draw>): StrokeOp[] =>
  strokes(ops).filter(
    (s) =>
      s.strokeStyle === INK &&
      s.subpaths.some((sp) => sp.length === 2 && sp.every((p) => Math.abs(p.x - 210 * K) < 1e-6) && sp.some((p) => Math.abs(p.y - 200 * K) < 1e-6) && sp.some((p) => Math.abs(p.y - 290 * K) < 1e-6)),
  )

describe("порог со стяжкой", () => {
  it("RW-310: одинаковая стяжка — обе половины порога заштрихованы, линии нет", () => {
    const ops = draw(viewOf(partitioned([screed("l", 100, 260, 65), screed("r", 300, 260, 65)])))
    expect(hatchBetween(ops, 200, 220)).toHaveLength(2)
    expect(dividerIn(ops)).toHaveLength(0)
  })

  it("RW-310b: штриховка порога рисуется после закраски проёма бумагой и до откосов, полотен и подписей (иначе закраска её стирает)", () => {
    const ops = draw(viewOf(partitioned([screed("l", 100, 260, 65), screed("r", 300, 260, 65)])))
    const paperOverOpening = ops.filter(
      (o) => o.kind === "fill" && o.fillStyle === PAPER && !o.hasArc && o.subpaths[0]?.length === 4 && o.subpaths[0].every((p) => p.x >= 200 * K - 1e-6 && p.x <= 220 * K + 1e-6 && p.y >= 200 * K - 1e-6 && p.y <= 290 * K + 1e-6),
    )
    expect(paperOverOpening).toHaveLength(1)
    const hatch = hatchBetween(ops, 200, 220)
    expect(hatch).toHaveLength(2)
    for (const h of hatch) expect(h.index).toBeGreaterThan(paperOverOpening[0]!.index)
    // подпись высоты проёма — выше штриховки порога
    const heightLabel = texts(ops).find((t) => t.text.startsWith("H="))
    expect(heightLabel).toBeDefined()
    for (const h of hatch) expect(h.index).toBeLessThan(heightLabel!.index)
  })

  it("RW-311: стяжки разной высоты — обе половины и линия по середине проёма", () => {
    const ops = draw(viewOf(partitioned([screed("l", 100, 260, 50), screed("r", 300, 260, 65)])))
    expect(hatchBetween(ops, 200, 220)).toHaveLength(2)
    expect(dividerIn(ops)).toHaveLength(1)
  })

  it("RW-312: стяжка только с одной стороны — одна половина и линия", () => {
    const ops = draw(viewOf(partitioned([screed("l", 100, 260, 50)])))
    expect(hatchBetween(ops, 200, 210)).toHaveLength(1)
    expect(hatchBetween(ops, 210, 220)).toHaveLength(0)
    expect(dividerIn(ops)).toHaveLength(1)
  })

  it("RW-313: без стяжки порог не штрихуется и линии нет", () => {
    const ops = draw(viewOf(partitioned([])))
    expect(hatchBetween(ops, 200, 220)).toHaveLength(0)
    expect(dividerIn(ops)).toHaveLength(0)
  })
})

describe("слои плана", () => {
  const leftRoom = (): Drawing => drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260, 65)], roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 30)] })
  // батарея у левой стены: задняя сторона x = 15, передняя x = 25, вдоль y 340..420
  const battery: Battery = { id: "b", wallId: "k4~0", face: 1, anchor: "a", offsetCm: 100, lengthCm: 80, thicknessCm: 10, gapCm: 5 }
  const isHatch = (s: StrokeOp): boolean => s.strokeStyle === INK && s.subpaths.length > 1

  it("RW-320: тело батареи закрывает штриховку — заливка цветом бумаги после штриховки", () => {
    const ops = draw(viewOf(leftRoom(), { batteries: [battery] }))
    const fills = ops.filter((o) => o.kind === "fill" && o.fillStyle === PAPER && !o.hasArc)
    expect(fills).toHaveLength(1)
    const [fill] = fills
    const corners = fill!.kind === "fill" ? fill!.subpaths[0]!.map((p) => [p.x / K, p.y / K]) : []
    expect(corners.map(([x, y]) => [Math.round(x!), Math.round(y!)]).sort()).toEqual([[15, 340], [15, 420], [25, 340], [25, 420]])
    expect(Math.max(...strokes(ops).filter(isHatch).map((s) => s.index))).toBeLessThan(fill!.index)
  })

  it("RW-321: без стяжки заливки под батареей нет", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 520) })
    expect(draw(viewOf(d, { batteries: [battery] })).filter((o) => o.kind === "fill" && o.fillStyle === PAPER && !o.hasArc)).toHaveLength(0)
  })

  it("RW-322: число размера — на подложке цвета бумаги и поверх подписи стяжки", () => {
    const ops = draw(viewOf(leftRoom()))
    const label = texts(ops).find((t) => t.text === ROOM_LABEL)
    const numbers = texts(ops).filter((t) => t.text !== ROOM_LABEL)
    expect(label).toBeDefined()
    expect(numbers.length).toBeGreaterThan(0)
    for (const n of numbers) {
      expect(n.index).toBeGreaterThan(label!.index)
      const backing = ops[n.index - 1]
      expect(backing?.kind).toBe("fillRect")
      expect(backing?.kind === "fillRect" && backing.fillStyle).toBe(PAPER)
    }
  })

  it("RW-323: пол (штриховка) рисуется раньше стен, полотен и остальных объектов", () => {
    const door: WallElement = { kind: "door", id: "dr", wallId: "k1", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210, hinge: "a", swing: "right" }
    const ops = draw(viewOf({ ...leftRoom(), doorways: [door] }))
    const grey = strokes(ops).filter((s) => s.strokeStyle === LIGHT_PALETTE.muted)
    expect(grey.length).toBeGreaterThan(0)
    // штриховка помещения; порог двери (полоса x 100..190 см у стены k1) рисуется слоем проёма, его порядок проверяет RW-310b
    const inThreshold = (s: StrokeOp): boolean => s.subpaths.flat().every((p) => p.x >= 100 * K - 1e-6 && p.x <= 190 * K + 1e-6)
    const roomHatch = strokes(ops).filter((s) => isHatch(s) && !inThreshold(s))
    expect(roomHatch.length).toBeGreaterThan(0)
    expect(Math.max(...roomHatch.map((s) => s.index))).toBeLessThan(Math.min(...grey.map((s) => s.index)))
  })
})

describe("порог: фаза, подложка слоёв, окно", () => {
  const both = (): Drawing => partitioned([screed("l", 100, 260, 65), screed("r", 300, 260, 65)])

  it("RW-314: фаза штриховки порога общая с помещениями — линии лежат на одной сетке x + y = const", () => {
    const ops = draw(viewOf(both()))
    // начало координат на экране — (0, 0): линии «/» стоят на x + y, кратных шагу штриховки
    const step = SCREED_HATCH.stepMm * SCREEN_METRICS.mmPx * Math.SQRT2
    const onGrid = (p: { x: number; y: number }): boolean => {
      const r = (p.x + p.y) % step
      return Math.min(r, step - r) < 1e-4
    }
    const room = strokes(draw(viewOf(both()))).filter((s) => s.strokeStyle === INK && s.subpaths.length > 1 && s.subpaths.every((sp) => sp.length === 2) && !hatchBetween(ops, 200, 220).includes(s))
    const threshold = hatchBetween(ops, 200, 220)
    expect(threshold.length).toBeGreaterThan(0)
    expect(room.length).toBeGreaterThan(0)
    for (const s of [...threshold, ...room.slice(0, 2)]) for (const sp of s.subpaths) expect(onGrid(sp[0]!), `линия ${JSON.stringify(sp[0])}`).toBe(true)
  })

  it("RW-324: число размера рисуется выше блока помещения и подписи стяжки", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260, 65)], roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 30)] })
    const s = roughScene(d)
    const ops = draw(viewOf(d, { blocks: roomBlocksOf(s.netItems) }))
    const blockTexts = texts(ops).filter((t) => t.text === "1" || t.text.startsWith("H="))
    const numbers = texts(ops).filter((t) => t.text !== ROOM_LABEL && !blockTexts.includes(t))
    expect(blockTexts.length).toBeGreaterThan(0)
    expect(numbers.length).toBeGreaterThan(0)
    for (const n of numbers) for (const b of blockTexts) expect(n.index).toBeGreaterThan(b.index)
  })

  it("RW-325: полотно двери рисуется выше штриховки порога", () => {
    const door: WallElement = { kind: "door", id: "dr", wallId: "p", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 210, hinge: "a", swing: "left" }
    const ops = draw(viewOf(drawing({ walls: [...rectWalls("k", 0, 0, 420, 520), wall("p", 210, 0, 210, 520)], doorways: [door], roughScreeds: [screed("l", 100, 260, 65), screed("r", 300, 260, 65)] })))
    const hatch = hatchBetween(ops, 200, 220)
    expect(hatch).toHaveLength(2)
    const afterFill = Math.min(...hatch.map((h) => h.index))
    // полотно — замкнутый прямоугольник из пяти точек серого цвета подложки, нарисованный после закраски проёма
    const leaf = strokes(ops).filter((s) => s.strokeStyle === LIGHT_PALETTE.muted && s.index > afterFill && s.subpaths.some((sp) => sp.length === 5))
    expect(leaf.length).toBeGreaterThan(0)
    for (const l of leaf) expect(l.index).toBeGreaterThan(Math.max(...hatch.map((h) => h.index)))
  })

  it("RW-306b: окно в перегородке порога не имеет: ни штриховки, ни линии", () => {
    const win: WallElement = { kind: "window", id: "w", wallId: "p", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 120, sillCm: 90 }
    const ops = draw(viewOf(drawing({ walls: [...rectWalls("k", 0, 0, 420, 520), wall("p", 210, 0, 210, 520)], doorways: [win], roughScreeds: [screed("l", 100, 260, 50), screed("r", 300, 260, 65)] })))
    expect(hatchBetween(ops, 200, 220)).toHaveLength(0)
    expect(dividerIn(ops)).toHaveLength(0)
  })
})