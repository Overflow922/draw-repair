import { describe, expect, it } from "vitest"
import type { WallElement } from "../types"
import { W, drawing, mark, opening, wall, windowAt } from "./mounting.test-utils"
import { mountingScene } from "./mounting-scene"
import { openWorkspace, storedContent } from "./mounting-workspace"
import { made, sceneF, sceneFa } from "../doorway/opening-reach-body-end.test-utils"

// change fix-opening-reach-body-end (test-plan T-26, дельта mounting-plan «Старые элементы стены на плане «Монтаж»»,
// «Элементы и размеры на остатках»; design D4a): остаток включает выступ тела стены за конец оси там, где его конец
// совпадает с концом исходной стены. Сцена F: блочная W (0,0)-(500,0), бетонная C (510,0)-(700,0) раньше, тело W до x = 510;
// Fa — зеркало: W (200,0)-(700,0), бетонная C (0,0)-(190,0) раньше, тело W от x = 190.

describe("старый элемент на выступе тела на плане «Монтаж»", () => {
  const { walls } = sceneF()
  const onOverhang: WallElement = windowAt("e0", "W", "b", -10, 120)

  it("T-26: без сноса окно на выступе у конца b видно на остатке W~0 с тем же смещением −10", () => {
    const s = mountingScene(drawing({ walls, doorways: [onOverhang] }))
    expect(s.doorways).toEqual([{ ...onOverhang, wallId: "W~0", offsetCm: -10 }])
  })

  it("T-26b: рабочий набор показывает смещение −10, а хранимое представление не копирует старый элемент", () => {
    const d = drawing({ walls, doorways: [onOverhang] })
    const { scene, workspace } = openWorkspace(d)
    expect(scene.doorways.map((e) => e.offsetCm)).toEqual([-10])
    expect(storedContent(scene, workspace, d).doorways ?? []).toEqual([])
  })

  it("T-26e: зеркало — окно на выступе у конца a (откосы x 190…310, привязка a, смещение −10) видно на остатке", () => {
    const fa = sceneFa()
    const e: WallElement = windowAt("e0", "W", "a", -10, 120)
    const s = mountingScene(drawing({ walls: fa.walls, doorways: [e] }))
    expect(s.doorways).toEqual([{ ...e, wallId: "W~0", offsetCm: -10 }])
  })

  it("T-26f: снос в стороне (x 0…50 у начала W) оставляет проём на выступе у конца b видимым на остатке W~500 со смещением −10", () => {
    const o = opening("o", "W", "b", -10, 90)
    const s = mountingScene(drawing({ walls, doorways: [o], demolition: [mark("m", "W", "a", 0, 50)] }))
    expect(s.doorways).toEqual([{ ...o, wallId: "W~500", offsetCm: -10 }])
  })

  it("T-26d: снос, задевающий проём на выступе (проём x 420…510, пометка x 450…500), скрывает проём", () => {
    const o = opening("o", "W", "b", -10, 90)
    const s = mountingScene(drawing({ walls, doorways: [o], demolition: [mark("m", "W", "a", 450, 500)] }))
    expect(s.doorways).toEqual([])
  })

  it("T-26d2: без сноса тот же проём на выступе виден", () => {
    const o = opening("o", "W", "b", -10, 90)
    expect(mountingScene(drawing({ walls, doorways: [o] })).doorways).toEqual([{ ...o, wallId: "W~0", offsetCm: -10 }])
  })

  it("T-26g: за концом тела без стыка продолжения нет — окно со смещением −5 на свободной стене не показано", () => {
    const e: WallElement = windowAt("e0", "W", "b", -5, 120)
    expect(mountingScene(drawing({ walls: [W()], doorways: [e] })).doorways).toEqual([])
  })

  it("T-26h: стена без выступа у конца оси — смещение 0 по-прежнему видно, а на 0.5 см за конец — нет", () => {
    const inside: WallElement = windowAt("e0", "W", "b", 0, 120)
    const beyond: WallElement = windowAt("e1", "W", "b", -0.5, 120)
    expect(mountingScene(drawing({ walls: [W()], doorways: [inside] })).doorways.map((e) => e.id)).toEqual(["e0"])
    expect(mountingScene(drawing({ walls: [W()], doorways: [beyond] })).doorways).toEqual([])
  })

  it("T-26i: пометка x 400…450 делит остаток; проём x 390…510 на выступе задет сносом и не показан", () => {
    const o = opening("o", "W", "b", -10, 120)
    const s = mountingScene(drawing({ walls, doorways: [o], demolition: [mark("m", "W", "a", 400, 450)] }))
    expect(s.doorways).toEqual([])
  })

  it("T-26k: окно частично за телом стены (смещение −15, x 395…515, выступ 10 см) не показано — сцена F", () => {
    const e: WallElement = windowAt("e0", "W", "b", -15, 120)
    expect(mountingScene(drawing({ walls, doorways: [e] })).doorways).toEqual([])
  })

  it("T-26l: то же у конца a (зеркало Fa, смещение −15) не показано", () => {
    const e: WallElement = windowAt("e0", "W", "a", -15, 120)
    expect(mountingScene(drawing({ walls: sceneFa().walls, doorways: [e] })).doorways).toEqual([])
  })

  it("T-26m: предел — реальный выступ: при выступе 5 см проём со смещением −5 показан, −6 — нет", () => {
    const C = made(wall("C", 505, 0, 700, 0), "concrete")
    const blocks = made(wall("W", 0, 0, 500, 0), "blocks")
    const five = [C, blocks]
    const at5 = opening("o5", "W", "b", -5, 90)
    const at6 = opening("o6", "W", "b", -6, 90)
    expect(mountingScene(drawing({ walls: five, doorways: [at5] })).doorways).toEqual([{ ...at5, wallId: "W~0", offsetCm: -5 }])
    expect(mountingScene(drawing({ walls: five, doorways: [at6] })).doorways).toEqual([])
  })

  it("T-26n: при выступе 10 см проём со смещением −10 показан, −11 — нет (предел не меньше и не больше реального)", () => {
    const at10 = opening("o10", "W", "b", -10, 90)
    const at11 = opening("o11", "W", "b", -11, 90)
    expect(mountingScene(drawing({ walls, doorways: [at10] })).doorways.map((e) => e.id)).toEqual(["o10"])
    expect(mountingScene(drawing({ walls, doorways: [at11] })).doorways).toEqual([])
  })
})

describe("собственный элемент «Монтажа» на выступе тела", () => {
  const { walls } = sceneF()
  const own: WallElement = windowAt("m0", "W", "b", -10, 120)

  it("T-26c: собственное окно на стене обмера на выступе показано на остатке и сохраняется со смещением −10 на W", () => {
    const d = drawing({ walls, doorways: [], mounting: { walls: [], dimensions: [], doorways: [own] } })
    const s = mountingScene(d)
    expect(s.doorways).toEqual([{ ...own, wallId: "W~0", offsetCm: -10 }])
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d).doorways).toEqual([own])
  })

  it("T-26j: собственное окно за концом тела (свободная стена, смещение −5) в сцене не показано, но остаётся в хранилище", () => {
    const e: WallElement = windowAt("m1", "W", "b", -5, 120)
    const d = drawing({ walls: [W()], doorways: [], mounting: { walls: [], dimensions: [], doorways: [e] } })
    expect(mountingScene(d).doorways).toEqual([])
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d).doorways).toEqual([e])
  })
})
