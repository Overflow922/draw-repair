import { describe, expect, it } from "vitest"
import { batteryRect } from "../battery/battery-geometry"
import { hostOfBattery } from "../battery/battery-motion"
import { findRooms } from "../room-area"
import type { Room } from "../room-area"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, FillOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { openingOn, rectWalls } from "../rough/rough.test-utils"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Battery, FurnitureItem, StretchCeiling, Wall } from "../types"
import { pointInPolygon } from "../wall-geometry"
import { CEILING_ALPHA, drawCeilingScene } from "./ceiling-render"
import type { CeilingView, Translucent } from "./ceiling-render"

// change add-ceiling-plan: отрисовка плана «Потолки и освещение» на холсте
// (spec ceiling-plan «Цвет натяжного потолка», «Отображение плана», «Мебель на плане»; design D7)
//
//  вид сверху, схематично, не в масштабе. Комната K, внутренняя область [10,410]×[10,310]; стол T 80 × 160 в центре (200, 160);
//  потолок 50 мм с опорной точкой (300, 100)
//
//   ##########################
//   #yyyyyyyyyyyyyyy -50мм yy#
//   #yyyyyyy[yTy]yyyyyyyyyyyy#     y — полупрозрачная жёлтая заливка поверх стен подложки и стола; подпись — поверх заливки
//   #yyyyyyy[yyy]yyyyyyyyyyyy#
//   ##########################

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WALLS = rectWalls("k", 0, 0, 420, 320)
const ROOM = (): Room => {
  const [room] = findRooms(WALLS)
  if (!room) throw new Error("нет помещения")
  return room
}
const table: FurnitureItem = { id: "t", kind: "table", x: 200, y: 160, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const ceiling: StretchCeiling = { id: "c", at: { x: 300, y: 100 }, dropMm: 50 }
const battery: Battery = { id: "b", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 80, thicknessCm: 10, gapCm: 5 }

const viewOf = (extra: Partial<CeilingView> = {}): CeilingView => ({
  walls: WALLS,
  doorways: [],
  pieces: [],
  drywall: [],
  items: [table],
  ceilings: [{ ceiling, room: ROOM() }],
  ...extra,
})

const draw = (view: CeilingView, theme: "light" | "dark" = "light"): DrawOp[] => {
  const rec = recordingContext()
  drawCeilingScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette: theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE, theme })
  return rec.ops
}

const fills = (ops: DrawOp[], style: string): FillOp[] => ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === style)
const strokes = (ops: DrawOp[], style: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === style)
const texts = (ops: DrawOp[]): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText")

describe("цвет натяжного потолка", () => {
  it("CP-100: жёлтый задан в обеих схемах, на тёмной — свой; прозрачность заливки одна, строго между 0 и 1", () => {
    expect(LIGHT_PALETTE.ceiling).toBe("#ffd600")
    expect(DARK_PALETTE.ceiling).toBe("#e0b400")
    expect(CEILING_ALPHA).toBeGreaterThan(0)
    expect(CEILING_ALPHA).toBeLessThan(1)
  })

  it("CP-111: заливка каждого потолка рисуется полупрозрачной — внутри рисования с прозрачностью CEILING_ALPHA", () => {
    const rec = recordingContext()
    const calls: { alpha: number; fills: number }[] = []
    const translucent: Translucent = (alpha, paint) => {
      const before = rec.ops.length
      paint()
      calls.push({ alpha, fills: rec.ops.slice(before).filter((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.ceiling).length })
    }
    const second = findRooms(WALLS)[0]
    if (!second) throw new Error("нет помещения")
    drawCeilingScene(rec.ctx, 800, 600, viewOf({ ceilings: [{ ceiling, room: ROOM() }, { ceiling: { ...ceiling, id: "c2" }, room: second }] }), "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light", translucent })
    expect(calls).toEqual([
      { alpha: CEILING_ALPHA, fills: 1 },
      { alpha: CEILING_ALPHA, fills: 1 },
    ])
    // вне рисования с прозрачностью заливки цветом потолка нет
    expect(fills(rec.ops, LIGHT_PALETTE.ceiling)).toHaveLength(2)
  })

  it("CP-101: на тёмной схеме заливка — цветом тёмной схемы", () => {
    expect(fills(draw(viewOf(), "dark"), DARK_PALETTE.ceiling)).toHaveLength(1)
    expect(fills(draw(viewOf(), "dark"), LIGHT_PALETTE.ceiling)).toHaveLength(0)
  })
})

describe("слои плана", () => {
  it("CP-102: помещение с потолком залито жёлтым по контуру помещения, острова не залиты (even-odd)", () => {
    const [fill] = fills(draw(viewOf()), LIGHT_PALETTE.ceiling)
    expect(fill?.subpaths[0]).toHaveLength(ROOM().outline.length)
    expect(fill?.rule).toBe("evenodd")
  })

  it("CP-103: заливка поверх подложки и мебели: после стен подложки и линий стола, до подписи", () => {
    const ops = draw(viewOf())
    const fill = fills(ops, LIGHT_PALETTE.ceiling)[0]?.index ?? -1
    const lastGrey = Math.max(...strokes(ops, LIGHT_PALETTE.muted).map((o) => o.index))
    const label = texts(ops).find((o) => o.text === "-50мм")?.index ?? -1
    expect(fill).toBeGreaterThan(lastGrey)
    expect(label).toBeGreaterThan(fill)
  })

  it("CP-104: мебель — серыми линиями цвета подложки; габаритов «80» и «160» нет", () => {
    const ops = draw(viewOf())
    expect(texts(ops).map((t) => t.text)).toEqual(["-50мм"])
    const withTable = strokes(ops, LIGHT_PALETTE.muted).length
    const without = strokes(draw(viewOf({ items: [] })), LIGHT_PALETTE.muted).length
    expect(withTable).toBeGreaterThan(without)
    expect(strokes(ops, LIGHT_PALETTE.ink).length).toBe(strokes(draw(viewOf({ items: [] })), LIGHT_PALETTE.ink).length)
  })

  it("CP-105: подпись «-50мм» — поверх линий стола и заливки, на непрозрачной подложке цвета бумаги", () => {
    const ops = draw(viewOf())
    const fill = fills(ops, LIGHT_PALETTE.ceiling)[0]?.index ?? Infinity
    const label = texts(ops).find((o) => o.text === "-50мм")?.index ?? -1
    const backing = ops.filter((o) => o.kind === "fillRect" && o.fillStyle === LIGHT_PALETTE.paper && o.index > fill && o.index < label)
    expect(label).toBeGreaterThan(fill)
    expect(backing).toHaveLength(1)
  })

  it("CP-106: без потолков заливки и подписей нет", () => {
    const ops = draw(viewOf({ ceilings: [] }))
    expect(fills(ops, LIGHT_PALETTE.ceiling)).toEqual([])
    expect(texts(ops)).toEqual([])
  })

  it("CP-107: батарея нарисована до заливки, и заливка её накрывает — белых пятен нет", () => {
    const ops = draw(viewOf({ batteries: [battery] }))
    const plain = draw(viewOf())
    const fill = fills(ops, LIGHT_PALETTE.ceiling)[0]?.index ?? -1
    // всё, что батарея добавила к рисунку, нарисовано раньше заливки
    const before = (list: DrawOp[], at: number): number => list.filter((o) => o.index < at).length
    const plainFill = fills(plain, LIGHT_PALETTE.ceiling)[0]?.index ?? -1
    expect(before(ops, fill)).toBeGreaterThan(before(plain, plainFill))
    expect(ops.length - fill).toBe(plain.length - plainFill)
    // тело батареи стоит в помещении: его центр внутри контура, который заливается
    const host = hostOfBattery(battery, WALLS)
    if (!host) throw new Error("нет стены батареи")
    const rect = batteryRect(battery, host)
    const center = { x: rect.reduce((s, q) => s + q.x, 0) / rect.length, y: rect.reduce((s, q) => s + q.y, 0) / rect.length }
    expect(pointInPolygon(center, ROOM().outline)).toBe(true)
  })

  it("CP-108: ластик над потолком — контур помещения цветом ластика", () => {
    expect(strokes(draw(viewOf({ erasingCeilingId: "c" })), LIGHT_PALETTE.erase)).toHaveLength(1)
    expect(strokes(draw(viewOf()), LIGHT_PALETTE.erase)).toHaveLength(0)
  })

  //  две комнаты за перегородкой P (ось x = 200, толщина 20) с дверным проёмом 90 см:
  //
  //   ##########################
  //   #yyyyyyyyyy#yyyyyyyyyyyyy#
  //   #yyyyyyyyyy   yyyyyyyyyyy#   <-- проём в толще P (190 < x < 210) не закрашен
  //   #yyyyyyyyyy#yyyyyyyyyyyyy#
  //   ##########################
  it("CP-109: порог не закрашен — заливки обоих помещений не заходят в толщу перегородки с проёмом", () => {
    const p: Wall = { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" }
    const walls = [...WALLS, p]
    const rooms = findRooms(walls)
    expect(rooms).toHaveLength(2)
    const ceilings = rooms.map((room, i) => ({ ceiling: { id: `c${i}`, at: room.outline[0] ?? { x: 0, y: 0 }, dropMm: 50 }, room }))
    const fill = fills(draw(viewOf({ walls, doorways: [openingOn("d", "p", 100, 90)], items: [], ceilings })), LIGHT_PALETTE.ceiling)
    expect(fill).toHaveLength(2)
    // точки записаны в пикселях холста: 2 px/см при zoom 1, толща перегородки — 380 < x < 420 px
    const xs = fill.flatMap((f) => f.subpaths.flat()).map((pt) => pt.x)
    expect(xs).toContain(380)
    expect(xs).toContain(420)
    for (const x of xs) expect(x > 380 + 1e-6 && x < 420 - 1e-6).toBe(false)
  })

  it("CP-110: стол, пересекающий стену, нарисован без красной подсветки пересечения", () => {
    const crossing: FurnitureItem = { ...table, x: 20 }
    const ops = draw(viewOf({ items: [crossing] }))
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle.startsWith("rgba(220, 38, 38"))).toBe(false)
    expect(strokes(ops, LIGHT_PALETTE.muted).length).toBeGreaterThan(strokes(draw(viewOf({ items: [] })), LIGHT_PALETTE.muted).length)
  })
})