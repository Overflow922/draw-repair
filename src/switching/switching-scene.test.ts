import { describe, expect, it } from "vitest"
import { furnitureScene } from "../furniture/furniture-scene"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { deepFreeze } from "../rough/rough.test-utils"
import type { Drawing, FurnitureItem, LightFixture, StretchCeiling } from "../types"
import { switchingScene } from "./switching-scene"
import { openSwitching } from "./switching-workspace"

// change add-switching-plan: сцена и рабочий набор плана «Группы включения»
// (spec switching-plan «Состав плана «Группы включения»», «Мебель и освещение на плане «Группы включения»»; design D3)

const item = (id: string, kind: FurnitureItem["kind"], extra: Partial<FurnitureItem> = {}): FurnitureItem => ({ id, kind, x: 100, y: 100, widthCm: 60, lengthCm: 60, angleDeg: 0, ...extra })
const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })
const stretch = (id: string): StretchCeiling => ({ id, at: { x: 200, y: 160 }, dropMm: 50 })

const withPlans = (d: Drawing, items: FurnitureItem[], lights: LightFixture[]): Drawing => ({
  ...d,
  furniture: { items, dimensions: [] },
  ceiling: { ceilings: [stretch("c")], ...(lights.length > 0 ? { lights } : null) },
})

describe("сцена: подложка, мебель и освещение", () => {
  it("SW-10: подложка — та же, что у плана «Мебель»: стены, штукатурка, гипсокартон", () => {
    const g = drywall("g", 50, 100, 150, 100)
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 320), roughPlaster: [plaster("pl", "k1", 1, "a", 100, 300)], reconstruction: content([g]) })
    const s = switchingScene(d)
    expect(s.base.underlay.map((w) => w.id)).toEqual(furnitureScene(d).base.underlay.map((w) => w.id))
    expect(s.base.pieces).toHaveLength(1)
    expect(s.base.own).toEqual([g])
  })

  it("SW-11: показаны все предметы «Мебели» и все объекты освещения как есть", () => {
    const items = [item("t", "table", { widthCm: 80, lengthCm: 160 }), item("s", "sofa")]
    const lights: LightFixture[] = [spot("a", 10, 20), { id: "x", kind: "chandelier", x: 50, y: 60 }, { id: "b", kind: "sconce", x: 0, y: 5, angleDeg: 90 }]
    const s = switchingScene(withPlans(drawing({ walls: rectWalls("k", 0, 0, 420, 320) }), items, lights))
    expect(s.items).toEqual(items)
    expect(s.lights).toEqual(lights)
  })

  it("SW-12: натяжных потолков и помещений в сцене нет", () => {
    const s = switchingScene(withPlans(drawing({ walls: rectWalls("k", 0, 0, 420, 320) }), [], []))
    expect(Object.keys(s).sort()).toEqual(["base", "items", "lights"])
  })

  it("SW-13: правка освещения отражается сразу: сдвиг и удаление", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 320) })
    expect(switchingScene(withPlans(d, [], [spot("a", 150, 20)])).lights[0]?.x).toBe(150)
    expect(switchingScene(withPlans(d, [], [])).lights).toEqual([])
  })

  it("SW-14: чертёж без «Мебели» и «Потолков» — подложка без предметов и освещения", () => {
    const s = switchingScene(drawing({ walls: rectWalls("k", 0, 0, 420, 320) }))
    expect(s.items).toEqual([])
    expect(s.lights).toEqual([])
  })

  it("SW-15: вход не мутируется, предметы и освещение — копии", () => {
    const d = deepFreeze(withPlans(drawing({ walls: rectWalls("k", 0, 0, 420, 320) }), [item("t", "table")], [spot("a", 1, 2)]))
    const s = switchingScene(d)
    expect(s.items[0]).not.toBe(d.furniture?.items[0])
    expect(s.lights[0]).not.toBe(d.ceiling?.lights?.[0])
  })
})

describe("рабочий набор", () => {
  it("SW-16: стены подложки, гипсокартон, предметы и освещение — только для чтения", () => {
    const g = drywall("g", 50, 100, 150, 100)
    const d = withPlans(drawing({ walls: rectWalls("k", 0, 0, 420, 320), reconstruction: content([g]) }), [item("t", "table")], [spot("a", 10, 20)])
    const { scene, workspace } = openSwitching(d)
    const underlay = switchingScene(d).base.underlay.map((w) => w.id)
    expect(scene.walls.map((w) => w.id)).toEqual([...underlay, "g"])
    expect(scene.items.map((t) => t.id)).toEqual(["t"])
    for (const id of [...underlay, "g", "t", "a"]) expect(workspace.readOnlyIds.has(id)).toBe(true)
  })
})
