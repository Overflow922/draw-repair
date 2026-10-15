import { describe, expect, it } from "vitest"
import { findRooms } from "./room-area"
import { rect, sceneR, sceneR3, sceneRP, sceneRisland, sceneSmall } from "./room-area.test-utils"
import {
  explicationTable,
  formatExplicationArea,
  formatRoomHeight,
  parseRoomHeight,
  reconcileRooms,
} from "./room-explication"
import type { Point, RoomRecord } from "./types"

// Тесты change add-room-explication: данные помещений, привязка записей к помещениям, порог 1 м², таблица (spec room-explication).

const rec = (number: number, anchor: Point, name = "", heightMm = 3000): RoomRecord => ({ number, name, heightMm, anchor })

const reconcile = (walls: ReturnType<typeof sceneR>, records: RoomRecord[]) => reconcileRooms(findRooms(walls), records)

describe("Данные помещения", () => {
  it("первое помещение получает номер 1, пустое название и высоту 3000 мм", () => {
    const [r] = reconcile(sceneR(), [])
    expect(r.record).toMatchObject({ number: 1, name: "", heightMm: 3000 })
  })

  it("новое помещение получает наименьший свободный номер", () => {
    const records = [rec(1, { x: 100, y: 160 }), rec(3, { x: 1000, y: 1000 })]
    const items = reconcile(sceneRP(), records)
    // левая комната — запись 1; правая новая: 2 свободен, 3 принадлежала исчезнувшему помещению и освободилась
    expect(items.map((i) => i.record.number)).toEqual([1, 2])
  })

  it("номера новых помещений назначаются детерминированно по положению", () => {
    const a = reconcile(sceneR3(), []).map((i) => [i.record.number, i.room.areaCm2])
    const b = reconcile(sceneR3(), []).map((i) => [i.record.number, i.room.areaCm2])
    expect(a).toEqual(b)
    expect(a.map(([n]) => n)).toEqual([1, 2, 3])
  })

  it("результат упорядочен по возрастанию номера", () => {
    const items = reconcile(sceneRP(), [rec(5, { x: 100, y: 160 }), rec(2, { x: 300, y: 160 })])
    expect(items.map((i) => i.record.number)).toEqual([2, 5])
  })

  it("входные записи не меняются", () => {
    const records = [rec(1, { x: 50, y: 50 }, "Кухня", 2700)]
    const before = structuredClone(records)
    reconcile(sceneR(), records)
    expect(records).toEqual(before)
  })
})

describe("Привязка данных к помещению", () => {
  it("помещение сохраняет данные, опорная точка обновляется на точку подписи", () => {
    const [r] = reconcile(sceneR(), [rec(4, { x: 50, y: 50 }, "Кухня", 2700)])
    expect(r.record).toMatchObject({ number: 4, name: "Кухня", heightMm: 2700 })
    expect(r.record.anchor).toEqual(r.room.labelAt)
  })

  it("деление перегородкой: часть с опорной точкой хранит запись, другая — новое помещение", () => {
    const items = reconcile(sceneRP(), [rec(1, { x: 300, y: 160 }, "Кухня", 2700)])
    const kept = items.find((i) => i.record.name === "Кухня")
    expect(kept?.record.number).toBe(1)
    expect(kept?.room.outline.every((p) => p.x >= 200)).toBe(true)
    const fresh = items.find((i) => i.record.name === "")
    expect(fresh?.record).toMatchObject({ number: 2, heightMm: 3000 })
  })

  it("слияние: остаётся запись с меньшим номером, номер второй освобождается", () => {
    const records = [rec(2, { x: 300, y: 160 }, "Спальня"), rec(1, { x: 100, y: 160 }, "Кухня")]
    const items = reconcile(sceneR(), records)
    expect(items).toHaveLength(1)
    expect(items[0].record).toMatchObject({ number: 1, name: "Кухня" })
    // номер 2 свободен: после деления новое помещение получит 2
    const split = reconcile(sceneRP(), items.map((i) => i.record))
    expect(split.map((i) => i.record.number)).toEqual([1, 2])
  })

  it("исчезновение помещения освобождает номер", () => {
    const items = reconcile([...sceneR().slice(0, 3)], [rec(2, { x: 200, y: 160 }, "Спальня")])
    expect(items).toEqual([])
    const again = reconcile(sceneR(), [])
    expect(again[0].record.number).toBe(1)
  })

  it("остров не владеет записью: опорная точка в острове не привязывает данные к помещению", () => {
    const walls = sceneRisland()
    const [r] = reconcile(walls, [rec(7, { x: 210, y: 160 }, "Колонна")])
    expect(r.record.number).toBe(1)
    expect(r.record.name).toBe("")
  })

  it("вложенное помещение (короб внутри) получает собственный номер", () => {
    const walls = [...rect(0, 0, 1020, 820), ...rect(400, 300, 600, 500, 10)]
    const items = reconcile(walls, [])
    expect(items).toHaveLength(2)
    expect(new Set(items.map((i) => i.record.number)).size).toBe(2)
  })
})

describe("Помещения экспликации: порог 1 м²", () => {
  it("помещение 0,9 м² не получает номер и не занимает номеров", () => {
    const walls = [...sceneSmall(90, 100), ...sceneSmall(300, 300).map((w) => ({ ...w, a: { x: w.a.x + 500, y: w.a.y }, b: { x: w.b.x + 500, y: w.b.y } }))]
    const items = reconcile(walls, [])
    expect(items).toHaveLength(1)
    expect(items[0].record.number).toBe(1)
  })

  it("помещение ровно 1 м² входит в экспликацию", () => {
    const items = reconcile(sceneSmall(100, 100), [])
    expect(items).toHaveLength(1)
    expect(items[0].room.areaCm2).toBeCloseTo(10000, 3)
  })

  it("помещение чуть меньше 1 м² не входит", () => {
    expect(reconcile(sceneSmall(99, 100), [])).toEqual([])
  })

  it("помещение, выросшее выше порога, получает наименьший свободный номер", () => {
    expect(reconcile(sceneSmall(90, 100), [])).toEqual([])
    const grown = reconcile(sceneSmall(120, 100), [rec(1, { x: 5000, y: 5000 })])
    expect(grown[0].record).toMatchObject({ number: 1, name: "", heightMm: 3000 })
  })

  it("помещение, уменьшившееся ниже порога, освобождает номер", () => {
    const [big] = reconcile(sceneSmall(120, 100), [])
    expect(big.record.number).toBe(1)
    const small = reconcile(sceneSmall(90, 100), [big.record])
    expect(small).toEqual([])
  })
})

describe("Таблица экспликации", () => {
  it("площадь с одним знаком и запятой", () => {
    expect(formatExplicationArea(108000)).toBe("10,8")
    expect(formatExplicationArea(140000)).toBe("14,0")
    expect(formatExplicationArea(121000)).toBe("12,1")
    expect(formatExplicationArea(0)).toBe("0,0")
  })

  it("строки по возрастанию номера, пустое название — «Комната»", () => {
    const items = reconcile(sceneRP(), [rec(2, { x: 100, y: 160 }, "  "), rec(1, { x: 300, y: 160 }, "Кухня")])
    const t = explicationTable(items)
    expect(t.rows.map((r) => r.number)).toEqual(["1", "2"])
    expect(t.rows.map((r) => r.name)).toEqual(["Кухня", "Комната"])
    expect(t.rows.map((r) => r.area)).toEqual(["6,0", "5,4"])
    expect(t.total).toBe("11,4")
  })

  it("итог считается по точным площадям, а не по округлённым", () => {
    const walls = [...sceneSmall(104, 100), ...sceneSmall(104, 100).map((w) => ({ ...w, a: { x: w.a.x + 500, y: w.a.y }, b: { x: w.b.x + 500, y: w.b.y } }))]
    const t = explicationTable(reconcile(walls, []))
    expect(t.rows.map((r) => r.area)).toEqual(["1,0", "1,0"])
    expect(t.total).toBe("2,1")
  })

  it("малое помещение не входит в таблицу и итог", () => {
    const walls = [...sceneR(), ...rect(600, 0, 640, 40)]
    const t = explicationTable(reconcile(walls, []))
    expect(t.rows).toHaveLength(1)
    expect(t.total).toBe("12,0")
  })
})

describe("Высота помещения", () => {
  it("формат блока", () => {
    expect(formatRoomHeight(2923)).toBe("H=2923")
  })

  it("допустимы целые 1–99999", () => {
    expect(parseRoomHeight("2923")).toBe(2923)
    expect(parseRoomHeight(" 1 ")).toBe(1)
    expect(parseRoomHeight("99999")).toBe(99999)
  })

  it("недопустимые значения отвергаются", () => {
    for (const bad of ["0", "-5", "abc", "", "100000", "12.5", "1e3"]) expect(parseRoomHeight(bad)).toBeNull()
  })
})
