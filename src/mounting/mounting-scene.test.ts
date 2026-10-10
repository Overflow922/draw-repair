import { describe, expect, it } from "vitest"
import type { Wall } from "../types"
import { W, deepFreeze, dimension, drawing, idsOf, mark, opening, wall } from "./mounting.test-utils"
import { mountingScene } from "./mounting-scene"

// change mounting-plan: сцена плана «Монтаж» — остатки + собственные объекты (spec mounting-plan «Остатки только для
// чтения», «Собственные объекты плана «Монтаж»», «Элементы и размеры на остатках»; design D2, D5).
// Собственная стена N1 — (0,100)-(0,400), N2 — (100,0)-(190,0).

const N1 = wall("N1", 0, 100, 0, 400)
const N2 = wall("N2", 100, 0, 190, 0)

describe("состав сцены", () => {
  it("MP-10: walls — остатки, затем собственные стены; own — ровно собственные стены чертежа", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: [N1, N2], dimensions: [] } }))
    expect(idsOf(s.remnants)).toEqual(["W~0", "W~1900"])
    expect(s.own).toEqual([N1, N2])
    expect(idsOf(s.walls)).toEqual(["W~0", "W~1900", "N1", "N2"])
  })

  it("MP-11: остатки не входят в own, а собственные стены — в remnants", () => {
    const s = mountingScene(drawing({ mounting: { walls: [N1], dimensions: [] } }))
    expect(idsOf(s.own)).toEqual(["N1"])
    expect(idsOf(s.remnants)).toEqual(["W~0"])
    expect(idsOf(s.remnants)).not.toContain("N1")
  })

  it("MP-11: чертёж без поля mounting — собственных объектов нет, остатки показаны", () => {
    const s = mountingScene(drawing())
    expect(s.own).toEqual([])
    expect(s.dimensions).toEqual([])
    expect(s.doorways).toEqual([])
    expect(idsOf(s.walls)).toEqual(["W~0"])
  })

  it("MP-12: сцена не мутирует чертёж (глубокая заморозка) и не меняет стены, размеры, элементы и пометки обмера", () => {
    const d = deepFreeze(
      drawing({
        walls: [W()],
        doorways: [opening("o", "W", "a", 200)],
        dimensions: [dimension(["W", 0], ["W", 2], ["W", 1], ["W", 3])],
        demolition: [mark("m", "W", "a", 100, 190)],
        mounting: { walls: [N1], dimensions: [], doorways: [opening("po", "N1", "a", 10)] },
      }),
    )
    expect(() => mountingScene(d)).not.toThrow()
  })

  it("MP-13: собственные стены не попадают в стены обмера чертежа", () => {
    const d = drawing({ mounting: { walls: [N1], dimensions: [] } })
    mountingScene(d)
    expect(idsOf(d.walls)).toEqual(["W"])
  })

  it("MP-14: размеры обмера в сцену «Монтажа» не попадают", () => {
    const d = drawing({ dimensions: [dimension(["W", 0], ["W", 2], ["W", 1], ["W", 3])] })
    expect(mountingScene(d).dimensions).toEqual([])
  })

  it("MP-15: пометки сноса сами в сцену не попадают как объекты — сцена содержит только стены, элементы и размеры", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)] }))
    expect(Object.keys(s).sort()).toEqual(["dimensions", "doorways", "oldElementIds", "own", "remnants", "walls"])
  })
})

describe("собственные элементы на остатках", () => {
  const withOpening = (el: ReturnType<typeof opening>, marks = [mark("m", "W", "a", 100, 190)]) =>
    mountingScene(drawing({ demolition: marks, mounting: { walls: [], dimensions: [], doorways: [el] } }))

  it("MP-20: проём на остатке 190–500 (привязка a, смещение 200, ширина 90) разрешён на W~1900 со смещением 10", () => {
    const s = withOpening(opening("po", "W", "a", 200))
    expect(s.doorways).toEqual([{ ...opening("po", "W", "a", 200), wallId: "W~1900", offsetCm: 10 }])
  })

  it("MP-20: проём на остатке 0–100 остаётся со смещением от конца a остатка", () => {
    const s = withOpening(opening("po", "W", "a", 10))
    expect(s.doorways).toEqual([{ ...opening("po", "W", "a", 10), wallId: "W~0", offsetCm: 10 }])
  })

  it("MP-21: привязка b — смещение считается от конца b остатка: проём [400,490] при остатке до 500 → смещение 10", () => {
    const s = withOpening(opening("po", "W", "b", 10))
    expect(s.doorways).toEqual([{ ...opening("po", "W", "b", 10), wallId: "W~1900", offsetCm: 10 }])
  })

  it("MP-21: привязка b — остаток заканчивается раньше конца стены: смещение уменьшается на отрезок до конца стены", () => {
    // снос b 0–5: область [495,500], остаток [0,495]; проём [400,490] лежит внутри, смещение 10 − 5 = 5
    const s = withOpening(opening("po", "W", "b", 10), [mark("m", "W", "b", 0, 5)])
    expect(s.doorways).toEqual([{ ...opening("po", "W", "b", 10), wallId: "W~0", offsetCm: 5 }])
  })

  it("MP-21: проём вплотную к границе остатка виден (включительно): остаток 0–100, проём [10,100]", () => {
    expect(withOpening(opening("po", "W", "a", 10)).doorways.map((d) => d.id)).toEqual(["po"])
  })

  it("MP-21: проём вплотную к началу второго остатка виден, смещение 0", () => {
    const s = withOpening(opening("po", "W", "a", 190))
    expect(s.doorways).toEqual([{ ...opening("po", "W", "a", 190), wallId: "W~1900", offsetCm: 0 }])
  })

  it("MP-21: привязка a — остаток начинается не в 0: смещение пересчитывается от начала остатка", () => {
    const s = withOpening(opening("po", "W", "a", 400), [mark("m", "W", "b", 100, 150)])
    expect(s.doorways).toEqual([{ ...opening("po", "W", "a", 400), wallId: "W~4000", offsetCm: 0 }])
  })

  it("MP-21: проём на собственной стене остаётся как есть", () => {
    const el = opening("po", "N1", "a", 10)
    const s = mountingScene(drawing({ mounting: { walls: [N1], dimensions: [], doorways: [el] } }))
    expect(s.doorways).toEqual([el])
  })

  it("MP-21: собственные окно и дверь разрешаются так же, как проём, и сохраняют свои поля", () => {
    const door = { kind: "door" as const, id: "pd", wallId: "W", anchor: "a" as const, offsetCm: 200, widthCm: 90, heightCm: 210, hinge: "b" as const, swing: "right" as const }
    const win = { kind: "window" as const, id: "pw", wallId: "W", anchor: "a" as const, offsetCm: 300, widthCm: 100, heightCm: 120, sillCm: 90 }
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: [], dimensions: [], doorways: [door, win] } }))
    expect(s.doorways).toEqual([
      { ...door, wallId: "W~1900", offsetCm: 10 },
      { ...win, wallId: "W~1900", offsetCm: 110 },
    ])
  })

  it("MP-23: проём, оказавшийся в области сноса, в сцену не попадает", () => {
    // проём [200,290], снос 150–350
    const s = withOpening(opening("po", "W", "a", 200), [mark("m", "W", "a", 150, 350)])
    expect(s.doorways).toEqual([])
  })

  it("MP-23: проём, пересекающий границу остатка (частично в сносе), не попадает в сцену", () => {
    // проём [95,185] при остатке [0,100]
    const s = withOpening(opening("po", "W", "a", 95))
    expect(s.doorways).toEqual([])
  })

  it("MP-23: проём, выступающий за остаток на 5 см, не виден; на 0 см — виден", () => {
    expect(withOpening(opening("po", "W", "a", 15)).doorways).toEqual([])
    expect(withOpening(opening("po", "W", "a", 10)).doorways.map((d) => d.id)).toEqual(["po"])
  })

  it("MP-23: проём, сохранённый в чертеже, возвращается, когда снос снят (пересчёт сцены без пометки)", () => {
    const el = opening("po", "W", "a", 200)
    const hidden = mountingScene(drawing({ demolition: [mark("m", "W", "a", 150, 350)], mounting: { walls: [], dimensions: [], doorways: [el] } }))
    const back = mountingScene(drawing({ demolition: [], mounting: { walls: [], dimensions: [], doorways: [el] } }))
    expect(hidden.doorways).toEqual([])
    expect(back.doorways).toEqual([{ ...el, wallId: "W~0", offsetCm: 200 }])
  })

  it("MP-20: собственный проём на второй стене чертежа разрешается на остаток этой стены", () => {
    const V = wall("V", 0, 100, 500, 100)
    const el = opening("pv", "V", "a", 200)
    const s = mountingScene(drawing({ walls: [W(), V], demolition: [mark("m", "V", "a", 100, 190)], mounting: { walls: [], dimensions: [], doorways: [el] } }))
    expect(s.doorways).toEqual([{ ...el, wallId: "V~1900", offsetCm: 10 }])
  })

  it("MP-23: пометка другой стены не скрывает собственный проём", () => {
    const V = wall("V", 0, 100, 500, 100)
    const el = opening("pw", "W", "a", 200)
    const s = mountingScene(drawing({ walls: [W(), V], demolition: [mark("m", "V", "a", 150, 350)], mounting: { walls: [], dimensions: [], doorways: [el] } }))
    expect(s.doorways).toEqual([{ ...el, wallId: "W~0", offsetCm: 200 }])
  })

  it("MP-23: проём, ссылающийся на отсутствующую стену, в сцену не попадает", () => {
    const s = mountingScene(drawing({ mounting: { walls: [], dimensions: [], doorways: [opening("po", "ghost", "a", 10)] } }))
    expect(s.doorways).toEqual([])
  })
})

describe("собственные размеры", () => {
  const dim = dimension(["W~0", 1], ["N1", 2], ["W~0", 1], ["N1", 3])

  it("MP-22: размер между гранью остатка и гранью собственной стены виден и не меняется", () => {
    const s = mountingScene(drawing({ mounting: { walls: [N1], dimensions: [dim] } }))
    expect(s.dimensions).toEqual([dim])
  })

  it("MP-22: размер между гранями двух собственных стен виден", () => {
    const d2 = dimension(["N1", 0], ["N1", 2], ["N2", 0], ["N2", 3])
    const s = mountingScene(drawing({ mounting: { walls: [N1, N2], dimensions: [d2] } }))
    expect(s.dimensions).toEqual([d2])
  })

  it("MP-24: размер к остатку, которого нет (стена снесена целиком), не виден", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 0, 500)], mounting: { walls: [N1], dimensions: [dim] } }))
    expect(s.dimensions).toEqual([])
  })

  it("MP-24: размер возвращается, когда остаток вернулся", () => {
    const hidden = mountingScene(drawing({ demolition: [mark("m", "W", "a", 0, 500)], mounting: { walls: [N1], dimensions: [dim] } }))
    const back = mountingScene(drawing({ demolition: [], mounting: { walls: [N1], dimensions: [dim] } }))
    expect(hidden.dimensions).toEqual([])
    expect(back.dimensions).toEqual([dim])
  })

  it("MP-24: размер виден, если нужный остаток цел, даже если другой остаток той же стены снесён", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 500)], mounting: { walls: [N1], dimensions: [dim] } }))
    expect(s.dimensions).toEqual([dim])
  })

  it("MP-24: размер к идентификатору остатка, сдвинувшемуся при смене границы сноса, не виден", () => {
    const moved = mountingScene(drawing({ demolition: [mark("m", "W", "a", 0, 50)], mounting: { walls: [N1], dimensions: [dimension(["W~0", 1], ["N1", 2], ["W~0", 1], ["N1", 3])] } }))
    expect(idsOf(moved.remnants)).toEqual(["W~500"])
    expect(moved.dimensions).toEqual([])
  })

  it.each([
    ["from.a", dimension(["gone", 0], ["N1", 2], ["N2", 0], ["N2", 3])],
    ["from.b", dimension(["N1", 0], ["gone", 2], ["N2", 0], ["N2", 3])],
    ["to.a", dimension(["N1", 0], ["N1", 2], ["gone", 0], ["N2", 3])],
    ["to.b", dimension(["N1", 0], ["N1", 2], ["N2", 0], ["gone", 3])],
  ])("MP-24: размер, у которого исчезла привязка %s, не виден; с целыми привязками — виден", (_name, broken) => {
    const ok = dimension(["N1", 0], ["N1", 2], ["N2", 0], ["N2", 3])
    const s = mountingScene(drawing({ mounting: { walls: [N1, N2], dimensions: [broken, ok] } }))
    expect(s.dimensions).toEqual([ok])
  })
})

describe("порядок и независимость сцены", () => {
  it("MP-16: два вызова с равными данными дают равные сцены", () => {
    const d = drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: [N1], dimensions: [] } })
    expect(mountingScene(d)).toEqual(mountingScene(d))
  })

  it("MP-16: стены без пометок других планов не затрагиваются: чужая стена целиком остаток", () => {
    const walls: Wall[] = [W(), wall("V", 0, 100, 500, 100)]
    const s = mountingScene(drawing({ walls, demolition: [mark("m", "W", "a", 0, 500)] }))
    expect(idsOf(s.remnants)).toEqual(["V~0"])
  })
})
