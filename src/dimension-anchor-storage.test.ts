import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, serializeHistory } from "./history"
import { isDimension, parseStore, serializeStore } from "./storage"
import type { Dimension, Drawing, DrawingStore, View, Wall, WallElement } from "./types"
import { jambDimension, jambPoint, win, door } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: формат точки замера-откоса в документе и в истории
// (spec drawing-storage «Формат документа»; design D1, D7, D8). Формат: { kind: "jamb", elementId, jamb: "a"|"b", face: 1|-1 };
// точка без kind читается как пара граней; ссылка на отсутствующий элемент форматом не проверяется.

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const e1: WallElement = win("w1", "a", 100, 120, 150, 85, "e1")
const e2: WallElement = win("w1", "a", 300, 120, 150, 85, "e2")
const view: View = { zoom: 1, pan: { x: 0, y: 0 } }

const edgeDim: Dimension = {
  from: { a: { wallId: "w1", edge: 0 }, b: { wallId: "w1", edge: 2 } },
  to: { a: { wallId: "w1", edge: 0 }, b: { wallId: "w1", edge: 3 } },
  offset: 25,
}
const jambDim: Dimension = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", -1), 42)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], doorways: [e1, e2], view, ...extra }) as Drawing

const doc = (drawings: unknown[]): string => JSON.stringify({ version: 3, activeId: "a", drawings })

const load = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const d = parsed?.store.drawings[0]
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("размер с откосами в документе", () => {
  it("DA-28: круг serializeStore → parseStore сохраняет откосы, грани и смещение", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ dimensions: [jambDim, edgeDim] })] }
    const d = load(serializeStore(store))
    expect(d.dimensions).toEqual([jambDim, edgeDim])
    expect(d.doorways).toEqual([e1, e2])
  })

  it("DA-28b: документ, записанный литералом формата kind/elementId/jamb/face, читается в такие же точки", () => {
    const raw =
      `{"version":3,"activeId":"a","drawings":[{"id":"a","name":"Ч","walls":[${JSON.stringify(W)}],"doorways":[${JSON.stringify(e1)},${JSON.stringify(e2)}],` +
      `"dimensions":[{"from":{"kind":"jamb","elementId":"e1","jamb":"b","face":1},"to":{"kind":"jamb","elementId":"e2","jamb":"a","face":-1},"offset":42}],` +
      `"view":{"zoom":1,"pan":{"x":0,"y":0}}}]}`
    const d = load(raw)
    expect(d.dimensions).toEqual([jambDim])
  })

  it("DA-28c: точка-откос на каждой допустимой комбинации jamb и face восстанавливается", () => {
    const all: Dimension[] = []
    for (const jamb of ["a", "b"] as const)
      for (const face of [1, -1] as const) all.push(jambDimension(jambPoint("e1", jamb, face), jambPoint("e2", jamb, face), 10))
    const d = load(doc([drawing({ dimensions: all })]))
    expect(d.dimensions).toEqual(all)
  })

  it("DA-29: размеры с откосами плана «Монтаж» хранятся и читаются так же", () => {
    const own: Wall = { id: "n1", a: { x: 0, y: 100 }, b: { x: 0, y: 400 }, thicknessCm: 10, type: "concrete" }
    const opening = door("n1", "a", 50, 90, 210, "p1")
    const mj = jambDimension(jambPoint("p1", "a", 1), jambPoint("p1", "b", 1), 12)
    const d = load(doc([drawing({ mounting: { walls: [own], dimensions: [mj], doorways: [opening] } })]))
    expect(d.mounting).toEqual({ walls: [own], dimensions: [mj], doorways: [opening] })
  })

  it("DA-29b: плохая точка-откос в «Монтаже» отбрасывает только свой размер", () => {
    const own: Wall = { id: "n1", a: { x: 0, y: 100 }, b: { x: 0, y: 400 }, thicknessCm: 10, type: "concrete" }
    const good = jambDimension(jambPoint("p1", "a", 1), jambPoint("p1", "b", 1), 12)
    const bad = { from: { kind: "jamb", elementId: "p1", jamb: "c", face: 1 }, to: good.to, offset: 5 }
    const d = load(doc([drawing({ mounting: { walls: [own], dimensions: [bad, good], doorways: [] } })]))
    expect(d.mounting?.dimensions).toEqual([good])
  })
})

describe("совместимость со старым форматом", () => {
  it("DA-30: размер из точек граней без kind читается и не получает kind", () => {
    const d = load(doc([drawing({ dimensions: [edgeDim] })]))
    expect(d.dimensions).toEqual([edgeDim])
    expect("kind" in d.dimensions[0].from).toBe(false)
    expect("kind" in d.dimensions[0].to).toBe(false)
  })

  it("DA-30b: isDimension принимает граневую точку без kind и откос", () => {
    expect(isDimension(edgeDim)).toBe(true)
    expect(isDimension(jambDim)).toBe(true)
  })

  it("DA-30c: смешанный размер (грани и откос) читается без потерь", () => {
    const mixed: Dimension = { from: edgeDim.from, to: jambPoint("e2", "a", 1), offset: 8 }
    const d = load(doc([drawing({ dimensions: [mixed] })]))
    expect(d.dimensions).toEqual([mixed])
  })
})

describe("битая точка-откос", () => {
  const good = jambDimension(jambPoint("e1", "a", 1), jambPoint("e2", "b", 1), 20)
  const base = { elementId: "e1", jamb: "a", face: 1 }
  const bad: [string, unknown][] = [
    ["нет elementId", { kind: "jamb", jamb: "a", face: 1 }],
    ["elementId пустой", { ...base, kind: "jamb", elementId: "" }],
    ["elementId не строка", { ...base, kind: "jamb", elementId: 5 }],
    ["jamb c", { ...base, kind: "jamb", jamb: "c" }],
    ["jamb отсутствует", { kind: "jamb", elementId: "e1", face: 1 }],
    ["face 0", { ...base, kind: "jamb", face: 0 }],
    ["face 2", { ...base, kind: "jamb", face: 2 }],
    ["face строкой", { ...base, kind: "jamb", face: "left" }],
    ["face отсутствует", { kind: "jamb", elementId: "e1", jamb: "a" }],
    ["неизвестный kind", { ...base, kind: "wat" }],
    ["неизвестный kind при корректных a и b", { kind: "wat", a: { wallId: "w1", edge: 0 }, b: { wallId: "w1", edge: 2 } }],
    ["kind jamb без полей", { kind: "jamb" }],
  ]

  it.each(bad)("DA-31: %s — размер отброшен, корректный размер и стены сохранены", (_name, from) => {
    const broken = { from, to: good.to, offset: 5 }
    const d = load(doc([drawing({ dimensions: [broken, good, edgeDim] })]))
    expect(d.dimensions).toEqual([good, edgeDim])
    expect(d.walls).toEqual([W])
    expect(d.doorways).toEqual([e1, e2])
  })

  it.each(bad)("DA-31b: %s — вторая точка размера тоже проверяется", (_name, to) => {
    const d = load(doc([drawing({ dimensions: [{ from: good.from, to, offset: 5 }, good] })]))
    expect(d.dimensions).toEqual([good])
  })

  it("DA-31c: isDimension отвергает каждую битую точку-откос", () => {
    for (const [name, point] of bad) expect(isDimension({ from: point, to: good.to, offset: 1 }), name).toBe(false)
  })
})

describe("ссылка на отсутствующий элемент", () => {
  it("DA-32: размер с откосом несуществующего элемента загружается, документ не повреждён", () => {
    const dangling = jambDimension(jambPoint("ghost", "a", 1), jambPoint("e2", "a", 1), 10)
    const d = load(doc([drawing({ dimensions: [dangling] })]))
    expect(d.dimensions).toEqual([dangling])
  })

  it("DA-32c: размер на откосе элемента, отброшенного при загрузке, сам не отбрасывается форматом", () => {
    const orphanElement = win("missing-wall", "a", 10, 50, 150, 85, "e9")
    const onOrphan = jambDimension(jambPoint("e9", "a", 1), jambPoint("e2", "a", 1), 10)
    const d = load(doc([drawing({ doorways: [e1, e2, orphanElement], dimensions: [onOrphan] })]))
    expect(d.doorways).toEqual([e1, e2])
    expect(d.dimensions).toEqual([onOrphan])
  })
})

describe("история", () => {
  const withEntry = (dimension: unknown): string => {
    const history = emptyHistory()
    history.histories.a = { past: [{ kind: "walls", walls: [W], dimensions: [dimension as Dimension], doorways: [e1, e2] }], future: [] }
    return serializeHistory(history)
  }

  it("DA-33: запись истории с точками-откосами проходит serialize → parse без потерь", () => {
    const loaded = parseHistory(withEntry(jambDim))
    expect(loaded).not.toBeNull()
    expect(loaded?.readOnly).toBe(false)
    const entry = loaded?.history.histories.a.past[0]
    expect(entry?.kind === "walls" ? entry.dimensions : null).toEqual([jambDim])
  })

  it("DA-33b: запись истории с битой точкой-откосом не принимается", () => {
    const broken = { from: { kind: "jamb", elementId: "e1", jamb: "c", face: 1 }, to: jambDim.to, offset: 1 }
    expect(parseHistory(withEntry(broken))).toBeNull()
  })
})
