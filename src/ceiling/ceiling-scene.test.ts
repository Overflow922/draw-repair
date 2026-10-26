import { describe, expect, it } from "vitest"
import { furnitureScene } from "../furniture/furniture-scene"
import { content, drawing, drywall, plaster, rectWalls, screed, wall } from "../reconstruction/reconstruction.test-utils"
import { deepFreeze } from "../rough/rough.test-utils"
import type { Dimension, Drawing, FurnitureItem, StretchCeiling, Wall } from "../types"
import { ceilingScene } from "./ceiling-scene"
import { openCeiling, storedCeiling } from "./ceiling-workspace"

// change add-ceiling-plan: сцена и рабочий набор плана «Потолки и освещение»
// (spec ceiling-plan «Состав плана», «Мебель на плане», «Натяжной потолок помещения»; design D4)

const item = (id: string, kind: FurnitureItem["kind"], extra: Partial<FurnitureItem> = {}): FurnitureItem => ({ id, kind, x: 100, y: 100, widthCm: 60, lengthCm: 60, angleDeg: 0, ...extra })
const ceiling = (id: string, x: number, y: number, dropMm = 50): StretchCeiling => ({ id, at: { x, y }, dropMm })
const dim: Dimension = { from: { a: { wallId: "k1", edge: 0 }, b: { wallId: "k2", edge: 1 } }, to: { a: { wallId: "k3", edge: 0 }, b: { wallId: "k4", edge: 1 } }, offset: 20 }

// комната K: внутренняя область [10,410]×[10,310]; перегородка P делит её по x = 200
const room = (): Wall[] => rectWalls("k", 0, 0, 420, 320)
const partition = (): Wall => wall("p", 200, 0, 200, 320)

const withPlans = (d: Drawing, items: FurnitureItem[], ceilings: StretchCeiling[]): Drawing => ({
  ...d,
  furniture: { items, dimensions: [dim] },
  ceiling: { ceilings },
})

describe("сцена: подложка и мебель", () => {
  it("CP-60: подложка — та же, что у плана «Мебель»: стены, штукатурка, гипсокартон", () => {
    const g = drywall("g", 50, 100, 150, 100)
    const d = drawing({ walls: room(), roughPlaster: [plaster("pl", "k1", 1, "a", 100, 300)], reconstruction: content([g]) })
    const s = ceilingScene(d)
    expect(s.base.underlay.map((w) => w.id)).toEqual(furnitureScene(d).base.underlay.map((w) => w.id))
    expect(s.base.pieces).toHaveLength(1)
    expect(s.base.own).toEqual([g])
  })

  it("CP-61: показаны все предметы «Мебели» любых видов с теми же центром, размерами и углом", () => {
    const items = [item("t", "table", { x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 90 }), item("s", "sofa"), item("k", "kitchenCabinet"), item("w", "sink"), item("c", "curtains")]
    expect(ceilingScene(withPlans(drawing({ walls: room() }), items, [])).items).toEqual(items)
  })

  it("CP-62: правка «Мебели» отражается сразу: сдвиг и удаление", () => {
    const t = item("t", "table")
    expect(ceilingScene(withPlans(drawing({ walls: room() }), [{ ...t, x: 150 }], [])).items[0]?.x).toBe(150)
    expect(ceilingScene(withPlans(drawing({ walls: room() }), [], [])).items).toEqual([])
  })

  it("CP-63: чертёж без «Мебели» и без плана — подложка без мебели и потолков", () => {
    const s = ceilingScene(drawing({ walls: room() }))
    expect(s.items).toEqual([])
    expect(s.ceilings).toEqual([])
    expect(s.rooms).toHaveLength(1)
  })
})

describe("сцена: натяжные потолки", () => {
  it("CP-64: потолок в помещении действует и привязан к нему; вне помещений — спит", () => {
    const s = ceilingScene(withPlans(drawing({ walls: room() }), [], [ceiling("c", 200, 160), ceiling("out", 900, 900)]))
    expect(s.ceilings.map((a) => a.object.id)).toEqual(["c"])
    expect(s.ceilings[0]?.item).toBe(s.rooms[0])
  })

  it("CP-65: помещение разделено — потолок только в части с опорной точкой", () => {
    const s = ceilingScene(withPlans(drawing({ walls: [...room(), partition()] }), [], [ceiling("c", 100, 160)]))
    expect(s.rooms).toHaveLength(2)
    expect(s.ceilings).toHaveLength(1)
    expect(s.ceilings[0]?.item.room.outline.every((p) => p.x <= 200)).toBe(true)
  })

  it("CP-66: помещения слились — действует поставленный раньше", () => {
    const s = ceilingScene(withPlans(drawing({ walls: room() }), [], [ceiling("c50", 100, 160, 50), ceiling("c80", 300, 160, 80)]))
    expect(s.ceilings.map((a) => a.object.dropMm)).toEqual([50])
  })

  it("CP-67: помещения — по стенам «Монтажа»: стена гипсокартона помещение не делит", () => {
    const d = drawing({ walls: room(), reconstruction: content([drywall("g", 200, 10, 200, 310)]) })
    const s = ceilingScene(withPlans(d, [], [ceiling("a", 100, 160), ceiling("b", 300, 160)]))
    expect(s.rooms).toHaveLength(1)
    expect(s.ceilings.map((a) => a.object.id)).toEqual(["a"])
  })

  it("CP-68: стяжка не мешает — потолок действует в помещении со стяжкой", () => {
    const s = ceilingScene(withPlans(drawing({ walls: room(), roughScreeds: [screed("s", 200, 160, 65)] }), [], [ceiling("c", 250, 200)]))
    expect(s.ceilings).toHaveLength(1)
  })

  it("CP-69: вход не мутируется", () => {
    const d = deepFreeze(withPlans(drawing({ walls: [...room(), partition()] }), [item("t", "table")], [ceiling("c", 100, 160)]))
    expect(() => ceilingScene(d)).not.toThrow()
  })
})

describe("рабочий набор", () => {
  it("CP-70: стены подложки, гипсокартон и предметы — только для чтения; потолки в набор не входят", () => {
    const g = drywall("g", 50, 100, 150, 100)
    const d = withPlans(drawing({ walls: room(), reconstruction: content([g]) }), [item("t", "table")], [ceiling("c", 300, 200)])
    const { scene, workspace } = openCeiling(d)
    const underlay = ceilingScene(d).base.underlay.map((w) => w.id)
    expect(underlay).toHaveLength(4)
    expect(scene.walls.map((w) => w.id)).toEqual([...underlay, "g"])
    expect(scene.items.map((t) => t.id)).toEqual(["t"])
    for (const id of [...underlay, "g", "t"]) expect(workspace.readOnlyIds.has(id)).toBe(true)
    expect(workspace.readOnlyIds.has("c")).toBe(false)
  })

  it("CP-71: хранимое содержимое — потолки, выноски и примечания плана как есть; мебели нет", () => {
    const callouts = [{ id: "x", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Светильник" }]
    const d: Drawing = { ...drawing({ walls: room() }), ceiling: { ceilings: [], callouts, notes: ["Первый"] } }
    const next = [ceiling("c", 300, 200)]
    expect(storedCeiling(next, d)).toEqual({ ceilings: next, callouts, notes: ["Первый"] })
    expect(storedCeiling(next, drawing({ walls: room() }))).toEqual({ ceilings: next })
  })
})
