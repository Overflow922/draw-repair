import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { isDemolitionMark, parseStore, serializeStore } from "../storage"
import type { DemolitionMark, Dimension, Doorway, Drawing, DrawingStore, View, Wall } from "../types"
import { mk } from "./demolition.test-utils"

// change demolition-plan: пометки сноса в документе версии 3 (spec drawing-storage «Пометки сноса в документе»;
// design D7). Все расстояния — в сантиметрах; стена w1 — (0,0)-(500,0), кирпич, 20 см.

const wall: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const reinforced: Wall = { id: "w2", a: { x: 0, y: 200 }, b: { x: 500, y: 200 }, thicknessCm: 20, type: "reinforced" }
const dimension: Dimension = {
  from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
  to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
  offset: 30,
}
const doorway: Doorway = { id: "d1", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 }
const view: View = { zoom: 1.5, pan: { x: -10, y: 20 } }

const drawing = (id: string, extra: Record<string, unknown> = {}): Drawing =>
  ({ id, name: `Чертёж ${id}`, walls: [wall, reinforced], dimensions: [dimension], doorways: [doorway], view, scale: 100, ...extra }) as Drawing

const doc = (drawings: Drawing[], version = 3): string => JSON.stringify({ version, activeId: drawings[0]?.id ?? "", drawings })

const parsedDrawings = (raw: string): Drawing[] => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  return parsed?.store.drawings ?? []
}

const marksOf = (raw: string): DemolitionMark[] | undefined => parsedDrawings(raw)[0]?.demolition

describe("сохранение и чтение пометок", () => {
  it("ST-01: пометки переживают serialize → parse с теми же идентификатором, стеной, концом привязки и расстояниями", () => {
    const marks = [mk("m1", "w1", "a", 100, 190), mk("m2", "w1", "b", 50, 140)]
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { demolition: marks })] }
    const parsed = parseStore(serializeStore(store))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.drawings[0]?.demolition).toEqual(marks)
  })

  it("ST-01: serialize записывает пометки в JSON чертежа в поле demolition", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { demolition: [mk("m1", "w1", "a", 100, 190)] })] }
    const json: unknown = JSON.parse(serializeStore(store))
    expect(json).toMatchObject({ version: 3, drawings: [{ id: "a", demolition: [{ id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }] }] })
  })

  it("ST-01: порядок пометок сохраняется", () => {
    const marks = [mk("z", "w1", "a", 300, 350), mk("a", "w1", "a", 100, 150)]
    expect(marksOf(doc([drawing("a", { demolition: marks })]))).toEqual(marks)
  })

  it("ST-02: чертёж без списка пометок открывается без изменений, поле не появляется", () => {
    const [d] = parsedDrawings(doc([drawing("a")]))
    expect("demolition" in (d as Drawing)).toBe(false)
    expect(d).toEqual(drawing("a"))
  })

  it("ST-02: пустой список пометок сохраняется как пустой список", () => {
    const [d] = parsedDrawings(doc([drawing("a", { demolition: [] })]))
    expect(d?.demolition).toEqual([])
  })

  it.each([
    ["строка", "oops"],
    ["число", 5],
    ["null", null],
    ["объект", { id: "m" }],
  ])("ST-08: поле demolition не массив (%s) читается как отсутствующее", (_name, value) => {
    const [d] = parsedDrawings(doc([drawing("a", { demolition: value })]))
    expect("demolition" in (d as Drawing)).toBe(false)
    expect(d?.walls).toEqual([wall, reinforced])
  })
})

describe("битые и лишние пометки", () => {
  const good = mk("good", "w1", "a", 100, 190)
  const bad = [
    { wallId: "w1", anchor: "a", fromCm: 10, toCm: 20 }, // нет идентификатора
    { id: "", wallId: "w1", anchor: "a", fromCm: 10, toCm: 20 }, // пустой идентификатор
    { id: "b1", wallId: "w1", anchor: "c", fromCm: 10, toCm: 20 }, // неизвестный конец
    { id: "b2", wallId: "w1", anchor: "a", fromCm: 50, toCm: 50 }, // toCm = fromCm
    { id: "b3", wallId: "w1", anchor: "a", fromCm: 60, toCm: 40 }, // toCm < fromCm
    { id: "b4", wallId: "w1", anchor: "a", fromCm: -5, toCm: 40 }, // отрицательный fromCm
    { id: "b5", wallId: "w1", anchor: "a", fromCm: "10", toCm: 40 }, // нечисловое расстояние
    { id: "b6", wallId: "w1", anchor: "a", fromCm: 10, toCm: null },
    { id: "b7", wallId: "gone", anchor: "a", fromCm: 10, toCm: 40 }, // нет такой стены
    { id: "b8", wallId: "", anchor: "a", fromCm: 10, toCm: 40 },
    "строка вместо пометки",
    null,
  ]

  it("ST-03: некорректные пометки отбрасываются, корректная восстанавливается, остальные данные чертежа целы", () => {
    const [d] = parsedDrawings(doc([drawing("a", { demolition: [...bad, good] })]))
    expect(d?.demolition).toEqual([good])
    expect(d?.walls).toEqual([wall, reinforced])
    expect(d?.dimensions).toEqual([dimension])
    expect(d?.doorways).toEqual([doorway])
    expect(d?.view).toEqual(view)
  })

  it("ST-03: каждый дефект по отдельности отбрасывает именно эту пометку", () => {
    for (const b of bad) {
      const out = marksOf(doc([drawing("a", { demolition: [good, b] })]))
      expect(out, JSON.stringify(b)).toEqual([good])
    }
  })

  it("ST-03: ссылка на стену другого чертежа отбрасывается", () => {
    const other = drawing("b", { walls: [{ ...wall, id: "only-b" }], doorways: [], dimensions: [], demolition: [mk("m", "w1", "a", 10, 50)] })
    const out = parsedDrawings(doc([drawing("a"), other]))
    expect(out[1]?.demolition).toEqual([])
  })

  it("ST-04: пересекающиеся пометки одной стены 100–200 и 150–300 сливаются при загрузке в одну 100–300", () => {
    const out = marksOf(doc([drawing("a", { demolition: [mk("m1", "w1", "a", 100, 200), mk("m2", "w1", "a", 150, 300)] })]))
    expect(out).toEqual([mk("m1", "w1", "a", 100, 300)])
  })

  it("ST-04: соприкасающиеся пометки сливаются, непересекающиеся — нет", () => {
    expect(marksOf(doc([drawing("a", { demolition: [mk("m1", "w1", "a", 100, 200), mk("m2", "w1", "a", 200, 300)] })]))).toEqual([mk("m1", "w1", "a", 100, 300)])
    const apart = [mk("m1", "w1", "a", 100, 200), mk("m2", "w1", "a", 250, 300)]
    expect(marksOf(doc([drawing("a", { demolition: apart })]))).toEqual(apart)
  })

  it("ST-04: пометки разных стен не сливаются", () => {
    const marks = [mk("m1", "w1", "a", 100, 200), mk("m2", "w2", "a", 100, 200)]
    expect(marksOf(doc([drawing("a", { demolition: marks })]))).toEqual(marks)
  })

  it("ST-05: пометка на стене из железобетона сохраняется (она не действует, но хранится)", () => {
    const marks = [mk("r", "w2", "a", 100, 200)]
    expect(marksOf(doc([drawing("a", { demolition: marks })]))).toEqual(marks)
  })

  it("ST-05: пометки сохраняются и при последующей записи", () => {
    const marks = [mk("r", "w2", "a", 100, 200)]
    const first = parseStore(doc([drawing("a", { demolition: marks })]))
    const again = parseStore(serializeStore(first!.store))
    expect(again?.store.drawings[0]?.demolition).toEqual(marks)
  })
})

describe("прочие поля документа", () => {
  it("ST-06: стены, размеры, проёмы, вид, масштаб и имя читаются из прежних полей без изменений", () => {
    const [d] = parsedDrawings(doc([drawing("a", { demolition: [mk("m1", "w1", "a", 100, 190)] })]))
    expect(d?.walls).toEqual([wall, reinforced])
    expect(d?.dimensions).toEqual([dimension])
    expect(d?.doorways).toEqual([doorway])
    expect(d?.view).toEqual(view)
    expect(d?.scale).toBe(100)
    expect(d?.name).toBe("Чертёж a")
  })

  it("ST-06: версия документа остаётся 3 при чтении и записи", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { demolition: [mk("m1", "w1", "a", 100, 190)] })] }
    expect(parseStore(serializeStore(store))?.store.version).toBe(3)
    expect(JSON.parse(serializeStore(store))).toMatchObject({ version: 3 })
  })

  it("ST-07: активный план demolition допустим и сохраняется", () => {
    const [d] = parsedDrawings(doc([drawing("a", { activePlan: "demolition" })]))
    expect(d?.activePlan).toBe("demolition")
    expect(activePlanOf(d as Drawing)).toBe("demolition")
  })

  it("ST-07: activePlan demolition переживает serialize → parse вместе с пометками", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { activePlan: "demolition", demolition: [mk("m1", "w1", "a", 100, 190)] })] }
    expect(parseStore(serializeStore(store))?.store).toEqual(store)
  })

  it("ST-07: неизвестный activePlan по-прежнему отбрасывается", () => {
    const [d] = parsedDrawings(doc([drawing("a", { activePlan: "unknown-plan" })]))
    expect("activePlan" in (d as Drawing)).toBe(false)
  })

  it("ST-10: документ версии 2 открывается без пометок", () => {
    const v2 = JSON.stringify({ version: 2, activeId: "a", drawings: [{ id: "a", name: "Чертёж", walls: [{ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }], view, scale: 100 }] })
    const [d] = parsedDrawings(v2)
    expect("demolition" in (d as Drawing)).toBe(false)
  })

  it("ST-11: документ будущей версии остаётся только для чтения и не читает пометки", () => {
    const parsed = parseStore(doc([drawing("a", { demolition: [mk("m1", "w1", "a", 100, 190)] })], 4))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.store.drawings[0]?.demolition).toBeUndefined()
  })
})

describe("isDemolitionMark", () => {
  const valid = { id: "m", wallId: "w1", anchor: "a", fromCm: 0, toCm: 0.5 }

  it("ST-09: корректная пометка принимается, включая from = 0", () => {
    expect(isDemolitionMark(valid)).toBe(true)
    expect(isDemolitionMark({ ...valid, anchor: "b" })).toBe(true)
  })

  it.each([
    ["пустой id", { ...valid, id: "" }],
    ["нет id", { wallId: "w1", anchor: "a", fromCm: 0, toCm: 1 }],
    ["пустой wallId", { ...valid, wallId: "" }],
    ["anchor c", { ...valid, anchor: "c" }],
    ["fromCm < 0", { ...valid, fromCm: -0.01 }],
    ["toCm = fromCm", { ...valid, fromCm: 5, toCm: 5 }],
    ["toCm < fromCm", { ...valid, fromCm: 5, toCm: 4 }],
    ["NaN", { ...valid, toCm: Number.NaN }],
    ["Infinity", { ...valid, toCm: Number.POSITIVE_INFINITY }],
    ["строковое число", { ...valid, toCm: "1" }],
    ["null", null],
    ["строка", "m"],
    ["массив", []],
  ])("ST-09: отвергает %s", (_name, value) => {
    expect(isDemolitionMark(value)).toBe(false)
  })
})
