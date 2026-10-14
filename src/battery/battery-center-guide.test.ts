import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import { centerGuide } from "./battery-guide"
import { centeredWindow } from "./battery-motion"
import { batteryToolOf } from "./battery-tool.test-utils"
import { bat, sceneR, windowAt } from "./battery.test-utils"

// change fix-battery-centering-and-numbers: риска центровки (spec battery «Риска центровки»; design D2).
// Сцена R: W (0,0)-(500,0) t20, окно [200,320] (центр 260), батарея X [100,170], радиус центровки по умолчанию 17,5 см.

const { walls, W } = sceneR()
const win = windowAt("W", "a", 200)
const centred = bat("W", "a", 225) // [225,295], центр 260

describe("centeredWindow: центр батареи на центре окна", () => {
  it("батарея по центру окна → центр окна (260)", () => {
    expect(centeredWindow(centred, W, [win])).toBe(260)
  })

  it("батарея сдвинута на 5 см → нет", () => {
    expect(centeredWindow(bat("W", "a", 230), W, [win])).toBeNull()
  })

  it("дробное положение (длина 71, расстояние 224,5) → центр окна", () => {
    expect(centeredWindow(bat("W", "a", 224.5, { lengthCm: 71 }), W, [win])).toBe(260)
  })

  it("окно на другой стене в расчёт не входит", () => {
    expect(centeredWindow(centred, W, [windowAt("R", "a", 100)])).toBeNull()
  })

  it("несколько окон: возвращается то, на чьём центре стоит батарея", () => {
    const left = windowAt("W", "a", 100, 120, "wl") // центр 160
    expect(centeredWindow(centred, W, [left, win])).toBe(260)
  })

  it("окон нет → нет", () => {
    expect(centeredWindow(centred, W, [])).toBeNull()
  })
})

describe("centerGuide: отрезок поперёк оси через общий центр", () => {
  const PX = 6

  it("грань +1: от дальней грани стены (y = −10) до передней стороны батареи (y = 23) и чуть дальше", () => {
    const g = centerGuide(centred, W, 260, 2, PX)
    expect(g.from.x).toBeCloseTo(260, 6)
    expect(g.to.x).toBeCloseTo(260, 6)
    expect(g.from.y).toBeCloseTo(-10, 6)
    expect(g.to.y).toBeGreaterThan(23)
  })

  it("грань −1: зеркально — от y = 10 до передней стороны y = −23 и чуть дальше", () => {
    const outer = bat("W", "a", 225, { face: -1 })
    const g = centerGuide(outer, W, 260, 2, PX)
    expect(g.from.y).toBeCloseTo(10, 6)
    expect(g.to.y).toBeLessThan(-23)
  })

  it("выступ за переднюю сторону — в экранных пикселях: одинаковый при разном зуме", () => {
    const near = centerGuide(centred, W, 260, 2, PX) // масштаб 1
    const far = centerGuide(centred, W, 260, 1, PX) // масштаб 0,5
    const pxNear = (near.to.y - 23) * 2
    const pxFar = (far.to.y - 23) * 1
    expect(pxNear).toBeCloseTo(PX, 6)
    expect(pxFar).toBeCloseTo(PX, 6)
  })

  it("риска пересекает тело стены и прямоугольник батареи", () => {
    const g = centerGuide(centred, W, 260, 2, PX)
    const ys = [g.from.y, g.to.y].sort((p, q) => p - q)
    expect(ys[0]).toBeLessThanOrEqual(-10) // дальняя грань стены
    expect(ys[1]).toBeGreaterThanOrEqual(23) // передняя сторона батареи
  })
})

describe("риска не сохраняется", () => {
  it("центрированная установка: в батарее нет полей риски или окна, в документе нет следов риски", () => {
    const h = batteryToolOf({ walls, elements: [win] })
    h.tool.hover({ x: 258, y: 5 })
    expect(h.tool.guide()).not.toBeNull()
    expect(h.tool.place({ x: 258, y: 5 })).toBe(true)
    const placed = h.batteries()[0]
    expect(Object.keys(placed).sort()).toEqual(["anchor", "face", "gapCm", "id", "lengthCm", "offsetCm", "thicknessCm", "wallId"])
    const drawing = { id: "a", name: "Чертёж 1", walls, dimensions: [], doorways: [win], batteries: [placed], view: { zoom: 1, pan: { x: 0, y: 0 } } }
    const json = serializeStore({ version: 3, activeId: "a", drawings: [drawing] })
    expect(json).not.toMatch(/guide|track|center/i)
    expect(parseStore(json)?.store.drawings[0].batteries).toEqual([placed])
  })
})

describe("адаптер: guide() — только пока батарея прилипла", () => {
  const sceneOf = (extra: Partial<Parameters<typeof batteryToolOf>[0]> = {}) => batteryToolOf({ walls, elements: [win], ...extra })

  it("призрак прилип к центру окна → риска на x = 260", () => {
    const { tool } = sceneOf()
    tool.hover({ x: 258, y: 5 })
    expect(tool.guide()?.from.x).toBeCloseTo(260, 6)
  })

  it("призрак вне радиуса центровки → риски нет", () => {
    const { tool } = sceneOf()
    tool.hover({ x: 300, y: 5 })
    expect(tool.guide()).toBeNull()
  })

  it("до первого движения курсора риски нет", () => {
    expect(sceneOf().tool.guide()).toBeNull()
  })

  it("центрированное положение недопустимо (сосед занимает [230,300]) → призрак у соседа, риски нет", () => {
    const neighbour = bat("W", "a", 230, { id: "n" })
    const { tool } = sceneOf({ batteries: [neighbour] })
    tool.hover({ x: 258, y: 5 })
    expect(tool.ghost()).not.toBeNull()
    expect(tool.guide()).toBeNull()
  })

  it("clearGhost и reset убирают риску", () => {
    const a = sceneOf()
    a.tool.hover({ x: 258, y: 5 })
    a.tool.clearGhost()
    expect(a.tool.guide()).toBeNull()
    const b = sceneOf()
    b.tool.hover({ x: 258, y: 5 })
    b.tool.reset()
    expect(b.tool.guide()).toBeNull()
  })

  it("установка кликом убирает риску", () => {
    const { tool } = sceneOf()
    tool.hover({ x: 258, y: 5 })
    expect(tool.place({ x: 258, y: 5 })).toBe(true)
    expect(tool.guide()).toBeNull()
  })

  it("перетаскивание: риска появляется при прилипании, исчезает вне радиуса и после отпускания", () => {
    const X = bat("W", "a", 100)
    const { tool } = sceneOf({ batteries: [X] })
    expect(tool.pressBody({ x: 135, y: 18 })).toBe(true)
    tool.dragTo({ x: 135 + 127, y: 18 }) // центр 262 → прилипает к 260
    expect(tool.guide()?.from.x).toBeCloseTo(260, 6)
    tool.dragTo({ x: 135 + 200, y: 18 }) // центр 335 — вне радиуса
    expect(tool.guide()).toBeNull()
    tool.dragTo({ x: 135 + 127, y: 18 })
    expect(tool.guide()).not.toBeNull()
    tool.endDrag()
    expect(tool.guide()).toBeNull()
  })

  it("батарея уже по центру окна: тянем её в пределах радиуса — она остаётся на месте и риска показана (прилипание держит)", () => {
    const h = sceneOf({ batteries: [centred] })
    expect(h.tool.pressBody({ x: 260, y: 18 })).toBe(true)
    h.tool.dragTo({ x: 265, y: 18 }) // центр 265 → снова прилипает к 260
    expect(h.batteries()[0].offsetCm).toBe(225)
    expect(h.tool.guide()?.from.x).toBeCloseTo(260, 6)
    h.tool.dragTo({ x: 300, y: 18 }) // вне радиуса
    expect(h.tool.guide()).toBeNull()
    h.tool.endDrag()
  })

  it("стрелки и ввод чисел риску не создают: батарея, стоящая точно по центру, после сдвига стрелкой — без риски", () => {
    const h = sceneOf({ batteries: [centred] })
    h.tool.pressBody({ x: 260, y: 18 })
    h.tool.endDrag()
    expect(h.tool.guide()).toBeNull() // нажатие без движения риску не включает
    expect(h.tool.nudge({ x: 1, y: 0 }, 10)).toBe(true)
    expect(h.tool.guide()).toBeNull()
  })
})
