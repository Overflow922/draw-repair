import { describe, expect, it } from "vitest"
import { furnitureScene } from "../furniture/furniture-scene"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { W, content, drawing, drywall, plaster, wall } from "../reconstruction/reconstruction.test-utils"
import type { Dimension, Drawing, FurnitureItem } from "../types"
import { plumbingScene } from "./plumbing-scene"
import { openPlumbing, storedPlumbing } from "./plumbing-workspace"

// change add-plumbing-plan: сцена и рабочий набор плана «Сантехника»
// (spec plumbing-plan «Состав плана «Сантехника»», «Приборы плана «Сантехника»»; design D3)

const dim = (a: string, b: string): Dimension => ({ from: { a: { wallId: a, edge: 0 }, b: { wallId: b, edge: 1 } }, to: { a: { wallId: a, edge: 2 }, b: { wallId: b, edge: 3 } }, offset: 20 })
const item = (id: string, kind: FurnitureItem["kind"], extra: Partial<FurnitureItem> = {}): FurnitureItem => ({ id, kind, x: 100, y: 100, widthCm: 60, lengthCm: 60, angleDeg: 0, ...extra })
const toItem = (itemId: string): Dimension => ({ from: dim("g", "W~0").from, to: { kind: "item", itemId, at: { kind: "center" } }, offset: -30 })

const withFurniture = (d: Drawing, items: FurnitureItem[], dimensions: Dimension[] = []): Drawing => ({ ...d, furniture: { items, dimensions } })

describe("сцена: подложка и приборы", () => {
  it("PS-01: подложка — тот же результат «Реконструкции», что у плана «Мебель»", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([g]) })
    const s = plumbingScene(d)
    expect(s.base.underlay.map((w) => w.id)).toEqual(reconstructionScene(d).underlay.map((w) => w.id))
    expect(s.base.underlay.map((w) => w.id)).toEqual(furnitureScene(d).base.underlay.map((w) => w.id))
    expect(s.base.pieces).toHaveLength(1)
    expect(s.base.own).toEqual([g])
  })

  it("PS-02: показаны раковина, посудомойка и стиральная машина; кухонного шкафа, стола, сушки, варочной панели и холодильника нет", () => {
    const items = [item("k", "kitchenCabinet"), item("s", "sink"), item("d", "dishwasher"), item("t", "table"), item("w", "washer"), item("r", "dryer"), item("h", "hob"), item("f", "fridge")]
    expect(plumbingScene(withFurniture(drawing(), items)).items.map((t) => t.id)).toEqual(["s", "d", "w"])
  })

  it("PS-03: прибор с теми же центром, размерами и углом, что на «Мебели» (повёрнутая раковина)", () => {
    const sink = item("s", "sink", { x: 200, y: 100, widthCm: 45, lengthCm: 40, angleDeg: 90 })
    expect(plumbingScene(withFurniture(drawing(), [sink])).items).toEqual([sink])
  })

  it("PS-04: правка «Мебели» отражается сразу: сдвиг и удаление прибора", () => {
    const sink = item("s", "sink")
    expect(plumbingScene(withFurniture(drawing(), [{ ...sink, x: 150 }])).items[0]?.x).toBe(150)
    expect(plumbingScene(withFurniture(drawing(), [])).items).toEqual([])
  })

  it("PS-05: чертёж без «Мебели» и «Сантехники» — подложка без приборов и размеров", () => {
    const s = plumbingScene(drawing())
    expect(s.items).toEqual([])
    expect(s.dimensions).toEqual([])
  })

  it("PS-06: размеры «Мебели» на «Сантехнике» не видны; собственные — видны, пока стены и прибор на месте", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const base = withFurniture(drawing({ reconstruction: content([g]) }), [item("s", "sink")], [dim("g", "W~0")])
    expect(plumbingScene(base).dimensions).toEqual([])
    const own = { ...base, plumbing: { dimensions: [dim("g", "W~0"), toItem("s")] } }
    expect(plumbingScene(own).dimensions).toEqual([dim("g", "W~0"), toItem("s")])
    expect(plumbingScene({ ...own, reconstruction: content([]) }).dimensions).toEqual([])
  })

  it("PS-07: размер к прибору не виден, пока прибора нет; к предмету, который не прибор, — тоже", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const d = drawing({ reconstruction: content([g]) })
    const plumbing = { dimensions: [toItem("s"), toItem("k")] }
    expect(plumbingScene({ ...withFurniture(d, []), plumbing }).dimensions).toEqual([])
    expect(plumbingScene({ ...withFurniture(d, [item("k", "kitchenCabinet")]), plumbing }).dimensions).toEqual([])
    expect(plumbingScene({ ...withFurniture(d, [item("s", "sink")]), plumbing }).dimensions).toEqual([toItem("s")])
  })

  it("PS-08: сцена и рабочий набор не мутируют чертёж", () => {
    const d = { ...withFurniture(drawing({ reconstruction: content([drywall("g", 0, 40, 200, 40)]) }), [item("s", "sink")]), plumbing: { dimensions: [toItem("s")] } }
    const before = JSON.stringify(d)
    plumbingScene(d)
    openPlumbing(d)
    expect(JSON.stringify(d)).toBe(before)
  })
})

describe("рабочий набор", () => {
  it("PS-09: вся подложка и приборы только для чтения", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const d = withFurniture(drawing({ walls: [W(), wall("v", 0, 0, 0, 300)], roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([g]) }), [item("s", "sink")])
    const { scene, workspace, obstacles } = openPlumbing(d)
    for (const w of [...scene.walls, ...obstacles]) expect(workspace.readOnlyIds.has(w.id)).toBe(true)
    expect(workspace.readOnlyIds.has("s")).toBe(true)
    expect(scene.walls.map((w) => w.id)).toContain("g")
    expect(scene.items.map((t) => t.id)).toEqual(["s"])
  })

  it("PS-10: хранимое содержимое — все размеры, в том числе невидимые; выноски и примечания как есть; приборов нет", () => {
    const ghost = toItem("нет")
    const d = { ...withFurniture(drawing(), [item("s", "sink")]), plumbing: { dimensions: [ghost], notes: ["Первый"] } }
    const { scene, workspace } = openPlumbing(d)
    expect(scene.dimensions).toEqual([])
    const next = storedPlumbing([], workspace, d)
    expect(next.dimensions).toEqual([ghost])
    expect(next.notes).toEqual(["Первый"])
    expect("callouts" in next).toBe(false)
    expect("items" in next).toBe(false)
  })

  it("PS-11: хранимое представление — только размеры, без стен и предметов", () => {
    const next = storedPlumbing([], openPlumbing(drawing()).workspace, drawing())
    expect(Object.keys(next)).toEqual(["dimensions"])
  })
})
