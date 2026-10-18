import { describe, expect, it } from "vitest"
import { mountingScene } from "../mounting/mounting-scene"
import { addPlaster, editPlasterNumber, mergeAllPlaster, removePlaster, setPlasterThickness } from "./plaster-marks"
import { plasterPieces } from "./plaster"
import { W, deepFreeze, drawing, idGen, plaster, wall } from "./rough.test-utils"

// change add-rough-works-plan: операции над списком пометок штукатурки
// (spec rough-works-plan «Участки штукатурки одной грани не пересекаются», «Инструмент «Штукатурка»», «Выделение штукатурки и правка на месте»)

const walls = [W()]
const add = (marks: ReturnType<typeof plaster>[], face: 1 | -1, from: number, to: number, mm = 20) => addPlaster(marks, walls, "W", face, from, to, mm, idGen())

describe("постановка и слияние", () => {
  it("RW-20: пересечение сливается в один участок, толщина — у новой пометки", () => {
    const next = add([plaster("p", "W", 1, "a", 100, 200, 20)], 1, 150, 300, 30)
    expect(next).toEqual([plaster("p", "W", 1, "a", 100, 300, 30)])
  })

  it("RW-20: соприкосновение сливается", () => {
    expect(add([plaster("p", "W", 1, "a", 100, 200)], 1, 200, 300)).toEqual([plaster("p", "W", 1, "a", 100, 300)])
  })

  it("RW-20: соприкосновение в пределах 0,01 см сливается", () => {
    expect(add([plaster("p", "W", 1, "a", 100, 200)], 1, 200.005, 300)).toHaveLength(1)
  })

  it("RW-20: отдельные участки остаются двумя пометками, новая — в конец с новым идентификатором", () => {
    const next = add([plaster("p", "W", 1, "a", 100, 200)], 1, 250, 300)
    // участок 250–300 ближе серединой к концу b (275 > 250): хранится от b как 200–250
    expect(next).toEqual([plaster("p", "W", 1, "a", 100, 200), plaster("n1", "W", 1, "b", 200, 250)])
  })

  it("RW-21: разные грани независимы — пометки не сливаются", () => {
    const next = add([plaster("p", "W", 1, "a", 100, 200)], -1, 150, 250)
    expect(next).toHaveLength(2)
    expect(next.map((m) => m.face)).toEqual([1, -1])
  })

  it("RW-20: вся стена поглощает участки", () => {
    const next = add([plaster("p", "W", 1, "a", 100, 200), plaster("q", "W", 1, "a", 250, 300)], 1, 0, 500)
    expect(next).toEqual([plaster("p", "W", 1, "a", 0, 500)])
  })

  it("RW-22: привязка — ближний к середине участка конец: участок 300–450 от a хранится от b как 50–200", () => {
    const next = add([], 1, 300, 450)
    expect(next).toEqual([plaster("n1", "W", 1, "b", 50, 200)])
  })

  it("RW-23: участок за стеной обрезается по её длине", () => {
    expect(add([], 1, 400, 700)).toEqual([plaster("n1", "W", 1, "b", 0, 100)])
  })

  it("RW-24: ширина после обрезки меньше 1 см — ничего не создаётся (тот же массив)", () => {
    const marks = [plaster("p", "W", 1, "a", 100, 200)]
    expect(add(marks, 1, 300, 300.5)).toBe(marks)
  })

  it("RW-24: стены нет — тот же массив", () => {
    const marks = [plaster("p", "W", 1, "a", 100, 200)]
    expect(addPlaster(marks, walls, "none", 1, 0, 100, 20, idGen())).toBe(marks)
  })

  it("RW-24: нечисловые границы — тот же массив", () => {
    const marks: ReturnType<typeof plaster>[] = []
    expect(add(marks, 1, Number.NaN, 100)).toBe(marks)
  })

  it("RW-25: операции не мутируют вход", () => {
    const marks = deepFreeze([plaster("p", "W", 1, "a", 100, 200)])
    expect(() => add(marks, 1, 150, 300)).not.toThrow()
  })

  it("RW-26: слияние сохраняет идентификатор первой слитой пометки", () => {
    const next = add([plaster("a1", "W", 1, "a", 100, 200), plaster("a2", "W", 1, "a", 250, 300)], 1, 190, 260)
    expect(next).toEqual([plaster("a1", "W", 1, "a", 100, 300, 20)])
  })
})

describe("снятие и толщина", () => {
  it("RW-27: removePlaster убирает пометку; неизвестный идентификатор — тот же массив", () => {
    const marks = [plaster("p", "W", 1, "a", 100, 200), plaster("q", "W", -1, "a", 100, 200)]
    expect(removePlaster(marks, "p")).toEqual([plaster("q", "W", -1, "a", 100, 200)])
    expect(removePlaster(marks, "x")).toBe(marks)
  })

  it("RW-28: setPlasterThickness меняет толщину одной пометки; то же значение — тот же массив", () => {
    const marks = [plaster("p", "W", 1, "a", 100, 200, 20), plaster("q", "W", 1, "a", 300, 400, 20)]
    expect(setPlasterThickness(marks, "p", 30)).toEqual([plaster("p", "W", 1, "a", 100, 200, 30), plaster("q", "W", 1, "a", 300, 400, 20)])
    expect(setPlasterThickness(marks, "p", 20)).toBe(marks)
    expect(setPlasterThickness(marks, "zz", 30)).toBe(marks)
  })
})

describe("слияние при загрузке", () => {
  it("RW-29: две пометки одной грани 100–200 и 150–300 сливаются в 100–300", () => {
    const next = mergeAllPlaster([plaster("p", "W", 1, "a", 100, 200), plaster("q", "W", 1, "a", 150, 300)], walls)
    expect(next).toEqual([plaster("p", "W", 1, "a", 100, 300)])
  })

  it("RW-29: пометки разных граней и пометки на отсутствующие стены не трогаются", () => {
    const marks = [plaster("p", "W", 1, "a", 100, 200), plaster("q", "W", -1, "a", 150, 300), plaster("g", "gone", 1, "a", 0, 10), plaster("h", "gone", 1, "a", 5, 20)]
    expect(mergeAllPlaster(marks, walls)).toEqual(marks)
  })
})

describe("правка чисел участка", () => {
  const scene = (marks: ReturnType<typeof plaster>[]) => {
    const d = drawing({ roughPlaster: marks })
    const s = mountingScene(d)
    return { d, s, pieces: plasterPieces(d, s) }
  }

  it("RW-30: ширина 200 на свободной стене — участок 100–300", () => {
    const { s, pieces } = scene([plaster("p", "W", 1, "a", 100, 190)])
    const edited = editPlasterNumber([plaster("p", "W", 1, "a", 100, 190)], walls, s.walls, pieces[0]!, 0, "width", 200)
    expect(edited?.marks).toEqual([plaster("p", "W", 1, "a", 100, 300)])
    expect(edited?.id).toBe("p")
  })

  it("RW-30: отступ до конца a: ввод 150 — участок 150–240 (ширина 90)", () => {
    const { s, pieces } = scene([plaster("p", "W", 1, "a", 100, 190)])
    const edited = editPlasterNumber([plaster("p", "W", 1, "a", 100, 190)], walls, s.walls, pieces[0]!, 0, "gapA", 150)
    expect(edited?.marks).toEqual([plaster("p", "W", 1, "a", 150, 240)])
  })

  it("RW-30: отступ до конца b: ввод 50 — участок 360–450", () => {
    const { s, pieces } = scene([plaster("p", "W", 1, "a", 100, 190)])
    const edited = editPlasterNumber([plaster("p", "W", 1, "a", 100, 190)], walls, s.walls, pieces[0]!, 0, "gapB", 50)
    expect(edited?.marks).toEqual([plaster("p", "W", 1, "b", 50, 140)])
  })

  it("RW-31: значение за стеной принимается ближайшим допустимым: ширина 900 — участок 100–500", () => {
    const { s, pieces } = scene([plaster("p", "W", 1, "a", 100, 190)])
    const edited = editPlasterNumber([plaster("p", "W", 1, "a", 100, 190)], walls, s.walls, pieces[0]!, 0, "width", 900)
    // участок 100–500 хранится от конца b (середина 300 > 250): 0–400
    expect(edited?.marks).toEqual([plaster("p", "W", 1, "b", 0, 400)])
  })

  it.each([["abc", Number.NaN], ["отрицательный отступ", -5], ["ширина 0", 0]])("RW-32: недопустимый ввод (%s) ничего не меняет", (_n, v) => {
    const { s, pieces } = scene([plaster("p", "W", 1, "a", 100, 190)])
    const which = _n === "ширина 0" ? "width" : "gapA"
    expect(editPlasterNumber([plaster("p", "W", 1, "a", 100, 190)], walls, s.walls, pieces[0]!, 0, which, v)).toBeNull()
  })

  it("RW-33: после правки участок сливается с соседними: 100–190 и 250–300, ширина первого 200", () => {
    const marks = [plaster("p", "W", 1, "a", 100, 190), plaster("q", "W", 1, "a", 250, 300)]
    const { s, pieces } = scene(marks)
    const edited = editPlasterNumber(marks, walls, s.walls, pieces[0]!, 0, "width", 200)
    expect(edited?.marks).toEqual([plaster("p", "W", 1, "a", 100, 300)])
  })

  it("RW-34: правка на стене с остатком — участок переводится в координаты исходной стены", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 500, 0)], demolition: [{ id: "m", wallId: "W", anchor: "a", fromCm: 0, toCm: 200 }], roughPlaster: [plaster("p", "W", 1, "a", 250, 330)] })
    const s = mountingScene(d)
    const pieces = plasterPieces(d, s)
    // остаток 200–500: участок на нём 50–130, ширина 80 → ввод 100 даёт 250–350 в координатах исходной стены
    const edited = editPlasterNumber(d.roughPlaster ?? [], d.walls, s.walls, pieces[0]!, 200, "width", 100)
    // участок 250–350 хранится от конца b (середина 300 > 250): 150–250
    expect(edited?.marks).toEqual([plaster("p", "W", 1, "b", 150, 250)])
  })
})
