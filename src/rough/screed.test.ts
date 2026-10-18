import { describe, expect, it } from "vitest"
import { findRooms } from "../room-area"
import { reconcileRooms } from "../room-explication"
import { activeScreeds, addScreed, removeScreed, setScreedThickness } from "./screed"
import { idGen, rectWalls, screed } from "./rough.test-utils"

// change add-rough-works-plan: стяжка помещения — привязка опорной точкой, постановка, правка
// (spec rough-works-plan «Помещение со стяжкой», «Инструмент «Стяжка»», «Подпись стяжки и правка на месте»)

// комната K: внутренняя область [10,410]×[10,310] (400×300 см = 12 м²)
const roomItems = (walls = rectWalls("k", 0, 0, 420, 320)) => reconcileRooms(findRooms(walls), [])

describe("действующие стяжки", () => {
  it("RW-40: опорная точка внутри помещения — стяжка действует, привязана к помещению", () => {
    const items = roomItems()
    const active = activeScreeds(items, [screed("s", 200, 160, 65)])
    expect(active).toHaveLength(1)
    expect(active[0]?.item).toBe(items[0])
    expect(active[0]?.screed.thicknessMm).toBe(65)
  })

  it("RW-41: опорная точка вне помещений — стяжка не действует", () => {
    expect(activeScreeds(roomItems(), [screed("s", 600, 160)])).toEqual([])
  })

  it("RW-41: опорная точка в теле стены не действует", () => {
    expect(activeScreeds(roomItems(), [screed("s", 5, 160)])).toEqual([])
  })

  it("RW-42: помещения слились — действует более ранняя в списке, остальные спят", () => {
    const items = roomItems()
    const active = activeScreeds(items, [screed("early", 100, 100, 50), screed("late", 300, 200, 65)])
    expect(active.map((a) => a.screed.id)).toEqual(["early"])
  })

  it("RW-43: помещение разделено перегородкой — стяжка у части с опорной точкой", () => {
    const walls = [...rectWalls("k", 0, 0, 420, 320), { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" as const }]
    const items = roomItems(walls)
    expect(items).toHaveLength(2)
    const active = activeScreeds(items, [screed("s", 100, 160)])
    expect(active).toHaveLength(1)
    expect(active[0]?.item.room.outline.every((p) => p.x <= 200)).toBe(true)
  })

  it("RW-44: опорная точка в острове внутри помещения не действует", () => {
    const walls = [...rectWalls("k", 0, 0, 420, 320), ...rectWalls("i", 150, 100, 250, 200, 20)]
    const items = roomItems(walls)
    // точка в острове (внутри коробки из четырёх стен) — вне помещения
    expect(activeScreeds(items, [screed("s", 200, 150)])).toEqual([])
    // точка в помещении вне острова действует
    expect(activeScreeds(items, [screed("t", 60, 60)])).toHaveLength(1)
  })

  it("RW-45: малое помещение (меньше 1 м²) не входит в экспликацию — стяжка в нём не действует", () => {
    const small = rectWalls("s", 0, 0, 110, 110) // внутри 90×90 = 0,81 м²
    expect(activeScreeds(roomItems(small), [screed("s", 55, 55)])).toEqual([])
  })

  it("RW-46: порядок результата — как в списке стяжек", () => {
    const walls = [...rectWalls("k", 0, 0, 420, 320), { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" as const }]
    const items = roomItems(walls)
    const active = activeScreeds(items, [screed("b", 300, 160), screed("a", 100, 160)])
    expect(active.map((a) => a.screed.id)).toEqual(["b", "a"])
  })
})

describe("постановка", () => {
  it("RW-47: клик в помещении без стяжки добавляет стяжку в точке клика с толщиной из панели", () => {
    const next = addScreed([], roomItems(), { x: 210, y: 170 }, 65, idGen())
    expect(next).toEqual([screed("n1", 210, 170, 65)])
  })

  it("RW-48: клик в помещении с действующей стяжкой — тот же массив", () => {
    const list = [screed("s", 200, 160)]
    expect(addScreed(list, roomItems(), { x: 100, y: 100 }, 65, idGen())).toBe(list)
  })

  it("RW-48: клик вне помещений и в теле стены — тот же массив", () => {
    const list: ReturnType<typeof screed>[] = []
    expect(addScreed(list, roomItems(), { x: 600, y: 160 }, 65, idGen())).toBe(list)
    expect(addScreed(list, roomItems(), { x: 5, y: 160 }, 65, idGen())).toBe(list)
  })

  it("RW-49: в помещении с недействующей (спящей) стяжкой новая ставится", () => {
    const list = [screed("sleeping", 600, 160)]
    const next = addScreed(list, roomItems(), { x: 100, y: 100 }, 50, idGen())
    expect(next.map((s) => s.id)).toEqual(["sleeping", "n1"])
  })

  it("RW-50: малое помещение — тот же массив", () => {
    const list: ReturnType<typeof screed>[] = []
    expect(addScreed(list, roomItems(rectWalls("s", 0, 0, 110, 110)), { x: 55, y: 55 }, 50, idGen())).toBe(list)
  })
})

describe("снятие и толщина", () => {
  it("RW-51: removeScreed и неизвестный идентификатор", () => {
    const list = [screed("a", 100, 100), screed("b", 300, 200)]
    expect(removeScreed(list, "a")).toEqual([screed("b", 300, 200)])
    expect(removeScreed(list, "x")).toBe(list)
  })

  it("RW-52: setScreedThickness меняет только толщину; то же значение — тот же массив", () => {
    const list = [screed("a", 100, 100, 50)]
    expect(setScreedThickness(list, "a", 80)).toEqual([screed("a", 100, 100, 80)])
    expect(setScreedThickness(list, "a", 50)).toBe(list)
    expect(setScreedThickness(list, "zz", 80)).toBe(list)
  })
})
