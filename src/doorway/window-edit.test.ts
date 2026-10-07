import { describe, expect, it } from "vitest"
import type { WallElement, WallWindow } from "../types"
import { arrowSlide, nudgeElements, placeDoorway, placeWindow, setDistance, setHeight, setSill, setWidth, slideDoorway } from "./doorway-edit"
import { doorwayHolds, jambsT } from "./doorway-faces"
import { D0, door, sceneF, w } from "./doorway.test-utils"
import { WA, sceneFO, sceneRN, win } from "./window.test-utils"

// change add-window: установка и правка элементов со стыками-соседями, окно и подоконник
// (spec doorway «Инвариант размещения проёма», «Элементы стены»; window «Окно — элемент стены»,
// «Инструмент «Окно»», «Панель выделенного окна»; design D3).

const applied = <E extends WallElement>(r: { kind: "applied"; doorway: E } | { kind: "rejected"; reason: string }): E => {
  expect(r.kind).toBe("applied")
  if (r.kind !== "applied") throw new Error(`rejected: ${r.reason}`)
  return r.doorway
}

describe("призрак и установка между элементами", () => {
  it("WE-01: призрак проёма встаёт в промежуток 190…280, касаясь обоих соседей", () => {
    const { walls, W, elements } = sceneRN()
    const g = placeDoorway(W, walls, { x: 250, y: 0 }, 90, 210, "g", elements)
    expect(g).toEqual({ id: "g", wallId: "W", anchor: "a", offsetCm: 190, widthCm: 90, heightCm: 210 })
    if (g) expect(doorwayHolds(g, walls, [...elements, g])).toBe(true)
  })

  it("WE-01b: без списка элементов призрак игнорирует соседей (контроль сигнатуры)", () => {
    const { walls, W } = sceneRN()
    const g = placeDoorway(W, walls, { x: 250, y: 0 }, 90, 210, "g")
    expect(g?.offsetCm).toBe(205)
  })

  it("WE-02: окну 120 нет места ни в одном промежутке RN — null", () => {
    const { walls, W, elements } = sceneRN()
    expect(placeWindow(W, walls, { x: 235, y: 0 }, 120, 150, 85, "g", elements)).toBeNull()
    expect(placeDoorway(W, walls, { x: 235, y: 0 }, 91, 210, "g", elements)).toBeNull()
  })

  it("WE-02b: призрак, налезающий на соседа, сдвигается к ближайшему допустимому положению", () => {
    const { walls, W } = sceneF()
    const d = D0()
    // курсор над проёмом: центр 150 → ближайшее допустимое — вплотную слева (10…100) или справа (190…280)
    const g = placeDoorway(W, walls, { x: 170, y: 0 }, 90, 210, "g", [d])
    expect(g).not.toBeNull()
    if (g) expect(jambsT(g, W)).toEqual([190, 280])
  })

  it("WE-09: окно ставится с шириной, высотой и подоконником; вид — окно", () => {
    const { walls, W } = sceneF()
    const g = placeWindow(W, walls, { x: 203.4, y: 5 }, 120, 150, 85, "w1", [])
    expect(g).toEqual({ kind: "window", id: "w1", wallId: "W", anchor: "a", offsetCm: 143, widthCm: 120, heightCm: 150, sillCm: 85 })
  })

  it("WE-09b: подоконник 0 допустим, отрицательный, ширина и высота ≤ 0 — нет", () => {
    const { walls, W } = sceneF()
    const at = { x: 250, y: 0 }
    expect(placeWindow(W, walls, at, 120, 150, 0, "z", [])?.sillCm).toBe(0)
    expect(placeWindow(W, walls, at, 120, 150, -0.01, "z", [])).toBeNull()
    expect(placeWindow(W, walls, at, 120, 150, Number.NaN, "z", [])).toBeNull()
    expect(placeWindow(W, walls, at, 0, 150, 85, "z", [])).toBeNull()
    expect(placeWindow(W, walls, at, 120, 0, 85, "z", [])).toBeNull()
  })
})

describe("правка элемента ограничена соседом", () => {
  it("WE-03: перетаскивание останавливается у окна, меньший сдвиг проходит полностью", () => {
    const { walls, d, elements } = sceneRN()
    expect(applied(slideDoorway(d, walls, { x: 200, y: 0 }, elements))).toEqual({ ...d, offsetCm: 190 })
    expect(applied(slideDoorway(d, walls, { x: 80, y: 30 }, elements))).toEqual({ ...d, offsetCm: 180 })
  })

  it("WE-03b: от касания элемент сразу отходит назад", () => {
    const { walls, elements } = sceneRN()
    const touching = door("W", "a", 190)
    const list = [touching, elements[1]]
    expect(applied(slideDoorway(touching, walls, { x: -30, y: 0 }, list))).toEqual({ ...touching, offsetCm: 160 })
    expect(slideDoorway(touching, walls, { x: 30, y: 0 }, list)).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("WE-04: ширина 200 ограничивается до 180 — откос касается окна", () => {
    const { walls, d, elements } = sceneRN()
    expect(applied(setWidth(d, walls, 200, elements))).toEqual({ ...d, widthCm: 180 })
  })

  it("WE-05: расстояние 0 до соседа — касание, привязка к b", () => {
    const { walls, W, d, elements } = sceneRN()
    const r = applied(setDistance(d, walls, 1, "b", 0, elements))
    expect(r).toEqual({ ...d, anchor: "b", offsetCm: 220 })
    expect(jambsT(r, W)).toEqual([190, 280])
  })

  it("WE-05b: расстояние 400 в сторону a ограничивается касанием окна", () => {
    const { walls, d, elements } = sceneRN()
    expect(applied(setDistance(d, walls, 1, "a", 400, elements))).toEqual({ ...d, anchor: "a", offsetCm: 190 })
  })

  it("WE-05c: расстояние в сторону соседа измеряется до соседа (40 → откос на 240)", () => {
    const { walls, W, d, elements } = sceneRN()
    const r = applied(setDistance(d, walls, -1, "b", 40, elements))
    expect(jambsT(r, W)).toEqual([150, 240])
  })

  it("WE-06: стрелка до касания соседа, дальше — без изменения", () => {
    const { walls, elements } = sceneRN()
    const near = door("W", "a", 185)
    const list = [near, elements[1]]
    expect(applied(arrowSlide(near, walls, { x: 1, y: 0 }, 10, list))).toEqual({ ...near, offsetCm: 190 })
    const touching = door("W", "a", 190)
    expect(arrowSlide(touching, walls, { x: 1, y: 0 }, 10, [touching, elements[1]])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("WE-07: наложенный элемент из документа выводится из наложения", () => {
    const { walls, d, elements } = sceneFO()
    expect(applied(slideDoorway(d, walls, { x: -30, y: 0 }, elements))).toEqual({ ...d, offsetCm: 70 })
  })

  it("WE-08: сдвиг в сторону наложения не углубляет его и не перебрасывает элемент", () => {
    const { walls, d, elements } = sceneFO()
    expect(slideDoorway(d, walls, { x: 50, y: 0 }, elements)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(arrowSlide(d, walls, { x: 1, y: 0 }, 10, elements)).toEqual({ kind: "rejected", reason: "no-change" })
  })
})

describe("подоконник", () => {
  it("WE-10: setSill меняет только подоконник; то же значение — no-change; недопустимое — invalid", () => {
    const x = WA()
    expect(setSill(x, 90)).toEqual({ kind: "applied", doorway: { ...x, sillCm: 90 } })
    expect(setSill(x, 0)).toEqual({ kind: "applied", doorway: { ...x, sillCm: 0 } })
    expect(setSill(x, 85)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(setSill(x, -1)).toEqual({ kind: "rejected", reason: "invalid" })
    expect(setSill(x, -0.01)).toEqual({ kind: "rejected", reason: "invalid" })
    expect(setSill(x, Number.NaN)).toEqual({ kind: "rejected", reason: "invalid" })
    expect(setSill(x, Number.POSITIVE_INFINITY)).toEqual({ kind: "rejected", reason: "invalid" })
  })
})

describe("правки окна сохраняют вид и подоконник", () => {
  it("WE-13: ширина, расстояние, сдвиг, стрелка и высота окна — kind и sillCm на месте", () => {
    const { walls } = sceneF()
    const x: WallWindow = WA()
    const list = [x]
    expect(applied(setWidth(x, walls, 130, list))).toEqual({ ...x, widthCm: 130 })
    expect(applied(setDistance(x, walls, 1, "b", 100, list))).toEqual({ ...x, anchor: "b", offsetCm: 100 })
    expect(applied(slideDoorway(x, walls, { x: 10, y: 0 }, list))).toEqual({ ...x, offsetCm: 110 })
    expect(applied(arrowSlide(x, walls, { x: 1, y: 0 }, 10, list))).toEqual({ ...x, offsetCm: 110 })
    expect(setHeight(x, 160)).toEqual({ kind: "applied", doorway: { ...x, heightCm: 160 } })
  })
})

describe("стрелки по нескольким элементам", () => {
  const byId = (list: readonly WallElement[], id: string): WallElement => {
    const e = list.find((x) => x.id === id)
    if (!e) throw new Error(`нет элемента ${id}`)
    return e
  }

  it("WE-12: пара в касании сдвигается вместе — ведущий первым, независимо от порядка выделения", () => {
    const { walls } = sceneF()
    const d = D0()
    const x = win("W", "a", 190, 120, 150, 85, "x")
    const out = nudgeElements([d, x], walls, [d, x], { x: 1, y: 0 }, 10)
    expect(byId(out, "d0")).toEqual({ ...d, offsetCm: 110 })
    expect(byId(out, "x")).toEqual({ ...x, offsetCm: 200 })
    const back = nudgeElements([x, d], walls, [d, x], { x: -1, y: 0 }, 10)
    expect(byId(back, "d0")).toEqual({ ...d, offsetCm: 90 })
    expect(byId(back, "x")).toEqual({ ...x, offsetCm: 180 })
  })

  it("WE-12b: каждый элемент сдвигается в сторону конца своей стены; невыделенный не двигается", () => {
    const W = w(0, 0, 500, 0, "W")
    const V = w(500, 300, 0, 300, "V") // направление a → b — влево
    const walls = [W, V]
    const d = D0()
    const onV = win("V", "a", 100, 120, 150, 85, "v")
    const idle = door("W", "a", 300, 90, 210, "idle")
    const all = [d, onV, idle]
    const out = nudgeElements([d, onV], walls, all, { x: 1, y: 0 }, 10)
    expect(byId(out, "d0")).toEqual({ ...d, offsetCm: 110 })
    expect(byId(out, "v")).toEqual({ ...onV, offsetCm: 90 })
    expect(byId(out, "idle")).toEqual(idle)
    expect(out).toHaveLength(3)
  })

  it("WE-12c: стрелка поперёк стен не сдвигает ни один элемент", () => {
    const { walls } = sceneF()
    const d = D0()
    const x = win("W", "a", 300, 120, 150, 85, "x")
    const out = nudgeElements([d, x], walls, [d, x], { x: 0, y: 1 }, 10)
    expect(byId(out, "d0")).toEqual(d)
    expect(byId(out, "x")).toEqual(x)
  })

  it("WE-12d: невыделенный сосед останавливает выделенный элемент", () => {
    const { walls } = sceneF()
    const d = door("W", "a", 95)
    const x = win("W", "a", 190, 120, 150, 85, "x")
    const out = nudgeElements([d], walls, [d, x], { x: 1, y: 0 }, 10)
    expect(byId(out, "d0")).toEqual({ ...d, offsetCm: 100 })
    expect(byId(out, "x")).toEqual(x)
  })
})
