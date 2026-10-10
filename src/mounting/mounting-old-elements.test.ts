import { describe, expect, it } from "vitest"
import type { WallElement } from "../types"
import { W, drawing, mark, opening, wall, windowAt } from "./mounting.test-utils"
import { mountingScene } from "./mounting-scene"

// change mounting-plan: проёмы, двери и окна обмера на плане «Монтаж» — только если целиком на остатке; всё, что задел
// снос, не показывается (spec mounting-plan «Старые элементы стены на плане «Монтаж»»; design D3).
// Проём o на W: привязка a, смещение 200, ширина 90 — полоса [200, 290].

const O = opening("o", "W", "a", 200)

const sceneWith = (marks: ReturnType<typeof mark>[], doorways: WallElement[] = [O]) => mountingScene(drawing({ doorways, demolition: marks }))

describe("видимость старых проёмов", () => {
  it("MP-40: снос не задевает проём — проём виден, разрешён на остаток W~0 с прежним смещением", () => {
    const s = sceneWith([mark("m", "W", "a", 350, 450)])
    expect(s.doorways).toEqual([{ ...O, wallId: "W~0", offsetCm: 200 }])
  })

  it("MP-40: без пометок проём виден на W~0", () => {
    expect(sceneWith([]).doorways).toEqual([{ ...O, wallId: "W~0", offsetCm: 200 }])
  })

  it("MP-40: снос слева от проёма (100–190) — проём виден на остатке W~1900, смещение 10", () => {
    const s = sceneWith([mark("m", "W", "a", 100, 190)])
    expect(s.doorways).toEqual([{ ...O, wallId: "W~1900", offsetCm: 10 }])
  })

  it("MP-41: проём целиком в зоне сноса (100–400) не показан", () => {
    expect(sceneWith([mark("m", "W", "a", 100, 400)]).doorways).toEqual([])
  })

  it("MP-42: проём задет частично (снос 250–400) не показан", () => {
    expect(sceneWith([mark("m", "W", "a", 250, 400)]).doorways).toEqual([])
  })

  it("MP-42: проём задет с другой стороны (снос 100–250) не показан", () => {
    expect(sceneWith([mark("m", "W", "a", 100, 250)]).doorways).toEqual([])
  })

  it("MP-43: снос касается проёма справа (290–400) — проём не показан", () => {
    expect(sceneWith([mark("m", "W", "a", 290, 400)]).doorways).toEqual([])
  })

  it("MP-43: снос касается проёма слева (100–200) — проём не показан", () => {
    expect(sceneWith([mark("m", "W", "a", 100, 200)]).doorways).toEqual([])
  })

  it("MP-43: зазор между сносом и проёмом больше допуска 0,01 см (290,02–400) — проём виден", () => {
    expect(sceneWith([mark("m", "W", "a", 290.02, 400)]).doorways.map((d) => d.id)).toEqual(["o"])
  })

  it("MP-43: зазор между сносом и проёмом слева больше допуска (100–199,98) — проём виден", () => {
    expect(sceneWith([mark("m", "W", "a", 100, 199.98)]).doorways.map((d) => d.id)).toEqual(["o"])
  })

  it("MP-43: снос на другой части стены не мешает: проём виден, а второй проём в зоне сноса — нет", () => {
    const o2 = opening("o2", "W", "a", 400, 50)
    const s = sceneWith([mark("m", "W", "a", 380, 480)], [O, o2])
    expect(s.doorways.map((d) => d.id)).toEqual(["o"])
  })

  it("MP-43: любая из двух пометок, задевающая проём, скрывает его", () => {
    const s = sceneWith([mark("m1", "W", "a", 0, 50), mark("m2", "W", "a", 280, 300)])
    expect(s.doorways).toEqual([])
  })

  it("MP-43: привязка b — полоса считается от конца b: проём b, смещение 10, ширина 90 — [400,490]; снос 100–190 не задевает", () => {
    const ob = opening("ob", "W", "b", 10)
    expect(sceneWith([mark("m", "W", "a", 100, 190)], [ob]).doorways).toEqual([{ ...ob, wallId: "W~1900", offsetCm: 10 }])
  })

  it("MP-43: привязка b — снос a 450–500 касается/задевает полосу [400,490] и скрывает проём", () => {
    const ob = opening("ob", "W", "b", 10)
    expect(sceneWith([mark("m", "W", "a", 450, 500)], [ob]).doorways).toEqual([])
  })

  it("MP-43: привязка b — снос a 495–500 не задевает полосу [400,490]; смещение пересчитано от конца b остатка (5)", () => {
    const ob = opening("ob", "W", "b", 10)
    expect(sceneWith([mark("m", "W", "a", 495, 500)], [ob]).doorways).toEqual([{ ...ob, wallId: "W~0", offsetCm: 5 }])
  })
})

describe("несколько стен в чертеже", () => {
  // V — вторая стена (0,100)-(500,100); проём ov на V — привязка a, смещение 200, ширина 90 (полоса [200,290])
  const V = wall("V", 0, 100, 500, 100)
  const ov = opening("ov", "V", "a", 200)
  const multi = (marks: ReturnType<typeof mark>[], doorways: WallElement[]) => mountingScene(drawing({ walls: [W(), V], doorways, demolition: marks }))

  it("MP-48: проём на второй стене разрешается на остаток второй стены, а не первой", () => {
    expect(multi([], [ov]).doorways).toEqual([{ ...ov, wallId: "V~0", offsetCm: 200 }])
  })

  it("MP-48: проёмы двух стен разрешаются каждый на остаток своей стены, порядок исходный", () => {
    const s = multi([mark("m", "W", "a", 100, 190)], [O, ov])
    expect(s.doorways).toEqual([
      { ...O, wallId: "W~1900", offsetCm: 10 },
      { ...ov, wallId: "V~0", offsetCm: 200 },
    ])
  })

  it("MP-49: пометка на V вне полосы проёма V не скрывает ни один из двух проёмов", () => {
    const s = multi([mark("m", "V", "a", 350, 450)], [O, ov])
    expect(s.doorways).toEqual([
      { ...O, wallId: "W~0", offsetCm: 200 },
      { ...ov, wallId: "V~0", offsetCm: 200 },
    ])
  })

  it("MP-49: пометка на W не скрывает проём на V с той же полосой", () => {
    const s = multi([mark("m", "W", "a", 250, 400)], [O, ov])
    expect(s.doorways).toEqual([{ ...ov, wallId: "V~0", offsetCm: 200 }])
  })

  it("MP-49: проём на V, задетый пометкой V, скрыт, а проём на W остаётся", () => {
    const s = multi([mark("m", "V", "a", 250, 400)], [O, ov])
    expect(s.doorways).toEqual([{ ...O, wallId: "W~0", offsetCm: 200 }])
    expect(s.oldElementIds.has("ov")).toBe(false)
  })
})

describe("допуск касания", () => {
  it("MP-43: зазор 0,005 см между проёмом и сносом не больше допуска — проём скрыт", () => {
    expect(sceneWith([mark("m", "W", "a", 290.005, 400)]).doorways).toEqual([])
  })

  it("MP-43: зазор 0,005 см с другой стороны (снос до 199,995) — проём скрыт", () => {
    expect(sceneWith([mark("m", "W", "a", 100, 199.995)]).doorways).toEqual([])
  })
})

describe("видимость старых окон и дверей", () => {
  it("MP-44: окно на стене видно: окно блокирует снос своего участка, поэтому остаток всегда содержит окно", () => {
    const win = windowAt("win", "W", "a", 200)
    const s = sceneWith([mark("m", "W", "a", 100, 190)], [win])
    expect(s.doorways).toEqual([{ ...win, wallId: "W~0", offsetCm: 200 }])
    expect(s.oldElementIds.has("win")).toBe(true)
  })

  it("MP-44: дверь обмера, задетая сносом, не показана; не задетая показана со всеми полями", () => {
    const door = { kind: "door" as const, id: "dr", wallId: "W", anchor: "a" as const, offsetCm: 400, widthCm: 80, heightCm: 210, hinge: "b" as const, swing: "right" as const }
    expect(sceneWith([mark("m", "W", "a", 390, 450)], [door]).doorways).toEqual([])
    expect(sceneWith([mark("m", "W", "a", 100, 190)], [door]).doorways).toEqual([{ ...door, wallId: "W~1900", offsetCm: 210 }])
  })

  it("MP-44: элемент на стене из железобетона (снос недействителен) виден", () => {
    const d = drawing({ walls: [W("reinforced")], doorways: [O], demolition: [mark("m", "W", "a", 100, 400)] })
    expect(mountingScene(d).doorways).toEqual([{ ...O, wallId: "W~0", offsetCm: 200 }])
  })

  it("MP-45: снос снят — ранее скрытый проём виден снова", () => {
    const hidden = sceneWith([mark("m", "W", "a", 250, 400)])
    const back = sceneWith([])
    expect(hidden.doorways).toEqual([])
    expect(back.doorways.map((d) => d.id)).toEqual(["o"])
  })

  it("MP-46: старые элементы помечены для чтения, собственные — нет", () => {
    const own = opening("po", "W", "a", 10)
    const s = mountingScene(drawing({ doorways: [O], demolition: [], mounting: { walls: [], dimensions: [], doorways: [own] } }))
    expect(s.oldElementIds.has("o")).toBe(true)
    expect(s.oldElementIds.has("po")).toBe(false)
  })

  it("MP-46: скрытый старый элемент не попадает в oldElementIds", () => {
    const s = sceneWith([mark("m", "W", "a", 100, 400)])
    expect(s.oldElementIds.has("o")).toBe(false)
  })

  it("MP-46: порядок doorways — сначала старые элементы, затем собственные", () => {
    const own = opening("po", "W", "a", 10)
    const s = mountingScene(drawing({ doorways: [O], mounting: { walls: [], dimensions: [], doorways: [own] } }))
    expect(s.doorways.map((d) => d.id)).toEqual(["o", "po"])
  })

  it("MP-47: старый элемент, ссылающийся на отсутствующую стену, не показывается", () => {
    expect(sceneWith([], [opening("x", "ghost", "a", 10)]).doorways).toEqual([])
  })
})
