import { describe, expect, it } from "vitest"
import { mountingScene } from "../mounting/mounting-scene"
import { plasterPieces } from "../rough/plaster"
import type { Dimension } from "../types"
import { plasterObstacles } from "./plaster-obstacles"
import { openReconstruction, storedReconstruction } from "./reconstruction-workspace"
import { reconstructionScene } from "./reconstruction-scene"
import { W, content, drawing, drywall, ends, plaster, rectWalls, screed, wall } from "./reconstruction.test-utils"

// change reconstruction-plan: сцена, виртуальные стены штукатурки и рабочий набор плана
// (spec reconstruction-plan «Состав плана «Реконструкция»»; design D2–D4)

const dim = (a: string, b: string): Dimension => ({ from: { a: { wallId: a, edge: 0 }, b: { wallId: b, edge: 1 } }, to: { a: { wallId: a, edge: 2 }, b: { wallId: b, edge: 3 } }, offset: 20 })

describe("сцена: подложка", () => {
  it("RC-1: подложка — результат «Монтажа»: остатки обмера и собственные стены «Монтажа»", () => {
    const own = wall("own", 0, 700, 300, 700)
    const d = drawing({ walls: [W()], demolition: [{ id: "m", wallId: "W", anchor: "a", fromCm: 100, toCm: 190 }], mounting: { walls: [own], dimensions: [] } })
    expect(reconstructionScene(d).underlay.map((w) => w.id)).toEqual(mountingScene(d).walls.map((w) => w.id))
    expect(reconstructionScene(d).underlay.map((w) => w.id)).toEqual(["W~0", "W~1900", "own"])
  })

  it("RC-2: куски штукатурки подложки те же, что на плане «Черновые работы»", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)] })
    expect(reconstructionScene(d).pieces).toEqual(plasterPieces(d))
    expect(reconstructionScene(d).pieces).toHaveLength(1)
  })

  it("RC-3: стяжка в сцену не входит", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260, 65)] })
    expect("screeds" in reconstructionScene(d)).toBe(false)
  })

  it("RC-4: размеры обмера и «Монтажа» в сцену не входят", () => {
    const d = { ...drawing({ mounting: { walls: [wall("m1", 0, 300, 200, 300)], dimensions: [dim("W", "m1")] } }), dimensions: [dim("W", "W")] }
    expect(reconstructionScene(d).dimensions).toEqual([])
  })

  it("RC-5: правка нижних планов отражается: штукатурку удалили — кусков нет", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)] })
    expect(reconstructionScene(d).pieces).toHaveLength(1)
    expect(reconstructionScene({ ...d, roughPlaster: [] }).pieces).toEqual([])
  })

  it("RC-6: стены ГКЛ — собственные стены плана; чертёж без поля — пустой план", () => {
    const g = drywall("g", 0, 40, 200, 40)
    expect(reconstructionScene(drawing({ reconstruction: content([g]) })).own).toEqual([g])
    expect(reconstructionScene(drawing()).own).toEqual([])
  })

  it("RC-7: сцена не мутирует чертёж", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([drywall("g", 0, 40, 200, 40)]) })
    const before = JSON.stringify(d)
    reconstructionScene(d)
    expect(JSON.stringify(d)).toBe(before)
  })
})

describe("виртуальные стены штукатурки (design D3)", () => {
  const strips = (d: ReturnType<typeof drawing>) => plasterObstacles(plasterPieces(d))

  it("RC-10: боковая полоса — одна виртуальная стена по средней линии полосы, толщина — толщина штукатурки", () => {
    // грань +1 стены W толщиной 20 — это y = 10; штукатурка 20 мм занимает y 10…12, участок 100–300
    const [o, ...rest] = strips(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] }))
    expect(rest).toEqual([])
    if (!o) throw new Error("виртуальной стены нет")
    expect(o.thicknessCm).toBeCloseTo(2, 9)
    const [a, b] = ends(o)
    expect(a.x).toBeCloseTo(100, 9)
    expect(b.x).toBeCloseTo(300, 9)
    expect(a.y).toBeCloseTo(11, 9)
    expect(b.y).toBeCloseTo(11, 9)
  })

  it("RC-11: грань −1 — полоса по другую сторону оси (y = −10…−12)", () => {
    const [o] = strips(drawing({ roughPlaster: [plaster("p", "W", -1, "a", 0, 500, 30)] }))
    if (!o) throw new Error("виртуальной стены нет")
    expect(o.thicknessCm).toBeCloseTo(3, 9)
    expect(o.a.y).toBeCloseTo(-11.5, 9)
    expect(o.b.y).toBeCloseTo(-11.5, 9)
  })

  it("RC-12: торец — виртуальная стена поперёк оси: длина — толщина стены, толщина — штукатурка", () => {
    // торец конца b стены W: x = 500…502, поперёк оси y −10…10
    const [o] = strips(drawing({ roughPlaster: [{ id: "e", wallId: "W", face: "end", anchor: "b", thicknessMm: 20 }] }))
    if (!o) throw new Error("виртуальной стены нет")
    expect(o.thicknessCm).toBeCloseTo(2, 9)
    const [a, b] = ends(o)
    expect(a.x).toBeCloseTo(501, 9)
    expect(b.x).toBeCloseTo(501, 9)
    expect(Math.abs(b.y - a.y)).toBeCloseTo(20, 9)
  })

  it("RC-13: у каждого куска свой уникальный идентификатор, не совпадающий с идентификаторами стен", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 200), plaster("q", "W", -1, "a", 0, 200)] })
    const ids = strips(d).map((o) => o.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).not.toContain("W")
  })

  it("RC-14: без штукатурки препятствий нет; пометка стены, которой нет, не действует", () => {
    expect(strips(drawing())).toEqual([])
    expect(strips(drawing({ roughPlaster: [plaster("p", "нет", 1, "a", 0, 100)] }))).toEqual([])
  })

  it("RC-15: снесённая часть штукатурки препятствием не является", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 500)], demolition: [{ id: "m", wallId: "W", anchor: "a", fromCm: 100, toCm: 190 }] })
    const xs = strips(d).flatMap((o) => ends(o).map((p) => p.x))
    expect(xs.some((x) => x > 100 + 1e-6 && x < 190 - 1e-6)).toBe(false)
  })
})

describe("рабочий набор (design D4)", () => {
  const d = (): ReturnType<typeof drawing> =>
    drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)], reconstruction: content([drywall("g", 0, 40, 200, 40)], [dim("g", "W~0"), dim("g", "ghost")]) })

  it("RC-20: рабочая сцена — подложка, виртуальные стены и стены ГКЛ; только для чтения — всё, кроме стен ГКЛ", () => {
    const { scene, workspace } = openReconstruction(d())
    const ids = scene.walls.map((w) => w.id)
    expect(ids).toContain("W~0")
    expect(ids).toContain("g")
    expect(scene.walls.length).toBe(3) // подложка W~0, виртуальная полоса штукатурки, стена ГКЛ
    expect(workspace.readOnlyIds.has("g")).toBe(false)
    for (const w of scene.walls.filter((x) => x.id !== "g")) expect(workspace.readOnlyIds.has(w.id)).toBe(true)
  })

  it("RC-21: стены ГКЛ в рабочей сцене — копии: правка не меняет чертёж до фиксации", () => {
    const drw = d()
    const { scene } = openReconstruction(drw)
    const g = scene.walls.find((w) => w.id === "g")
    if (!g) throw new Error("стены ГКЛ нет")
    g.a.x = 55
    expect(drw.reconstruction?.walls[0]?.a.x).toBe(0)
  })

  it("RC-22: размер на стену, которой нет, скрыт, но не теряется при записи", () => {
    const drw = d()
    const { scene, workspace } = openReconstruction(drw)
    expect(scene.dimensions).toHaveLength(1)
    expect(storedReconstruction(scene, workspace, drw).dimensions).toHaveLength(2)
  })

  it("RC-23: хранимое содержимое — только стены ГКЛ с высотой; подложка и виртуальные стены не записываются", () => {
    const drw = d()
    const { scene, workspace } = openReconstruction(drw)
    expect(storedReconstruction(scene, workspace, drw).walls).toEqual([drywall("g", 0, 40, 200, 40)])
  })

  it("RC-24: выноски и примечания плана переносятся в хранимое содержимое как есть", () => {
    const callouts = [{ id: "c", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "т" }]
    const drw = { ...d(), reconstruction: { walls: [drywall("g", 0, 40, 200, 40)], dimensions: [], callouts, notes: ["н"] } }
    const { scene, workspace } = openReconstruction(drw)
    const stored = storedReconstruction(scene, workspace, drw)
    expect(stored.callouts).toEqual(callouts)
    expect(stored.notes).toEqual(["н"])
  })

  it("RC-25: стена ГКЛ, добавленная в рабочую сцену, попадает в хранимое содержимое", () => {
    const drw = d()
    const { scene, workspace } = openReconstruction(drw)
    const added = drywall("new", 300, 40, 400, 40, 5, 270)
    const stored = storedReconstruction({ ...scene, walls: [...scene.walls, added] }, workspace, drw)
    expect(stored.walls.map((w) => w.id)).toEqual(["g", "new"])
    expect(stored.walls[1]?.heightCm).toBe(270)
  })

  it("RC-26: чертёж без объектов плана — пустой набор, подложка только для чтения", () => {
    const { scene, workspace } = openReconstruction(drawing())
    expect(scene.dimensions).toEqual([])
    expect(scene.walls.every((w) => workspace.readOnlyIds.has(w.id))).toBe(true)
  })
})
