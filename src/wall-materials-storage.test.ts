import { describe, expect, it } from "vitest"
import { effectiveMarks } from "./demolition/marks"
import { parseStore, serializeStore } from "./storage"
import type { DemolitionMark, Drawing, DrawingStore, View, Wall } from "./types"

// change new-wall-materials: миграция типов стен при загрузке документа
// (spec wall-types «Штриховка стены по материалу» — «Миграция всех старых типов»; spec drawing-storage
// «Пометки сноса в документе»; test-plan WM-S1, WM-S2, WM-D4, WM-D5).

const view: View = { zoom: 1, pan: { x: 0, y: 0 } }
const wallOf = (id: string, type: string, y = 0): Record<string, unknown> => ({ id, a: { x: 0, y }, b: { x: 500, y }, thicknessCm: 20, type })

const doc = (extra: Record<string, unknown>, version = 3): string =>
  JSON.stringify({ version, activeId: "a", drawings: [{ id: "a", name: "Чертёж 1", dimensions: [], view, ...extra }] })

const load = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

const typesOf = (d: Drawing): string[] => d.walls.map((w) => w.type)

describe("миграция типов стен при загрузке", () => {
  it("WM-S1: reinforced открывается как concrete, а не как brick", () => {
    const d = load(doc({ walls: [wallOf("w1", "reinforced")] }))
    expect(typesOf(d)).toEqual(["concrete"])
  })

  it("WM-S1: wood-long остаётся wood-long (формат не меняется)", () => {
    expect(typesOf(load(doc({ walls: [wallOf("w1", "wood-long")] })))).toEqual(["wood-long"])
  })

  it("WM-S1: blocks, brick, concrete, gkl сохраняются как есть", () => {
    const d = load(doc({ walls: [wallOf("a", "blocks", 0), wallOf("b", "brick", 100), wallOf("c", "concrete", 200), wallOf("d", "gkl", 300)] }))
    expect(typesOf(d)).toEqual(["blocks", "brick", "concrete", "gkl"])
  })

  it("WM-S1: остальные старые и неизвестные типы открываются как brick", () => {
    const legacy = ["partition", "drywall", "bearing", "selfbearing", "nonbearing", "wood-cross", "unknown", ""]
    const d = load(doc({ walls: legacy.map((type, i) => wallOf(`w${i}`, type, i * 100)) }))
    expect(typesOf(d)).toEqual(legacy.map(() => "brick"))
  })

  it("WM-S1: смесь типов мигрирует поштучно, порядок стен сохраняется", () => {
    const d = load(doc({ walls: [wallOf("a", "reinforced", 0), wallOf("b", "partition", 100), wallOf("c", "wood-long", 200), wallOf("d", "reinforced", 300)] }))
    expect(d.walls.map((w) => [w.id, w.type])).toEqual([
      ["a", "concrete"],
      ["b", "brick"],
      ["c", "wood-long"],
      ["d", "concrete"],
    ])
  })

  it("WM-S1: стены плана «Монтаж» мигрируют так же", () => {
    const d = load(doc({ walls: [wallOf("w1", "brick")], mounting: { walls: [wallOf("n1", "reinforced", 100), wallOf("n2", "partition", 200)], dimensions: [], doorways: [] } }))
    expect(d.mounting?.walls.map((w) => w.type)).toEqual(["concrete", "brick"])
  })

  it("WM-S1: документ версии 1 и версии 2 с reinforced мигрирует в concrete", () => {
    const v1 = JSON.stringify({ version: 1, walls: [{ ...wallOf("w1", "reinforced"), id: undefined }], view })
    const v2 = doc({ walls: [{ ...wallOf("w1", "reinforced"), id: undefined }] }, 2)
    expect(typesOf(load(v1))).toEqual(["concrete"])
    expect(typesOf(load(v2))).toEqual(["concrete"])
  })

  it("WM-S1: формат документа остаётся версии 3, мигрированный документ при повторном сохранении не меняется", () => {
    const parsed = parseStore(doc({ walls: [wallOf("w1", "reinforced")] }))
    expect(parsed?.store.version).toBe(3)
    const store = parsed?.store as DrawingStore
    const again = parseStore(serializeStore(store))
    expect(again?.store).toEqual(store)
    expect(typesOf(again?.store.drawings[0] as Drawing)).toEqual(["concrete"])
  })
})

describe("пометки сноса на бывшем железобетоне", () => {
  const mark: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }

  it("WM-S2: пометка на стене reinforced сохраняется после загрузки", () => {
    const d = load(doc({ walls: [wallOf("w1", "reinforced")], demolition: [mark] }))
    expect(d.demolition).toEqual([mark])
  })

  it("WM-S2, WM-D4: пометка на бывшем железобетоне не действует (стена теперь бетон)", () => {
    const d = load(doc({ walls: [wallOf("w1", "reinforced")], demolition: [mark] }))
    expect(effectiveMarks(d.demolition ?? [], d.walls)).toEqual([])
  })

  it("WM-S2: пометка на бетонной стене сохраняется и не действует", () => {
    const d = load(doc({ walls: [wallOf("w1", "concrete")], demolition: [mark] }))
    expect(d.demolition).toEqual([mark])
    expect(effectiveMarks(d.demolition ?? [], d.walls)).toEqual([])
  })

  it("WM-D5: после смены материала стены обратно на «Кирпич» прежняя пометка снова действует с прежним участком", () => {
    const d = load(doc({ walls: [wallOf("w1", "reinforced")], demolition: [mark] }))
    const brick: Wall[] = d.walls.map((w) => ({ ...w, type: "brick" }))
    const resolved = effectiveMarks(d.demolition ?? [], brick)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({ mark: { id: "m1" }, from: 100, to: 190 })
  })

  it("WM-S2: пометка на стене wood-long и gkl действует (эти материалы сносятся)", () => {
    for (const type of ["wood-long", "gkl", "blocks"]) {
      const d = load(doc({ walls: [wallOf("w1", type)], demolition: [mark] }))
      expect(effectiveMarks(d.demolition ?? [], d.walls), type).toHaveLength(1)
    }
  })
})
