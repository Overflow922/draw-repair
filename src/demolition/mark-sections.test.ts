import { describe, expect, it } from "vitest"
import { door } from "../doorway/doorway.test-utils"
import type { Wall, WallElement } from "../types"
import { deepFreeze, door_, mk, wall, W, window_ } from "./demolition.test-utils"
import { effectiveMarks } from "./mark-model"
import { cleanRanges, windowBlocks } from "./mark-sections"

// change demolition-window-sections: окно блокирует снос своего участка стены, а не всей стены (spec demolition-plan
// «Что сносится и что нет»; design D1–D2). Оракулы — из геометрии разрывов граней: перегородка P (300,10)–(300,400)
// толщиной 10 примыкает к грани y = 10 стены W (0,0)–(500,0) и разрывает её на [295, 305].

const room = (): Wall[] => [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
const tee = (): Wall[] => [W(), wall(300, 10, 300, 400, "P", "brick", 10)]
const roomTee = (): Wall[] => [...room(), wall(300, 10, 300, 400, "P", "brick", 10)]
const left = window_("W", "a", 100, 90, "wl") // откосы 100–190
const right = window_("W", "a", 350, 90, "wr") // откосы 350–440

const blocks = (walls: Wall[], elements: WallElement[] = [left]) => windowBlocks(walls[0] as Wall, walls, elements)
const clean = (walls: Wall[], elements: WallElement[] = [left]) => cleanRanges(walls[0] as Wall, walls, elements)

describe("участки окон и чистые участки", () => {
  it("SW-01: без элементов чистый участок — вся стена, участков окон нет", () => {
    expect(windowBlocks(W(), [W()], [])).toEqual([])
    expect(cleanRanges(W(), [W()], [])).toEqual([[0, 500]])
  })

  it("SW-02: свободная стена с окном: участок окна — вся стена, чистых участков нет", () => {
    expect(blocks([W()])).toEqual([[0, 500]])
    expect(clean([W()])).toEqual([])
  })

  it("SW-03: перегородка делит стену: окно слева — участок окна [0, 295], чистый [295, 500]", () => {
    expect(blocks(tee())).toEqual([[0, 295]])
    expect(clean(tee())).toEqual([[295, 500]])
  })

  it("SW-03: окно справа от перегородки — участок окна [305, 500], чистый [0, 305] (разрыв относится к чистому участку)", () => {
    expect(blocks(tee(), [right])).toEqual([[305, 500]])
    expect(clean(tee(), [right])).toEqual([[0, 305]])
  })

  it("SW-03: комната с замкнутыми углами и перегородкой: те же участки (углы и торцы разрывами не считаются)", () => {
    expect(blocks(roomTee())).toEqual([[0, 295]])
    expect(clean(roomTee())).toEqual([[295, 500]])
    expect(clean(roomTee(), [right])).toEqual([[0, 305]])
  })

  it("SW-03: комната без перегородки: окно блокирует стену целиком", () => {
    expect(blocks(room())).toEqual([[0, 500]])
    expect(clean(room())).toEqual([])
  })

  it("SW-04: перегородка только с наружной грани тоже разрывает стену: участки те же", () => {
    const outer = [W(), wall(300, -10, 300, -300, "Q", "brick", 10)]
    expect(blocks(outer)).toEqual([[0, 295]])
    expect(clean(outer)).toEqual([[295, 500]])
  })

  it("SW-04: окна по обе стороны перегородки: блокированы оба участка, чистым остаётся разрыв [295, 305]", () => {
    expect(blocks(tee(), [left, right])).toEqual([[0, 295], [305, 500]])
    expect(clean(tee(), [left, right])).toEqual([[295, 305]])
  })

  it("SW-03: две перегородки (200 и 400) и окно между ними (250–340): ближайшие разрывы по обе стороны — блок [205, 395], чистые [0, 205] и [395, 500]", () => {
    const two = [W(), wall(200, 10, 200, 400, "P1", "brick", 10), wall(400, 10, 400, 400, "P2", "brick", 10)]
    const between = window_("W", "a", 250, 90, "wm") // откосы 250–340
    expect(windowBlocks(W(), two, [between])).toEqual([[205, 395]])
    expect(cleanRanges(W(), two, [between])).toEqual([[0, 205], [395, 500]])
  })

  it("SW-03: окно левее обеих перегородок блокирует только первый участок: [0, 195]", () => {
    const two = [W(), wall(200, 10, 200, 400, "P1", "brick", 10), wall(400, 10, 400, 400, "P2", "brick", 10)]
    expect(windowBlocks(W(), two, [window_("W", "a", 50, 60, "w0")])).toEqual([[0, 195]])
  })

  it("SW-04: два окна одного участка объединяются: блокирован один участок", () => {
    const second = window_("W", "a", 220, 60, "w2") // откосы 220–280
    expect(blocks(tee(), [left, second])).toEqual([[0, 295]])
  })

  it("SW-04: окно с привязкой к концу b: откосы считаются от конца b — окно 350–440 при привязке b, 60 см", () => {
    const b = window_("W", "b", 60, 90, "wb") // откосы 350–440
    expect(blocks(tee(), [b])).toEqual([[305, 500]])
  })

  it("SW-05: проёмы и двери участков не блокируют", () => {
    const elements = [door("W", "a", 100, 90, 210, "p"), door_("W", "b", 100, 90, "dr")]
    expect(blocks(tee(), elements)).toEqual([])
    expect(clean(tee(), elements)).toEqual([[0, 500]])
  })

  it("SW-05: проём вместе с окном: блокирует только окно", () => {
    const elements = [door("W", "a", 350, 90, 210, "p"), left]
    expect(blocks(tee(), elements)).toEqual([[0, 295]])
  })

  it("SW-06: окно другой стены стену не блокирует", () => {
    expect(blocks(tee(), [window_("P", "a", 100, 90, "wp")])).toEqual([])
    expect(clean(tee(), [window_("P", "a", 100, 90, "wp")])).toEqual([[0, 500]])
  })

  it("SW-07: железобетон и вырожденная стена — чистых участков нет, с окном и без", () => {
    expect(cleanRanges(W("reinforced"), [W("reinforced")], [])).toEqual([])
    expect(cleanRanges(W("reinforced"), [W("reinforced")], [left])).toEqual([])
    const z = wall(10, 10, 10, 10, "Z")
    expect(cleanRanges(z, [z], [])).toEqual([])
  })

  it("SW-08: входы не мутируются", () => {
    const walls = deepFreeze(tee())
    expect(() => windowBlocks(walls[0] as Wall, walls, deepFreeze([left]))).not.toThrow()
    expect(() => cleanRanges(walls[0] as Wall, walls, deepFreeze([left]))).not.toThrow()
  })

  it("SW-08: пустой список стен не ломает: чистый участок — вся стена", () => {
    expect(cleanRanges(W(), [W()], [])).toEqual([[0, 500]])
  })
})

describe("действующие пометки и участки окон", () => {
  const walls = tee()
  const shown = (marks: ReturnType<typeof mk>[], elements: WallElement[] = [left]) => effectiveMarks(marks, walls, elements).map((r) => r.mark.id)

  it("SW-10: пометка на чистом участке действует: 300–450 и 295–500", () => {
    expect(shown([mk("a", "W", "a", 300, 450)])).toEqual(["a"])
    expect(shown([mk("a", "W", "a", 295, 500)])).toEqual(["a"])
  })

  it("SW-12: пометка, пересекающая участок окна, не действует: 200–400, 0–100 и 290–300", () => {
    expect(shown([mk("a", "W", "a", 200, 400)])).toEqual([])
    expect(shown([mk("a", "W", "a", 0, 100)])).toEqual([])
    expect(shown([mk("a", "W", "a", 290, 300)])).toEqual([])
  })

  it("SW-13: пометка, лишь касающаяся участка окна (в пределах 0,01 см), действует: 295–400 и 294,995–400", () => {
    expect(shown([mk("a", "W", "a", 295, 400)])).toEqual(["a"])
    expect(shown([mk("a", "W", "a", 294.995, 400)])).toEqual(["a"])
  })

  it("SW-13: пересечение больше 0,01 см скрывает: 294,5–400", () => {
    expect(shown([mk("a", "W", "a", 294.5, 400)])).toEqual([])
  })

  it("SW-11: окно удалено — прежняя пометка 200–400 снова действует", () => {
    const m = mk("a", "W", "a", 200, 400)
    expect(effectiveMarks([m], walls, [left])).toEqual([])
    expect(effectiveMarks([m], walls, [])).toHaveLength(1)
  })

  it("SW-10: из двух пометок действует только та, что вне участка окна", () => {
    expect(shown([mk("a", "W", "a", 50, 150), mk("b", "W", "a", 320, 420)])).toEqual(["b"])
  })

  it("SW-14: пометка на железобетонной стене не действует при любых элементах", () => {
    expect(effectiveMarks([mk("a", "W", "a", 300, 450)], [W("reinforced")], [])).toEqual([])
  })

  it("SW-14: проём и дверь пометку не скрывают", () => {
    const wide = mk("a", "W", "a", 100, 450)
    expect(effectiveMarks([wide], walls, [door("W", "a", 200, 90, 210, "p"), door_("W", "b", 100, 90, "dr")])).toHaveLength(1)
  })

  it("SW-14: пометка с привязкой b проверяется по оси от a: 0–205 от конца b даёт 295–500 — действует", () => {
    expect(shown([mk("a", "W", "b", 0, 205)])).toEqual(["a"])
  })
})
