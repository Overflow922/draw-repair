import { describe, expect, it } from "vitest"
import type { Doorway, Wall } from "../types"
import { arrowSlide, placeDoorway, setDistance, setHeight, setWidth, slideDoorway } from "./doorway-edit"
import type { DoorwayEdit } from "./doorway-edit"
import { doorwayDistances, doorwayHolds, jambsT } from "./doorway-faces"
import { D0, door, sceneF, sceneR, sceneRP, w } from "./doorway.test-utils"

// change add-doorway: установка и правка проёма — чистые функции с ограничением по инварианту
// (spec doorway «Установка проёма», «Ввод чисел размеров проёма», «Выделение проёма» (поля),
// «Перемещение проёма»; design D4).

function applied(r: DoorwayEdit, walls: Wall[]): Doorway {
  expect(r.kind).toBe("applied")
  if (r.kind !== "applied") throw new Error("rejected")
  // инвариант после любой применённой правки
  expect(doorwayHolds(r.doorway, walls)).toBe(true)
  return r.doorway
}

function rejected(r: DoorwayEdit, reason: "invalid" | "no-change"): void {
  expect(r).toEqual({ kind: "rejected", reason })
}

describe("установка проёма", () => {
  it("DE-01: призрак следует за курсором — центр в проекции, округлённой до 1 см", () => {
    const { walls, W } = sceneF()
    const d = placeDoorway(W, walls, { x: 203.4, y: 5 }, 90, 210, "n1")
    expect(d).not.toBeNull()
    expect(jambsT(d as Doorway, W)).toEqual([158, 248])
    expect(d).toEqual({ id: "n1", wallId: "W", anchor: "a", offsetCm: 158, widthCm: 90, heightCm: 210 })
  })

  it("DE-01b: округление центра — 203.5 → 204, 203.49 → 203", () => {
    const { walls, W } = sceneF()
    expect(jambsT(placeDoorway(W, walls, { x: 203.5, y: 0 }, 90, 210, "n") as Doorway, W)).toEqual([159, 249])
    expect(jambsT(placeDoorway(W, walls, { x: 203.49, y: 0 }, 90, 210, "n") as Doorway, W)).toEqual([158, 248])
  })

  it("DE-01c: наклонная стена — центр в проекции курсора на ось", () => {
    const S = w(0, 0, 300, 400, "S") // ось вдоль (0.6, 0.8)
    // точка оси t = 250 — (150, 200); смещение поперёк оси на 5 см
    const d = placeDoorway(S, [S], { x: 150 - 4, y: 200 + 3 }, 100, 210, "n")
    expect(jambsT(d as Doorway, S)).toEqual([200, 300])
  })

  it("DE-02: курсор у угла — призрак прижат к грани угловой стены", () => {
    const { walls, W } = sceneR()
    const d = placeDoorway(W, walls, { x: 30, y: 0 }, 90, 210, "n")
    const [j1, j2] = jambsT(d as Doorway, W)
    expect(j1).toBeCloseTo(10, 3)
    expect(j2).toBeCloseTo(100, 3)
    expect(doorwayDistances(d as Doorway, walls)?.plus.a).toBeCloseTo(0, 3)
  })

  it("DE-03: курсор над перегородкой — ближайшее допустимое положение на стене (справа от P)", () => {
    const { walls, W } = sceneRP()
    const d = placeDoorway(W, walls, { x: 310, y: 5 }, 90, 210, "n")
    const [j1, j2] = jambsT(d as Doorway, W)
    expect(j1).toBeCloseTo(305, 3)
    expect(j2).toBeCloseTo(395, 3)
  })

  it("DE-03b: курсор над перегородкой левее — проём слева от P", () => {
    const { walls, W } = sceneRP()
    const d = placeDoorway(W, walls, { x: 290, y: 5 }, 90, 210, "n")
    const [j1, j2] = jambsT(d as Doorway, W)
    expect(j1).toBeCloseTo(205, 3)
    expect(j2).toBeCloseTo(295, 3)
  })

  it("DE-04: сторона привязки — ближний конец; при равенстве — a", () => {
    const { walls, W } = sceneF()
    expect(placeDoorway(W, walls, { x: 250, y: 0 }, 90, 210, "n")).toMatchObject({ anchor: "a", offsetCm: 205 })
    expect(placeDoorway(W, walls, { x: 400, y: 0 }, 90, 210, "n")).toMatchObject({ anchor: "b", offsetCm: 55 })
    expect(placeDoorway(W, walls, { x: 100, y: 0 }, 90, 210, "n")).toMatchObject({ anchor: "a", offsetCm: 55 })
  })

  it("DE-05: нет места — null; ширина ровно на участок — ставится", () => {
    const { walls, W } = sceneR()
    expect(placeDoorway(W, walls, { x: 250, y: 0 }, 480.01, 210, "n")).toBeNull()
    const d = placeDoorway(W, walls, { x: 250, y: 0 }, 480, 210, "n")
    const [j1, j2] = jambsT(d as Doorway, W)
    expect(j1).toBeCloseTo(10, 3)
    expect(j2).toBeCloseTo(490, 3)
  })

  it("DE-05b: стена короче проёма — null", () => {
    const S = w(0, 0, 80, 0, "S")
    expect(placeDoorway(S, [S], { x: 40, y: 0 }, 90, 210, "n")).toBeNull()
  })
})

describe("ввод расстояния и ширины", () => {
  it("DE-06: ввод 231 по грани plus в сторону b — привязка b, ширина 90", () => {
    const { walls } = sceneR()
    const d = applied(setDistance(D0(), walls, 1, "b", 231), walls)
    expect(doorwayDistances(d, walls)?.plus.b).toBeCloseTo(231, 3)
    expect(d.anchor).toBe("b")
    expect(d.widthCm).toBe(90)
    expect(d.heightCm).toBe(210)
    // откос со стороны b: x = 490 − 231 = 259; от конца b (500) по оси — 241
    expect(d.offsetCm).toBeCloseTo(241, 3)
  })

  it("DE-06b: ввод по наружной грани в сторону a — сдвиг по наружному стыку", () => {
    const { walls } = sceneR()
    const d = applied(setDistance(D0(), walls, -1, "a", 240), walls)
    const dist = doorwayDistances(d, walls)
    expect(dist?.minus.a).toBeCloseTo(240, 3)
    expect(dist?.plus.a).toBeCloseTo(220, 3)
    expect(d.anchor).toBe("a")
    expect(d.offsetCm).toBeCloseTo(230, 3)
  })

  it("DE-06c: ввод расстояния 0 — откос на стыке", () => {
    const { walls } = sceneR()
    const d = applied(setDistance(D0(), walls, 1, "a", 0), walls)
    expect(d.offsetCm).toBeCloseTo(10, 3)
    expect(doorwayDistances(d, walls)?.plus.a).toBeCloseTo(0, 3)
  })

  it("DE-07: ширина растёт от откоса привязки a (100 → 100/220)", () => {
    const { walls, W } = sceneR()
    const d = applied(setWidth(D0(), walls, 120), walls)
    expect(jambsT(d, W)).toEqual([100, 220])
    expect(d.anchor).toBe("a")
    expect(d.offsetCm).toBe(100)
  })

  it("DE-08: при привязке b неподвижен откос со стороны b", () => {
    const { walls, W } = sceneR()
    const d = applied(setWidth(door("W", "b", 100), walls, 120), walls)
    expect(jambsT(d, W)).toEqual([280, 400])
    expect(d.offsetCm).toBe(100)
  })

  it("DE-09: слишком большое расстояние ограничивается до касания (400 → 390, b = 0)", () => {
    const { walls } = sceneR()
    const d = applied(setDistance(D0(), walls, 1, "a", 400), walls)
    const dist = doorwayDistances(d, walls)
    expect(dist?.plus.a).toBeCloseTo(390, 3)
    expect(dist?.plus.b).toBeCloseTo(0, 3)
    expect(d.anchor).toBe("a")
  })

  it("DE-09b: слишком большая ширина ограничивается при неподвижном откосе привязки (500 → 390)", () => {
    const { walls, W } = sceneR()
    const d = applied(setWidth(D0(), walls, 500), walls)
    expect(d.widthCm).toBeCloseTo(390, 3)
    const [j1, j2] = jambsT(d, W)
    expect(j1).toBeCloseTo(100, 3)
    expect(j2).toBeCloseTo(490, 3)
  })

  it("DE-09c: ограничение в пределах участка текущего положения — через перегородку не перескакивает", () => {
    const { walls } = sceneRP()
    const d = applied(setDistance(D0(), walls, 1, "a", 300), walls)
    // участок [10, 295]: наибольшее расстояние до L — 295 − 90 − 10 = 195
    expect(doorwayDistances(d, walls)?.plus.a).toBeCloseTo(195, 3)
  })

  it("DE-09d: ввод по одной грани ограничивается стыками обеих граней (перегородка только на plus)", () => {
    const { walls } = sceneRP()
    // без ограничения по plus проём встал бы на [240, 330] — под перегородку P (295 … 305)
    const d = applied(setDistance(D0(), walls, -1, "a", 250), walls)
    expect(d.offsetCm).toBeCloseTo(205, 3)
    const dist = doorwayDistances(d, walls)
    expect(dist?.minus.a).toBeCloseTo(215, 3)
    expect(dist?.plus.b).toBeCloseTo(0, 3)
  })

  it("DE-10: неверный ввод отклоняется", () => {
    const { walls } = sceneR()
    rejected(setDistance(D0(), walls, 1, "a", Number.NaN), "invalid")
    rejected(setDistance(D0(), walls, 1, "a", -1), "invalid")
    rejected(setDistance(D0(), walls, 1, "a", Number.POSITIVE_INFINITY), "invalid")
    rejected(setWidth(D0(), walls, 0), "invalid")
    rejected(setWidth(D0(), walls, -5), "invalid")
    rejected(setWidth(D0(), walls, Number.NaN), "invalid")
    rejected(setHeight(D0(), 0), "invalid")
    rejected(setHeight(D0(), -1), "invalid")
    rejected(setHeight(D0(), Number.NaN), "invalid")
  })

  it("DE-10b: очень малая ширина допустима", () => {
    const { walls } = sceneR()
    expect(applied(setWidth(D0(), walls, 0.1), walls).widthCm).toBeCloseTo(0.1, 6)
  })

  it("DE-11: значение без изменения — no-change", () => {
    const { walls } = sceneR()
    rejected(setDistance(D0(), walls, 1, "a", 90), "no-change")
    rejected(setWidth(D0(), walls, 90), "no-change")
    rejected(setHeight(D0(), 210), "no-change")
  })

  it("DE-11b: ввод того же расстояния в другую сторону меняет только привязку", () => {
    const { walls } = sceneR()
    const d = applied(setDistance(D0(), walls, 1, "b", 300), walls)
    expect(d.anchor).toBe("b")
    expect(doorwayDistances(d, walls)?.plus.a).toBeCloseTo(90, 3)
  })

  it("DE-HEIGHT: высота меняется полем, остальное прежнее", () => {
    expect(setHeight(D0(), 200)).toEqual({ kind: "applied", doorway: { ...D0(), heightCm: 200 } })
  })

  it("DE-PURE: правки не мутируют исходный проём", () => {
    const { walls } = sceneR()
    const d = D0()
    setDistance(d, walls, 1, "b", 231)
    setWidth(d, walls, 120)
    slideDoorway(d, walls, { x: 50, y: 0 })
    expect(d).toEqual(D0())
  })
})

describe("перемещение и стрелки", () => {
  it("DE-12: перетаскивание на (50, 30) — проекция на ось, offset 150, привязка прежняя", () => {
    const { walls } = sceneR()
    const d = applied(slideDoorway(D0(), walls, { x: 50, y: 30 }), walls)
    expect(d).toEqual({ ...D0(), offsetCm: 150 })
  })

  it("DE-12b: при привязке b сдвиг к концу b уменьшает расстояние привязки", () => {
    const { walls } = sceneF()
    const d = applied(slideDoorway(door("W", "b", 100), walls, { x: 50, y: 0 }), walls)
    expect(d).toMatchObject({ anchor: "b", offsetCm: 50 })
  })

  it("DE-13: остановка у стыка — (−200, 0) в R → offset 10, привязка a", () => {
    const { walls } = sceneR()
    const d = applied(slideDoorway(D0(), walls, { x: -200, y: 0 }), walls)
    expect(d.offsetCm).toBeCloseTo(10, 3)
    expect(d.anchor).toBe("a")
  })

  it("DE-14: не перепрыгивает перегородку — останавливается у её грани", () => {
    const { walls } = sceneRP()
    const d = applied(slideDoorway(D0(), walls, { x: 200, y: 0 }), walls)
    expect(d.offsetCm).toBeCloseTo(205, 3)
  })

  it("DE-14b: допустимое положение за перегородкой не достигается — остановка у её грани", () => {
    const { walls } = sceneRP()
    // запрос offset 400 ([400, 490]) допустим сам по себе, но путь проходит через P
    const d = applied(slideDoorway(D0(), walls, { x: 300, y: 0 }), walls)
    expect(d.offsetCm).toBeCloseTo(205, 3)
  })

  it("DE-15: расстояние привязки при перетаскивании округляется до 1 см", () => {
    const { walls } = sceneR()
    expect(applied(slideDoorway(D0(), walls, { x: 50.4, y: 0 }), walls).offsetCm).toBe(150)
    expect(applied(slideDoorway(D0(), walls, { x: 50.6, y: 0 }), walls).offsetCm).toBe(151)
  })

  it("DE-15b: перетаскивание без смещения — no-change", () => {
    const { walls } = sceneR()
    rejected(slideDoorway(D0(), walls, { x: 0, y: 40 }), "no-change")
  })

  it("DE-16: стрелка вправо — +10 к концу b, с шагом 1 — +1", () => {
    const { walls } = sceneR()
    expect(applied(arrowSlide(D0(), walls, { x: 1, y: 0 }, 10), walls).offsetCm).toBe(110)
    expect(applied(arrowSlide(D0(), walls, { x: 1, y: 0 }, 1), walls).offsetCm).toBe(101)
    expect(applied(arrowSlide(D0(), walls, { x: -1, y: 0 }, 10), walls).offsetCm).toBe(90)
  })

  it("DE-16b: стрелка при привязке b — расстояние от b меняется в обратную сторону", () => {
    const { walls } = sceneF()
    expect(applied(arrowSlide(door("W", "b", 100), walls, { x: 1, y: 0 }, 10), walls).offsetCm).toBe(90)
  })

  it("DE-16c: стрелка в упоре — сдвиг до касания, в касании — no-change", () => {
    const { walls } = sceneR()
    expect(applied(arrowSlide(door("W", "a", 14), walls, { x: -1, y: 0 }, 10), walls).offsetCm).toBeCloseTo(10, 3)
    rejected(arrowSlide(door("W", "a", 10), walls, { x: -1, y: 0 }, 10), "no-change")
  })

  it("DE-17: стрелка поперёк стены не сдвигает", () => {
    const { walls } = sceneR()
    rejected(arrowSlide(D0(), walls, { x: 0, y: -1 }, 10), "no-change")
    rejected(arrowSlide(D0(), walls, { x: 0, y: 1 }, 10), "no-change")
  })

  it("DE-18: стена под 45° — стрелка сдвигает на шаг вдоль оси", () => {
    const S = w(0, 0, 300, 300, "S")
    const d = door("S", "a", 100)
    expect(applied(arrowSlide(d, [S], { x: 1, y: 0 }, 10), [S]).offsetCm).toBeCloseTo(110, 6)
    expect(applied(arrowSlide(d, [S], { x: 0, y: 1 }, 10), [S]).offsetCm).toBeCloseTo(110, 6)
    expect(applied(arrowSlide(d, [S], { x: -1, y: 0 }, 10), [S]).offsetCm).toBeCloseTo(90, 6)
  })

  it("DE-18b: допуск прямого угла 0.5° — 89.6° не сдвигает, 89.4° сдвигает", () => {
    const at = (deg: number): Wall => {
      const r = (deg * Math.PI) / 180
      return w(0, 0, 400 * Math.cos(r), 400 * Math.sin(r), "S")
    }
    const d = door("S", "a", 100)
    const s1 = at(89.6)
    rejected(arrowSlide(d, [s1], { x: 1, y: 0 }, 10), "no-change")
    const s2 = at(89.4)
    expect(applied(arrowSlide(d, [s2], { x: 1, y: 0 }, 10), [s2]).offsetCm).toBeCloseTo(110, 6)
  })
})
