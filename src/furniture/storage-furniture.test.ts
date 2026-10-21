import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Dimension, Drawing, DrawingStore, FurnitureItem, Wall } from "../types"

// change furniture-plan-table: объекты плана «Мебель» в документе версии 3
// (spec drawing-storage «Объекты плана «Мебель» в документе»; design D9)
// TCR (change furniture-items-catalog): стол стал предметом мебели (Table → FurnitureItem, tables → items, table*.ts → item*.ts) с видом «table»; меняются только имена и вид в данных, утверждения о поведении не менялись

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const T: FurnitureItem = { id: "t1", kind: "table", x: 300, y: 200, widthCm: 90, lengthCm: 180, angleDeg: 30 }
const dim: Dimension = { from: { a: { wallId: "w1", edge: 0 }, b: { wallId: "w1", edge: 1 } }, to: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 3 } }, offset: 20 }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("объекты «Мебели» в документе", () => {
  it("FP-90: стол восстанавливается без потерь: идентификатор, центр, размеры, угол", () => {
    expect(first(doc([drawing({ furniture: { items: [T], dimensions: [] } })])).furniture?.items).toEqual([T])
  })

  it("FP-90: круг serializeStore → parseStore сохраняет столы, размеры, активный план и обмер", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ activePlan: "furniture", furniture: { items: [T], dimensions: [dim] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.furniture?.items).toEqual([T])
    expect(d?.furniture?.dimensions).toEqual([dim])
    expect(d ? activePlanOf(d) : null).toBe("furniture")
    expect(d?.walls).toEqual([W])
  })

  it("FP-90: формат документа остаётся версии 3", () => {
    expect(parseStore(doc([drawing({ furniture: { items: [T], dimensions: [] } })]))?.store.version).toBe(3)
  })

  it("FP-91: старый документ без поля — поле не появляется", () => {
    const d = first(doc([drawing()]))
    expect("furniture" in d).toBe(false)
    expect(d.walls).toEqual([W])
  })

  it("FP-92: некорректные столы отбрасываются по одному, корректный и размер восстанавливаются", () => {
    const bad = [
      { ...T, id: "b1", widthCm: 0 },
      { ...T, id: "b2", lengthCm: -5 },
      { ...T, id: "b3", widthCm: "90" },
      { id: "b4", x: 1, y: 2, widthCm: 10, lengthCm: 10 },
      { ...T, id: "" },
      { ...T, id: "b6", x: "0" },
      { ...T, id: "b7", angleDeg: Number.NaN },
    ]
    const d = first(doc([drawing({ furniture: { items: [...bad, T], dimensions: [dim] } })]))
    expect(d.furniture?.items).toEqual([T])
    expect(d.furniture?.dimensions).toEqual([dim])
  })

  // change furniture-items-catalog: вид предмета в документе (spec drawing-storage «Вид предмета мебели в документе»)
  it("FIK-20: вид сохраняется и восстанавливается; в сохранённом документе у предмета есть вид", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ furniture: { items: [T], dimensions: [] } })] }
    expect(serializeStore(store)).toContain('"kind":"table"')
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.furniture?.items[0]?.kind).toBe("table")
  })

  it("FIK-21: предмет без вида читается как стол; документ при загрузке не дописывается", () => {
    const { kind: _kind, ...noKind } = T
    const raw = doc([drawing({ furniture: { items: [noKind], dimensions: [] } })])
    expect(first(raw).furniture?.items).toEqual([T])
    expect(raw).not.toContain('"kind"')
  })

  it("FIK-22: чертёж до каталога видов (предметы в поле tables, без вида) открывается столами", () => {
    const { kind: _kind, ...noKind } = T
    expect(first(doc([drawing({ furniture: { tables: [noKind], dimensions: [] } })])).furniture?.items).toEqual([T])
  })

  it("FIK-23: предмет с неизвестным видом отбрасывается, корректный стол восстанавливается", () => {
    const d = first(doc([drawing({ furniture: { items: [{ ...T, id: "x", kind: "wardrobe" }, { ...T, id: "y", kind: 3 }, T], dimensions: [] } })]))
    expect(d.furniture?.items).toEqual([T])
  })

  it("FP-93: угол вне диапазона приводится при загрузке: 450 → 90, −90 → 270", () => {
    const d = first(doc([drawing({ furniture: { items: [{ ...T, id: "a", angleDeg: 450 }, { ...T, id: "b", angleDeg: -90 }], dimensions: [] } })]))
    expect(d.furniture?.items.map((t) => t.angleDeg)).toEqual([90, 270])
  })

  it("FP-94: размер на стену, которой нет, сохраняется; размер не по формату отбрасывается", () => {
    const ghost: Dimension = { ...dim, from: { a: { wallId: "нет", edge: 0 }, b: { wallId: "w1", edge: 1 } } }
    const d = first(doc([drawing({ furniture: { items: [], dimensions: [ghost, { offset: 1 }, dim] } })]))
    expect(d.furniture?.dimensions).toEqual([ghost, dim])
  })

  it("FP-95: выноски и примечания плана читаются по общим правилам, битые отбрасываются", () => {
    const callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Стол" }
    const d = first(doc([drawing({ furniture: { items: [], dimensions: [], callouts: [callout, { id: "x" }], notes: ["Первый", "Второй"] } })]))
    expect(d.furniture?.callouts).toEqual([callout])
    expect(d.furniture?.notes).toEqual(["Первый", "Второй"])
  })

  it("FP-96: поле не объект или без списка столов не делает документ повреждённым", () => {
    for (const bad of [5, "x", null, [], { items: 3, dimensions: 4 }]) {
      const d = first(doc([drawing({ furniture: bad })]))
      expect(d.walls).toEqual([W])
      expect(d.furniture?.items ?? []).toEqual([])
    }
  })

  it("FP-97: прочие планы не затронуты: стены, «Монтаж», штукатурка, гипсокартон читаются из прежних полей", () => {
    const own: Wall = { id: "n1", a: { x: 0, y: 100 }, b: { x: 0, y: 400 }, thicknessCm: 10, type: "brick" }
    const plaster = { id: "p1", wallId: "w1", face: 1, anchor: "a", fromCm: 100, toCm: 300, thicknessMm: 20 }
    const g = { id: "g1", a: { x: 0, y: 40 }, b: { x: 300, y: 40 }, thicknessCm: 10, heightCm: 270 }
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [] }, roughPlaster: [plaster], reconstruction: { walls: [g], dimensions: [] }, furniture: { items: [T], dimensions: [] } })]))
    expect(d.walls).toEqual([W])
    expect(d.mounting?.walls).toEqual([own])
    expect(d.roughPlaster).toEqual([plaster])
    expect(d.reconstruction?.walls).toHaveLength(1)
  })

  it("FP-98: идентификатор активного плана furniture допустим; неизвестный читается как обмерочный", () => {
    expect(activePlanOf(first(doc([drawing({ activePlan: "furniture" })])))).toBe("furniture")
    expect(activePlanOf(first(doc([drawing({ activePlan: "furniture2" })])))).toBe("measure")
  })

  it("FP-99: подсветка пересечений и значения панели в документе не хранятся", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ furniture: { items: [T], dimensions: [] } })] }
    const raw = serializeStore(store)
    expect(raw).not.toContain("overlap")
    expect(Object.keys(JSON.parse(raw).drawings[0].furniture).sort()).toEqual(["dimensions", "items"])
  })
})
