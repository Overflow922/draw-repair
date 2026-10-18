import { describe, expect, it } from "vitest"
import { roughScene } from "./rough-scene"
import { drawing, plaster, r6, rectWalls, screed, wall } from "./rough.test-utils"

// change add-rough-works-plan: сцена плана целиком и многошаговые сценарии — комната, нарисованная стена за стеной
// (spec rough-works-plan «Помещение со стяжкой»; room-explication «Экспликация плана «Черновые работы»»)

describe("сцена плана", () => {
  it("RW-210: стяжка спит, пока стены не замкнули помещение, и оживает с замыкающей стеной", () => {
    const [k1, k2, k3, k4] = rectWalls("k", 0, 0, 420, 520)
    const own = (walls: ReturnType<typeof wall>[]) => drawing({ walls: [], mounting: { walls, dimensions: [] }, roughScreeds: [screed("s", 200, 260, 65)] })
    expect(roughScene(own([k1!, k2!, k3!])).screeds).toEqual([])
    expect(roughScene(own([k1!, k2!, k3!, k4!])).screeds).toHaveLength(1)
  })

  it("RW-211: поздняя перегородка делит помещение: стяжка остаётся за частью с опорной точкой, нетто-площадь считается по частям", () => {
    const base = rectWalls("k", 0, 0, 420, 520)
    const before = roughScene(drawing({ walls: base, roughScreeds: [screed("s", 100, 260, 65)], roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 30)] }))
    expect(before.items).toHaveLength(1)
    const divided = roughScene(drawing({ walls: [...base, wall("p", 210, 0, 210, 520)], roughScreeds: [screed("s", 100, 260, 65)], roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 30)] }))
    expect(divided.items).toHaveLength(2)
    expect(divided.screeds).toHaveLength(1)
    const left = divided.screeds[0]!.item
    expect(left.room.outline.every((p) => p.x <= 210)).toBe(true)
    // полоса вдоль верхней стены делится перегородкой: у каждой части вычтено по 3 см × ширина части
    const total = divided.items.reduce((s, i) => s + i.room.areaCm2, 0)
    const net = divided.netItems.reduce((s, i) => s + i.room.areaCm2, 0)
    expect(r6(total - net)).toBe(r6(3 * (divided.items[0]!.room.areaCm2 / 500 + divided.items[1]!.room.areaCm2 / 500)))
  })

  it("RW-212: стена перенесена — штукатурка и стяжка следуют за ней и помещением", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 520).map((w) => ({ ...w, a: { x: w.a.x + 100, y: w.a.y + 50 }, b: { x: w.b.x + 100, y: w.b.y + 50 } })), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 30)], roughScreeds: [screed("s", 300, 300, 65)] })
    const s = roughScene(d)
    expect(s.screeds).toHaveLength(1)
    expect(s.pieces).toHaveLength(1)
    expect(r6(s.items[0]!.room.areaCm2 - s.netItems[0]!.room.areaCm2)).toBe(1200)
  })

  it("RW-213: сцена не зависит от активного плана и не меняет чертёж", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 30)], roughScreeds: [screed("s", 200, 260, 65)] })
    const before = structuredClone(d)
    roughScene({ ...d, activePlan: "measure" })
    expect(d).toEqual(before)
    expect(roughScene({ ...d, activePlan: "rough" }).netItems.map((i) => i.room.areaCm2)).toEqual(roughScene(d).netItems.map((i) => i.room.areaCm2))
  })

  it("RW-214: данные помещений общие: номера и высоты берутся из записей «Монтажа»", () => {
    const rooms = [{ number: 7, name: "Кухня", heightMm: 2700, anchor: { x: 200, y: 260 } }]
    const s = roughScene(drawing({ walls: rectWalls("k", 0, 0, 420, 520), rooms }))
    expect(s.items.map((i) => [i.record.number, i.record.name, i.record.heightMm])).toEqual([[7, "Кухня", 2700]])
    expect(s.netItems.map((i) => [i.record.number, i.record.name, i.record.heightMm])).toEqual([[7, "Кухня", 2700]])
  })
})
