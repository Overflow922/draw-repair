import { describe, expect, it } from "vitest"
import { reachBodies } from "../furniture/item-wall-reach"
import { findRooms } from "../room-area"
import type { Room } from "../room-area"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { LightFixture, StretchCeiling } from "../types"
import { drawCeilingScene } from "./ceiling-render"
import type { CeilingView } from "./ceiling-render"

// change add-ceiling-lighting: объекты освещения на холсте плана «Потолки и освещение»
// (spec ceiling-plan «Отображение плана «Потолки и освещение»»; ceiling-lighting «Расстояния точки освещения до стен»; design D6)
//
//  вид сверху, схематично, не в масштабе. Помещение — внутренние грани x = 0, x = 400, y = 0, y = 300; потолок 50 мм
//
//   ####################################
//   #yyyyyyyyy^yyyyyyyyyyyyyyyyyyyyyyyy#
//   #yyyyyyyyy|80yyyyyyyyyy -50мм yyyyy#     числа и знак — поверх заливки и подписи потолка
//   #<--100-->(+)yyyyyyyyyyyyyyyyyyyyyy#
//   ####################################

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WALLS = rectWalls("w", -10, -10, 410, 310)
const ROOM = (): Room => {
  const [room] = findRooms(WALLS)
  if (!room) throw new Error("нет помещения")
  return room
}
const ceiling: StretchCeiling = { id: "c", at: { x: 300, y: 100 }, dropMm: 50 }
const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })

const viewOf = (extra: Partial<CeilingView> = {}): CeilingView => ({
  walls: WALLS,
  doorways: [],
  pieces: [],
  drywall: [],
  items: [],
  ceilings: [{ ceiling, room: ROOM() }],
  lights: [spot("a", 100, 80)],
  lightBodies: reachBodies(WALLS),
  ...extra,
})

const draw = (view: CeilingView): DrawOp[] => {
  const rec = recordingContext()
  drawCeilingScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const texts = (ops: DrawOp[]): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText")
const redStrokes = (ops: DrawOp[]): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)

describe("освещение на холсте", () => {
  it("CL-V1: числа всех объектов видны без выделения", () => {
    const ops = draw(viewOf({ lights: [spot("a", 100, 80), spot("b", 300, 200)] }))
    expect(texts(ops).map((t) => t.text).filter((t) => /^\d+$/.test(t)).sort()).toEqual(["100", "100", "100", "80"].sort())
  })

  it("CL-V2: слои — заливка потолка, подпись «-50мм», числа освещения, знаки", () => {
    const ops = draw(viewOf())
    const fill = ops.findIndex((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.ceiling)
    const label = ops.findIndex((o) => o.kind === "fillText" && o.text === "-50мм")
    const number = ops.findIndex((o) => o.kind === "fillText" && o.text === "100")
    const symbol = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)
    expect(fill).toBeGreaterThanOrEqual(0)
    expect(fill).toBeLessThan(label)
    expect(label).toBeLessThan(number)
    expect(number).toBeLessThan(symbol)
  })

  it("CL-V3: знак рисуется непрозрачным цветом освещения поверх заливки", () => {
    const ops = draw(viewOf())
    expect(redStrokes(ops).length).toBeGreaterThan(0)
  })

  it("CL-V4: призрак показан со своими числами", () => {
    const ops = draw(viewOf({ lights: [], lightGhost: spot("ghost", 100, 80) }))
    expect(texts(ops).map((t) => t.text)).toEqual(expect.arrayContaining(["100", "80"]))
    expect(redStrokes(ops).length).toBeGreaterThan(0)
  })

  it("CL-V5: выделенный и стираемый объект подсвечены своими цветами; без выделения подсветки нет", () => {
    const plain = draw(viewOf())
    expect(plain.some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.selection)).toBe(false)
    expect(draw(viewOf({ selectedLightId: "a" })).some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.selection)).toBe(true)
    expect(draw(viewOf({ erasingLightId: "a" })).some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.erase)).toBe(true)
  })

  it("CL-V6: без объектов освещения отрисовка прежняя — ни знаков, ни чисел", () => {
    const ops = draw(viewOf({ lights: [] }))
    expect(redStrokes(ops)).toEqual([])
    expect(texts(ops).map((t) => t.text)).toEqual(["-50мм"])
  })
})
