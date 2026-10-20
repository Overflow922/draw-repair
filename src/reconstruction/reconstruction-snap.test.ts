import { describe, expect, it } from "vitest"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "../wall-edit"
import { snapRadiusCm, snapStartVertex, snapVertex } from "../wall-snap"
import { openReconstruction } from "./reconstruction-workspace"
import { W, drawing, drywall, plaster, content } from "./reconstruction.test-utils"
import type { Drawing } from "../types"

// change reconstruction-plan: привязка к поверхности штукатурки и границы правки
// (spec reconstruction-plan «Привязка к поверхности штукатурки», «Границы правки стен гипсокартона», «Рисование стен гипсокартона»)
// Сцена: W — стена (0,0)–(500,0) толщиной 20 см, грань +1 это y = 10; штукатурка 20 мм на этой грани, участок 100–300 см,
// то есть её поверхность — y = 12. Толщина ГКЛ — 10 см.

const GRID = 10
const R = snapRadiusCm(1)
const plastered = (): Drawing => drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] })
const bare = (): Drawing => drawing()

describe("привязка квадрата установки", () => {
  it("RC-30: у штукатурки ближняя грань ГКЛ лежит на y = 12 (зазор от грани стены равен толщине штукатурки)", () => {
    const { scene } = openReconstruction(plastered())
    const r = snapVertex({ x: 200, y: 14 }, scene.walls, R, GRID, 10)
    expect(r.source).toBe("wall")
    expect(r.base?.y).toBeCloseTo(12, 6)
    expect(r.normal?.y).toBeCloseTo(1, 6)
  })

  it("RC-31: вне штукатурки — к грани стены: y = 10", () => {
    const { scene } = openReconstruction(plastered())
    const r = snapVertex({ x: 400, y: 13 }, scene.walls, R, GRID, 10)
    expect(r.source).toBe("wall")
    expect(r.base?.y).toBeCloseTo(10, 6)
  })

  it("RC-32: стена без штукатурки — привязка к грани стены, как к грани любой стены", () => {
    const { scene } = openReconstruction(bare())
    const r = snapVertex({ x: 200, y: 13 }, scene.walls, R, GRID, 10)
    expect(r.base?.y).toBeCloseTo(10, 6)
  })

  it("RC-33: штукатурку убрали — привязка снова к грани стены", () => {
    const withPlaster = openReconstruction(plastered()).scene.walls
    const without = openReconstruction({ ...plastered(), roughPlaster: [] }).scene.walls
    expect(snapVertex({ x: 200, y: 14 }, withPlaster, R, GRID, 10).base?.y).toBeCloseTo(12, 6)
    expect(snapVertex({ x: 200, y: 14 }, without, R, GRID, 10).base?.y).toBeCloseTo(10, 6)
  })

  it("RC-34: грань −1 со штукатуркой — поверхность y = −12", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", -1, "a", 0, 500, 20)] })
    const { scene } = openReconstruction(d)
    const r = snapVertex({ x: 250, y: -14 }, scene.walls, R, GRID, 10)
    expect(r.base?.y).toBeCloseTo(-12, 6)
    expect(r.normal?.y).toBeCloseTo(-1, 6)
  })

  it("RC-35: начальная вершина у штукатурки (snapStartVertex): квадрат касается поверхности, а не тела штукатурки", () => {
    const { scene } = openReconstruction(plastered())
    const r = snapStartVertex({ x: 200, y: 13 }, scene.walls, R, GRID, 10)
    expect(r.source).toBe("wall")
    expect(r.base?.y).toBeCloseTo(12, 6)
  })

  it("RC-36: толщина штукатурки меняет поверхность: 30 мм → y = 13", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 30)] })
    const r = snapVertex({ x: 200, y: 15 }, openReconstruction(d).scene.walls, R, GRID, 10)
    expect(r.base?.y).toBeCloseTo(13, 6)
  })
})

describe("границы правки", () => {
  const withWall = (d: Drawing, ...walls: ReturnType<typeof drywall>[]): { walls: ReturnType<typeof openReconstruction>["scene"]["walls"]; own: ReturnType<typeof drywall>[] } => {
    const { scene } = openReconstruction({ ...d, reconstruction: content(walls) })
    return { walls: scene.walls, own: walls.map((w) => scene.walls.find((x) => x.id === w.id) as ReturnType<typeof drywall>) }
  }

  it("RC-40: перемещение к штукатурке останавливается в касании: ось на y = 17 (грань на y = 12)", () => {
    const { walls, own } = withWall(plastered(), drywall("m", 150, 30, 250, 30))
    const v = moveWallsBounded(walls, own, { x: 0, y: -100 }, { ortho: false })
    expect(v.y).toBeCloseTo(-13, 4)
    expect(own[0]?.a.y).toBeCloseTo(17, 4)
    expect(own[0]?.b.y).toBeCloseTo(17, 4)
  })

  it("RC-41: перемещение к стене без штукатурки останавливается у грани: ось на y = 15", () => {
    const { walls, own } = withWall(plastered(), drywall("m", 350, 30, 450, 30))
    moveWallsBounded(walls, own, { x: 0, y: -100 }, { ortho: false })
    expect(own[0]?.a.y).toBeCloseTo(15, 4)
  })

  it("RC-42: стена подложки и полосы штукатурки при правке не двигаются", () => {
    const { walls, own } = withWall(plastered(), drywall("m", 150, 30, 250, 30))
    const before = walls.filter((w) => w !== own[0]).map((w) => JSON.stringify([w.a, w.b]))
    moveWallsBounded(walls, own, { x: 0, y: -100 }, { ortho: false })
    expect(walls.filter((w) => w !== own[0]).map((w) => JSON.stringify([w.a, w.b]))).toEqual(before)
  })

  it("RC-43: большой шаг не проносит стену сквозь штукатурку и стену", () => {
    const { walls, own } = withWall(plastered(), drywall("m", 150, 30, 250, 30))
    moveWallsBounded(walls, own, { x: 0, y: -400 }, { ortho: false })
    expect(own[0]?.a.y).toBeGreaterThan(0)
  })

  it("RC-44: скольжение вдоль поверхности: составляющая вдоль применена, в штукатурку — ограничена", () => {
    const { walls, own } = withWall(plastered(), drywall("m", 150, 30, 250, 30))
    moveWallsBounded(walls, own, { x: 20, y: -100 }, { ortho: false })
    expect(own[0]?.a.y).toBeCloseTo(17, 4)
    expect(own[0]?.a.x).toBeCloseTo(170, 4)
  })

  it("RC-45: конец стены ГКЛ тянут сквозь штукатурку — упирается в касание", () => {
    const { walls, own } = withWall(plastered(), drywall("m", 200, 60, 200, 100))
    // конец a вертикальной стены ГКЛ тянут вниз к стене подложки; толщина стены 10 — торец останавливается на поверхности штукатурки
    moveEndpointBounded(walls, own[0] as NonNullable<(typeof own)[number]>, "a", { x: 200, y: -50 }, { ortho: false })
    expect(own[0]?.a.y).toBeCloseTo(12, 4)
  })

  it("RC-46: ввод длины, упирающейся в подложку, укорачивается до касания", () => {
    // вытягивание конца b (от y = 60 вверх к y = 100 − 400) упирается в грань W на y = 10: длина 90
    const { walls, own } = withWall(bare(), drywall("m", 200, 100, 200, 60))
    const r = resizeWallBounded(walls, own[0] as NonNullable<(typeof own)[number]>, 400, { ortho: false })
    expect(r.kind).toBe("applied")
    if (r.kind === "applied") expect(r.lengthCm).toBeCloseTo(90, 3)
  })

  it("RC-47: нарисованное поверх подложки не блокирует правку вдоль неё", () => {
    // стена ГКЛ целиком внутри тела W, но не на её оси (ось на оси — см. TODO.md)
    const { walls, own } = withWall(bare(), drywall("m", 100, 3, 200, 3))
    const v = moveWallsBounded(walls, own, { x: 20, y: 0 }, { ortho: false })
    expect(v.x).toBeCloseTo(20, 4)
    expect(own[0]?.a.x).toBeCloseTo(120, 4)
  })
})

describe("подложка и стены ГКЛ: геометрия", () => {
  it("RC-50: W (стена подложки) в сцене не меняется при подстановке стен ГКЛ", () => {
    const { scene } = openReconstruction({ ...plastered(), reconstruction: content([drywall("g", 0, 40, 500, 40)]) })
    const w = scene.walls.find((x) => x.id === "W~0")
    expect(w).toMatchObject({ a: W().a, b: W().b, thicknessCm: 20 })
  })
})
