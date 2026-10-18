import { describe, expect, it } from "vitest"
import { findRooms } from "../room-area"
import { explicationTable, reconcileRooms } from "../room-explication"
import type { Wall } from "../types"
import { netAreaCm2, netItems } from "./net-area"
import { plasterPieces, plasterStrip } from "./plaster"
import { mountingScene } from "../mounting/mounting-scene"
import { drawing, plaster, r6, rectWalls, wall } from "./rough.test-utils"
import type { PlasterMark } from "../types"

// change add-rough-works-plan: площадь помещения после штукатурки
// (spec room-explication «Экспликация плана «Черновые работы»»)

// комната 4×5 м: внутренняя область [10,410]×[10,510]; у всех стен грань +1 смотрит внутрь комнаты (обход по часовой)
const ROOM = (): Wall[] => rectWalls("k", 0, 0, 420, 520)

const netOf = (walls: Wall[], marks: PlasterMark[]) => {
  const d = drawing({ walls, roughPlaster: marks })
  const scene = mountingScene(d)
  const strips = plasterPieces(d, scene).map(plasterStrip)
  const items = reconcileRooms(findRooms(scene.walls), [])
  return { items, nets: items.map((i) => netAreaCm2(i, strips)), strips }
}

const full = (id: string, wallId: string, len: number, mm = 30): PlasterMark => plaster(id, wallId, 1, "a", 0, len, mm)

describe("площадь после штукатурки", () => {
  it("RW-60: 30 мм на всех четырёх гранях целиком — 3,94 × 4,94 м² = 194 636 см²", () => {
    const marks = [full("a", "k1", 420), full("b", "k2", 520), full("c", "k3", 420), full("d", "k4", 520)]
    const { items, nets } = netOf(ROOM(), marks)
    expect(r6(items[0]!.room.areaCm2)).toBe(200000)
    expect(r6(nets[0]!)).toBe(194636)
  })

  it("RW-61: в таблице экспликации площадь после штукатурки округляется до «19,5»", () => {
    const marks = [full("a", "k1", 420), full("b", "k2", 520), full("c", "k3", 420), full("d", "k4", 520)]
    const { items, strips } = netOf(ROOM(), marks)
    const table = explicationTable(netItems(items, strips))
    expect(table.rows.map((r) => r.area)).toEqual(["19,5"])
    expect(table.total).toBe("19,5")
  })

  it("RW-62: штукатурка на внешней грани (грань −1) не уменьшает площадь помещения", () => {
    const { items, nets } = netOf(ROOM(), [plaster("a", "k1", -1, "a", 0, 420, 30)])
    expect(nets[0]).toBe(items[0]!.room.areaCm2)
  })

  it("RW-63: угол считается один раз: две смежные грани — вычтено 1200 + 1500 − 9 = 2691 см²", () => {
    const { items, nets } = netOf(ROOM(), [full("a", "k1", 420), full("d", "k4", 520)])
    expect(r6(items[0]!.room.areaCm2 - nets[0]!)).toBe(2691)
  })

  it("RW-64: штукатурки нет — площадь равна площади помещения", () => {
    const { items, nets } = netOf(ROOM(), [])
    expect(nets[0]).toBe(items[0]!.room.areaCm2)
  })

  it("RW-65: частичный участок вычитает только свою полосу: 200 см × 3 см = 600 см²", () => {
    const { items, nets } = netOf(ROOM(), [plaster("a", "k1", 1, "a", 100, 300, 30)])
    expect(r6(items[0]!.room.areaCm2 - nets[0]!)).toBe(600)
  })

  it("RW-66: полоса соседнего помещения: перегородка, грань +1 — левая комната теряет 3 × 300 см², правая ничего", () => {
    const walls = [...rectWalls("k", 0, 0, 420, 320), wall("p", 200, 0, 200, 320)]
    const { items, nets } = netOf(walls, [plaster("a", "p", 1, "a", 0, 320, 30)])
    expect(items).toHaveLength(2)
    const left = items.findIndex((i) => i.room.outline.every((p) => p.x <= 200))
    const right = 1 - left
    expect(r6(items[left]!.room.areaCm2 - nets[left]!)).toBe(900)
    expect(nets[right]).toBe(items[right]!.room.areaCm2)
  })

  it("RW-67: остров внутри помещения: полоса на его внешней грани уменьшает помещение; внутри острова — нет", () => {
    const island = rectWalls("i", 150, 100, 250, 200, 20) // обход по часовой: грань +1 смотрит внутрь острова
    const walls = [...rectWalls("k", 0, 0, 420, 320), ...island]
    // грань −1 стены i1 смотрит наружу острова — в помещение; грань +1 — внутрь острова (вне помещения)
    const outside = netOf(walls, [plaster("a", "i1", -1, "a", 0, 100, 30)])
    const insideIsland = netOf(walls, [plaster("a", "i1", 1, "a", 0, 100, 30)])
    const room = outside.items.find((i) => i.room.holes.length === 1)!
    const idx = outside.items.indexOf(room)
    expect(outside.nets[idx]!).toBeLessThan(room.room.areaCm2)
    expect(insideIsland.nets[idx]).toBe(insideIsland.items[idx]!.room.areaCm2)
  })

  it("RW-68: порог экспликации — по площади до штукатурки: помещение 1,02 м² остаётся в экспликации, хотя после штукатурки его площадь меньше 1 м²", () => {
    // внутренняя область 101×101 = 1,0201 м²; штукатурка 20 мм на двух смежных гранях уводит площадь ниже 1 м²
    const walls = rectWalls("s", 0, 0, 121, 121)
    const marks = [full("a", "s1", 121, 20), full("b", "s2", 121, 20)]
    const { items, nets } = netOf(walls, marks)
    expect(items).toHaveLength(1)
    expect(nets[0]!).toBeLessThan(10000)
    expect(nets[0]!).toBeGreaterThan(0)
  })

  it("RW-69: netItems сохраняет состав, номера и данные, меняет только площадь", () => {
    const { items, strips } = netOf(ROOM(), [full("a", "k1", 420)])
    const next = netItems(items, strips)
    expect(next.map((i) => i.record)).toEqual(items.map((i) => i.record))
    expect(next[0]!.room.outline).toEqual(items[0]!.room.outline)
    expect(next[0]!.room.areaCm2).toBeLessThan(items[0]!.room.areaCm2)
  })
})
