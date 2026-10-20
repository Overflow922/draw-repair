import { describe, expect, it } from "vitest"
import { mk, wall } from "../demolition/demolition.test-utils"
import { markRegion } from "../demolition/mark-region"
import { effectiveMarks } from "../demolition/mark-model"
import type { Point, Wall } from "../types"
import { displayPolygons, pointInPolygon } from "../wall-geometry"
import { remnantWalls } from "./remnants"

// change demolition-no-neighbor-overlap (spec mounting-plan «Остатки — живая производная»): остаток — форма стены за вычетом
// областей сноса, соседние стены после сноса остаются целыми. Сцена пользователя (см): стена V (7 см) идёт сквозь разрыв
// нижней стены (B1, B2 примыкают к её граням), к грани V сверху примыкает T, правая стена R разорвана по толщине T.

const scene = (): Wall[] => [
  wall(1119.3, 462.1, 1268.9, 462.1, "B1", "blocks", 10),
  wall(1272.4, 457.1, 1272.4, 345.8, "V", "blocks", 7),
  wall(1275.9, 349.3, 1307.1, 349.3, "T", "blocks", 7),
  wall(1312.1, 345.8, 1312.1, 193.5, "R1", "blocks", 10),
  wall(1312.1, 352.8, 1312.1, 457.1, "R2", "blocks", 10),
  wall(1275.9, 462.1, 1307.1, 462.1, "B2", "blocks", 10),
]

const covers = (walls: readonly Wall[], p: Point): boolean => walls.some((w) => displayPolygons(w, [...walls]).some((poly) => pointInPolygon(p, poly)))

describe("остатки возвращают выступы формы, потерянные со снесённым соседом", () => {
  const walls = scene()
  const marks = effectiveMarks([mk("v", "V", "a", 0, 111.3), mk("t", "T", "a", 0, 31.2)], walls)
  const remnants = remnantWalls(walls, marks)

  it("MO-01: ни одна точка формы обмера вне областей сноса не пропадает с плана «Монтаж» и ничего лишнего не появляется", () => {
    const zones = marks.flatMap((m) => markRegion(m, walls))
    let lost = 0
    let extra = 0
    for (let x = 1260; x <= 1325; x += 1)
      for (let y = 340; y <= 470; y += 1) {
        const p = { x, y }
        const inZone = zones.some((poly) => pointInPolygon(p, poly))
        const before = covers(walls, p)
        const after = covers(remnants, p)
        if (before && !inZone && !after) lost++
        if (after && !before) extra++
      }
    expect({ lost, extra }).toEqual({ lost: 0, extra: 0 })
  })

  it("MO-02: нижняя стена и правая стена остаются непрерывными: проверка точек на месте бывших V и T", () => {
    expect(covers(remnants, { x: 1272.4, y: 462.1 })).toBe(true)
    expect(covers(remnants, { x: 1312.1, y: 349.3 })).toBe(true)
  })

  it("MO-03: зона V (между гранями нижних стен) на плане «Монтаж» пуста", () => {
    expect(covers(remnants, { x: 1272.4, y: 400 })).toBe(false)
    expect(covers(remnants, { x: 1290, y: 349.3 })).toBe(false)
  })
})

describe("выступы не добавляются без надобности", () => {
  it("MO-04: без пометок остатки — только оси стен", () => {
    const walls = scene()
    expect(remnantWalls(walls, []).map((w) => w.id)).toEqual(walls.map((w) => `${w.id}~0`))
  })

  it("MO-05: снос участка в стороне от стыков стен выступов не добавляет", () => {
    const walls = [wall(0, 0, 500, 0, "W", "brick", 20)]
    const marks = effectiveMarks([mk("m", "W", "a", 100, 190)], walls)
    expect(remnantWalls(walls, marks).map((w) => w.id)).toEqual(["W~0", "W~1900"])
  })
})
