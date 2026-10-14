import { describe, expect, it } from "vitest"
import { deepFreeze, drawing, mark, wall } from "../mounting/mounting.test-utils"
import type { DrawingParts } from "../mounting/mounting.test-utils"
import { mountingScene } from "../mounting/mounting-scene"
import type { Battery, BatteryMark, Dimension, Drawing, MountingContent } from "../types"
import { batteryHolds } from "./battery-geometry"
import { bat } from "./battery.test-utils"

// change add-battery: батареи на плане «Монтаж» — собственные и батареи обмера: условия показа, перенос на остатки
// (spec mounting-plan «Батареи на плане «Монтаж»»; design D7; test-plan B-MNT-*).
// Сцена: стена W (0,0)-(500,0) t20; батарея X на W: привязка a, 100, длина 70 → участок вдоль оси [100,170].
// Идентификатор остатка — `<стена>~<начало в мм>` (spec mounting-plan), как у старых элементов.

const X = bat("W", "a", 100)

interface Parts extends DrawingParts {
  batteries?: Battery[]
  batteryDemolition?: BatteryMark[]
  mounting?: MountingContent
}

const scene = (parts: Parts = {}) => {
  const { batteries, batteryDemolition, ...rest } = parts
  const base = drawing(rest)
  const full: Drawing = { ...base, ...(batteries ? { batteries } : null), ...(batteryDemolition ? { batteryDemolition } : null) }
  return mountingScene(full)
}

const mountingOf = (batteries: Battery[], walls = [] as ReturnType<typeof wall>[]): MountingContent => ({ walls, dimensions: [], batteries })

describe("батареи обмера на «Монтаже»", () => {
  it("B-MNT-4: без сноса батарея показана на остатке W~0 с прежним расстоянием привязки", () => {
    const s = scene({ batteries: [X] })
    expect(s.batteries).toEqual([{ ...X, wallId: "W~0", offsetCm: 100 }])
    expect(s.oldBatteryIds.has("b0")).toBe(true)
  })

  it("B-MNT-5: снос рядом (200–300): батарея [100,170] остаётся на остатке W~0 — [0,200]", () => {
    const s = scene({ batteries: [X], demolition: [mark("m", "W", "a", 200, 300)] })
    expect(s.batteries).toEqual([{ ...X, wallId: "W~0", offsetCm: 100 }])
  })

  it("B-MNT-5b: батарея за зоной сноса [350,420] переносится на остаток W~3000 (начало 300 см) с расстоянием 50", () => {
    const far = bat("W", "a", 350, { id: "far" })
    const s = scene({ batteries: [far], demolition: [mark("m", "W", "a", 200, 300)] })
    expect(s.batteries).toEqual([{ ...far, wallId: "W~3000", offsetCm: 50 }])
  })

  it("B-MNT-6: батарея, помеченная сносом, не показана; снятие пометки возвращает её", () => {
    expect(scene({ batteries: [X], batteryDemolition: [{ id: "m1", batteryId: "b0" }] }).batteries).toEqual([])
    expect(scene({ batteries: [X], batteryDemolition: [] }).batteries).toHaveLength(1)
  })

  it("B-MNT-6b: пометка другой батареи не скрывает эту", () => {
    const Y = bat("W", "a", 300, { id: "y" })
    const s = scene({ batteries: [X, Y], batteryDemolition: [{ id: "m1", batteryId: "y" }] })
    expect(s.batteries.map((b) => b.id)).toEqual(["b0"])
  })

  it("B-MNT-7: снос стены под батареей (150–300 задевает участок [100,170]) скрывает её", () => {
    expect(scene({ batteries: [X], demolition: [mark("m", "W", "a", 150, 300)] }).batteries).toEqual([])
  })

  it("B-MNT-8: снос в стороне (200–300) батарею не скрывает", () => {
    expect(scene({ batteries: [X], demolition: [mark("m", "W", "a", 200, 300)] }).batteries).toHaveLength(1)
  })

  it("B-MNT-9: граница сноса касается торца (170–300) — батарея скрыта, как и у элементов стены", () => {
    expect(scene({ batteries: [X], demolition: [mark("m", "W", "a", 170, 300)] }).batteries).toEqual([])
  })

  it("B-MNT-9b: граница сноса касается другого торца (0–100) — батарея скрыта", () => {
    expect(scene({ batteries: [X], demolition: [mark("m", "W", "a", 0, 100)] }).batteries).toEqual([])
  })

  it("B-MNT-9c: зазор 1 см до сноса (0–99) — батарея видна", () => {
    expect(scene({ batteries: [X], demolition: [mark("m", "W", "a", 0, 99)] }).batteries).toHaveLength(1)
  })

  it("B-MNT-9d: стена снесена целиком — батареи нет", () => {
    expect(scene({ batteries: [X], demolition: [mark("m", "W", "a", 0, 500)] }).batteries).toEqual([])
  })

  it("B-MNT-9e: батарея с привязкой b: участок считается от конца b: [330,400]; снос 0–330 касается — скрыта, 0–329 — видна", () => {
    const fromB = bat("W", "b", 100, { id: "rb" })
    expect(scene({ batteries: [fromB], demolition: [mark("m", "W", "a", 0, 330)] }).batteries).toEqual([])
    expect(scene({ batteries: [fromB], demolition: [mark("m", "W", "a", 0, 329)] }).batteries).toHaveLength(1)
  })

  it("B-MNT-9f: батарея на отсутствующей стене не показана", () => {
    expect(scene({ batteries: [bat("Z", "a", 100)] }).batteries).toEqual([])
  })

  it("B-MNT-9g: пометка сноса батареи на отсутствующую батарею ничего не ломает", () => {
    expect(scene({ batteries: [X], batteryDemolition: [{ id: "m1", batteryId: "gone" }] }).batteries).toHaveLength(1)
  })

  it("B-MNT-3: данные чертежа не мутируются", () => {
    const d = deepFreeze({ ...drawing({ demolition: [mark("m", "W", "a", 200, 300)] }), batteries: [X] } as Drawing)
    expect(() => mountingScene(d)).not.toThrow()
  })
})

describe("собственные батареи «Монтажа»", () => {
  it("B-MNT-10: собственная батарея на остатке переносится на остаток: снос 200–300, батарея [350,420] → W~3000, 50", () => {
    const own = bat("W", "a", 350, { id: "own" })
    const s = scene({ mounting: mountingOf([own]), demolition: [mark("m", "W", "a", 200, 300)] })
    expect(s.batteries).toEqual([{ ...own, wallId: "W~3000", offsetCm: 50 }])
    expect(s.oldBatteryIds.has("own")).toBe(false)
  })

  it("B-MNT-10b: собственная батарея на собственной стене остаётся как есть", () => {
    const N = wall("N", 0, 100, 300, 100)
    const own = bat("N", "a", 50, { id: "own" })
    const s = scene({ mounting: mountingOf([own], [N]) })
    expect(s.batteries).toEqual([own])
  })

  it("B-MNT-10c: собственная батарея на остатке, которого не стало (стена снесена целиком), не показана, но данные остаются в хранилище", () => {
    const own = bat("W", "a", 100, { id: "own" })
    const d: Drawing = { ...drawing({ demolition: [mark("m", "W", "a", 0, 500)], mounting: mountingOf([own]) }) }
    expect(mountingScene(d).batteries).toEqual([])
    expect(d.mounting?.batteries).toEqual([own])
  })

  it("B-MNT-10d: собственная батарея не зависит от пометки сноса обмера по её идентификатору", () => {
    const own = bat("W", "a", 100, { id: "own" })
    const s = scene({ mounting: mountingOf([own]), batteryDemolition: [{ id: "m1", batteryId: "own" }] })
    expect(s.batteries.map((b) => b.id)).toEqual(["own"])
  })

  it("B-MNT-11: порядок: сначала батареи обмера, затем собственные", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const s = scene({ batteries: [X], mounting: mountingOf([own]) })
    expect(s.batteries.map((b) => b.id)).toEqual(["b0", "own"])
    expect([...s.oldBatteryIds]).toEqual(["b0"])
  })
})

describe("пересечения на «Монтаже»", () => {
  it("B-MNT-12: собственная батарея не пересекается с показанной батареей обмера (проверка по видимым батареям)", () => {
    const own = bat("W", "a", 150, { id: "own" }) // [150,220] налагается на X [100,170]
    const s = scene({ batteries: [X], mounting: mountingOf([own]) })
    const placed = s.batteries.find((b) => b.id === "own")
    expect(placed).toBeDefined()
    if (placed) expect(batteryHolds(placed, { walls: s.walls, batteries: s.batteries, communications: [] })).toBe(false)
  })

  it("B-MNT-13: снесённая батарея обмера не мешает: та же собственная батарея допустима", () => {
    const own = bat("W", "a", 150, { id: "own" })
    const s = scene({ batteries: [X], batteryDemolition: [{ id: "m1", batteryId: "b0" }], mounting: mountingOf([own]) })
    const placed = s.batteries.find((b) => b.id === "own")
    expect(placed).toBeDefined()
    if (placed) expect(batteryHolds(placed, { walls: s.walls, batteries: s.batteries, communications: [] })).toBe(true)
  })

  it("B-MNT-14: остатки W~0 и W~3000 — разные стены: батарея на одном остатке не мешает другой", () => {
    const left = bat("W", "a", 100, { id: "l" })
    const right = bat("W", "a", 350, { id: "r" })
    const s = scene({ batteries: [left, right], demolition: [mark("m", "W", "a", 200, 300)] })
    expect(s.batteries.map((b) => b.wallId).sort()).toEqual(["W~0", "W~3000"])
    for (const b of s.batteries) expect(batteryHolds(b, { walls: s.walls, batteries: s.batteries, communications: [] })).toBe(true)
  })
})

describe("прочее содержимое сцены не меняется", () => {
  it("B-MNT-15: без батарей поля сцены прежние, список батарей пуст", () => {
    const s = scene()
    expect(s.batteries).toEqual([])
    expect(s.oldBatteryIds.size).toBe(0)
    expect(s.walls.map((w) => w.id)).toEqual(["W~0"])
  })
})

describe("перенос на остаток при привязке b", () => {
  const fromB = bat("W", "b", 100, { id: "rb" }) // в мире [330,400]

  it("B-MNT-16: снос 450–500 укорачивает конец b остатка до 450: расстояние от нового конца b — 50, остаток W~0", () => {
    const s = scene({ batteries: [fromB], demolition: [mark("m", "W", "a", 450, 500)] })
    expect(s.batteries).toEqual([{ ...fromB, wallId: "W~0", offsetCm: 50 }])
  })

  it("B-MNT-16b: снос у начала (0–100): конец b остатка W~1000 тот же — расстояние прежнее, 100", () => {
    const s = scene({ batteries: [fromB], demolition: [mark("m", "W", "a", 0, 100)] })
    expect(s.batteries).toEqual([{ ...fromB, wallId: "W~1000", offsetCm: 100 }])
  })

  it("B-MNT-16c: собственная батарея с привязкой b на остатке пересчитывается так же", () => {
    const own = bat("W", "b", 100, { id: "own-b" })
    const s = scene({ mounting: mountingOf([own]), demolition: [mark("m", "W", "a", 450, 500)] })
    expect(s.batteries).toEqual([{ ...own, wallId: "W~0", offsetCm: 50 }])
  })
})

describe("размеры к углам батарей в сцене «Монтажа»", () => {
  const own = bat("W", "a", 300, { id: "own" })
  const link: Dimension = { from: { kind: "corner", batteryId: "b0", end: "b", side: "front" }, to: { kind: "corner", batteryId: "own", end: "a", side: "front" }, offset: 20 }
  const withDims = (parts: Parts) => scene({ ...parts, mounting: { walls: [], dimensions: [link], batteries: [own] } })

  it("B-MNT-17: размер между углом показанной батареи обмера и углом собственной батареи остаётся в сцене", () => {
    expect(withDims({ batteries: [X] }).dimensions).toEqual([link])
  })

  it("B-MNT-17b: батарея обмера снесена (скрыта) — размер к её углу не попадает в сцену", () => {
    expect(withDims({ batteries: [X], batteryDemolition: [{ id: "m1", batteryId: "b0" }] }).dimensions).toEqual([])
  })

  it("B-MNT-17c: батарея обмера скрыта сносом стены под ней — размер не попадает в сцену; снос снят — вернулся", () => {
    expect(withDims({ batteries: [X], demolition: [mark("m", "W", "a", 150, 300)] }).dimensions).toEqual([])
    expect(withDims({ batteries: [X] }).dimensions).toEqual([link])
  })

  it("B-MNT-17d: батареи с таким идентификатором нет — размер не попадает в сцену, расчёт не падает", () => {
    expect(withDims({ batteries: [] }).dimensions).toEqual([])
  })

  it("B-MNT-17e: размер к углу собственной батареи, которой нет на остатке, не попадает в сцену", () => {
    const d: Drawing = { ...drawing({ demolition: [mark("m", "W", "a", 0, 500)], mounting: { walls: [], dimensions: [link], batteries: [own] } }), batteries: [X] }
    expect(mountingScene(d).dimensions).toEqual([])
  })
})

describe("только для чтения: старые батареи отличимы от собственных", () => {
  it("B-MNT-18: собственные батареи сцены — те, чьих идентификаторов нет в oldBatteryIds", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const s = scene({ batteries: [X], mounting: mountingOf([own]) })
    expect(s.batteries.filter((b) => !s.oldBatteryIds.has(b.id)).map((b) => b.id)).toEqual(["own"])
    expect(s.batteries.filter((b) => s.oldBatteryIds.has(b.id)).map((b) => b.id)).toEqual(["b0"])
  })
})
