import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { W, content, drawing, drywall, plaster, wall } from "../reconstruction/reconstruction.test-utils"
import type { Dimension, Table } from "../types"
import { furnitureScene } from "./furniture-scene"
import { openFurniture, storedFurniture } from "./furniture-workspace"

// change furniture-plan-table: сцена и рабочий набор плана «Мебель»
// (spec furniture-plan «Состав плана «Мебель»»; design D3)

const dim = (a: string, b: string): Dimension => ({ from: { a: { wallId: a, edge: 0 }, b: { wallId: b, edge: 1 } }, to: { a: { wallId: a, edge: 2 }, b: { wallId: b, edge: 3 } }, offset: 20 })
const T: Table = { id: "t", x: 300, y: 200, widthCm: 80, lengthCm: 160, angleDeg: 0 }

describe("сцена: подложка", () => {
  it("FP-1: подложка — результат «Реконструкции»: стены, штукатурка и стены гипсокартона", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([g]) })
    const s = furnitureScene(d)
    expect(s.base.underlay.map((w) => w.id)).toEqual(reconstructionScene(d).underlay.map((w) => w.id))
    expect(s.base.pieces).toHaveLength(1)
    expect(s.base.own).toEqual([g])
  })

  it("FP-2: правка нижних планов отражается: стену гипсокартона удалили — её нет на подложке", () => {
    const d = drawing({ reconstruction: content([drywall("g", 0, 40, 200, 40)]) })
    expect(furnitureScene(d).base.own).toHaveLength(1)
    expect(furnitureScene({ ...d, reconstruction: content([]) }).base.own).toEqual([])
  })

  it("FP-3: столы — собственные объекты плана; чертёж без поля — пустой план", () => {
    expect(furnitureScene(drawing({})).tables).toEqual([])
    expect(furnitureScene({ ...drawing(), furniture: { tables: [T], dimensions: [] } }).tables).toEqual([T])
  })

  it("FP-4: размеры «Реконструкции» на плане «Мебель» не видны, собственные — видны, пока стены на месте", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const base = drawing({ reconstruction: { walls: [g], dimensions: [dim("g", "W~0")] } })
    expect(furnitureScene(base).dimensions).toEqual([])
    const own = { ...base, furniture: { tables: [], dimensions: [dim("g", "W~0")] } }
    expect(furnitureScene(own).dimensions).toEqual([dim("g", "W~0")])
    expect(furnitureScene({ ...own, reconstruction: content([]) }).dimensions).toEqual([])
  })

  it("FP-5: сцена не мутирует чертёж", () => {
    const d = { ...drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([drywall("g", 0, 40, 200, 40)]) }), furniture: { tables: [T], dimensions: [] } }
    const before = JSON.stringify(d)
    furnitureScene(d)
    openFurniture(d)
    expect(JSON.stringify(d)).toBe(before)
  })
})

describe("рабочий набор", () => {
  it("FP-6: вся подложка (стены, штукатурка, гипсокартон) только для чтения", () => {
    const g = drywall("g", 0, 40, 200, 40)
    const d = drawing({ walls: [W(), wall("v", 0, 0, 0, 300)], roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([g]) })
    const { scene, workspace, obstacles } = openFurniture(d)
    for (const w of [...scene.walls, ...obstacles]) expect(workspace.readOnlyIds.has(w.id)).toBe(true)
    expect(scene.walls.map((w) => w.id)).toContain("g")
    expect(obstacles).toHaveLength(1)
  })

  it("FP-7: хранимое содержимое — столы и все размеры, в том числе невидимые; выноски и примечания как есть", () => {
    const ghost = dim("нет", "W")
    const d = { ...drawing(), furniture: { tables: [T], dimensions: [ghost], notes: ["Первый"] } }
    const { scene, workspace } = openFurniture(d)
    expect(scene.dimensions).toEqual([])
    const next = storedFurniture([T, { ...T, id: "u" }], scene.dimensions, workspace, d)
    expect(next.tables.map((t) => t.id)).toEqual(["t", "u"])
    expect(next.dimensions).toEqual([ghost])
    expect(next.notes).toEqual(["Первый"])
    expect("callouts" in next).toBe(false)
  })

  it("FP-7: хранимое представление не содержит стен подложки", () => {
    const next = storedFurniture([], [], openFurniture(drawing({})).workspace, drawing({}))
    expect(Object.keys(next).sort()).toEqual(["dimensions", "tables"])
  })
})
