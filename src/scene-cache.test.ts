import { beforeEach, describe, expect, it } from "vitest"
import { clearSceneCache, sceneMemo } from "./scene-cache"
import { contourSegments, displayPolygons } from "./wall-geometry"
import { findRooms } from "./room-area"
import type { Material, Point, Wall } from "./types"

const wall = (id: string, a: Point, b: Point, type: Material = "brick", thicknessCm = 10): Wall => ({ id, a, b, thicknessCm, type })

// комната 400×300 из четырёх стен «цепочкой», как её рисует пользователь
const room = (): Wall[] => [
  wall("n", { x: 0, y: 0 }, { x: 400, y: 0 }),
  wall("e", { x: 400, y: 0 }, { x: 400, y: 300 }),
  wall("s", { x: 400, y: 300 }, { x: 0, y: 300 }),
  wall("w", { x: 0, y: 300 }, { x: 0, y: 0 }),
]

const cloneWalls = (walls: Wall[]): Wall[] => walls.map((w) => ({ ...w, a: { ...w.a }, b: { ...w.b } }))

// результат тех же вычислений на копии стен без накопленного кэша
function fresh<T>(walls: Wall[], f: (copy: Wall[]) => T): T {
  const copy = cloneWalls(walls)
  clearSceneCache()
  const result = f(copy)
  clearSceneCache()
  return result
}

beforeEach(() => clearSceneCache())

describe("кэш геометрии: неизменная сцена", () => {
  it("повторный запрос по тем же стенам отдаёт тот же результат без пересчёта", () => {
    const walls = room()
    expect(findRooms(walls)).toBe(findRooms(walls))
    expect(displayPolygons(walls[0], walls)).toBe(displayPolygons(walls[0], walls))
    expect(contourSegments(walls[1], walls)).toBe(contourSegments(walls[1], walls))
  })

  it("равные по значению стены из другого массива дают тот же по значению результат", () => {
    const walls = room()
    const other = cloneWalls(walls)
    expect(findRooms(other)).toEqual(findRooms(walls))
    expect(displayPolygons(other[2], other)).toEqual(displayPolygons(walls[2], walls))
  })
})

describe("кэш геометрии: изображение соответствует текущим стенам", () => {
  it("перемещение стены на месте меняет контуры и помещения", () => {
    const walls = room()
    findRooms(walls)
    displayPolygons(walls[1], walls)
    contourSegments(walls[1], walls)
    walls[1].a = { x: 500, y: 0 }
    walls[1].b = { x: 500, y: 300 }
    expect(findRooms(walls)).toEqual(fresh(walls, (w) => findRooms(w)))
    expect(displayPolygons(walls[1], walls)).toEqual(fresh(walls, (w) => displayPolygons(w[1], w)))
    expect(contourSegments(walls[1], walls)).toEqual(fresh(walls, (w) => contourSegments(w[1], w)))
  })

  it("возврат стены в прежнее положение (отмена) возвращает прежнюю геометрию", () => {
    const walls = room()
    const before = findRooms(walls)
    const home = { a: { ...walls[2].a }, b: { ...walls[2].b } }
    walls[2].a = { x: 400, y: 200 }
    walls[2].b = { x: 0, y: 200 }
    expect(findRooms(walls)).toEqual(fresh(walls, (w) => findRooms(w)))
    walls[2].a = home.a
    walls[2].b = home.b
    expect(findRooms(walls)).toEqual(before)
    expect(findRooms(walls)).toEqual(fresh(walls, (w) => findRooms(w)))
  })

  it("смена типа соседней стены меняет шов в контуре", () => {
    const walls = [wall("a", { x: 0, y: 0 }, { x: 200, y: 0 }), wall("b", { x: 200, y: 0 }, { x: 400, y: 0 })]
    contourSegments(walls[0], walls)
    walls[1].type = "concrete"
    expect(contourSegments(walls[0], walls)).toEqual(fresh(walls, (w) => contourSegments(w[0], w)))
  })

  it("смена толщины меняет тело стены", () => {
    const walls = room()
    displayPolygons(walls[0], walls)
    walls[0].thicknessCm = 30
    expect(displayPolygons(walls[0], walls)).toEqual(fresh(walls, (w) => displayPolygons(w[0], w)))
  })

  it("порядок стен влияет на геометрию и учитывается", () => {
    const walls = room()
    findRooms(walls)
    displayPolygons(walls[0], walls)
    const reversed = [...walls].reverse()
    expect(displayPolygons(reversed[3], reversed)).toEqual(fresh(reversed, (w) => displayPolygons(w[3], w)))
    expect(findRooms(reversed)).toEqual(fresh(reversed, (w) => findRooms(w)))
  })

  it("добавление и удаление стены (в том числе превью) меняет результат", () => {
    const walls = room()
    findRooms(walls)
    const preview = wall("", { x: 0, y: 150 }, { x: 400, y: 150 })
    const withPreview = [...walls, preview]
    expect(findRooms(withPreview)).toEqual(fresh(withPreview, (w) => findRooms(w)))
    expect(displayPolygons(preview, withPreview)).toEqual(fresh(withPreview, (w) => displayPolygons(w[4], w)))
    walls.pop()
    expect(findRooms(walls)).toEqual(fresh(walls, (w) => findRooms(w)))
    expect(displayPolygons(walls[0], walls)).toEqual(fresh(walls, (w) => displayPolygons(w[0], w)))
  })

  it("стена вне массива (превью) пересчитывается при смене её значений", () => {
    const walls = room()
    const preview = wall("", { x: 100, y: 100 }, { x: 200, y: 100 })
    displayPolygons(preview, walls)
    preview.b = { x: 300, y: 250 }
    expect(displayPolygons(preview, walls)).toEqual(fresh(walls, (w) => displayPolygons({ ...preview, a: { ...preview.a }, b: { ...preview.b } }, w)))
  })

  it("чередование сцены и сцены с превью не портит ни одну из них", () => {
    const walls = room()
    const preview = wall("", { x: 0, y: 150 }, { x: 400, y: 150 })
    for (let i = 0; i < 4; i++) {
      preview.b = { x: 400, y: 150 + i * 10 }
      const scene = [...walls, preview]
      expect(findRooms(scene)).toEqual(fresh(scene, (w) => findRooms(w)))
      expect(findRooms(walls)).toEqual(fresh(walls, (w) => findRooms(w)))
    }
  })
})

describe("кэш геометрии: результат нельзя испортить", () => {
  it("кэшированный результат защищён от записи", () => {
    const walls = room()
    const polys = displayPolygons(walls[0], walls)
    expect(() => {
      polys[0][0].x = 12345
    }).toThrow(TypeError)
    expect(displayPolygons(walls[0], walls)[0][0].x).not.toBe(12345)
  })
})

describe("sceneMemo", () => {
  it("считает один раз на неизменную сцену и заново после её изменения", () => {
    const walls = room()
    const memo = sceneMemo<number>()
    let calls = 0
    const compute = (): number => ++calls
    expect(memo(walls, null, compute)).toBe(1)
    expect(memo(walls, null, compute)).toBe(1)
    walls[0].b = { x: 410, y: 0 }
    expect(memo(walls, null, compute)).toBe(2)
  })

  it("различает стены одной сцены", () => {
    const walls = room()
    const memo = sceneMemo<string>()
    expect(memo(walls, walls[0], () => "n")).toBe("n")
    expect(memo(walls, walls[1], () => "e")).toBe("e")
    expect(memo(walls, walls[0], () => "other")).toBe("n")
  })
})
