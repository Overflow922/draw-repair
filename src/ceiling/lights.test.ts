import { describe, expect, it } from "vitest"
import type { LightFixture } from "../types"
import { LIGHT_KINDS, addLight, moveLight, newLight, removeLight } from "./lights"

// change add-ceiling-lighting: каталог видов и правки списка объектов освещения (spec ceiling-lighting «Виды объектов освещения»)

const SPOT: LightFixture = { id: "s", kind: "spot", x: 100, y: 80 }
const SCONCE: LightFixture = { id: "b", kind: "sconce", x: 120, y: 0, angleDeg: 90 }

describe("объекты освещения", () => {
  it("CL-M1: пять видов в порядке каталога", () => {
    expect(LIGHT_KINDS.map((k) => k.title)).toEqual([
      "Точечный встроенный светильник",
      "Датчик пожарной сигнализации потолочный",
      "Люстра",
      "Бра",
      "Электровывод для освещения",
    ])
  })

  it("CL-M2: центр точки округляется до целого сантиметра; бра — точка грани как есть и с углом, у точки угла нет", () => {
    expect(newLight("spot", { at: { x: 100.4, y: 79.6 } }, "n")).toEqual({ id: "n", kind: "spot", x: 100, y: 80 })
    expect(newLight("sconce", { at: { x: 120, y: 7.5 }, angleDeg: 90 }, "m")).toEqual({ id: "m", kind: "sconce", x: 120, y: 7.5, angleDeg: 90 })
  })

  it("CL-M3: сдвиг меняет только центр (и угол бра); без изменения — тот же массив", () => {
    const lights = [SPOT, SCONCE]
    expect(moveLight(lights, "s", { at: { x: 150, y: 80 } })).toEqual([{ ...SPOT, x: 150 }, SCONCE])
    expect(moveLight(lights, "s", { at: { x: 100.2, y: 80 } })).toBe(lights)
    expect(moveLight(lights, "b", { at: { x: 0, y: 200 }, angleDeg: 0 })).toEqual([SPOT, { ...SCONCE, x: 0, y: 200, angleDeg: 0 }])
    expect(moveLight(lights, "x", { at: { x: 1, y: 1 } })).toBe(lights)
    expect(lights).toEqual([SPOT, SCONCE])
  })

  it("CL-M4: постановка добавляет в конец, удаление убирает; отсутствующий id — тот же массив", () => {
    const lights = [SPOT]
    expect(addLight(lights, SCONCE)).toEqual([SPOT, SCONCE])
    expect(removeLight([SPOT, SCONCE], "s")).toEqual([SCONCE])
    expect(removeLight(lights, "x")).toBe(lights)
  })
})
