import { describe, expect, it } from "vitest"
import type { Shape } from "../communications/shape"
import { reachBodies } from "../furniture/item-wall-reach"
import { doorOn, openingOn, rectWalls } from "../rough/rough.test-utils"
import type { Wall } from "../types"
import { openingBodies, snapSwitch } from "./switch-reach"

// change add-light-switch: грани стен для выключателей (spec light-switch «Грани стен для выключателей»). Помещение сценариев —
// внутренние грани x = 0, x = 400, y = 0, y = 300: оси стен толщиной 20 см на x = −10, x = 410, y = −10, y = 310; внешние грани
// x = −20, x = 420, y = −20, y = 320. Северная стена w1 идёт от (−10, −10) к (410, −10). Угол нормали — как у бра: −90 вверх, 90 вниз.

const MAX_CM = 40
const ROOM = (): Wall[] => rectWalls("w", -10, -10, 410, 310)

describe("грани выключателя", () => {
  it("SW-F1: внешняя грань — призрак на внешней грани, нормаль наружу (от помещения)", () => {
    const snap = snapSwitch({ x: 120, y: -40 }, reachBodies(ROOM()), [], MAX_CM)
    expect(snap?.at).toEqual({ x: 120, y: -20 })
    expect(snap?.angle).toBeCloseTo(-90, 9)
  })

  it("SW-F2: внутренняя грань — призрак на внутренней грани, нормаль в помещение", () => {
    const snap = snapSwitch({ x: 120, y: 15 }, reachBodies(ROOM()), [], MAX_CM)
    expect(snap?.at).toEqual({ x: 120, y: 0 })
    expect(snap?.angle).toBeCloseTo(90, 9)
  })

  it("SW-F3: вдоль грани — целое число сантиметров", () => {
    const snap = snapSwitch({ x: 120.4, y: -40 }, reachBodies(ROOM()), [], MAX_CM)
    expect(snap?.at.x).toBe(120)
  })

  it("SW-F4: далеко от стены — призрака нет", () => {
    expect(snapSwitch({ x: 200, y: 150 }, reachBodies(ROOM()), [], MAX_CM)).toBeNull()
  })

  it("SW-F5: курсор внутри тела стены — призрака нет", () => {
    expect(snapSwitch({ x: 120, y: -10 }, reachBodies(ROOM()), [], MAX_CM)).toBeNull()
  })

  it("SW-F6: штукатурка 3 см на внутренней грани — центр на поверхности штукатурки", () => {
    const plaster: Shape = { kind: "poly", pts: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 3 }, { x: 0, y: 3 }] }
    const snap = snapSwitch({ x: 120, y: 20 }, [...reachBodies(ROOM()), plaster], [], MAX_CM)
    expect(snap?.at).toEqual({ x: 120, y: 3 })
    expect(snap?.angle).toBeCloseTo(90, 9)
  })
})

describe("проёмы", () => {
  // проём на w1: от x = 90 до x = 180 (offset 100 от конца a в x = −10, ширина 90)
  const north = (): Shape[] => openingBodies(ROOM(), [openingOn("o", "w1", 100, 90)])

  it("SW-O1: точка грани в проёме — призрака нет, с обеих сторон стены", () => {
    expect(snapSwitch({ x: 120, y: -40 }, reachBodies(ROOM()), north(), MAX_CM)).toBeNull()
    expect(snapSwitch({ x: 120, y: 15 }, reachBodies(ROOM()), north(), MAX_CM)).toBeNull()
  })

  it("SW-O2: за откосом проёма грань доступна", () => {
    expect(snapSwitch({ x: 200, y: -40 }, reachBodies(ROOM()), north(), MAX_CM)?.at).toEqual({ x: 200, y: -20 })
    expect(snapSwitch({ x: 80, y: 15 }, reachBodies(ROOM()), north(), MAX_CM)?.at).toEqual({ x: 80, y: 0 })
  })

  it("SW-O3: дверь и окно занимают грань так же, как проём; опора от конца b", () => {
    const door = openingBodies(ROOM(), [doorOn("d", "w1", 100, 90)])
    expect(snapSwitch({ x: 120, y: -40 }, reachBodies(ROOM()), door, MAX_CM)).toBeNull()
    const fromB = openingBodies(ROOM(), [openingOn("o", "w1", 30, 60, "b")]) // x от 320 до 380
    expect(snapSwitch({ x: 350, y: 15 }, reachBodies(ROOM()), fromB, MAX_CM)).toBeNull()
    expect(snapSwitch({ x: 300, y: 15 }, reachBodies(ROOM()), fromB, MAX_CM)?.at).toEqual({ x: 300, y: 0 })
  })

  it("SW-O4: элемент несуществующей стены ничего не занимает", () => {
    expect(openingBodies(ROOM(), [openingOn("o", "nope", 0, 50)])).toEqual([])
  })
})
