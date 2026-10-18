import { describe, expect, it } from "vitest"
import { mountingScene } from "../mounting/mounting-scene"
import { plasterPieces, plasterStrip } from "./plaster"
import { areaOf, boxOf, demolitionMark, drawing, plaster, r6, wall } from "./rough.test-utils"

// change add-rough-works-plan: пометка штукатурки — геометрия полосы, отсечение по снесённому, следование за стеной
// (spec rough-works-plan «Пометка штукатурки», «Участок штукатурки следует за стеной»)

const stripBox = (d: ReturnType<typeof drawing>) => {
  const pieces = plasterPieces(d, mountingScene(d))
  return boxOf(pieces.map(plasterStrip))
}

describe("полоса штукатурки", () => {
  it("RW-10: грань +1, участок 100–300 см, 20 мм — прямоугольник x 100…300, y 10…12", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] })
    const pieces = plasterPieces(d, mountingScene(d))
    expect(pieces).toHaveLength(1)
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX), r6(box.minY), r6(box.maxY)]).toEqual([100, 300, 10, 12])
  })

  it("RW-10: грань −1 лежит с другой стороны тела стены: y −12…−10", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", -1, "a", 100, 300, 20)] })
    const box = stripBox(d)
    expect([r6(box.minY), r6(box.maxY)]).toEqual([-12, -10])
  })

  it("RW-10: толщина 100 мм — полоса 10 см вглубь; площадь = длина × толщина", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 100)] })
    const strips = plasterPieces(d, mountingScene(d)).map(plasterStrip)
    expect(r6(areaOf(strips))).toBe(5000)
  })

  it("RW-10: полоса не заходит в тело стены", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 50)] })
    expect(stripBox(d).minY).toBeGreaterThanOrEqual(10)
  })

  it("RW-11: привязка к концу b — участок отсчитывается от конца b", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "b", 100, 300, 20)] })
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX)]).toEqual([200, 400])
  })

  it("RW-12: проём на стене полосу не прерывает — одна сплошная полоса 100…400", () => {
    const d = { ...drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 400, 20)] }), doorways: [{ id: "o", wallId: "W", anchor: "a" as const, offsetCm: 200, widthCm: 90, heightCm: 210 }] }
    const pieces = plasterPieces(d, mountingScene(d))
    expect(pieces).toHaveLength(1)
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX)]).toEqual([100, 400])
  })

  it("RW-12: окно полосу не прерывает", () => {
    const d = {
      ...drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 400, 20)] }),
      doorways: [{ kind: "window" as const, id: "o", wallId: "W", anchor: "a" as const, offsetCm: 200, widthCm: 90, heightCm: 120, sillCm: 90 }],
    }
    expect(plasterPieces(d, mountingScene(d))).toHaveLength(1)
  })

  it("RW-13: часть участка над снесённым отсекается, остаются 100–150 и 250–300", () => {
    const d = drawing({ demolition: [demolitionMark("m", "W", "a", 150, 250)], roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] })
    const pieces = plasterPieces(d, mountingScene(d))
    expect(pieces).toHaveLength(2)
    const xs = pieces.map((p) => boxOf([plasterStrip(p)])).map((b) => [r6(b.minX), r6(b.maxX)])
    expect(xs).toEqual([
      [100, 150],
      [250, 300],
    ])
  })

  it("RW-13: целиком снесённый участок не даёт полосы", () => {
    const d = drawing({ demolition: [demolitionMark("m", "W", "a", 50, 350)], roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] })
    expect(plasterPieces(d, mountingScene(d))).toEqual([])
  })

  it("RW-14: пометка на отсутствующую стену не действует (остаётся в хранилище)", () => {
    const d = drawing({ roughPlaster: [plaster("p", "gone", 1, "a", 100, 300, 20)] })
    expect(plasterPieces(d, mountingScene(d))).toEqual([])
    expect(d.roughPlaster).toHaveLength(1)
  })

  it("RW-15: штукатурка на собственной стене «Монтажа» действует", () => {
    const own = wall("own", 0, 200, 300, 200)
    const d = drawing({ mounting: { walls: [own], dimensions: [] }, roughPlaster: [plaster("p", "own", 1, "a", 0, 300, 30)] })
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX), r6(box.minY), r6(box.maxY)]).toEqual([0, 300, 210, 213])
  })

  it("RW-16: участок за концом стены обрезается по стене", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 400, 700, 20)] })
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX)]).toEqual([400, 500])
  })

  it("RW-17: бетонная стена штукатурится", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 500, 0, 20, "concrete")], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] })
    expect(plasterPieces(d, mountingScene(d))).toHaveLength(1)
  })

  it("RW-18: участок следует за стеной: перенос W на (0,100) переносит полосу на y 110…112", () => {
    const d = drawing({ walls: [wall("W", 0, 100, 500, 100)], roughPlaster: [plaster("p", "W", 1, "a", 100, 190, 20)] })
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX), r6(box.minY), r6(box.maxY)]).toEqual([100, 190, 110, 112])
  })

  it("RW-18: перемещение второго конца не смещает участок", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 600, 0)], roughPlaster: [plaster("p", "W", 1, "a", 100, 190, 20)] })
    const box = stripBox(d)
    expect([r6(box.minX), r6(box.maxX)]).toEqual([100, 190])
  })

  it("RW-19: диагональная стена — полоса параллельна оси", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 300, 400, 20)], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 100)] })
    const [strip] = plasterPieces(d, mountingScene(d)).map(plasterStrip)
    // ось (3,4)/5, нормаль (−4,3)/5: грань +1 на 10 см, глубина 10 см; площадь 500 × 10
    expect(r6(areaOf([strip]))).toBe(5000)
    expect(strip.every((p) => (-4 * p.x + 3 * p.y) / 5 >= 10 - 1e-9)).toBe(true)
  })
})
