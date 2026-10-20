import { describe, expect, it } from "vitest"
import { addPlaster, mergeAllPlaster, removePlaster, setPlasterThickness } from "./plaster-marks"
import { W, deepFreeze, idGen, plaster } from "./rough.test-utils"

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
