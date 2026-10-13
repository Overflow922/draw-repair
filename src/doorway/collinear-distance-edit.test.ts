import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findRooms } from "../room-area"
import { PX_PER_CM } from "../types"
import type { WallElement } from "../types"
import { createSelectionEditing } from "./doorway-tool"
import { arrowSlide, placeWindow, setDistance, setWidth, slideDoorway } from "./doorway-edit"
import type { ElementEdit } from "./doorway-edit"
import { doorwayHolds, jambsT } from "./doorway-faces"
import { editableNumbers } from "./editable-numbers"
import type { EditableNumber } from "./editable-numbers"
import { LABEL_PX, byId, fakeHost, stubEditorDom } from "./selection-editing.test-utils"
import type { EditorInput } from "./selection-editing.test-utils"
import { win } from "./window.test-utils"
import { WN, distancesFor, elementOf, sceneCK, sceneCKb } from "./collinear-distance.test-utils"

// change fix-opening-distance-collinear: ввод расстояния, ширины и сдвиг ограничены опорной стеной; элемент не
// переходит на соседнюю стену (spec doorway «Расстояния проёма сквозь коллинеарные стены», «Ввод чисел размеров
// проёма»; design D4). Тесты CD-7…CD-10, CD-13, CD-14, CD-19, CD-22…CD-24 test-plan.md.
// Сцена CK: W0 (0,0)-(250,0), W (250,0)-(700,0), L (0,400)-(0,0); окно на W — x 400…520 (t 150…270 от a).

const applied = <E extends WallElement>(r: ElementEdit<E>): E => {
  if (r.kind !== "applied") throw new Error(`rejected: ${r.reason}`)
  return r.doorway
}

const PLUS = 1
const MINUS = -1

describe("ввод расстояния больше возможного", () => {
  it("CD-7: ввод 600 слева — окно вплотную к торцу W, привязка a, смещение 330, число 570 слева, 0 справа", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(setDistance(e, walls, PLUS, "a", 600, [e]))
    expect(next.wallId).toBe("W")
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(330, 6)
    expect(next.widthCm).toBe(120)
    expect(distancesFor(next, walls)[0]).toBeCloseTo(570, 3)
    expect(distancesFor(next, walls)[1]).toBeCloseTo(0, 3)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("CD-8: границы ввода слева: 570 — вплотную к торцу, 569 — зазор 1 см, 571 — как 570", () => {
    const { walls } = sceneCK()
    const e = WN()
    expect(applied(setDistance(e, walls, PLUS, "a", 570, [e])).offsetCm).toBeCloseTo(330, 6)
    expect(applied(setDistance(e, walls, PLUS, "a", 569, [e])).offsetCm).toBeCloseTo(329, 6)
    expect(applied(setDistance(e, walls, PLUS, "a", 571, [e])).offsetCm).toBeCloseTo(330, 6)
  })

  it("CD-8b: та же граница с наружной грани — ввод 590 слева даёт торец (число 590), 591 — то же", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(setDistance(e, walls, MINUS, "a", 591, [e]))
    expect(next.offsetCm).toBeCloseTo(330, 6)
    expect(distancesFor(next, walls)[2]).toBeCloseTo(590, 3)
  })
})

describe("ввод расстояния меньше, чем до начала опорной стены", () => {
  it("CD-9: ввод 100 слева — окно остаётся на W у её начала: откос x = 250, смещение 0, число слева 240 и 260", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(setDistance(e, walls, PLUS, "a", 100, [e]))
    expect(next.wallId).toBe("W")
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(0, 6)
    const host = walls.find((x) => x.id === "W")
    if (!host) throw new Error("нет W")
    expect(jambsT(next, host)[0]).toBeCloseTo(0, 6)
    const [plusA, , minusA] = distancesFor(next, walls)
    expect(plusA).toBeCloseTo(240, 3)
    expect(minusA).toBeCloseTo(260, 3)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("CD-10: границы 239 / 240 / 241 слева: 239 и 240 — у начала W, 241 — смещение 1", () => {
    const { walls } = sceneCK()
    const e = WN()
    expect(applied(setDistance(e, walls, PLUS, "a", 239, [e])).offsetCm).toBeCloseTo(0, 6)
    expect(applied(setDistance(e, walls, PLUS, "a", 240, [e])).offsetCm).toBeCloseTo(0, 6)
    expect(applied(setDistance(e, walls, PLUS, "a", 241, [e])).offsetCm).toBeCloseTo(1, 6)
  })

  it("CD-10b: ввод 0 слева — как у начала W (число 240), смещение не отрицательное", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(setDistance(e, walls, PLUS, "a", 0, [e]))
    expect(next.offsetCm).toBeGreaterThanOrEqual(0)
    expect(next.offsetCm).toBeCloseTo(0, 6)
  })

  it("CD-10c: ввод расстояния справа 0 у торца W — привязка b, смещение 0", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(setDistance(e, walls, PLUS, "b", 0, [e]))
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(0, 6)
    expect(distancesFor(next, walls)[0]).toBeCloseTo(570, 3)
  })
})

describe("сдвиг и ширина у начала опорной стены", () => {
  it("CD-13: перетаскивание далеко влево — окно останавливается у начала W (x = 250), не заходит на W0", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(slideDoorway(e, walls, { x: -300, y: 0 }, [e]))
    expect(next.wallId).toBe("W")
    expect(next.offsetCm).toBeCloseTo(0, 6)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("CD-13b: стрелка влево у начала W — без изменений, запись не создаётся", () => {
    const { walls } = sceneCK()
    const e = win("W", "a", 0, 120, 150, 85, "e0")
    const r = arrowSlide(e, walls, { x: -1, y: 0 }, 10, [e])
    expect(r).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("CD-13c: перетаскивание далеко вправо — окно у торца W, смещение привязки a равно 330", () => {
    const { walls } = sceneCK()
    const e = WN()
    const next = applied(slideDoorway(e, walls, { x: 900, y: 0 }, [e]))
    expect(next.offsetCm).toBeCloseTo(330, 6)
  })

  it("CD-14: ширина 1000 у начала W с привязкой a — 450 (до торца W), откос привязки неподвижен", () => {
    const { walls } = sceneCK()
    const e = win("W", "a", 0, 120, 150, 85, "e0")
    const next = applied(setWidth(e, walls, 1000, [e]))
    expect(next.offsetCm).toBeCloseTo(0, 6)
    expect(next.widthCm).toBeCloseTo(450, 6)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("CD-14b: ширина 1000 у торца W с привязкой b — 450 (до начала W), смещение 0", () => {
    const { walls } = sceneCK()
    const e = win("W", "b", 0, 120, 150, 85, "e0")
    const next = applied(setWidth(e, walls, 1000, [e]))
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(0, 6)
    expect(next.widthCm).toBeCloseTo(450, 6)
  })
})

describe("призрак установки на опорной стене", () => {
  it("CD-25: курсор над W0 левее W — призрак окна на W встаёт у её начала (смещение 0, привязка a), не заходит на W0", () => {
    const { walls, W } = sceneCK()
    const g = placeWindow(W, walls, { x: 100, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.wallId).toBe("W")
    expect(g.anchor).toBe("a")
    expect(g.offsetCm).toBeCloseTo(0, 6)
    expect(doorwayHolds(g, walls, [g])).toBe(true)
  })

  it("CD-25b: курсор далеко правее торца W — призрак у торца (привязка b, смещение 0)", () => {
    const { walls, W } = sceneCK()
    const g = placeWindow(W, walls, { x: 2000, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.anchor).toBe("b")
    expect(g.offsetCm).toBeCloseTo(0, 6)
  })
})

// CKb: опорная W (0,0)-(450,0), продолжение W0 (450,0)-(700,0), угол W0/R замкнут; свободный конец W — x = 0
describe("продолжение у конца b опорной стены", () => {
  const mirror = (): { walls: ReturnType<typeof sceneCKb>["walls"]; host: ReturnType<typeof sceneCKb>["W"] } => {
    const { walls, W } = sceneCKb()
    return { walls, host: W }
  }
  const winA = (offset: number): WallElement => win("W", "a", offset, 120, 150, 85, "e0")

  it("CD-27: ввод расстояния слева 1000 — окно прижато к концу W (x = 450), смещение 330, расстояние справа 240 и 260", () => {
    const { walls, host } = mirror()
    const e = winA(150)
    const next = applied(setDistance(e, walls, PLUS, "a", 1000, [e]))
    expect(next.wallId).toBe("W")
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(330, 6)
    expect(jambsT(next, host)[1]).toBeCloseTo(450, 6)
    const [, plusB, , minusB] = distancesFor(next, walls)
    expect(plusB).toBeCloseTo(240, 3)
    expect(minusB).toBeCloseTo(260, 3)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("CD-27b: ввод расстояния справа 100 (меньше, чем до конца W) — окно прижато к концу W, привязка b, смещение 0, число справа 240", () => {
    const { walls } = mirror()
    const e = winA(150)
    const next = applied(setDistance(e, walls, PLUS, "b", 100, [e]))
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(0, 6)
    expect(next.wallId).toBe("W")
    expect(distancesFor(next, walls)[1]).toBeCloseTo(240, 3)
  })

  it("CD-27c: границы справа: 240 — у конца W, 241 — смещение 1 привязки b, 239 — как 240", () => {
    const { walls } = mirror()
    const e = winA(150)
    expect(applied(setDistance(e, walls, PLUS, "b", 239, [e])).offsetCm).toBeCloseTo(0, 6)
    expect(applied(setDistance(e, walls, PLUS, "b", 241, [e])).offsetCm).toBeCloseTo(1, 6)
  })

  it("CD-28: перетаскивание далеко вправо — окно останавливается у конца W (x = 450), не заходит на W0", () => {
    const { walls, host } = mirror()
    const e = winA(150)
    const next = applied(slideDoorway(e, walls, { x: 900, y: 0 }, [e]))
    expect(jambsT(next, host)[1]).toBeCloseTo(450, 6)
    expect(next.wallId).toBe("W")
  })

  it("CD-28b: стрелка вправо у конца W — без изменений, запись не создаётся", () => {
    const { walls } = mirror()
    const e = winA(330)
    expect(arrowSlide(e, walls, { x: 1, y: 0 }, 10, [e])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("CD-29: ширина 1000 от откоса привязки a (x = 150) — 300 (до конца W), не заходит на W0", () => {
    const { walls, host } = mirror()
    const e = winA(150)
    const next = applied(setWidth(e, walls, 1000, [e]))
    expect(next.widthCm).toBeCloseTo(300, 6)
    expect(jambsT(next, host)[1]).toBeCloseTo(450, 6)
  })

  it("CD-29b: окно у конца W (x 330…450) — рост ширины не меняет окно (нет места)", () => {
    const { walls } = mirror()
    const e = winA(330)
    expect(setWidth(e, walls, 1000, [e])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("CD-30: призрак окна с курсором над W0 — на W у её конца (привязка b, смещение 0)", () => {
    const { walls, W } = sceneCKb()
    const g = placeWindow(W, walls, { x: 600, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.wallId).toBe("W")
    expect(g.anchor).toBe("b")
    expect(g.offsetCm).toBeCloseTo(0, 6)
    expect(doorwayHolds(g, walls, [g])).toBe(true)
  })

  it.each(["doorway", "door", "window"] as const)("CD-31: %s — ни одно значение не выводит элемент за опорную стену W (0…450)", (kind) => {
    const { walls, host } = mirror()
    const base = elementOf(kind)
    const e: WallElement = { ...base, wallId: "W", anchor: "a", offsetCm: 150 }
    for (const side of [PLUS, MINUS] as const)
      for (const toward of ["a", "b"] as const)
        for (const v of [-1000, 0, 1, 100, 239, 240, 241, 390, 570, 1000, 5000]) {
          const r = setDistance(e, walls, side, toward, v, [e])
          if (r.kind !== "applied") continue
          const [j1, j2] = jambsT(r.doorway, host)
          const tag = `${kind} side=${side} toward=${toward} v=${v}`
          expect(r.doorway.wallId, tag).toBe("W")
          expect(j1, tag).toBeGreaterThanOrEqual(-1e-9)
          expect(j2, tag).toBeLessThanOrEqual(450 + 1e-9)
          expect(doorwayHolds(r.doorway, walls, [r.doorway]), tag).toBe(true)
        }
    for (const v of [1, 100, 300, 1000, 5000]) {
      const r = setWidth(e, walls, v, [e])
      if (r.kind !== "applied") continue
      const [j1, j2] = jambsT(r.doorway, host)
      expect(j1, `width ${v}`).toBeGreaterThanOrEqual(-1e-9)
      expect(j2, `width ${v}`).toBeLessThanOrEqual(450 + 1e-9)
    }
  })
})

describe("инварианты правок в CK", () => {
  const VALUES = [-1000, -1, 0, 1, 50, 100, 239, 240, 241, 390, 570, 571, 1000, 5000]

  it.each(["doorway", "door", "window"] as const)("CD-22: %s — ни одно значение не выводит элемент за опорную стену, wallId и ширина сохраняются", (kind) => {
    const { walls } = sceneCK()
    const host = walls.find((x) => x.id === "W")
    if (!host) throw new Error("нет W")
    const e = elementOf(kind)
    for (const side of [PLUS, MINUS] as const)
      for (const toward of ["a", "b"] as const)
        for (const v of VALUES) {
          const r = setDistance(e, walls, side, toward, v, [e])
          if (r.kind !== "applied") continue
          const [j1, j2] = jambsT(r.doorway, host)
          const tag = `${kind} side=${side} toward=${toward} v=${v}`
          expect(r.doorway.wallId, tag).toBe("W")
          expect(r.doorway.offsetCm, tag).toBeGreaterThanOrEqual(-1e-9)
          expect(j1, tag).toBeGreaterThanOrEqual(-1e-9)
          expect(j2, tag).toBeLessThanOrEqual(450 + 1e-9)
          expect(r.doorway.widthCm, tag).toBeCloseTo(120, 6)
          expect(doorwayHolds(r.doorway, walls, [r.doorway]), tag).toBe(true)
        }
  })

  it("CD-22b: ширина любого значения не выводит элемент за опорную стену", () => {
    const { walls } = sceneCK()
    const host = walls.find((x) => x.id === "W")
    if (!host) throw new Error("нет W")
    for (const anchor of ["a", "b"] as const)
      for (const v of VALUES) {
        const e = win("W", anchor, 100, 120, 150, 85, "e0")
        const r = setWidth(e, walls, v, [e])
        if (r.kind !== "applied") continue
        const [j1, j2] = jambsT(r.doorway, host)
        expect(j1, `${anchor} ${v}`).toBeGreaterThanOrEqual(-1e-9)
        expect(j2, `${anchor} ${v}`).toBeLessThanOrEqual(450 + 1e-9)
        expect(doorwayHolds(r.doorway, walls, [r.doorway]), `${anchor} ${v}`).toBe(true)
      }
  })
})

describe("без изменений и неверный ввод", () => {
  it("CD-23: ввод текущего расстояния слева (390) — без изменений; повторный ввод 570 после прижатия — без изменений", () => {
    const { walls } = sceneCK()
    const e = WN()
    expect(setDistance(e, walls, PLUS, "a", 390, [e])).toEqual({ kind: "rejected", reason: "no-change" })
    const pressed = applied(setDistance(e, walls, PLUS, "a", 600, [e]))
    expect(setDistance(pressed, walls, PLUS, "a", 570, [pressed])).toEqual({ kind: "rejected", reason: "no-change" })
    expect(setDistance(pressed, walls, PLUS, "a", 700, [pressed])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("CD-24: отрицательное расстояние и не число не применяются", () => {
    const { walls } = sceneCK()
    const e = WN()
    expect(setDistance(e, walls, PLUS, "a", -5, [e])).toEqual({ kind: "rejected", reason: "invalid" })
    expect(setDistance(e, walls, PLUS, "a", Number.NaN, [e])).toEqual({ kind: "rejected", reason: "invalid" })
  })
})

describe("повторные правки через адаптер выделения", () => {
  let editors: EditorInput[] = []
  beforeEach(() => {
    editors = stubEditorDom()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // число цепочки target выделенного элемента на данный момент
  const numberOf = (host: ReturnType<typeof fakeHost>, target: EditableNumber["target"]): EditableNumber => {
    const e = host.state.selected[0]
    const list = editableNumbers(e, host.walls(), host.state.elements, findRooms(host.walls()), "cm", PX_PER_CM, LABEL_PX)
    const hit = list.find((n) => JSON.stringify(n.target) === JSON.stringify(target))
    if (!hit) throw new Error(`нет числа ${JSON.stringify(target)}`)
    return hit
  }
  const enter = (value: string): void => {
    const input = editors[editors.length - 1]
    input.value = value
    input.key("Enter")
  }

  it("CD-19: слева 600, затем слева 100, затем слева 240 (то же), затем справа 100 — каждая значимая правка — одна запись", () => {
    const { walls } = sceneCK()
    const e = WN()
    const host = fakeHost(walls, [e], [e])
    const editing = createSelectionEditing(host)
    const left = { kind: "distance", side: PLUS, part: "a" } as const
    const right = { kind: "distance", side: PLUS, part: "b" } as const

    expect(editing.pressNumber(numberOf(host, left).center)).toBe(true)
    expect(editors[editors.length - 1].value).toBe("390")
    enter("600")
    expect(byId(host.state.elements, "e0")).toMatchObject({ wallId: "W", anchor: "a", widthCm: 120 })
    expect(byId(host.state.elements, "e0").offsetCm).toBeCloseTo(330, 6)
    expect(host.state.records).toBe(1)

    // число слева переехало — вторая правка подряд по новому положению
    expect(editing.pressNumber(numberOf(host, left).center)).toBe(true)
    expect(editors[editors.length - 1].value).toBe("570")
    enter("100")
    expect(byId(host.state.elements, "e0").offsetCm).toBeCloseTo(0, 6)
    expect(host.state.records).toBe(2)

    // ввод фактического значения (240) — без изменений, записи нет
    expect(editing.pressNumber(numberOf(host, left).center)).toBe(true)
    expect(editors[editors.length - 1].value).toBe("240")
    enter("240")
    expect(host.state.records).toBe(2)

    // правка другого конца: привязка b, расстояние справа 100
    expect(editing.pressNumber(numberOf(host, right).center)).toBe(true)
    enter("100")
    const after = byId(host.state.elements, "e0")
    expect(after.anchor).toBe("b")
    expect(after.offsetCm).toBeCloseTo(100, 6)
    expect(after.wallId).toBe("W")
    expect(host.state.records).toBe(3)
    expect(host.state.calls).toEqual(["record", "replace", "record", "replace", "record", "replace"])
    expect(doorwayHolds(after, walls, host.state.elements)).toBe(true)
  })

  it("CD-19b: после правки число слева показывает фактическое значение, а не введённое", () => {
    const { walls } = sceneCK()
    const e = WN()
    const host = fakeHost(walls, [e], [e])
    const editing = createSelectionEditing(host)
    expect(editing.pressNumber(numberOf(host, { kind: "distance", side: PLUS, part: "a" }).center)).toBe(true)
    enter("100")
    const n = numberOf(host, { kind: "distance", side: PLUS, part: "a" })
    expect(n.text).toBe("240")
    expect(n.valueCm).toBeCloseTo(240, 3)
  })
})
