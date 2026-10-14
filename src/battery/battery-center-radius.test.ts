import { describe, expect, it } from "vitest"
import { centerSnapRadiusCm, snapRadiusCm } from "../wall-snap"
import { DEFAULT_BATTERY_PARAMS, placeBattery, slideBattery } from "./battery-place"
import { batteryToolOf } from "./battery-tool.test-utils"
import { applied, bat, ctxOf, sceneR, windowAt } from "./battery.test-utils"

// change fix-battery-centering-and-numbers: радиус центровки 35 px (spec battery «Центровка по окну», сценарии «Радиус
// центровки 35 пикселей», «Радиус центровки растёт с уменьшением масштаба»; design D1).
// Сцена R: W (0,0)-(500,0) t20, окно [200,320] (центр 260), батарея X [100,170] (центр 135).

const { walls, W } = sceneR()
const win = windowAt("W", "a", 200)
const X = bat("W", "a", 100)

describe("радиус центровки в сантиметрах", () => {
  it("масштаб 1: 35 px = 17,5 см; масштаб 0,25: 70 см", () => {
    expect(centerSnapRadiusCm(1)).toBe(17.5)
    expect(centerSnapRadiusCm(0.25)).toBe(70)
  })

  it("обычный радиус привязок не изменился: 12 px = 6 см при масштабе 1", () => {
    expect(snapRadiusCm(1)).toBe(6)
  })
})

describe("прилипание в радиусе центровки", () => {
  const ctx = (zoom: number) => ctxOf({ elements: [win], snapCm: centerSnapRadiusCm(zoom) })

  it("масштаб 1: центр на x = 277 (17 см от 260) прилипает; на x = 279 (19 см) — нет", () => {
    // исходный центр 135, смещение 142 → центр 277
    expect(applied(slideBattery(X, walls, { x: 142, y: 0 }, ctx(1))).offsetCm).toBe(225)
    // центр 279 → расстояние привязки 244
    expect(applied(slideBattery(X, walls, { x: 144, y: 0 }, ctx(1))).offsetCm).toBe(244)
  })

  it("масштаб 0,25: центр на x = 330 (70 см от 260) прилипает", () => {
    expect(applied(slideBattery(X, walls, { x: 195, y: 0 }, ctx(0.25))).offsetCm).toBe(225)
  })

  it("установка: курсор на x = 277 при масштабе 1 ставит призрак центрированным", () => {
    expect(placeBattery(W, walls, { x: 277, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctx(1))?.offsetCm).toBe(225)
  })
})

describe("адаптер использует радиус центровки, а не радиус попадания", () => {
  const cursor = { x: 277, y: 5 } // центр призрака на 17 см от центра окна

  it("радиус попадания 6 см, радиус центровки 17,5 см → призрак центрирован", () => {
    const { tool } = batteryToolOf({ walls, elements: [win], radiusCm: 6, centerRadiusCm: 17.5 })
    tool.hover(cursor)
    expect(tool.ghost()?.offsetCm).toBe(225)
  })

  it("радиус попадания 17,5 см, радиус центровки 1 см → призрак не центрирован", () => {
    const { tool } = batteryToolOf({ walls, elements: [win], radiusCm: 17.5, centerRadiusCm: 1 })
    tool.hover(cursor)
    expect(tool.ghost()?.offsetCm).toBe(242)
  })

  it("клик ставит батарею центрированной, в хранимых данных нет полей риски или окна", () => {
    const h = batteryToolOf({ walls, elements: [win] })
    expect(h.tool.place(cursor)).toBe(true)
    const placed = h.batteries()[0]
    expect(placed.offsetCm).toBe(225)
    expect(Object.keys(placed).sort()).toEqual(["anchor", "face", "gapCm", "id", "lengthCm", "offsetCm", "thicknessCm", "wallId"])
  })

  it("перетаскивание: радиус центровки 17,5 см, радиус попадания 6 см → батарея прилипает", () => {
    const h = batteryToolOf({ walls, batteries: [X], elements: [win] })
    expect(h.tool.pressBody({ x: 135, y: 8 })).toBe(true)
    h.tool.dragTo({ x: 277, y: 8 })
    h.tool.endDrag()
    expect(h.batteries()[0].offsetCm).toBe(225)
  })
})
