import { describe, expect, it } from "vitest"
import { rectWalls, wall } from "../rough/rough.test-utils"
import type { FurnitureItem, Wall } from "../types"
import { applyItemNumber } from "./item-edit"
import type { ItemNumberField, ItemSide } from "./item-number"
import { itemWallReach, reachBodies } from "./item-wall-reach"

// change furniture-dimensions: ввод в числа выделенного предмета (spec furniture-plan «Правка габаритов на месте»,
// «Правка расстояний до стен»). Помещение — внутренние грани x = 0, x = 400, y = 0, y = 300.

const ROOM = (): Wall[] => rectWalls("w", -10, -10, 410, 310)
const BODIES = reachBodies(ROOM())

const item = (x: number, y: number, widthCm = 80, lengthCm = 160, angleDeg = 0): FurnitureItem => ({ id: "t", kind: "table", x, y, widthCm, lengthCm, angleDeg })
const width: ItemNumberField = { kind: "size", size: "width" }
const length: ItemNumberField = { kind: "size", size: "length" }
const distance = (side: ItemSide): ItemNumberField => ({ kind: "distance", side })
const reach = (t: FurnitureItem, side: ItemSide, bodies = BODIES): number | null => itemWallReach(t, side, bodies)?.t ?? null

describe("ввод габарита", () => {
  it("FD-300: ширина 120 у стола 80 × 160 с центром (200, 100) — центр на месте, стол по x от 140 до 260", () => {
    const next = applyItemNumber(item(200, 100), width, 120, BODIES)
    expect(next).toEqual({ ...item(200, 100), widthCm: 120 })
  })

  it("FD-301: длина меняется так же, угол и центр не меняются", () => {
    const next = applyItemNumber(item(200, 100, 80, 160, 30), length, 200, BODIES)
    expect(next).toEqual({ ...item(200, 100, 80, 160, 30), lengthCm: 200 })
  })

  it("FD-302: 0, отрицательное и нечисло не применяются", () => {
    for (const v of [0, -5, Number.NaN]) {
      expect(applyItemNumber(item(200, 100), width, v, BODIES)).toBeNull()
      expect(applyItemNumber(item(200, 100), length, v, BODIES)).toBeNull()
    }
  })

  it("FD-303: то же значение — изменения нет", () => {
    expect(applyItemNumber(item(200, 100), width, 80, BODIES)).toBeNull()
  })
})

describe("ввод расстояния", () => {
  it("FD-310: 20 в число слева (было 60) — центр (60, 120), расстояния 20, 300, 40, 100", () => {
    const next = applyItemNumber(item(100, 120), distance("left"), 20, BODIES)
    if (!next) throw new Error("ввод не применён")
    expect(next.x).toBeCloseTo(60, 6)
    expect(next.y).toBeCloseTo(120, 6)
    expect(next.widthCm).toBe(80)
    expect(next.lengthCm).toBe(160)
    expect(next.angleDeg).toBe(0)
    expect(reach(next, "left")).toBeCloseTo(20, 6)
    expect(reach(next, "right")).toBeCloseTo(300, 6)
    expect(reach(next, "top")).toBeCloseTo(40, 6)
    expect(reach(next, "bottom")).toBeCloseTo(100, 6)
  })

  it("FD-311: повёрнутый стул (угол 45) — ввод 50 в «101» сдвигает его вдоль нормали стороны на 101,4 − 50, угол и размеры прежние", () => {
    const bodies = reachBodies([wall("W", -10, -1000, -10, 1000)])
    const chair: FurnitureItem = { id: "c", kind: "chair", x: 100, y: 100, widthCm: 40, lengthCm: 40, angleDeg: 45 }
    const before = reach(chair, "left", bodies)
    if (before === null) throw new Error("нет расстояния")
    const next = applyItemNumber(chair, distance("left"), 50, bodies)
    if (!next) throw new Error("ввод не применён")
    // нормаль левой стороны при угле 45 — (−cos 45, −sin 45)
    const shift = before - 50
    expect(next.x).toBeCloseTo(100 - shift * Math.SQRT1_2, 6)
    expect(next.y).toBeCloseTo(100 - shift * Math.SQRT1_2, 6)
    expect(next.angleDeg).toBe(45)
    expect(next.widthCm).toBe(40)
    expect(reach(next, "left", bodies)).toBeCloseTo(50, 6)
  })

  it("FD-312: 0 — сторона вплотную к грани", () => {
    const next = applyItemNumber(item(100, 120), distance("bottom"), 0, BODIES)
    if (!next) throw new Error("ввод не применён")
    expect(next.y + 80).toBeCloseTo(300, 6)
    expect(reach(next, "bottom")).toBeCloseTo(0, 6)
  })

  it("FD-313: больше свободного места — стол сдвинут на 290 вправо, правая сторона за гранью x = 400 на 30 см", () => {
    const next = applyItemNumber(item(100, 120), distance("left"), 350, BODIES)
    if (!next) throw new Error("ввод не применён")
    expect(next.x).toBeCloseTo(390, 6)
    expect(reach(next, "right")).toBeCloseTo(-30, 6)
  })

  it("FD-314: «0» у стола, зашедшего на 10 см за грань x = 0, — стол сдвинут на 10 вправо, левая сторона на x = 0", () => {
    const next = applyItemNumber(item(30, 120), distance("left"), 0, BODIES)
    if (!next) throw new Error("ввод не применён")
    expect(next.x).toBeCloseTo(40, 6)
    expect(reach(next, "left")).toBeCloseTo(0, 6)
  })

  it("FD-315: отрицательное значение и нечисло не применяются", () => {
    expect(applyItemNumber(item(100, 120), distance("left"), -5, BODIES)).toBeNull()
    expect(applyItemNumber(item(100, 120), distance("left"), Number.NaN, BODIES)).toBeNull()
  })

  it("FD-316: то же значение — изменения нет", () => {
    expect(applyItemNumber(item(100, 120), distance("left"), 60, BODIES)).toBeNull()
  })

  it("FD-317: без стены по направлению ввод не применяется", () => {
    const bodies = reachBodies([wall("L", -10, -10, -10, 310)])
    expect(applyItemNumber(item(100, 120), distance("right"), 50, bodies)).toBeNull()
  })

  it("FD-318: без центровки — 163 слева ставит центр в x = 203, в 3 см от линии центра стены x = 200, и он к ней не прилипает", () => {
    const next = applyItemNumber(item(100, 120), distance("left"), 163, BODIES)
    expect(next?.x).toBeCloseTo(203, 9)
  })
})
