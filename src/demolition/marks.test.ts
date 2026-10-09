import { describe, expect, it } from "vitest"
import type { DemolitionMark } from "../types"
import { W, deepFreeze, idGen, mk, wall } from "./demolition.test-utils"
import { addMark, canDemolish, effectiveMarks, markAt, mergeAll, removeMark, span } from "./marks"

// change demolition-plan: модель пометок сноса (spec demolition-plan «Пометка сноса», «Что сносится и что нет»,
// «Участки одной стены не пересекаются»; design D2). Стена W — (0,0)-(500,0), кирпич, 20 см.

const walls = [W()]

describe("span и canDemolish", () => {
  it("DM-26: привязка a — границы от конца a без изменений", () => {
    expect(span(mk("m", "W", "a", 100, 190), W())).toEqual([100, 190])
  })

  it("DM-26: привязка b — границы пересчитаны от конца a: [len − to, len − from]", () => {
    expect(span(mk("m", "W", "b", 50, 140), W())).toEqual([360, 450])
  })

  it("DM-26: span не обрезает участок по стене", () => {
    expect(span(mk("m", "W", "a", 400, 700), W())).toEqual([400, 700])
  })

  it.each(["brick", "concrete", "wood-long"] as const)("DM-27: стена из материала %s сносится", (type) => {
    expect(canDemolish(W(type))).toBe(true)
  })

  it("DM-27: железобетон не сносится", () => {
    expect(canDemolish(W("reinforced"))).toBe(false)
  })

  it("DM-27: вырожденная стена не сносится", () => {
    expect(canDemolish(wall(10, 10, 10, 10, "Z"))).toBe(false)
  })
})

describe("addMark: создание и якорь", () => {
  it("DM-01: целая стена — участок от 0 до длины, одна пометка с новым идентификатором", () => {
    expect(addMark([], walls, "W", 0, 500, idGen())).toEqual([mk("n1", "W", "a", 0, 500)])
  })

  it("DM-02: участок 300–450 — привязка b, from 50, to 200", () => {
    expect(addMark([], walls, "W", 300, 450, idGen())).toEqual([mk("n1", "W", "b", 50, 200)])
  })

  it("DM-03: середина участка ровно в середине стены — привязка a", () => {
    expect(addMark([], walls, "W", 200, 300, idGen())).toEqual([mk("n1", "W", "a", 200, 300)])
  })

  it("DM-04: середина левее середины стены — a (0–240); правее — b (260–500 → b 0…240)", () => {
    expect(addMark([], walls, "W", 0, 240, idGen())).toEqual([mk("n1", "W", "a", 0, 240)])
    expect(addMark([], walls, "W", 260, 500, idGen())).toEqual([mk("n1", "W", "b", 0, 240)])
  })

  it("DM-20: участок за концом стены обрезается: 400–700 → 400–500", () => {
    expect(addMark([], walls, "W", 400, 700, idGen())).toEqual([mk("n1", "W", "b", 0, 100)])
  })

  it("DM-20: участок до начала стены обрезается: −50–120 → 0–120", () => {
    expect(addMark([], walls, "W", -50, 120, idGen())).toEqual([mk("n1", "W", "a", 0, 120)])
  })

  it("DM-19: ширина ровно 1 см принимается, 0,5 см — нет", () => {
    expect(addMark([], walls, "W", 100, 101, idGen())).toEqual([mk("n1", "W", "a", 100, 101)])
    const empty: DemolitionMark[] = []
    expect(addMark(empty, walls, "W", 100, 100.5, idGen())).toBe(empty)
  })

  it("DM-19: участок, обрезанный до ширины < 1 см, отклоняется", () => {
    const empty: DemolitionMark[] = []
    expect(addMark(empty, walls, "W", 499.5, 700, idGen())).toBe(empty)
  })

  it("DM-19: не конечные границы отклоняются", () => {
    const empty: DemolitionMark[] = []
    expect(addMark(empty, walls, "W", Number.NaN, 100, idGen())).toBe(empty)
    expect(addMark(empty, walls, "W", 0, Number.POSITIVE_INFINITY, idGen())).toBe(empty)
  })

  it("DM-01: идентификатор по умолчанию уникален и непуст", () => {
    const a = addMark([], walls, "W", 0, 100)[0]
    const b = addMark([], walls, "W", 0, 100)[0]
    expect(typeof a?.id).toBe("string")
    expect(a?.id).not.toBe("")
    expect(a?.id).not.toBe(b?.id)
  })

  it("DM-01: новая пометка добавляется в конец списка, существующие не меняются", () => {
    const existing = [mk("m1", "W", "a", 100, 200)]
    const next = addMark(existing, walls, "W", 300, 350, idGen())
    expect(next).toEqual([mk("m1", "W", "a", 100, 200), mk("n1", "W", "b", 150, 200)])
  })
})

describe("addMark: отказы", () => {
  it("DM-06: железобетон не помечается — возвращается тот же массив", () => {
    const empty: DemolitionMark[] = []
    expect(addMark(empty, [W("reinforced")], "W", 0, 500, idGen())).toBe(empty)
  })

  it("DM-18: отсутствующая стена — тот же массив", () => {
    const list = [mk("m1", "W", "a", 100, 200)]
    expect(addMark(list, walls, "nope", 0, 100, idGen())).toBe(list)
  })

  it("DM-18: вырожденная стена — тот же массив", () => {
    const empty: DemolitionMark[] = []
    expect(addMark(empty, [wall(5, 5, 5, 5, "Z")], "Z", 0, 10, idGen())).toBe(empty)
  })

  it("DM-17: пустые стены и пометки — тот же пустой массив", () => {
    const empty: DemolitionMark[] = []
    expect(addMark(empty, [], "W", 0, 100, idGen())).toBe(empty)
  })
})

describe("addMark: слияние", () => {
  it("DM-13: пересечение 100–200 и 150–300 даёт один участок 100–300 с прежним идентификатором", () => {
    const next = addMark([mk("m1", "W", "a", 100, 200)], walls, "W", 150, 300, idGen())
    expect(next).toEqual([mk("m1", "W", "a", 100, 300)])
  })

  it("DM-14: соприкосновение 100–200 и 200–300 даёт один участок 100–300", () => {
    expect(addMark([mk("m1", "W", "a", 100, 200)], walls, "W", 200, 300, idGen())).toEqual([mk("m1", "W", "a", 100, 300)])
  })

  it("DM-14: зазор 0,005 см (в пределах допуска 0,01) сливается", () => {
    const next = addMark([mk("m1", "W", "a", 100, 200)], walls, "W", 200.005, 300, idGen())
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe("m1")
  })

  it("DM-15: участки 100–200 и 250–300 остаются отдельными, порядок: старый, новый (середина нового 275 правее середины стены — привязка b: 200…250)", () => {
    const next = addMark([mk("m1", "W", "a", 100, 200)], walls, "W", 250, 300, idGen())
    expect(next).toEqual([mk("m1", "W", "a", 100, 200), mk("n1", "W", "b", 200, 250)])
  })

  it("DM-15: зазор 0,02 см (больше допуска) не сливается", () => {
    const next = addMark([mk("m1", "W", "a", 100, 200)], walls, "W", 200.02, 300, idGen())
    expect(next).toHaveLength(2)
  })

  it("DM-16: вся стена поглощает участки 100–200 и 250–300 — остаётся одна пометка 0–500, идентификатор первой", () => {
    const list = [mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 250, 300)]
    expect(addMark(list, walls, "W", 0, 500, idGen())).toEqual([mk("m1", "W", "a", 0, 500)])
  })

  it("DM-16: новый участок, соединяющий два существующих, сливает все три", () => {
    const list = [mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 250, 300)]
    expect(addMark(list, walls, "W", 190, 260, idGen())).toEqual([mk("m1", "W", "a", 100, 300)])
  })

  it("DM-16: пометка b-привязки учитывается в слиянии (span от конца a)", () => {
    // b 50…140 = участок 360–450 от a; новый 400–480 пересекается
    const next = addMark([mk("m1", "W", "b", 50, 140)], walls, "W", 400, 480, idGen())
    expect(next).toEqual([mk("m1", "W", "b", 20, 140)])
  })

  it("DM-22: идемпотентность — участок уже целиком внутри существующей пометки не меняет список", () => {
    const list = [mk("m1", "W", "a", 100, 300)]
    expect(addMark(list, walls, "W", 150, 200, idGen())).toBe(list)
    expect(addMark(list, walls, "W", 100, 300, idGen())).toBe(list)
  })

  it("DM-23: пометки другой стены не сливаются с пересекающимися числами", () => {
    const two = [W(), wall(0, 100, 500, 100, "V")]
    const list = [mk("v1", "V", "a", 100, 200)]
    const next = addMark(list, two, "W", 150, 300, idGen())
    expect(next).toEqual([mk("v1", "V", "a", 100, 200), mk("n1", "W", "a", 150, 300)])
  })

  it("DM-23: слияние учитывает только свою стену при нескольких пометках в списке", () => {
    const two = [W(), wall(0, 100, 500, 100, "V")]
    const list = [mk("v1", "V", "a", 100, 200), mk("w1", "W", "a", 100, 200)]
    const next = addMark(list, two, "W", 180, 260, idGen())
    expect(next).toEqual([mk("v1", "V", "a", 100, 200), mk("w1", "W", "a", 100, 260)])
  })
})

describe("инварианты addMark", () => {
  it("DM-05: входные массивы и объекты не мутируются", () => {
    const list = deepFreeze([mk("m1", "W", "a", 100, 200)])
    const frozenWalls = deepFreeze([W()])
    expect(() => addMark(list, frozenWalls, "W", 150, 300, idGen())).not.toThrow()
    expect(() => addMark(list, frozenWalls, "W", 400, 450, idGen())).not.toThrow()
  })

  it("DM-24: после серии пометок участки одной стены не пересекаются и не соприкасаются", () => {
    let list: DemolitionMark[] = []
    const gen = idGen()
    for (const [f, t] of [[10, 60], [50, 120], [200, 260], [255, 300], [400, 450], [440, 500], [130, 190]] as const) {
      list = addMark(list, walls, "W", f, t, gen)
    }
    const spans = list.map((m) => span(m, W())).sort((x, y) => x[0] - y[0])
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0] - spans[i - 1]![1]).toBeGreaterThan(0.01)
    for (const m of list) {
      expect(m.fromCm).toBeGreaterThanOrEqual(0)
      expect(m.toCm).toBeGreaterThan(m.fromCm)
    }
  })

  it("DM-24: нормализованный якорь — ближний к середине участка конец", () => {
    const list = addMark([], walls, "W", 300, 450, idGen())
    expect(list[0]?.anchor).toBe("b")
    const left = addMark([], walls, "W", 20, 100, idGen())
    expect(left[0]?.anchor).toBe("a")
  })
})

describe("removeMark", () => {
  it("DM-25: удаляет пометку по идентификатору, остальные в прежнем порядке", () => {
    const list = [mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 250, 300), mk("m3", "W", "a", 400, 450)]
    expect(removeMark(list, "m2")).toEqual([list[0], list[2]])
  })

  it("DM-25: неизвестный идентификатор — тот же массив", () => {
    const list = [mk("m1", "W", "a", 100, 200)]
    expect(removeMark(list, "zzz")).toBe(list)
  })

  it("DM-25: входной массив не мутируется", () => {
    const list = deepFreeze([mk("m1", "W", "a", 100, 200)])
    expect(() => removeMark(list, "m1")).not.toThrow()
  })
})

describe("mergeAll", () => {
  it("DM-28: сливает пересекающиеся пометки одной стены, прочие не трогает", () => {
    const list = [mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 150, 300), mk("m3", "W", "a", 400, 450)]
    expect(mergeAll(list, walls)).toEqual([mk("m1", "W", "a", 100, 300), mk("m3", "W", "a", 400, 450)])
  })

  it("DM-28: соприкасающиеся сливаются", () => {
    expect(mergeAll([mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 200, 300)], walls)).toEqual([mk("m1", "W", "a", 100, 300)])
  })

  it("DM-28: пометки на железобетоне сливаются так же (они хранятся)", () => {
    const list = [mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 150, 300)]
    expect(mergeAll(list, [W("reinforced")])).toEqual([mk("m1", "W", "a", 100, 300)])
  })

  it("DM-28: пометки на отсутствующие стены остаются без изменений и в прежнем порядке", () => {
    const list = [mk("x1", "gone", "a", 10, 50), mk("m1", "W", "a", 100, 200), mk("x2", "gone", "a", 40, 80)]
    expect(mergeAll(list, walls)).toEqual(list)
  })

  it("DM-28: пометка на отсутствующую стену в начале списка не прерывает слияние остальных", () => {
    const list = [mk("x", "gone", "a", 10, 50), mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 150, 300)]
    expect(mergeAll(list, walls)).toEqual([mk("x", "gone", "a", 10, 50), mk("m1", "W", "a", 100, 300)])
  })

  it("DM-28: без пересечений — тот же массив", () => {
    const list = [mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 300, 350)]
    expect(mergeAll(list, walls)).toBe(list)
  })

  it("DM-28: вход не мутируется", () => {
    const list = deepFreeze([mk("m1", "W", "a", 100, 200), mk("m2", "W", "a", 150, 300)])
    expect(() => mergeAll(list, deepFreeze([W()]))).not.toThrow()
  })
})

describe("effectiveMarks", () => {
  it("DM-29: участок a-привязки — from/to от конца a, ссылка на пометку и стену", () => {
    const m = mk("m", "W", "a", 100, 190)
    const [r] = effectiveMarks([m], walls)
    expect(r?.mark).toBe(m)
    expect(r?.wall).toBe(walls[0])
    expect([r?.from, r?.to]).toEqual([100, 190])
  })

  it("DM-29: участок b-привязки пересчитан от конца a", () => {
    const [r] = effectiveMarks([mk("m", "W", "b", 50, 140)], walls)
    expect([r?.from, r?.to]).toEqual([360, 450])
  })

  it("DM-07: пометка на железобетонной стене не действует, список не меняется", () => {
    const list = [mk("m", "W", "a", 100, 200)]
    const before = structuredClone(list)
    expect(effectiveMarks(list, [W("reinforced")])).toEqual([])
    expect(list).toEqual(before)
  })

  it("DM-08: после возврата материала пометка снова действует с прежним участком", () => {
    const list = [mk("m", "W", "a", 100, 200)]
    expect(effectiveMarks(list, [W("reinforced")])).toEqual([])
    const [r] = effectiveMarks(list, [W("brick")])
    expect([r?.from, r?.to]).toEqual([100, 200])
  })

  it("DM-09: стены нет — пометка не действует; стена вернулась — действует", () => {
    const list = [mk("m", "W", "a", 100, 200)]
    expect(effectiveMarks(list, [])).toEqual([])
    expect(effectiveMarks(list, walls)).toHaveLength(1)
  })

  it("DM-10: стена укорочена до 300 — участок 100–450 действует как 100–300", () => {
    const short = wall(0, 0, 300, 0, "W")
    const [r] = effectiveMarks([mk("m", "W", "a", 100, 450)], [short])
    expect([r?.from, r?.to]).toEqual([100, 300])
  })

  it("DM-10: привязка b при укороченной стене: участок 100–450 от конца b на стене 300 действует как 0–200 (от конца a)", () => {
    // от b: [len − to, len − from] = [300 − 450, 300 − 100] = [−150, 200] → обрезка по началу
    const [r] = effectiveMarks([mk("m", "W", "b", 100, 450)], [wall(0, 0, 300, 0, "W")])
    expect([r?.from, r?.to]).toEqual([0, 200])
  })

  it("DM-11: участок целиком за концом укороченной стены не действует", () => {
    expect(effectiveMarks([mk("m", "W", "a", 400, 450)], [wall(0, 0, 300, 0, "W")])).toEqual([])
  })

  it("DM-12: после обрезки ширина 0,005 см не действует, 0,02 см действует", () => {
    const short = wall(0, 0, 300, 0, "W")
    expect(effectiveMarks([mk("m", "W", "a", 299.995, 450)], [short])).toEqual([])
    expect(effectiveMarks([mk("m", "W", "a", 299.98, 450)], [short])).toHaveLength(1)
  })

  it("DM-12: участок нулевой ширины в хранилище не действует", () => {
    expect(effectiveMarks([mk("m", "W", "a", 100, 100)], walls)).toEqual([])
  })

  it("DM-29: порядок списка сохраняется, у стены несколько пометок", () => {
    const v = wall(0, 100, 400, 100, "V")
    const list = [mk("m1", "V", "a", 10, 60), mk("m2", "W", "a", 100, 200), mk("m3", "W", "a", 300, 350)]
    expect(effectiveMarks(list, [W(), v]).map((r) => r.mark.id)).toEqual(["m1", "m2", "m3"])
  })

  it("DM-29: недействующие пометки пропускаются, действующие остаются", () => {
    const list = [mk("m1", "gone", "a", 10, 60), mk("m2", "W", "a", 100, 200)]
    expect(effectiveMarks(list, walls).map((r) => r.mark.id)).toEqual(["m2"])
  })

  it("DM-17: пустые списки", () => {
    expect(effectiveMarks([], [])).toEqual([])
    expect(effectiveMarks([], walls)).toEqual([])
  })

  it("DM-05: вход не мутируется", () => {
    expect(() => effectiveMarks(deepFreeze([mk("m", "W", "a", 100, 200)]), deepFreeze([W()]))).not.toThrow()
  })

  it("DM-30: инвариант — эквивалентные записи a и b дают один и тот же участок", () => {
    const [ra] = effectiveMarks([mk("m", "W", "a", 360, 450)], walls)
    const [rb] = effectiveMarks([mk("m", "W", "b", 50, 140)], walls)
    expect([ra?.from, ra?.to]).toEqual([rb?.from, rb?.to])
  })
})

describe("markAt", () => {
  const resolved = effectiveMarks([mk("m1", "W", "a", 100, 190)], walls)

  it("DM-31: точка в области сноса возвращает пометку", () => {
    expect(markAt({ x: 150, y: 0 }, resolved, walls)?.mark.id).toBe("m1")
    expect(markAt({ x: 150, y: 9 }, resolved, walls)?.mark.id).toBe("m1")
  })

  it("DM-31: точка на стене вне участка — нет пометки", () => {
    expect(markAt({ x: 50, y: 0 }, resolved, walls)).toBeNull()
    expect(markAt({ x: 250, y: 0 }, resolved, walls)).toBeNull()
  })

  it("DM-31: точка вне стены — нет пометки", () => {
    expect(markAt({ x: 150, y: 40 }, resolved, walls)).toBeNull()
  })

  it("DM-31: пустой список — нет пометки", () => {
    expect(markAt({ x: 150, y: 0 }, [], walls)).toBeNull()
  })
})
