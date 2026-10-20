import { describe, expect, it } from "vitest"
import { formatLength } from "../format-length"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "../wall-edit"
import { DRYWALL_DEFAULTS, editParams, newDrywallWall, panelValues, parseLengthField } from "./drywall-params"
import { drywall } from "./reconstruction.test-utils"

// change reconstruction-plan: высота и толщина стены ГКЛ, панель инструмента «Гипсокартон»
// (spec reconstruction-plan «Высота стены гипсокартона», «Панель инструмента «Гипсокартон»», «Стена гипсокартона»)

describe("значения по умолчанию", () => {
  it("RC-60: толщина 10 см, высота 250 см", () => {
    expect(DRYWALL_DEFAULTS).toEqual({ thicknessCm: 10, heightCm: 250 })
  })

  it("RC-61: новая стена получает толщину и высоту из параметров и тип «ГКЛ»", () => {
    const w = newDrywallWall("g", { x: 0, y: 0 }, { x: 300, y: 0 }, { thicknessCm: 5, heightCm: 270 })
    expect(w).toEqual({ id: "g", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 5, heightCm: 270, type: "gkl" })
  })

  it("RC-61: концы стены — копии точек, а не те же объекты", () => {
    const a = { x: 0, y: 0 }
    const w = newDrywallWall("g", a, { x: 300, y: 0 }, DRYWALL_DEFAULTS)
    w.a.x = 99
    expect(a.x).toBe(0)
  })
})

describe("поле длины в текущей единице", () => {
  it("RC-62: «мм» — 2700 → 270 см; «см» — 270; «м» — 2,7 и 2.7 → 270", () => {
    expect(parseLengthField("2700", "mm")).toBeCloseTo(270, 9)
    expect(parseLengthField("270", "cm")).toBe(270)
    expect(parseLengthField("2,7", "m")).toBeCloseTo(270, 9)
    expect(parseLengthField("2.7", "m")).toBeCloseTo(270, 9)
  })

  it("RC-63: нуль, отрицательное, нечисловое и пустое значения не применяются", () => {
    for (const text of ["0", "-5", "abc", "", " ", "NaN", "Infinity"]) expect(parseLengthField(text, "cm")).toBeNull()
  })

  it("RC-64: при переключении единицы поле показывает ту же физическую высоту (270 см → 2,7 м / 270 / 2700)", () => {
    expect(formatLength(270, "m")).toBe("2,7")
    expect(formatLength(270, "cm")).toBe("270")
    expect(formatLength(270, "mm")).toBe("2700")
  })
})

describe("панель: значения для новых и для выделенной стены", () => {
  const sel = drywall("g", 0, 0, 300, 0, 10, 250)

  it("RC-65: без выделения панель показывает значения для новых", () => {
    expect(panelValues({ thicknessCm: 5, heightCm: 270 }, null)).toEqual({ thicknessCm: 5, heightCm: 270 })
  })

  it("RC-65: при выделении панель показывает значения выделенной стены", () => {
    expect(panelValues({ thicknessCm: 5, heightCm: 270 }, sel)).toEqual({ thicknessCm: 10, heightCm: 250 })
  })

  it("RC-66: правка без выделения меняет значения для новых", () => {
    const r = editParams(DRYWALL_DEFAULTS, null, { heightCm: 270 })
    expect(r.params).toEqual({ thicknessCm: 10, heightCm: 270 })
    expect(r.wall).toBeNull()
  })

  it("RC-67: правка при выделении меняет выделенную стену и НЕ меняет значения для новых", () => {
    const r = editParams(DRYWALL_DEFAULTS, sel, { heightCm: 280 })
    expect(r.wall?.heightCm).toBe(280)
    expect(r.wall).toMatchObject({ id: "g", thicknessCm: 10, a: sel.a, b: sel.b })
    expect(r.params).toEqual(DRYWALL_DEFAULTS)
  })

  it("RC-68: правка толщины выделенной стены сохраняет высоту, и наоборот", () => {
    expect(editParams(DRYWALL_DEFAULTS, sel, { thicknessCm: 5 }).wall).toMatchObject({ thicknessCm: 5, heightCm: 250 })
  })

  it("RC-69: значение, равное текущему, ничего не меняет (шага истории нет)", () => {
    expect(editParams(DRYWALL_DEFAULTS, sel, { heightCm: 250 }).wall).toBeNull()
  })

  it("RC-70: недопустимое значение (0, отрицательное, нечисловое) не применяется", () => {
    for (const v of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = editParams(DRYWALL_DEFAULTS, sel, { heightCm: v })
      expect(r.wall).toBeNull()
      expect(r.params).toEqual(DRYWALL_DEFAULTS)
    }
  })

  it("RC-71: исходные объекты не мутируются", () => {
    const before = JSON.stringify(sel)
    editParams(DRYWALL_DEFAULTS, sel, { heightCm: 280 })
    expect(JSON.stringify(sel)).toBe(before)
  })
})

describe("высота и идентификатор переживают правки стены (R2)", () => {
  const mk = () => drywall("g", 100, 100, 300, 100, 10, 270)

  it("RC-72: перемещение за средний маркер", () => {
    const g = mk()
    moveWallsBounded([g], [g], { x: 30, y: 20 }, { ortho: false })
    expect(g).toMatchObject({ id: "g", heightCm: 270, thicknessCm: 10, type: "gkl" })
  })

  it("RC-73: перетаскивание конца", () => {
    const g = mk()
    moveEndpointBounded([g], g, "b", { x: 400, y: 150 }, { ortho: false })
    expect(g).toMatchObject({ id: "g", heightCm: 270 })
  })

  it("RC-74: ввод длины", () => {
    const g = mk()
    resizeWallBounded([g], g, 350, { ortho: false })
    expect(g).toMatchObject({ id: "g", heightCm: 270 })
  })
})
