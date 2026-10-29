import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import type { Drawing, FurnitureItem, LightSwitch, Wall } from "../types"
import { electricalScene } from "./electrical-scene"

// change add-electrical-plan: сцена плана «Электрооборудование»
// (spec electrical-plan «Состав плана «Электрооборудование»», «Выключатели на плане «Электрооборудование»»; design D2)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const TABLE: FurnitureItem = { id: "t1", kind: "table", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const SINK: FurnitureItem = { id: "s1", kind: "sink", x: 100, y: 20, widthCm: 45, lengthCm: 40, angleDeg: 0 }
const SW: LightSwitch = { id: "sw1", at: { x: 100, y: -10 }, angle: 270, keys: [{ lines: ["L2", "LV1"] }, { lines: ["L3"] }, { lines: [] }] }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

describe("сцена плана «Электрооборудование»", () => {
  it("ESC-01: подложка — та же, что у «Мебели» (результат «Реконструкции»)", () => {
    const d = drawing()
    expect(electricalScene(d).base).toEqual(reconstructionScene(d))
  })

  it("ESC-02: показаны все предметы «Мебели» любых видов, в порядке «Мебели»", () => {
    const s = electricalScene(drawing({ furniture: { items: [TABLE, SINK], dimensions: [] } }))
    expect(s.items).toEqual([TABLE, SINK])
  })

  it("ESC-03: показаны все выключатели «Потолков и освещения» с теми же центром, углом и клавишами", () => {
    const s = electricalScene(drawing({ switching: { switches: [SW] } }))
    expect(s.switches).toEqual([SW])
  })

  it("ESC-04: потолки, светильники, вытяжки и метки линий в сцену не входят", () => {
    const s = electricalScene(
      drawing({
        ceiling: { ceilings: [{ id: "c", at: { x: 10, y: 10 }, dropMm: 50 }], lights: [{ id: "l", kind: "spot", x: 50, y: 50 }] },
        switching: { switches: [SW], exhausts: [{ id: "e", x: 30, y: 30 }], lines: [{ id: "n", name: "L1", lightId: "l" }] },
      }),
    )
    expect(Object.keys(s).sort()).toEqual(["base", "items", "switches"])
  })

  it("ESC-05: сцена — живая производная: правка мебели и выключателя отражается при следующем построении", () => {
    const d = drawing({ furniture: { items: [TABLE], dimensions: [] }, switching: { switches: [SW] } })
    expect(electricalScene(d).items[0]?.x).toBe(200)
    if (d.furniture) d.furniture.items = [{ ...TABLE, x: 250 }]
    if (d.switching) d.switching.switches = [{ ...SW, at: { x: 150, y: -10 } }]
    const s = electricalScene(d)
    expect(s.items[0]?.x).toBe(250)
    expect(s.switches[0]?.at).toEqual({ x: 150, y: -10 })
  })

  it("ESC-05: построение сцены не мутирует чертёж", () => {
    const d = drawing({ furniture: { items: [TABLE], dimensions: [] }, switching: { switches: [SW] } })
    const before = JSON.stringify(d)
    electricalScene(d)
    expect(JSON.stringify(d)).toBe(before)
  })

  it("ESC-06: сцена не делит объекты с чертежом", () => {
    const d = drawing({ furniture: { items: [TABLE], dimensions: [] }, switching: { switches: [SW] } })
    const s = electricalScene(d)
    expect(s.items[0]).not.toBe(d.furniture?.items[0])
    expect(s.switches[0]).not.toBe(d.switching?.switches?.[0])
    expect(s.switches[0]?.keys[0]).not.toBe(d.switching?.switches?.[0]?.keys[0])
  })

  it("ESC-07: выключатель не следует за стенами: сдвиг стены не меняет выключатель", () => {
    const moved = drawing({ switching: { switches: [SW] } })
    moved.walls = [{ ...W, a: { x: 0, y: 20 }, b: { x: 500, y: 20 } }]
    expect(electricalScene(moved).switches).toEqual([SW])
  })

  it("ESC-08: чертёж без мебели и выключателей даёт пустые списки и подложку", () => {
    const s = electricalScene(drawing())
    expect(s.items).toEqual([])
    expect(s.switches).toEqual([])
    expect(s.base.underlay.length).toBeGreaterThan(0)
  })
})
