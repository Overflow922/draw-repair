import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findRooms } from "../room-area"
import { PX_PER_CM } from "../types"
import type { Wall, WallElement } from "../types"
import { createSelectionEditing } from "./doorway-tool"
import { arrowSlide, placeDoor, placeDoorway, placeWindow, setDistance, setWidth, slideDoorway } from "./doorway-edit"
import type { ElementEdit } from "./doorway-edit"
import { doorwayHolds, doorwayViolation, jambsT } from "./doorway-faces"
import { editableNumbers } from "./editable-numbers"
import type { EditableNumber } from "./editable-numbers"
import { dr } from "./door.test-utils"
import { door, w } from "./doorway.test-utils"
import { LABEL_PX, byId, fakeHost, stubEditorDom } from "./selection-editing.test-utils"
import type { EditorInput } from "./selection-editing.test-utils"
import { win } from "./window.test-utils"
import { MINUS, PLUS, distancesFor, made, sceneF, sceneFM, sceneFa, sceneG, winMid } from "./opening-reach-body-end.test-utils"

// change fix-opening-reach-body-end: элемент занимает всё тело опорной стены, расстояние до стыка может быть 0
// (spec doorway «Проём и опорная стена», «Расстояния проёма сквозь коллинеарные стены»). Тесты T-03, T-11…T-16,
// T-20 test-plan.md. Сцена F: бетонная C (510,0)-(700,0) раньше, блочная W (0,0)-(500,0) позже, тело W доходит до
// x = 510; окно winMid на W — x 300…420 (привязка a, 300 см, ширина 120). Сцена G — порядок «W раньше C»,
// граница на x = 500. Сцена FM — выступ слева (бетон раньше) и продолжение того же материала справа.

const applied = <E extends WallElement>(r: ElementEdit<E>): E => {
  if (r.kind !== "applied") throw new Error(`rejected: ${r.reason}`)
  return r.doorway
}

describe("откос на выступе тела", () => {
  it("T-03: окно с привязкой b и расстоянием −10 занимает x 390…510, расстояния справа 0 на обеих гранях", () => {
    const { walls, W } = sceneF()
    const e = win("W", "b", -10, 120, 150, 85, "e0")
    const [j1, j2] = jambsT(e, W)
    expect(j1).toBeCloseTo(390, 6)
    expect(j2).toBeCloseTo(510, 6)
    const d = distancesFor(e, walls)
    expect(d[0]).toBeCloseTo(390, 3)
    expect(d[1]).toBeCloseTo(0, 3)
    expect(d[2]).toBeCloseTo(390, 3)
    expect(d[3]).toBeCloseTo(0, 3)
    expect(doorwayHolds(e, walls, [e])).toBe(true)
  })

  it("T-03b: до правки окно x 300…420 видит 90 см до стыка на обеих гранях", () => {
    const { walls } = sceneF()
    const d = distancesFor(winMid(), walls)
    expect(d[1]).toBeCloseTo(90, 3)
    expect(d[3]).toBeCloseTo(90, 3)
  })
})

describe("ввод расстояния до стыка", () => {
  it("T-11: ввод 0 справа — окно x 390…510, привязка b, смещение −10, расстояния справа 0 на обеих гранях", () => {
    const { walls, W } = sceneF()
    const e = winMid()
    const next = applied(setDistance(e, walls, PLUS, "b", 0, [e]))
    expect(next.wallId).toBe("W")
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    expect(next.widthCm).toBe(120)
    const [j1, j2] = jambsT(next, W)
    expect(j1).toBeCloseTo(390, 6)
    expect(j2).toBeCloseTo(510, 6)
    const d = distancesFor(next, walls)
    expect(d[1]).toBeCloseTo(0, 3)
    expect(d[3]).toBeCloseTo(0, 3)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("T-11b: границы справа: 0 → смещение −10, 1 → −9, 2 → −8", () => {
    const { walls } = sceneF()
    const e = winMid()
    expect(applied(setDistance(e, walls, PLUS, "b", 0, [e])).offsetCm).toBeCloseTo(-10, 6)
    expect(applied(setDistance(e, walls, PLUS, "b", 1, [e])).offsetCm).toBeCloseTo(-9, 6)
    expect(applied(setDistance(e, walls, PLUS, "b", 2, [e])).offsetCm).toBeCloseTo(-8, 6)
  })

  it("T-11c: то же с наружной грани — ввод 0 справа даёт тот же участок x 390…510", () => {
    const { walls, W } = sceneF()
    const e = winMid()
    const next = applied(setDistance(e, walls, MINUS, "b", 0, [e]))
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    expect(jambsT(next, W)[1]).toBeCloseTo(510, 6)
  })

  it("T-11d: ввод большого расстояния слева прижимает окно к стыку: привязка a, смещение 390, расстояние справа 0", () => {
    const { walls, W } = sceneF()
    const e = winMid()
    const next = applied(setDistance(e, walls, PLUS, "a", 5000, [e]))
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(390, 6)
    expect(jambsT(next, W)[1]).toBeCloseTo(510, 6)
    expect(distancesFor(next, walls)[1]).toBeCloseTo(0, 3)
  })

  it("T-11e: уже стоящее у стыка окно — повторный ввод 0 справа без изменений", () => {
    const { walls } = sceneF()
    const e = winMid()
    const pressed = applied(setDistance(e, walls, PLUS, "b", 0, [e]))
    expect(setDistance(pressed, walls, PLUS, "b", 0, [pressed])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("T-11f: отрицательное число по-прежнему неверный ввод", () => {
    const { walls } = sceneF()
    const e = winMid()
    expect(setDistance(e, walls, PLUS, "b", -5, [e])).toEqual({ kind: "rejected", reason: "invalid" })
  })

  it("T-11g: ширина у стыка растёт до 510: окно привязка b смещение −10 — ширина 1000 даёт участок от торца W до стыка", () => {
    const { walls, W } = sceneF()
    const e = win("W", "b", -10, 120, 150, 85, "e0")
    const next = applied(setWidth(e, walls, 1000, [e]))
    const [j1, j2] = jambsT(next, W)
    expect(j1).toBeCloseTo(0, 6)
    expect(j2).toBeCloseTo(510, 6)
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("T-11h: ширина с привязкой a от откоса 300 растёт до стыка: 210 см", () => {
    const { walls } = sceneF()
    const e = winMid()
    const next = applied(setWidth(e, walls, 1000, [e]))
    expect(next.widthCm).toBeCloseTo(210, 6)
    expect(next.offsetCm).toBeCloseTo(300, 6)
  })
})

describe("перетаскивание и стрелки до стыка", () => {
  it("T-12: перетаскивание далеко вправо — окно останавливается в касании со стыком, откос x = 510, остаётся на W", () => {
    const { walls, W } = sceneF()
    const e = winMid()
    const next = applied(slideDoorway(e, walls, { x: 900, y: 0 }, [e]))
    expect(next.wallId).toBe("W")
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(390, 6)
    expect(jambsT(next, W)[1]).toBeCloseTo(510, 6)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("T-12b: из положения у стыка перетаскивание обратно на 5 см сдвигает окно влево: x 385…505", () => {
    const { walls, W } = sceneF()
    const e = winMid()
    const atJoint = applied(slideDoorway(e, walls, { x: 900, y: 0 }, [e]))
    const back = applied(slideDoorway(atJoint, walls, { x: -5, y: 0 }, [atJoint]))
    expect(jambsT(back, W)[0]).toBeCloseTo(385, 6)
    expect(jambsT(back, W)[1]).toBeCloseTo(505, 6)
  })

  it("T-12c: окно, стоящее у стыка, при перетаскивании ещё правее не меняется", () => {
    const { walls } = sceneF()
    const e = win("W", "b", -10, 120, 150, 85, "e0")
    expect(slideDoorway(e, walls, { x: 50, y: 0 }, [e])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("T-14: стрелка вправо с шагом 1 см от x 385…505 — пять нажатий до x 390…510, шестое без изменений", () => {
    const { walls, W } = sceneF()
    let e: WallElement = win("W", "a", 385, 120, 150, 85, "e0")
    for (let i = 1; i <= 5; i++) {
      e = applied(arrowSlide(e, walls, { x: 1, y: 0 }, 1, [e]))
      expect(jambsT(e, W)[0], `нажатие ${i}`).toBeCloseTo(385 + i, 6)
    }
    expect(jambsT(e, W)[1]).toBeCloseTo(510, 6)
    expect(arrowSlide(e, walls, { x: 1, y: 0 }, 1, [e])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("T-14b: стрелка с шагом 10 от x 380…500 — одно нажатие до x 390…510, а не остановка на оси (x = 500)", () => {
    const { walls, W } = sceneF()
    const e = win("W", "a", 380, 120, 150, 85, "e0")
    const next = applied(arrowSlide(e, walls, { x: 1, y: 0 }, 10, [e]))
    expect(jambsT(next, W)[1]).toBeCloseTo(510, 6)
    expect(arrowSlide(next, walls, { x: 1, y: 0 }, 10, [next])).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("T-14c: стрелка влево от x 390…510 сдвигает окно на 10 см: x 380…500", () => {
    const { walls, W } = sceneF()
    const e = win("W", "b", -10, 120, 150, 85, "e0")
    const next = applied(arrowSlide(e, walls, { x: -1, y: 0 }, 10, [e]))
    expect(jambsT(next, W)[0]).toBeCloseTo(380, 6)
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(0, 6)
  })
})

describe("призрак установки у стыка", () => {
  it("T-13: призрак окна при курсоре (495, 0) — x 390…510, привязка b, смещение −10", () => {
    const { walls, W } = sceneF()
    const g = placeWindow(W, walls, { x: 495, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.wallId).toBe("W")
    expect(g.anchor).toBe("b")
    expect(g.offsetCm).toBeCloseTo(-10, 6)
    expect(jambsT(g, W)[1]).toBeCloseTo(510, 6)
    expect(doorwayHolds(g, walls, [g])).toBe(true)
  })

  it("T-13b: курсор за стыком, над C (650, 0), — призрак остаётся на W у стыка, x 390…510", () => {
    const { walls, W } = sceneF()
    const g = placeWindow(W, walls, { x: 650, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.wallId).toBe("W")
    expect(jambsT(g, W)[1]).toBeCloseTo(510, 6)
  })

  it("T-13c: курсор в середине стены (300, 0) — призрак по центру курсора, x 240…360; ближний к откосу конец b (140 до оси), привязка b", () => {
    const { walls, W } = sceneF()
    const g = placeWindow(W, walls, { x: 300, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(jambsT(g, W)[0]).toBeCloseTo(240, 6)
    expect(jambsT(g, W)[1]).toBeCloseTo(360, 6)
    expect(g.anchor).toBe("b")
    expect(g.offsetCm).toBeCloseTo(140, 6)
  })

  it("T-13d: призраки проёма и двери у стыка — x 420…510 при ширине 90", () => {
    const { walls, W } = sceneF()
    const p = placeDoorway(W, walls, { x: 495, y: 0 }, 90, 210, "p", [])
    const d = placeDoor(W, walls, { x: 495, y: 0 }, 90, 210, "a", "left", "d", [])
    for (const g of [p, d]) {
      expect(g).not.toBeNull()
      if (!g) continue
      expect(jambsT(g, W)[0]).toBeCloseTo(420, 6)
      expect(jambsT(g, W)[1]).toBeCloseTo(510, 6)
    }
  })
})

describe("граница на конце оси при другом порядке рисования", () => {
  it("T-15: сцена G — ввод 0 справа: откос на x = 500, привязка b, смещение 0", () => {
    const { walls, W } = sceneG()
    const e = winMid()
    const next = applied(setDistance(e, walls, PLUS, "b", 0, [e]))
    expect(next.anchor).toBe("b")
    expect(next.offsetCm).toBeCloseTo(0, 6)
    expect(jambsT(next, W)[1]).toBeCloseTo(500, 6)
    const d = distancesFor(next, walls)
    expect(d[1]).toBeCloseTo(0, 3)
    expect(d[3]).toBeCloseTo(0, 3)
  })

  it("T-15b: сцена G — перетаскивание далеко вправо останавливается на x = 500, смещение справа не отрицательное", () => {
    const { walls, W } = sceneG()
    const e = winMid()
    const next = applied(slideDoorway(e, walls, { x: 900, y: 0 }, [e]))
    expect(jambsT(next, W)[1]).toBeCloseTo(500, 6)
    expect(next.offsetCm).toBeCloseTo(380, 6)
  })

  it("T-15c: сцена G — призрак у стыка: x 380…500, привязка b, смещение 0", () => {
    const { walls, W } = sceneG()
    const g = placeWindow(W, walls, { x: 495, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.anchor).toBe("b")
    expect(g.offsetCm).toBeCloseTo(0, 6)
  })

  it("T-15d: сцена G — подпись до правки: расстояние справа 80 см (до конца оси)", () => {
    const { walls } = sceneG()
    expect(distancesFor(winMid(), walls)[1]).toBeCloseTo(80, 3)
  })
})

describe("концы без продолжения и с продолжением того же материала", () => {
  it("T-16: сцена FM — перетаскивание далеко вправо останавливается на конце оси W (x = 500), не заходит на W2", () => {
    const { walls, W } = sceneFM()
    const e = winMid()
    const next = applied(slideDoorway(e, walls, { x: 2000, y: 0 }, [e]))
    expect(next.wallId).toBe("W")
    expect(jambsT(next, W)[1]).toBeCloseTo(500, 6)
    expect(next.offsetCm).toBeCloseTo(380, 6)
  })

  it("T-16b: сцена FM — перетаскивание далеко влево доходит до стыка с бетоном: x = −10, смещение −10", () => {
    const { walls, W } = sceneFM()
    const e = winMid()
    const next = applied(slideDoorway(e, walls, { x: -2000, y: 0 }, [e]))
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    expect(jambsT(next, W)[0]).toBeCloseTo(-10, 6)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("T-16c: сцена FM — ввод 0 справа даёт откос на x = 500 (смещение 0), ввод 0 слева — на x = −10 (смещение −10)", () => {
    const { walls } = sceneFM()
    const e = winMid()
    const right = applied(setDistance(e, walls, PLUS, "b", 0, [e]))
    expect(right.anchor).toBe("b")
    expect(right.offsetCm).toBeCloseTo(0, 6)
    const left = applied(setDistance(e, walls, PLUS, "a", 0, [e]))
    expect(left.anchor).toBe("a")
    expect(left.offsetCm).toBeCloseTo(-10, 6)
  })

  it("T-16d: сцена FM — ввод слишком большого расстояния справа не выводит окно за конец оси W на W2", () => {
    const { walls, W } = sceneFM()
    const e = winMid()
    const next = applied(setDistance(e, walls, PLUS, "a", 5000, [e]))
    expect(next.wallId).toBe("W")
    expect(jambsT(next, W)[1]).toBeLessThanOrEqual(500 + 1e-9)
  })

  it("T-16e: сцена FM — ширина с привязкой b не заходит за конец оси W на W2", () => {
    const { walls, W } = sceneFM()
    const e = win("W", "b", 0, 120, 150, 85, "e0")
    const next = applied(setWidth(e, walls, 5000, [e]))
    expect(jambsT(next, W)[1]).toBeCloseTo(500, 6)
    expect(jambsT(next, W)[0]).toBeGreaterThanOrEqual(-10 - 1e-9)
  })
})

describe("выступ у конца a (зеркало сцены F)", () => {
  it("T-17a: ввод 0 слева — откос на x = 190, привязка a, смещение −10", () => {
    const { walls, W } = sceneFa()
    const e = win("W", "a", 100, 120, 150, 85, "e0")
    const next = applied(setDistance(e, walls, PLUS, "a", 0, [e]))
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    expect(jambsT(next, W)[0]).toBeCloseTo(-10, 6)
    expect(distancesFor(next, walls)[0]).toBeCloseTo(0, 3)
    expect(distancesFor(next, walls)[2]).toBeCloseTo(0, 3)
    expect(doorwayHolds(next, walls, [next])).toBe(true)
  })

  it("T-17b: перетаскивание далеко влево — откос на стыке, не заходит на C", () => {
    const { walls, W } = sceneFa()
    const e = win("W", "a", 100, 120, 150, 85, "e0")
    const next = applied(slideDoorway(e, walls, { x: -1000, y: 0 }, [e]))
    expect(next.wallId).toBe("W")
    expect(jambsT(next, W)[0]).toBeCloseTo(-10, 6)
  })

  it("T-17c: призрак у стыка слева (курсор x = 195) — привязка a, смещение −10", () => {
    const { walls, W } = sceneFa()
    const g = placeWindow(W, walls, { x: 195, y: 0 }, 120, 150, 85, "g", [])
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.anchor).toBe("a")
    expect(g.offsetCm).toBeCloseTo(-10, 6)
  })
})

describe("все виды элементов", () => {
  const kinds = ["doorway", "door", "window"] as const
  const make = (kind: (typeof kinds)[number]): WallElement => {
    if (kind === "window") return win("W", "a", 300, 120, 150, 85, "e0")
    if (kind === "door") return dr("W", "a", 300, "a", "left", 120, 210, "e0")
    return door("W", "a", 300, 120, 210, "e0")
  }

  it.each(kinds)("T-20: %s — ввод 0 справа, перетаскивание и стрелки доводят откос до x = 510", (kind) => {
    const { walls, W } = sceneF()
    const e = make(kind)
    const typed = applied(setDistance(e, walls, PLUS, "b", 0, [e]))
    expect(jambsT(typed, W)[1], "ввод").toBeCloseTo(510, 6)
    expect(typed.offsetCm).toBeCloseTo(-10, 6)
    const dragged = applied(slideDoorway(e, walls, { x: 900, y: 0 }, [e]))
    expect(jambsT(dragged, W)[1], "перетаскивание").toBeCloseTo(510, 6)
    const near = { ...e, offsetCm: 385 }
    let stepped: WallElement = near
    for (let i = 0; i < 5; i++) stepped = applied(arrowSlide(stepped, walls, { x: 1, y: 0 }, 1, [stepped]))
    expect(jambsT(stepped, W)[1], "стрелки").toBeCloseTo(510, 6)
    expect(arrowSlide(stepped, walls, { x: 1, y: 0 }, 1, [stepped])).toEqual({ kind: "rejected", reason: "no-change" })
    for (const r of [typed, dragged, stepped]) {
      expect(r.kind).toBe(kind === "doorway" ? undefined : kind)
      expect(doorwayHolds(r, walls, [r])).toBe(true)
    }
  })

  it.each(kinds)("T-20b: %s — ни одно значение не выводит элемент за тело W (0…510) и не меняет стену и ширину", (kind) => {
    const { walls, W } = sceneF()
    const e = make(kind)
    for (const side of [PLUS, MINUS] as const)
      for (const toward of ["a", "b"] as const)
        for (const v of [0, 1, 50, 100, 239, 240, 241, 390, 570, 1000, 5000]) {
          const r = setDistance(e, walls, side, toward, v, [e])
          if (r.kind !== "applied") continue
          const [j1, j2] = jambsT(r.doorway, W)
          const tag = `${kind} side=${side} toward=${toward} v=${v}`
          expect(r.doorway.wallId, tag).toBe("W")
          expect(j1, tag).toBeGreaterThanOrEqual(-1e-9)
          expect(j2, tag).toBeLessThanOrEqual(510 + 1e-9)
          expect(r.doorway.widthCm, tag).toBeCloseTo(120, 6)
          expect(doorwayHolds(r.doorway, walls, [r.doorway]), tag).toBe(true)
        }
    for (const v of [1, 100, 300, 1000, 5000]) {
      const r = setWidth(e, walls, v, [e])
      if (r.kind !== "applied") continue
      const [j1, j2] = jambsT(r.doorway, W)
      expect(j1, `width ${v}`).toBeGreaterThanOrEqual(-1e-9)
      expect(j2, `width ${v}`).toBeLessThanOrEqual(510 + 1e-9)
    }
  })
})

describe("соседние элементы и нарушенные документы", () => {
  it("T-21: проём у стыка и окно рядом не налагаются: окно у стыка (390…510) блокирует проём x 300…390 справа", () => {
    const { walls } = sceneF()
    const o = door("W", "a", 300, 90, 210, "d1")
    const wnd = win("W", "b", -10, 120, 150, 85, "e0")
    const els: WallElement[] = [o, wnd]
    expect(doorwayHolds(o, walls, els)).toBe(true)
    expect(doorwayHolds(wnd, walls, els)).toBe(true)
    expect(slideDoorway(o, walls, { x: 500, y: 0 }, els)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(slideDoorway(wnd, walls, { x: -5, y: 0 }, els)).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("T-21b: у стыка осталось 90 см (проём 330…420) — окно 120 см не помещается там и встаёт левее проёма, x 210…330", () => {
    const { walls, W } = sceneF()
    const o = door("W", "a", 330, 90, 210, "d1")
    const g = placeWindow(W, walls, { x: 495, y: 0 }, 120, 150, 85, "g", [o])
    expect(g).not.toBeNull()
    if (!g) return
    expect(doorwayHolds(g, walls, [o, g])).toBe(true)
    expect(jambsT(g, W)[0]).toBeCloseTo(210, 6)
    expect(jambsT(g, W)[1]).toBeCloseTo(330, 6)
  })

  it("T-21c: у стыка остался участок 90 см (проём 330…420) — проём шириной 90 ставится вплотную к стыку, x 420…510", () => {
    const { walls, W } = sceneF()
    const o = door("W", "a", 330, 90, 210, "d1")
    const g = placeDoorway(W, walls, { x: 495, y: 0 }, 90, 210, "g", [o])
    expect(g).not.toBeNull()
    if (!g) return
    expect(jambsT(g, W)[0]).toBeCloseTo(420, 6)
    expect(jambsT(g, W)[1]).toBeCloseTo(510, 6)
  })

  it("T-22: нарушенный документ — окно на свободном торце с смещением −50 не углубляется влево и записи не создаёт", () => {
    const { walls } = sceneF()
    const e = win("W", "a", -50, 120, 150, 85, "e0")
    const before = doorwayViolation(e, walls, [e])
    expect(before).toBeGreaterThan(0)
    const r = slideDoorway(e, walls, { x: -100, y: 0 }, [e])
    if (r.kind === "applied") expect(doorwayViolation(r.doorway, walls, [r.doorway])).toBeLessThanOrEqual(before + 1e-9)
    else expect(r).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("T-27b: окно, проём и дверь со смещением −1 на свободной стене (сцена без выступа) не блокируют правки и не углубляют нарушение", () => {
    const { walls } = sceneG()
    const els: WallElement[] = [
      win("W", "a", -1, 120, 150, 85, "w2"),
      door("W", "a", -1, 90, 210, "o2"),
      dr("W", "a", -1, "a", "left", 90, 210, "d2"),
    ]
    for (const e of els) {
      const before = doorwayViolation(e, walls, [e])
      expect(before, e.id).toBeGreaterThan(0)
      const left = slideDoorway(e, walls, { x: -50, y: 0 }, [e])
      if (left.kind === "applied") expect(doorwayViolation(left.doorway, walls, [left.doorway]), `${e.id} влево`).toBeLessThanOrEqual(before + 1e-9)
      const right = slideDoorway(e, walls, { x: 50, y: 0 }, [e])
      expect(right.kind, `${e.id} вправо`).toBe("applied")
      if (right.kind === "applied") expect(doorwayHolds(right.doorway, walls, [right.doorway]), `${e.id} вправо`).toBe(true)
    }
  })

  it("T-22b: нарушенное окно можно вернуть в стену перетаскиванием вправо", () => {
    const { walls } = sceneF()
    const e = win("W", "a", -50, 120, 150, 85, "e0")
    const r = slideDoorway(e, walls, { x: 200, y: 0 }, [e])
    expect(r.kind).toBe("applied")
    if (r.kind === "applied") expect(doorwayHolds(r.doorway, walls, [r.doorway])).toBe(true)
  })
})

describe("чертёж пользователя: окна на блочной стене между бетонными", () => {
  // фрагмент реального чертежа: порядок стен как в документе (бетонная справа раньше, бетонная слева позже)
  const walls: Wall[] = [
    made(w(850.3, 863.65, 770.1, 863.65, "beb2", 19.5), "concrete"),
    made(w(760.1, 863.65, 289.9, 863.65, "cf4f"), "blocks"),
    made(w(279.9, 863.65, 213.7, 863.65, "a37b"), "concrete"),
  ]
  const f9ad = win("cf4f", "a", 0, 151.2, 150, 85, "f9ad")
  const f4c9 = win("cf4f", "b", 5.684341886080802e-14, 148.5, 150, 85, "f4c9")
  const elements: WallElement[] = [f9ad, f4c9]

  it("T-23: подпись у правого окна показывает 10 см до стыка на обеих гранях", () => {
    const d = distancesFor(f9ad, walls, elements)
    expect(d[0]).toBeCloseTo(10, 3)
    expect(d[2]).toBeCloseTo(10, 3)
  })

  it("T-23b: перетаскивание правого окна вправо доводит его до стыка: смещение −10, расстояние 0", () => {
    const next = applied(slideDoorway(f9ad, walls, { x: 500, y: 0 }, elements))
    expect(next.wallId).toBe("cf4f")
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    const d = distancesFor(next, walls, [next, f4c9])
    expect(d[0]).toBeCloseTo(0, 3)
    expect(d[2]).toBeCloseTo(0, 3)
  })

  it("T-23c: ввод 0 в число расстояния до стыка (справа на экране) ставит окно вплотную", () => {
    const next = applied(setDistance(f9ad, walls, PLUS, "a", 0, elements))
    expect(next.anchor).toBe("a")
    expect(next.offsetCm).toBeCloseTo(-10, 6)
    expect(next.widthCm).toBeCloseTo(151.2, 6)
  })

  it("T-23d: левое окно уже у конца оси (граница по порядку стен на оси): перетаскивание влево не меняет его", () => {
    expect(slideDoorway(f4c9, walls, { x: -500, y: 0 }, elements)).toEqual({ kind: "rejected", reason: "no-change" })
  })
})

describe("границы ширины, свободный торец, симметрия привязки", () => {
  it("T-28: ширина вплотную к телу принимается, на 0.01 больше — нет (setWidth и призрак)", () => {
    const { walls, W } = sceneF()
    const flush = win("W", "a", 390, 100, 150, 85, "e0")
    expect(setWidth(flush, walls, 120, [flush]).kind).toBe("applied")
    expect(applied(setWidth(flush, walls, 120, [flush])).widthCm).toBeCloseTo(120, 6)
    expect(applied(setWidth(flush, walls, 120.01, [flush])).widthCm).toBeCloseTo(120, 6)
    const full = placeWindow(W, walls, { x: 250, y: 0 }, 510, 150, 85, "g", [])
    expect(full).not.toBeNull()
    if (full) {
      expect(jambsT(full, W)[0]).toBeCloseTo(0, 6)
      expect(jambsT(full, W)[1]).toBeCloseTo(510, 6)
    }
    expect(placeWindow(W, walls, { x: 250, y: 0 }, 510.01, 150, 85, "g", [])).toBeNull()
  })

  it("T-28b: окно, лежащее только на выступе (ширина 5, x 505…510), допустимо", () => {
    const { walls, W } = sceneF()
    const e = win("W", "b", -10, 5, 150, 85, "e0")
    expect(jambsT(e, W)[0]).toBeCloseTo(505, 6)
    expect(doorwayHolds(e, walls, [e])).toBe(true)
  })

  it("T-29: свободный торец без выступа — ввод 0 слева даёт смещение 0 (не отрицательное), перетаскивание влево остаётся на 0", () => {
    const { walls, W } = sceneG()
    const e = winMid()
    const typed = applied(setDistance(e, walls, PLUS, "a", 0, [e]))
    expect(typed.anchor).toBe("a")
    expect(typed.offsetCm).toBeCloseTo(0, 6)
    const dragged = applied(slideDoorway(e, walls, { x: -2000, y: 0 }, [e]))
    expect(dragged.offsetCm).toBeCloseTo(0, 6)
    expect(jambsT(dragged, W)[0]).toBeCloseTo(0, 6)
  })

  it("T-29b: продолжение того же материала слева, выступ справа — перетаскивание влево останавливается на x = 0 (смещение 0), вправо доходит до стыка x = 510", () => {
    const N = made(w(0, 0, -200, 0, "N"), "blocks")
    const { walls: base, W } = sceneF()
    const walls = [...base, N]
    const e = winMid()
    const left = applied(slideDoorway(e, walls, { x: -2000, y: 0 }, [e]))
    expect(left.wallId).toBe("W")
    expect(left.offsetCm).toBeCloseTo(0, 6)
    const right = applied(slideDoorway(e, walls, { x: 2000, y: 0 }, [e]))
    expect(jambsT(right, W)[1]).toBeCloseTo(510, 6)
  })

  it("T-30: одно и то же положение через привязки a и b даёт одни откосы и одни расстояния", () => {
    const { walls, W } = sceneF()
    const viaB = win("W", "b", -10, 120, 150, 85, "e0")
    const viaA = win("W", "a", 390, 120, 150, 85, "e0")
    expect(jambsT(viaA, W)[0]).toBeCloseTo(jambsT(viaB, W)[0], 6)
    expect(jambsT(viaA, W)[1]).toBeCloseTo(jambsT(viaB, W)[1], 6)
    const da = distancesFor(viaA, walls)
    const db = distancesFor(viaB, walls)
    for (let i = 0; i < 4; i++) expect(da[i], `расстояние ${i}`).toBeCloseTo(db[i], 3)
  })

  it("T-31: два элемента вплотную у стыка: расстояние между ними 0, оба удовлетворяют инварианту", () => {
    const { walls } = sceneF()
    const o = door("W", "a", 300, 90, 210, "d1")
    const wnd = win("W", "b", -10, 120, 150, 85, "e0")
    const els: WallElement[] = [o, wnd]
    const dO = distancesFor(o, walls, els)
    const dW = distancesFor(wnd, walls, els)
    expect(dO[1]).toBeCloseTo(0, 3)
    expect(dO[3]).toBeCloseTo(0, 3)
    expect(dW[0]).toBeCloseTo(0, 3)
    expect(dW[2]).toBeCloseTo(0, 3)
  })

  it("T-32: значения, близкие к нулю — ввод 1e-9 справа доводит до стыка, а не отклоняется как неверный", () => {
    const { walls } = sceneF()
    const e = winMid()
    const r = setDistance(e, walls, PLUS, "b", 1e-9, [e])
    expect(r.kind).toBe("applied")
    if (r.kind === "applied") expect(r.doorway.offsetCm).toBeCloseTo(-10, 6)
  })

  it("T-20c: каждая группа значений даёт применённую правку, а не пустое отклонение (защита от «всегда rejected»)", () => {
    const { walls } = sceneF()
    const e = winMid()
    let appliedCount = 0
    for (const side of [PLUS, MINUS] as const)
      for (const toward of ["a", "b"] as const)
        for (const v of [0, 50, 100, 240]) if (setDistance(e, walls, side, toward, v, [e]).kind === "applied") appliedCount++
    expect(appliedCount).toBe(16)
  })
})

describe("комната из стен, нарисованных по одной: окно у границы материала в обоих порядках", () => {
  // верхняя стена комнаты 700×400: блочная W (0,0)-(500,0) и бетонная C (510,0)-(700,0); окно на W
  const room = (order: "C-first" | "W-first") => {
    const C = made(w(510, 0, 700, 0, "C"), "concrete")
    const W = made(w(0, 0, 500, 0, "W"), "blocks")
    const R = w(700, 0, 700, 400, "R")
    const B = w(700, 400, 0, 400, "B")
    const L = w(0, 400, 0, 0, "L")
    return order === "C-first" ? { walls: [C, W, R, B, L], W } : { walls: [W, C, R, B, L], W }
  }

  it("T-33: после каждой добавленной стены окно x 390…510 (C раньше) допустимо; при W раньше граница на x = 500", () => {
    const e = win("W", "b", -10, 120, 150, 85, "e0")
    const c = room("C-first")
    for (let n = 2; n <= 5; n++) expect(doorwayHolds(e, c.walls.slice(0, n), [e]), `C раньше, стен ${n}`).toBe(true)
    const wf = room("W-first")
    const typed = applied(setDistance(win("W", "a", 300, 120, 150, 85, "e1"), wf.walls, PLUS, "b", 0, [win("W", "a", 300, 120, 150, 85, "e1")]))
    expect(jambsT(typed, wf.W)[1]).toBeCloseTo(500, 6)
    const typedC = applied(setDistance(win("W", "a", 300, 120, 150, 85, "e1"), c.walls, PLUS, "b", 0, [win("W", "a", 300, 120, 150, 85, "e1")]))
    expect(jambsT(typedC, c.W)[1]).toBeCloseTo(510, 6)
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

  const numberOf = (host: ReturnType<typeof fakeHost>, target: EditableNumber["target"]): EditableNumber => {
    const e = host.state.selected[0]
    const list = editableNumbers(e, host.walls(), host.state.elements, findRooms(host.walls()), "cm", PX_PER_CM, LABEL_PX)
    const hit = list.find((n) => JSON.stringify(n.target) === JSON.stringify(target))
    if (!hit) throw new Error(`нет числа ${JSON.stringify(target)}`)
    return hit
  }

  it("T-24: число расстояния справа, ввод 0 — одна запись в истории, окно у стыка, число показывает 0", () => {
    const { walls } = sceneF()
    const e = winMid()
    const host = fakeHost(walls, [e], [e])
    const editing = createSelectionEditing(host)
    const right = { kind: "distance", side: PLUS, part: "b" } as const
    expect(editing.pressNumber(numberOf(host, right).center)).toBe(true)
    expect(editors[editors.length - 1].value).toBe("90")
    const input = editors[editors.length - 1]
    input.value = "0"
    input.key("Enter")
    const after = byId(host.state.elements, "e0")
    expect(after.anchor).toBe("b")
    expect(after.offsetCm).toBeCloseTo(-10, 6)
    expect(host.state.records).toBe(1)
    expect(host.state.calls).toEqual(["record", "replace"])
    expect(numberOf(host, right).text).toBe("0")
    expect(doorwayHolds(after, walls, host.state.elements)).toBe(true)
  })
})
