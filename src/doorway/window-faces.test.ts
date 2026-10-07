import { describe, expect, it } from "vitest"
import type { WallElement } from "../types"
import { doorwayDistances, doorwayHolds, jambsT } from "./doorway-faces"
import { D0, door, sceneF, sceneR, w } from "./doorway.test-utils"
import { WN, sceneFO, sceneRN, win } from "./window.test-utils"

// change add-window: соседние элементы стены — стыки граней, наложение — отрицательное расстояние
// (spec doorway «Элементы стены», «Стыки грани и расстояния проёма», «Инвариант размещения проёма»; design D2).

describe("окно — элемент стены", () => {
  it("WF-01: откосы окна по привязке a и b — как у проёма", () => {
    const { W } = sceneR()
    expect(jambsT(WN(), W)).toEqual([280, 400])
    expect(jambsT(win("W", "a", 100), W)).toEqual([100, 220])
  })
})

describe("соседний элемент — стык обеих граней", () => {
  it("WF-02: в RN расстояния проёма 90/90 и 110/90, окна 90/90 и 90/110", () => {
    const { walls, d, wn, elements } = sceneRN()
    const dd = doorwayDistances(d, walls, elements)
    expect(dd?.plus.a).toBeCloseTo(90, 3)
    expect(dd?.plus.b).toBeCloseTo(90, 3)
    expect(dd?.minus.a).toBeCloseTo(110, 3)
    expect(dd?.minus.b).toBeCloseTo(90, 3)
    const dw = doorwayDistances(wn, walls, elements)
    expect(dw?.plus.a).toBeCloseTo(90, 3)
    expect(dw?.plus.b).toBeCloseTo(90, 3)
    expect(dw?.minus.a).toBeCloseTo(90, 3)
    expect(dw?.minus.b).toBeCloseTo(110, 3)
  })

  it("WF-03: без списка элементов расстояния прежние — до углов", () => {
    const { walls } = sceneR()
    const dd = doorwayDistances(D0(), walls)
    expect(dd?.plus.b).toBeCloseTo(300, 3)
    expect(dd?.minus.b).toBeCloseTo(320, 3)
  })

  it("WF-04: элемент в списке не является собственным соседом", () => {
    const { walls } = sceneR()
    const d = D0()
    const dd = doorwayDistances(d, walls, [d])
    expect(dd?.plus.a).toBeCloseTo(90, 3)
    expect(dd?.plus.b).toBeCloseTo(300, 3)
    expect(dd?.minus.a).toBeCloseTo(110, 3)
    expect(dd?.minus.b).toBeCloseTo(320, 3)
    expect(doorwayHolds(d, walls, [d])).toBe(true)
  })

  it("WF-04b: копия элемента с тем же id не режет его участок", () => {
    const { walls } = sceneR()
    const d = D0()
    expect(doorwayDistances(d, walls, [{ ...d }])?.plus.b).toBeCloseTo(300, 3)
  })

  it("WF-05: наложение 20 см даёт −20 на обеих гранях у обоих элементов", () => {
    const { walls, d, wo, elements } = sceneFO()
    const dd = doorwayDistances(d, walls, elements)
    expect(dd?.plus.b).toBeCloseTo(-20, 3)
    expect(dd?.minus.b).toBeCloseTo(-20, 3)
    expect(dd?.plus.a).toBeCloseTo(100, 3)
    const dw = doorwayDistances(wo, walls, elements)
    expect(dw?.plus.a).toBeCloseTo(-20, 3)
    expect(dw?.minus.a).toBeCloseTo(-20, 3)
    expect(dw?.plus.b).toBeCloseTo(210, 3)
  })

  it("WF-06: элементы на другой стене не влияют", () => {
    const { walls } = sceneR()
    // окно на B (500,400)-(0,400): x 400…280 — над проёмом W по x, но на другой стене
    const onB: WallElement = win("B", "a", 0, 300, 150, 85, "wb")
    const dd = doorwayDistances(D0(), walls, [D0(), onB])
    expect(dd?.plus.a).toBeCloseTo(90, 3)
    expect(dd?.plus.b).toBeCloseTo(300, 3)
    expect(dd?.minus.a).toBeCloseTo(110, 3)
    expect(dd?.minus.b).toBeCloseTo(320, 3)
  })

  it("WF-06b: элемент, ссылающийся на отсутствующую стену, не влияет", () => {
    const { walls } = sceneF()
    const ghost = win("gone", "a", 150)
    expect(doorwayDistances(D0(), walls, [D0(), ghost])?.plus.b).toBeCloseTo(310, 3)
  })
})

describe("инвариант: элементы не налагаются", () => {
  it("WF-07: касание соседа допустимо, наложение 0.01 — нет", () => {
    const { walls } = sceneF()
    const d = D0()
    const touching = win("W", "a", 190)
    expect(doorwayHolds(d, walls, [d, touching])).toBe(true)
    expect(doorwayHolds(touching, walls, [d, touching])).toBe(true)
    expect(doorwayDistances(d, walls, [d, touching])?.plus.b).toBeCloseTo(0, 3)
    const wide = door("W", "a", 100, 90.01)
    expect(doorwayHolds(wide, walls, [wide, touching])).toBe(false)
    expect(doorwayHolds(touching, walls, [wide, touching])).toBe(false)
  })

  it("WF-07b: наложение проёма на проём тоже нарушает инвариант", () => {
    const { walls } = sceneF()
    const d1 = D0()
    const d2 = door("W", "a", 150, 90, 210, "d2")
    expect(doorwayHolds(d1, walls, [d1, d2])).toBe(false)
    expect(doorwayHolds(d2, walls, [d1, d2])).toBe(false)
  })

  it("WF-07c: окно на стене толщиной 10 — сосед режет обе грани", () => {
    const W = w(0, 0, 500, 0, "W", 10)
    const d = D0()
    const x = win("W", "a", 250)
    const dd = doorwayDistances(d, [W], [d, x])
    expect(dd?.plus.b).toBeCloseTo(60, 3)
    expect(dd?.minus.b).toBeCloseTo(60, 3)
  })
})
