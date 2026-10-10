import { describe, expect, it } from "vitest"
import { door } from "../doorway/doorway.test-utils"
import { deepFreeze, door_, mk, wall, W, window_ } from "./demolition.test-utils"
import { canDemolish, effectiveMarks } from "./mark-model"

// change demolition-no-window-walls: стена с окном не сносится — внешняя стена здания (spec demolition-plan «Что
// сносится и что нет»; design D1). Проёмы и двери демонтажу не мешают. Стена W — (0,0)-(500,0), кирпич, 20 см.

const win = window_("W", "a", 210, 90, "w1") // откосы 200–290
const m = mk("m", "W", "a", 100, 190)

describe("canDemolish с элементами", () => {
  it("NW-01: свободная стена сносится; с окном на ней — нет", () => {
    expect(canDemolish(W())).toBe(true)
    expect(canDemolish(W(), [])).toBe(true)
    expect(canDemolish(W(), [win])).toBe(false)
  })

  it("NW-04: проём и дверь на стене не мешают: стена сносится", () => {
    expect(canDemolish(W(), [door("W", "a", 100, 90, 210, "p")])).toBe(true)
    expect(canDemolish(W(), [door_("W", "a", 100, 90, "dr")])).toBe(true)
    expect(canDemolish(W(), [door("W", "a", 100, 90, 210, "p"), door_("W", "b", 100, 90, "dr")])).toBe(true)
  })

  it("NW-05: окно другой стены не мешает", () => {
    expect(canDemolish(W(), [window_("V", "a", 210, 90, "w1")])).toBe(true)
  })

  it("NW-01: окно среди других элементов запрещает снос", () => {
    expect(canDemolish(W(), [door("W", "a", 10, 90, 210, "p"), win, door_("W", "b", 10, 90, "dr")])).toBe(false)
  })

  it("NW-06: железобетон не сносится ни с элементами, ни без; вырожденная стена — тоже", () => {
    expect(canDemolish(W("reinforced"))).toBe(false)
    expect(canDemolish(W("reinforced"), [door("W", "a", 100, 90, 210, "p")])).toBe(false)
    expect(canDemolish(wall(10, 10, 10, 10, "Z"), [])).toBe(false)
  })
})

describe("действующие пометки с элементами", () => {
  const walls = [W()]

  it("NW-02: на стене с окном пометка не действует, но входной список не меняется", () => {
    const marks = deepFreeze([m])
    expect(effectiveMarks(marks, walls, [win])).toEqual([])
    expect(marks).toEqual([m])
  })

  it("NW-03: окно удалено — та же пометка действует с прежним участком", () => {
    const hidden = effectiveMarks([m], walls, [win])
    const shown = effectiveMarks([m], walls, [])
    expect(hidden).toEqual([])
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({ from: 100, to: 190 })
    expect(shown).toEqual(effectiveMarks([m], walls))
  })

  it("NW-04: проём и дверь не скрывают пометку: область сноса включает участок элемента", () => {
    const wide = mk("m", "W", "a", 100, 400)
    for (const e of [door("W", "a", 210, 90, 210, "p"), door_("W", "a", 210, 90, "dr")]) {
      const out = effectiveMarks([wide], walls, [e])
      expect(out).toHaveLength(1)
      expect(out[0]).toMatchObject({ from: 100, to: 400 })
    }
  })

  it("NW-05: окно на другой стене: пометка W действует, пометка V (со своим окном) — нет", () => {
    const two = [W(), wall(0, 300, 500, 300, "V")]
    const v = mk("v", "V", "a", 50, 120)
    const out = effectiveMarks([m, v], two, [window_("V", "a", 210, 90, "w1")])
    expect(out.map((r) => r.mark.id)).toEqual(["m"])
  })

  it("NW-06: железобетон без окна и с проёмом — пометка не действует", () => {
    expect(effectiveMarks([m], [W("reinforced")], [])).toEqual([])
    expect(effectiveMarks([m], [W("reinforced")], [door("W", "a", 100, 90, 210, "p")])).toEqual([])
  })

  it("NW-07: окно с неизвестной стеной ничего не скрывает", () => {
    expect(effectiveMarks([m], walls, [window_("nope", "a", 210, 90, "w1")])).toHaveLength(1)
  })

  it("NW-08: несколько пометок одной стены с окном скрыты все; стены без окон — нет", () => {
    const two = [W(), wall(0, 300, 500, 300, "V")]
    const list = [mk("a", "W", "a", 10, 50), mk("b", "W", "a", 100, 190), mk("c", "V", "a", 0, 500)]
    const out = effectiveMarks(list, two, [window_("W", "b", 100, 90, "w1")])
    expect(out.map((r) => r.mark.id)).toEqual(["c"])
  })

  it("NW-08: вход (стены и элементы) не мутируется", () => {
    expect(() => effectiveMarks([m], deepFreeze([W()]), deepFreeze([win]))).not.toThrow()
  })
})
