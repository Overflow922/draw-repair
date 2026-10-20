import { describe, expect, it } from "vitest"
import { markDimensions } from "../demolition/mark-dimensions"
import { door } from "../doorway/doorway.test-utils"
import type { Point } from "../types"
import { px, setup } from "./plaster-tool.test-utils"
import type { Setup } from "./plaster-tool.test-utils"
import { roughScene } from "./rough-scene"
import { demolitionMark, drawing, plaster, rectWalls, wall } from "./rough.test-utils"

// change plaster-partial-drag: протяжка ставит частичную пометку на нажатую стену и входит в режим правки
// (spec rough-works-plan «Постановка частичной штукатурки протяжкой», «Выделение штукатурки и правка на месте»).
// Свободная стена W — (0,0)-(500,0), 20 см; грань +1 — сторона y > 0. Экранный сдвиг 100 px — дальше мёртвой зоны 4 px.

const at = (x: number, y = 5): Point => ({ x, y })

const press = (s: Setup, from: Point): void => s.tool.down(px(0), from)

// протяжка: нажатие в мировой точке from, движение и отпускание в to
const drag = (s: Setup, from: Point, to: Point): string | null => {
  press(s, from)
  s.tool.move(to, px(100))
  return s.tool.up(to, px(100))
}

describe("постановка протяжкой", () => {
  it("PD-01: протяжка 100–300 ставит пометку на грани +1 с толщиной из панели одним шагом; пометка выделена", () => {
    const s = setup(drawing(), 30)
    expect(drag(s, at(100), at(300))).toBe("n1")
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 300, 30)])
    expect(s.log.records).toBe(1)
    expect(s.log.changes).toBe(1)
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("PD-02: протяжка в обратную сторону даёт тот же участок", () => {
    const s = setup(drawing())
    drag(s, at(300), at(100))
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 300, 20)])
  })

  it("PD-03: грань определяется стороной нажатия: со стороны y < 0 — грань −1; уход отпусканием на другую сторону грань не меняет", () => {
    const s = setup(drawing())
    drag(s, at(100, -5), at(300, -5))
    expect(s.marks()[0]?.face).toBe(-1)
    const t = setup(drawing())
    drag(t, at(100, 5), at(300, -5))
    expect(t.marks()[0]?.face).toBe(1)
  })

  it("PD-04: правая граница у конца стены привязывается к нему и доходит до края грани; за концом стены обрезается", () => {
    const s = setup(drawing())
    drag(s, at(100), at(497))
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "b", 0, 400, 20)]) // участок 100–500, привязка — к ближнему к середине концу b
    const t = setup(drawing())
    drag(t, at(100), at(600))
    expect(t.marks()).toEqual([plaster("n1", "W", 1, "b", 0, 400, 20)])
  })

  it("PD-05: граница привязывается к откосу проёма; проём участок не прерывает", () => {
    const withOpening = { ...drawing(), doorways: [door("W", "a", 200, 90)] } // откосы в 200 и 290
    const s = setup(withOpening)
    drag(s, at(100), at(198))
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 200, 20)])
    const t = setup(withOpening)
    drag(t, at(100), at(400))
    expect(t.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 400, 20)])
  })

  it("PD-06: без узла в радиусе граница округляется до целого сантиметра", () => {
    const s = setup(drawing())
    drag(s, at(100.4), at(300.6))
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 301, 20)])
  })

  it("PD-07: протяжка не выходит за нажатую стену: на коллинеарную W2 пометка не ставится", () => {
    const s = setup(drawing({ walls: [wall("W1", 0, 0, 300, 0), wall("W2", 300, 0, 600, 0)] }))
    drag(s, at(200), at(450))
    expect(s.marks()).toEqual([plaster("n1", "W1", 1, "b", 0, 100, 20)]) // 200–300 на W1
  })

  it("PD-07b: нажатая стена — любая из плоскости: нажатие на W2 ставит пометку только на W2", () => {
    const s = setup(drawing({ walls: [wall("W1", 0, 0, 300, 0), wall("W2", 300, 0, 600, 0)] }))
    drag(s, at(450), at(350))
    expect(s.marks()).toEqual([plaster("n1", "W2", 1, "a", 50, 150, 20)])
  })

  it("PD-08: протяжка обрезается у примыкания: участок заканчивается у грани примыкающей стены", () => {
    const s = setup(drawing({ walls: [wall("W", 0, 0, 500, 0), wall("T", 250, 0, 250, 300)] }))
    drag(s, at(100), at(350))
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 240, 20)])
  })

  it("PD-09: протяжка не заходит на снесённый участок нажатой стены: границы остаются внутри остатка", () => {
    const s = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 0, 200)] }))
    drag(s, at(300), at(450))
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "b", 50, 200, 20)]) // исходная стена: 300–450
    const t = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 0, 200)] }))
    drag(t, at(300), at(120))
    expect(t.marks()).toEqual([plaster("n1", "W", 1, "a", 200, 300, 20)]) // обрезано по краю остатка: 200–300
  })

  it("PD-10: слишком узкая протяжка (меньше 1 см после округления) ничего не создаёт и инструмент не затрагивает", () => {
    const s = setup(drawing())
    expect(drag(s, at(100), at(100.4))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("PD-11: участок, уже целиком лежащий в пометке той же грани, ничего не меняет и не выделяется", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] }), 30)
    expect(drag(s, at(100), at(300))).toBeNull()
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 0, 500, 20)])
    expect(s.log.records).toBe(0)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("PD-12: пересекающаяся пометка сливается, слитая выделяется и берёт толщину из панели; один шаг", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 200, 20)] }), 30)
    expect(drag(s, at(150), at(350))).toBe("p")
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 0, 350, 30)])
    expect(s.tool.selectedId()).toBe("p")
    expect(s.log.records).toBe(1)
  })

  it("PD-13: протяжка противоположной грани не трогает пометку первой", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] }))
    drag(s, at(100, -5), at(300, -5))
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 0, 500, 20), plaster("n1", "W", -1, "a", 100, 300, 20)])
  })

  it("PD-14: нажатие на свободном торце не начинает протяжку", () => {
    const s = setup(drawing())
    s.tool.hover(at(503, 0))
    expect(s.tool.ghost()?.pieces.map((x) => x.face)).toEqual(["end"]) // цель в точке нажатия — торец
    expect(drag(s, at(503, 0), at(503, 100))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("PD-15: нажатие вдали от стен и протяжка без мировой точки ничего не ставят", () => {
    const s = setup(drawing())
    expect(drag(s, at(250, 200), at(300, 200))).toBeNull()
    s.tool.down(px(0))
    s.tool.move(at(300), px(100))
    expect(s.tool.up(at(300), px(100))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("PD-16: торец плоскости в протяжку не входит: ставится только пометка нажатой стены", () => {
    const walls = [wall("H1", 0, 0, 490, 0), wall("H2", 510, 0, 1000, 0), wall("S", 500, -10, 500, 300)]
    const s = setup(drawing({ walls }))
    drag(s, at(200, -13), at(495, -13))
    expect(s.marks().map((m) => m.face)).toEqual([-1])
    expect(s.marks().map((m) => m.wallId)).toEqual(["H1"])
  })

  it("PD-17: многошаговая сборка — стена, достроенная после комнаты, режет протяжку по внутренней грани", () => {
    const room = rectWalls("R", 0, 0, 500, 400)
    const s = setup(drawing({ walls: [...room, wall("T", 250, 0, 250, 400)] }))
    drag(s, at(100, 12), at(400, 12)) // внутренняя грань R1 (y = 10), T примыкает в x = 250 (грань T — 240)
    expect(s.marks()).toEqual([plaster("n1", "R1", 1, "a", 100, 240, 20)])
  })
})

describe("превью, отмена и клик", () => {
  it("PD-20: во время протяжки показывается превью участка нажатой стены; пометки и шага истории нет", () => {
    const s = setup(drawing(), 40)
    press(s, at(100))
    expect(s.tool.dragging()).toBe(false)
    s.tool.move(at(300), px(100))
    expect(s.tool.dragging()).toBe(true)
    const g = s.tool.ghost()
    expect(g?.thicknessMm).toBe(40)
    expect(g?.pieces.map((x) => [x.wall.id, x.face, x.from, x.to])).toEqual([["W~0", 1, 100, 300]])
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("PD-21: превью следует за курсором и привязывается к узлам", () => {
    const s = setup(drawing())
    press(s, at(100))
    s.tool.move(at(497), px(100))
    expect(s.tool.ghost()?.pieces.map((x) => [x.from, x.to])).toEqual([[100, 500]])
  })

  it("PD-22: наведение во время протяжки не подменяет превью целью клика", () => {
    const s = setup(drawing())
    press(s, at(100))
    s.tool.move(at(300), px(100))
    const redraws = s.log.redraws
    s.tool.hover(at(400))
    expect(s.log.redraws).toBe(redraws) // цель клика во время протяжки не пересчитывается и не перерисовывается
    expect(s.tool.ghost()?.pieces.map((x) => [x.from, x.to])).toEqual([[100, 300]])
  })

  it("PD-23: Escape отменяет протяжку: превью нет, пометки нет, шага нет, отпускание ничего не ставит", () => {
    const s = setup(drawing())
    press(s, at(100))
    s.tool.move(at(300), px(100))
    s.tool.cancel()
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.up(at(300), px(100))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("PD-24: после постановки протяжкой превью пропадает", () => {
    const s = setup(drawing())
    drag(s, at(100), at(300))
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.dragging()).toBe(false)
  })

  it("PD-25: нажатие и отпускание в пределах мёртвой зоны с мировой точкой — клик: вся плоскость, пометка не выделена", () => {
    const s = setup(drawing())
    press(s, at(100))
    s.tool.move(at(101), px(3))
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.up(at(101), px(3))).toBe("n1")
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 500, 20)])
    expect(s.tool.selectedId()).toBeNull()
  })

  it("PD-26: сдвиг дальше мёртвой зоны (5 px) — протяжка, а не клик", () => {
    const s = setup(drawing())
    press(s, at(100))
    s.tool.move(at(200), px(5))
    expect(s.tool.dragging()).toBe(true)
  })

  it("PD-27: граница мёртвой зоны: ровно 4 px — ещё клик, чуть дальше — протяжка", () => {
    const s = setup(drawing())
    press(s, at(100))
    s.tool.move(at(200), px(4))
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.up(at(200), px(4))).toBe("n1")
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 500, 20)])
    const t = setup(drawing())
    press(t, at(100))
    t.tool.move(at(200), px(4.01))
    expect(t.tool.dragging()).toBe(true)
  })
})

describe("режим правки после протяжки", () => {
  const placed = () => {
    const s = setup(drawing())
    drag(s, at(100), at(300))
    return s
  }
  // числа цепочки грани +1 выделенной пометки на свободной стене: 100, 200, 200
  const spotAt = (s: Setup, target: "gapA" | "width" | "gapB") => {
    const scene = roughScene(s.drawing())
    const piece = scene.pieces[0]!
    const d = markDimensions(piece, scene.base.walls, "chain", "cm", 2, 14).find((x) => x.side === 1 && x.target === target)!
    return s.tool.numberAt(d.spot.center, "cm", 2, 14, 0)
  }

  it("PD-30: сразу после протяжки правимы числа цепочки «100 | 200 | 200»", () => {
    const s = placed()
    expect(spotAt(s, "gapA")?.text).toBe("100")
    expect(spotAt(s, "width")?.text).toBe("200")
    expect(spotAt(s, "gapB")?.text).toBe("200")
  })

  it("PD-31: правка расстояния до стыка в сторону a (50) — участок 50–250 одним шагом; пометка остаётся выделенной", () => {
    const s = placed()
    expect(s.tool.applyNumber(spotAt(s, "gapA")!, 50)).toBe(true)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 50, 250, 20)])
    expect(s.log.records).toBe(2) // постановка и правка
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("PD-32: Delete удаляет пометку протяжки и снимает выделение; Escape (clearSelection) снимает выделение без удаления", () => {
    const s = placed()
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.tool.selectedId()).toBeNull()
    const t = placed()
    t.tool.clearSelection()
    expect(t.tool.selectedId()).toBeNull()
    expect(t.marks()).toHaveLength(1)
  })

  it("PD-33: клик мимо пометок без инструмента снимает выделение", () => {
    const s = placed()
    expect(s.tool.select(at(450, 11))).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("PD-34: правка толщины в панели меняет пометку протяжки одним шагом", () => {
    const s = placed()
    expect(s.tool.setSelectedThickness(30)).toBe(true)
    expect(s.marks()[0]?.thicknessMm).toBe(30)
    expect(s.log.records).toBe(2)
  })
})
