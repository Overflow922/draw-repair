import { describe, expect, it } from "vitest"
import { autoWallDimensions, placeWall, syncAutoDimensions } from "./auto-dimensions"
import { expectLength, expectOutsideBodies, expectPoint, expectThickness, dimsOf, measure, permutations, placeAll, split, w } from "./auto-dimensions.test-utils"
import { door } from "./doorway/doorway.test-utils"
import { deleteObjects } from "./doorway/doorway-scene"
import type { Scene } from "./history"
import { cloneScene, drawingHistory, emptyHistory, record, undoEntry } from "./history"
import { parseStore, serializeStore } from "./storage"
import type { Dimension, Drawing, DrawingStore, Wall } from "./types"
import { mergeContinuation } from "./wall-merge"

// change auto-wall-dimensions (модель «видимые куски граней»): spec dimension-tool «Автоматические размеры
// стены», «Пересчёт автоматических размеров», «Метка автоматического размера»; design D1–D6.
// Числа выведены из спецификации и геометрии сцен, а не из продакшн-кода.

const snapshot = (scene: Scene): string => JSON.stringify(scene)
const emptyScene = (): Scene => ({ walls: [], dimensions: [], doorways: [] })

describe("одиночная стена", () => {
  it("AD-1: стена (0,0)-(500,0) получает четыре размера: две длины по 500 и две толщины по 20", () => {
    const W = w(0, 0, 500, 0, "W")
    const scene = placeAll([W])
    expect(scene.dimensions).toHaveLength(4)
    const s = split(scene, W)
    expect(s.plus).toHaveLength(1)
    expect(s.minus).toHaveLength(1)
    expect(s.thickness).toHaveLength(2)
    expectLength(s.plus[0], W, 1, 0, 500)
    expectLength(s.minus[0], W, -1, 0, 500)
    expectThickness(s.thickness[0], W, 0, -1)
    expectThickness(s.thickness[1], W, 500, 1)
    // линии на y = +30, y = −30, x = −20, x = 520 (spec «Одиночная стена получает четыре размера»)
    expectPoint(s.plus[0].line[0], s.plus[0].line[0].x, 30)
    expectPoint(s.minus[0].line[0], s.minus[0].line[0].x, -30)
    expect(s.thickness[0].line[0].x).toBeCloseTo(-20, 5)
    expect(s.thickness[1].line[0].x).toBeCloseTo(520, 5)
  })

  it("AD-2: наклонная стена (0,0)-(300,400) — две длины по 500 и две толщины, линии параллельны и на 20 см снаружи", () => {
    const W = w(0, 0, 300, 400, "W")
    const scene = placeAll([W])
    expect(scene.dimensions).toHaveLength(4)
    const s = split(scene, W)
    expectLength(s.plus[0], W, 1, 0, 500)
    expectLength(s.minus[0], W, -1, 0, 500)
    expectThickness(s.thickness[0], W, 0, -1)
    expectThickness(s.thickness[1], W, 500, 1)
  })

  it("AD-2b: стена, нарисованная справа налево (500,0)-(0,0), даёт тот же набор в своей системе координат", () => {
    const W = w(500, 0, 0, 0, "W")
    const scene = placeAll([W])
    expect(scene.dimensions).toHaveLength(4)
    const s = split(scene, W)
    expectLength(s.plus[0], W, 1, 0, 500)
    expectLength(s.minus[0], W, -1, 0, 500)
    expectThickness(s.thickness[0], W, 0, -1)
    expectThickness(s.thickness[1], W, 500, 1)
  })

  it("AD-2c: размеры разной толщины — толщина 40 даёт число 40, линии на 20 см от граней y = ±20", () => {
    const W = w(0, 0, 500, 0, "W", 40)
    const s = split(placeAll([W]), W)
    expectLength(s.plus[0], W, 1, 0, 500)
    expectLength(s.minus[0], W, -1, 0, 500)
    expectThickness(s.thickness[0], W, 0, -1)
    expectThickness(s.thickness[1], W, 500, 1)
  })

  it("AD-3: стена нулевой длины размеров не получает", () => {
    expect(autoWallDimensions(w(10, 10, 10, 10, "Z"), [w(10, 10, 10, 10, "Z")])).toEqual([])
    const placed = placeWall(emptyScene(), w(10, 10, 10, 10, "Z"))
    expect(placed?.walls).toHaveLength(1)
    expect(placed?.dimensions).toEqual([])
  })

  it("AD-4: каждый автоматический размер помечен идентификатором владельца", () => {
    const W = w(0, 0, 500, 0, "W")
    const dims = autoWallDimensions(W, [W])
    expect(dims).toHaveLength(4)
    for (const d of dims) expect(d.auto).toBe("W")
    const scene = placeAll([w(0, 0, 500, 0, "W1")])
    for (const d of scene.dimensions) expect(d.auto).toBe("W1")
  })
})

describe("примыкание: ножка (T)", () => {
  const W = () => w(0, 0, 500, 0, "W")
  const S = () => w(250, -10, 250, -300, "S")

  it("AD-5: ножка делит грань y = −10 перекладины на 240 и 240, остальные размеры перекладины не меняются", () => {
    const before = placeAll([W()])
    const after = placeWall(before, S())
    if (!after) throw new Error("стена не зафиксирована")
    const Ws = W()
    const s = split(after, Ws)
    expect(s.plus).toHaveLength(1)
    expectLength(s.plus[0], Ws, 1, 0, 500)
    expect(s.minus).toHaveLength(2)
    expectLength(s.minus[0], Ws, -1, 0, 240)
    expectLength(s.minus[1], Ws, -1, 260, 500)
    expect(s.thickness).toHaveLength(2)
    expectThickness(s.thickness[0], Ws, 0, -1)
    expectThickness(s.thickness[1], Ws, 500, 1)
    expect(dimsOf(after, "W")).toHaveLength(5)
    // нетронутые размеры остались такими же объектами данных
    const old = dimsOf(before, "W")
    const replaced = old.filter((d) => d.offset === -20 && Math.abs(measure(d, before.walls).length - 500) < 1e-6)
    expect(replaced).toHaveLength(1)
    for (const d of old.filter((x) => !replaced.includes(x))) expect(after.dimensions).toContainEqual(d)
    expect(after.dimensions).not.toContainEqual(replaced[0])
  })

  it("AD-5b: размер 500 по грани y = −10 заменён, а не оставлен", () => {
    const after = placeAll([W(), S()])
    const lengths = dimsOf(after, "W").map((d) => measure(d, after.walls).length)
    expect(lengths.filter((l) => Math.abs(l - 500) < 1e-6)).toHaveLength(1)
    expect(after.dimensions).toHaveLength(8)
  })

  it("AD-6: у ножки два размера длины по 290 (от грани перекладины до торца) и толщина 20 на свободном торце b, на примкнувшем a толщины нет", () => {
    const after = placeAll([W(), S()])
    const Ss = S()
    const s = split(after, Ss)
    expect(s.plus).toHaveLength(1)
    expect(s.minus).toHaveLength(1)
    expectLength(s.plus[0], Ss, 1, 0, 290)
    expectLength(s.minus[0], Ss, -1, 0, 290)
    expect(s.thickness).toHaveLength(1)
    expectThickness(s.thickness[0], Ss, 290, 1)
  })

  it("AD-6b: ножка, нарисованная от свободного торца к грани (a свободен, b примкнул), даёт толщину на a", () => {
    const Ss = w(250, -300, 250, -10, "S")
    const after = placeAll([W(), Ss])
    const s = split(after, Ss)
    expect(s.thickness).toHaveLength(1)
    expectThickness(s.thickness[0], Ss, 0, -1)
    const lengths = [...s.plus, ...s.minus].map((m) => m.length).sort()
    expect(lengths[0]).toBeCloseTo(290, 5)
    expect(lengths[1]).toBeCloseTo(290, 5)
  })

  it("AD-7: перекладина толщиной 40, ножка 20 — куски 240 и 240 по грани y = −20, у ножки 280", () => {
    const base = w(0, 0, 500, 0, "W", 40)
    const stem = w(250, -20, 250, -300, "S", 20)
    const after = placeAll([base, stem])
    const s = split(after, base)
    expectLength(s.minus[0], base, -1, 0, 240)
    expectLength(s.minus[1], base, -1, 260, 500)
    const t = split(after, stem)
    expectLength(t.plus[0], stem, 1, 0, 280)
    expectLength(t.minus[0], stem, -1, 0, 280)
    expectThickness(t.thickness[0], stem, 280, 1)
    expectThickness(s.thickness[0], base, 0, -1)
    expect(s.thickness[0].length).toBeCloseTo(40, 5)
  })

  it("AD-8: ни размеры, ни их линии не заходят в тела стен (ножка)", () => {
    expectOutsideBodies(placeAll([W(), S()]))
  })
})

describe("примыкание: угол", () => {
  const W = () => w(0, 0, 500, 0, "W")
  const V = () => w(500, 0, 500, 400, "V")

  it("AD-9: угол W и V — у W размеры 490 (y = +10) и 510 (y = −10) и толщина только на торце a; у V 390, 410 и толщина на торце b", () => {
    for (const order of [[W(), V()], [V(), W()]]) {
      const after = placeAll(order)
      const Ws = W()
      const a = split(after, Ws)
      expect(a.plus).toHaveLength(1)
      expect(a.minus).toHaveLength(1)
      expectLength(a.plus[0], Ws, 1, 0, 490)
      expectLength(a.minus[0], Ws, -1, 0, 510)
      expect(a.thickness).toHaveLength(1)
      expectThickness(a.thickness[0], Ws, 0, -1)
      const Vs = V()
      const b = split(after, Vs)
      expect(b.plus).toHaveLength(1)
      expect(b.minus).toHaveLength(1)
      expectLength(b.plus[0], Vs, 1, 10, 400)
      expectLength(b.minus[0], Vs, -1, -10, 400)
      expect(b.thickness).toHaveLength(1)
      expectThickness(b.thickness[0], Vs, 400, 1)
      expectOutsideBodies(after)
    }
  })

  it("AD-10: угол замыкается по прошлому размеру — старый размер толщины на торце b у W убран, число размеров 6", () => {
    const after = placeAll([W(), V()])
    expect(dimsOf(after, "W")).toHaveLength(3)
    expect(dimsOf(after, "V")).toHaveLength(3)
    expect(after.dimensions).toHaveLength(6)
  })
})

describe("комната из четырёх стен", () => {
  const A = () => w(0, 0, 500, 0, "A")
  const B = () => w(500, 0, 500, 400, "B")
  const C = () => w(500, 400, 0, 400, "C")
  const D = () => w(0, 400, 0, 0, "D")
  const expected: Record<string, [number, number]> = { A: [480, 520], B: [380, 420], C: [480, 520], D: [380, 420] }

  const lengthsOf = (scene: Scene, id: string): number[] =>
    dimsOf(scene, id)
      .map((d) => measure(d, scene.walls).length)
      .sort((p, q) => p - q)

  it("AD-11: во всех 24 порядках итог один — внутри 480 и 380, снаружи 520 и 420, ровно восемь размеров, толщины нет", () => {
    for (const order of permutations([A(), B(), C(), D()])) {
      const scene = placeAll(order)
      const tag = order.map((x) => x.id).join("")
      expect(scene.dimensions, tag).toHaveLength(8)
      for (const id of ["A", "B", "C", "D"]) {
        const [inner, outer] = lengthsOf(scene, id)
        expect(inner, `${tag} ${id}`).toBeCloseTo(expected[id][0], 5)
        expect(outer, `${tag} ${id}`).toBeCloseTo(expected[id][1], 5)
        expect(dimsOf(scene, id), `${tag} ${id}`).toHaveLength(2)
      }
    }
  })

  it("AD-11b: тот же результат у комнаты, нарисованной в обратном направлении (концы стен a и b переставлены)", () => {
    const flip = (x: Wall): Wall => ({ ...x, a: x.b, b: x.a })
    for (const order of permutations([flip(A()), flip(B()), flip(C()), flip(D())])) {
      const scene = placeAll(order)
      expect(scene.dimensions).toHaveLength(8)
      for (const id of ["A", "B", "C", "D"]) {
        const [inner, outer] = lengthsOf(scene, id)
        expect(inner).toBeCloseTo(expected[id][0], 5)
        expect(outer).toBeCloseTo(expected[id][1], 5)
      }
    }
  })

  it("AD-11c: у каждой стены по одному размеру на внутренней и наружной грани, обе точки замера на одной грани, линии вне тел (24 порядка)", () => {
    for (const order of permutations([A(), B(), C(), D()])) {
      const scene = placeAll(order)
      expectOutsideBodies(scene)
      for (const x of order) {
        const s = split(scene, x)
        expect(s.plus).toHaveLength(1)
        expect(s.minus).toHaveLength(1)
        expect(s.thickness).toHaveLength(0)
      }
    }
  })
})
describe("слияние и пересчёт", () => {
  it("AD-12: слияние удлиняет стену — размеры E пересчитаны: длины по 900 и толщины на обоих торцах, всего четыре", () => {
    const E = w(0, 0, 500, 0, "E")
    const scene = placeAll([E])
    const r = mergeContinuation(scene, w(510, 0, 900, 0, "N"))
    if (r.kind !== "merged") throw new Error("ожидалось слияние")
    const synced = syncAutoDimensions(r.scene)
    const Ee = synced.walls[0]
    expectPoint(Ee.b, 900, 0)
    const s = split(synced, Ee)
    expect(synced.dimensions).toHaveLength(4)
    expectLength(s.plus[0], Ee, 1, 0, 900)
    expectLength(s.minus[0], Ee, -1, 0, 900)
    expectThickness(s.thickness[0], Ee, 0, -1)
    expectThickness(s.thickness[1], Ee, 900, 1)
    expect(synced.dimensions.every((d) => d.auto === "E")).toBe(true)
  })

  it("AD-13: syncAutoDimensions без идентификатора пересчитывает стены с автоматическими размерами и не трогает остальные", () => {
    const base = placeAll([w(0, 0, 500, 0, "W")])
    const walls = [...base.walls, w(250, -10, 250, -300, "S")]
    const synced = syncAutoDimensions({ ...base, walls })
    expect(dimsOf(synced, "S")).toHaveLength(0)
    const lengths = dimsOf(synced, "W").map((d) => measure(d, synced.walls).length)
    expect(lengths.filter((l) => Math.abs(l - 240) < 1e-6)).toHaveLength(2)
  })

  it("AD-14: пересчёт идемпотентен — повторный вызов ничего не меняет", () => {
    const scene = placeAll([w(0, 0, 500, 0, "W"), w(250, -10, 250, -300, "S")])
    expect(syncAutoDimensions(scene)).toEqual(scene)
    expect(syncAutoDimensions(syncAutoDimensions(scene))).toEqual(scene)
  })

  it("AD-15: новая стена, не затронувшая соседей, оставляет размеры соседей прежними и в прежнем порядке", () => {
    const before = placeAll([w(0, 0, 500, 0, "W")])
    const after = placeAll([w(0, 0, 500, 0, "W"), w(0, 1000, 500, 1000, "F")])
    expect(after.dimensions.slice(0, before.dimensions.length)).toEqual(before.dimensions)
    expect(dimsOf(after, "F")).toHaveLength(4)
  })

  it("AD-16: стена без автоматических размеров (старый чертёж) не получает их при примыкании, новая стена получает свои", () => {
    const X = w(0, 0, 500, 0, "X")
    const scene: Scene = { walls: [X], dimensions: [], doorways: [] }
    const after = placeWall(scene, w(250, -10, 250, -300, "S"))
    if (!after) throw new Error("стена не зафиксирована")
    expect(dimsOf(after, "X")).toHaveLength(0)
    expect(dimsOf(after, "S")).toHaveLength(3)
    expect(after.dimensions).toHaveLength(3)
  })

  it("AD-17: размер, который пользователь передвинул (метки нет), не заменяется и не удаляется, остальные размеры стены пересчитаны", () => {
    const W = w(0, 0, 500, 0, "W")
    const base = placeAll([W])
    const minusLength = base.dimensions.find((d) => d.offset === -20 && Math.abs(measure(d, base.walls).length - 500) < 1e-6)
    if (!minusLength) throw new Error("нет размера длины по грани −")
    const moved: Dimension = { from: minusLength.from, to: minusLength.to, offset: -70 }
    const prepared: Scene = { ...base, dimensions: base.dimensions.map((d) => (d === minusLength ? moved : d)) }
    const after = placeWall(prepared, w(250, -10, 250, -300, "S"))
    if (!after) throw new Error("стена не зафиксирована")
    expect(after.dimensions.filter((d) => d.auto === undefined)).toEqual([moved])
    expect(dimsOf(after, "W")).toHaveLength(5)
  })

  it("AD-18: ручной размер без метки не затрагивается пересчётом", () => {
    const base = placeAll([w(0, 0, 500, 0, "W")])
    const manual: Dimension = { from: { a: { wallId: "W", edge: 0 }, b: { wallId: "W", edge: 2 } }, to: { a: { wallId: "W", edge: 1 }, b: { wallId: "W", edge: 2 } }, offset: 90 }
    const after = placeWall({ ...base, dimensions: [...base.dimensions, manual] }, w(250, -10, 250, -300, "S"))
    expect(after?.dimensions).toContainEqual(manual)
    expect(after?.dimensions.filter((d) => d.auto === undefined)).toEqual([manual])
  })
})

describe("отказ, история и чистота", () => {
  it("AD-19: стена, нарушающая проём, не фиксируется — null, вход не изменён", () => {
    const W = w(0, 0, 500, 0, "W")
    const base = placeAll([W])
    const scene: Scene = { ...base, doorways: [door("W", "a", 100)] }
    const before = snapshot(scene)
    expect(placeWall(scene, w(150, 10, 150, 300, "S"))).toBeNull()
    expect(snapshot(scene)).toBe(before)
  })

  it("AD-20: одна запись истории — «Отменить» возвращает прежние стены и размеры (включая заменённый размер соседа)", () => {
    const base = placeAll([w(0, 0, 500, 0, "W")])
    const history = drawingHistory(emptyHistory(), "x")
    record(history, base)
    const after = placeWall(base, w(250, -10, 250, -300, "S"))
    if (!after) throw new Error("стена не зафиксирована")
    expect(base.dimensions).toHaveLength(4)
    expect(after.dimensions).toHaveLength(8)
    expect(history.past).toHaveLength(1)
    const entry = undoEntry(history, after)
    if (entry?.kind !== "walls") throw new Error("ожидалась запись walls")
    expect(entry.walls).toEqual(base.walls)
    expect(entry.dimensions).toEqual(base.dimensions)
    expect(history.past).toHaveLength(0)
    expect(history.future).toHaveLength(1)
    const redo = history.future[0]
    if (redo.kind !== "walls") throw new Error("ожидалась запись walls")
    expect(redo.dimensions).toEqual(after.dimensions)
  })

  it("AD-21: placeWall и syncAutoDimensions не мутируют вход", () => {
    const base = placeAll([w(0, 0, 500, 0, "W")])
    const before = snapshot(base)
    placeWall(base, w(250, -10, 250, -300, "S"))
    expect(snapshot(base)).toBe(before)
    syncAutoDimensions({ ...base, walls: [...base.walls, w(250, -10, 250, -300, "S")] })
    expect(snapshot(base)).toBe(before)
  })

  it("AD-22: проём на стене не меняет размеры (проёмы в размерах не учитываются)", () => {
    const W = w(0, 0, 500, 0, "W")
    const base: Scene = { walls: [], dimensions: [], doorways: [door("W", "a", 100)] }
    const placed = placeWall(base, W)
    if (!placed) throw new Error("стена не зафиксирована")
    const s = split(placed, W)
    expectLength(s.plus[0], W, 1, 0, 500)
    expectLength(s.minus[0], W, -1, 0, 500)
    expect(placed.dimensions).toHaveLength(4)
  })

  it("AD-23: удаление ножки каскадом убирает только размеры, привязанные к ней; остальные размеры перекладины не пересчитываются", () => {
    const S = w(250, -10, 250, -300, "S")
    const scene = placeAll([w(0, 0, 500, 0, "W"), S])
    const next = deleteObjects(scene, { walls: [S], dimensions: [], doorways: [] })
    expect(next.walls.map((x) => x.id)).toEqual(["W"])
    expect(dimsOf(next, "S")).toHaveLength(0)
    const left = dimsOf(next, "W")
    // остались длина по грани y = +10 и две толщины; куски 240 и 240 привязаны к граням ножки и удалены каскадом
    expect(left).toHaveLength(3)
    const lengths = left.map((d) => measure(d, next.walls).length).sort((p, q) => p - q)
    expect(lengths[0]).toBeCloseTo(20, 5)
    expect(lengths[1]).toBeCloseTo(20, 5)
    expect(lengths[2]).toBeCloseTo(500, 5)
  })
})

describe("метка auto: хранение и история", () => {
  const wall = w(0, 0, 300, 0, "w1")
  const marked: Dimension = {
    from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
    to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
    offset: 40,
    auto: "w1",
  }
  const plain: Dimension = { from: marked.from, to: marked.to, offset: marked.offset }
  const drawing = (dims: Dimension[]): Drawing => ({ id: "a", name: "t", walls: [wall], dimensions: dims, view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100 })
  const storeOf = (dims: Dimension[]): DrawingStore => ({ version: 3, activeId: "a", drawings: [drawing(dims)] })

  it("AD-24: сохранение и загрузка сохраняют поле auto у тех же размеров и не добавляют его остальным", () => {
    const loaded = parseStore(serializeStore(storeOf([marked, plain])))
    expect(loaded?.store.drawings[0].dimensions).toEqual([marked, plain])
    expect(loaded?.store.drawings[0].dimensions[0].auto).toBe("w1")
    expect("auto" in (loaded?.store.drawings[0].dimensions[1] ?? {})).toBe(false)
  })

  it("AD-25: размер с auto не строкой при загрузке отклоняется как некорректный", () => {
    for (const bad of [5, true, null, {}, ["w1"]]) {
      const raw = JSON.stringify({ version: 3, activeId: "a", drawings: [{ ...drawing([]), dimensions: [{ ...marked, auto: bad }] }] })
      const loaded = parseStore(raw)
      expect(loaded?.store.drawings[0]?.dimensions ?? [], JSON.stringify(bad)).toEqual([])
    }
  })

  it("AD-26: чертёж без поля auto (старый формат) читается без изменений", () => {
    const loaded = parseStore(JSON.stringify(storeOf([plain])))
    expect(loaded?.store.drawings[0].dimensions).toEqual([plain])
  })

  it("AD-27: cloneScene копирует auto глубоко и не добавляет поле остальным размерам", () => {
    const scene: Scene = { walls: [wall], dimensions: [marked, plain], doorways: [] }
    const copy = cloneScene(scene)
    expect(copy.dimensions).toEqual([marked, plain])
    expect(copy.dimensions[0]).not.toBe(marked)
    expect(copy.dimensions[0].auto).toBe("w1")
    expect("auto" in copy.dimensions[1]).toBe(false)
  })
})

// раунд 1 валидации новой модели: торец внутри тела, сравнение набора, невалидное auto, закрытая грань
describe("AD-28: свободный торец не лежит на оси и внутри тела другой стены", () => {
  it("торец ножки на оси или внутри тела перекладины толщины не получает (оба порядка фиксации)", () => {
    for (const endY of [-5, 0]) {
      for (const swap of [false, true]) {
        const W = w(0, 0, 500, 0, "W")
        const S = w(250, -300, 250, endY, "S")
        const after = placeAll(swap ? [S, W] : [W, S])
        const s = split(after, S)
        expect(s.thickness, `endY=${endY} swap=${swap}`).toHaveLength(1)
        expectThickness(s.thickness[0], S, 0, -1)
        expect(split(after, W).thickness, `endY=${endY} swap=${swap} W`).toHaveLength(2)
      }
    }
  })
})

describe("AD-29/AD-30: сравнение набора при пересчёте", () => {
  const W = () => w(0, 0, 500, 0, "W")
  const edge = (wallId: string, e: number) => ({ wallId, edge: e })

  it("AD-29: набор того же числа размеров, но с иной точкой замера или смещением, заменяется целиком", () => {
    const base = placeAll([W()])
    const target = base.dimensions.find((x) => x.offset === 20 && Math.abs(measure(x, base.walls).length - 500) < 1e-6)
    if (!target) throw new Error("нет размера")
    const pairs: [Dimension, Dimension][] = [
      ...base.dimensions.map((d): [Dimension, Dimension] => [d, { ...d, offset: d.offset * 2 }]),
      [target, { ...target, from: { a: edge("W", 1), b: edge("W", 2) } }],
      [target, { ...target, to: { a: edge("W", 1), b: edge("W", 3) } }],
    ]
    for (const [original, mod] of pairs) {
      const scene: Scene = { ...base, dimensions: base.dimensions.map((d) => (d === original ? mod : d)) }
      const synced = syncAutoDimensions(scene)
      expect(synced.dimensions).toHaveLength(4)
      expect(synced.dimensions).not.toContainEqual(mod)
      for (const d of base.dimensions) expect(synced.dimensions).toContainEqual(d)
    }
  })

  it("AD-30: неизменившийся набор остаётся без изменений (эквивалентная запись точки сохраняется)", () => {
    const A = w(0, 0, 500, 0, "A")
    const base = placeAll([A, w(0, 300, 500, 300, "B"), w(0, 600, 500, 600, "C")])
    const target = base.dimensions.find((d) => d.auto === "A" && d.offset === 20 && Math.abs(measure(d, base.walls).length - 500) < 1e-6)
    if (!target) throw new Error("нет размера")
    const swapped: Dimension = { ...target, from: { a: target.from.b, b: target.from.a } }
    const prepared: Scene = { ...base, dimensions: base.dimensions.map((d) => (d === target ? swapped : d)) }
    const after = placeWall(prepared, w(250, 310, 250, 500, "T"))
    if (!after) throw new Error("стена не зафиксирована")
    expect(dimsOf(after, "B").length).toBeGreaterThan(4)
    expect(after.dimensions).toContainEqual(swapped)
    expect(after.dimensions).not.toContainEqual(target)
  })
})

describe("AD-31: некорректное поле auto отклоняет только размер", () => {
  const wall = w(0, 0, 300, 0, "w1")
  const marked: Dimension = {
    from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
    to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
    offset: 40,
    auto: "w1",
  }
  const plain: Dimension = { from: marked.from, to: marked.to, offset: 50 }
  const drawing = (dims: unknown[]): unknown => ({ id: "a", name: "t", walls: [wall], dimensions: dims, view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100 })
  it("чертёж, стены и остальные размеры загружаются", () => {
    const loaded = parseStore(JSON.stringify({ version: 3, activeId: "a", drawings: [drawing([plain, { ...marked, auto: 5 }, marked])] }))
    expect(loaded).not.toBeNull()
    expect(loaded?.store.drawings[0].walls).toHaveLength(1)
    expect(loaded?.store.drawings[0].dimensions).toEqual([plain, marked])
  })
})

describe("AD-32: грань, целиком закрытая телом другой стены", () => {
  it("AD-32: стена целиком внутри тела другой стены не получает размеров (оба порядка фиксации)", () => {
    for (const swap of [false, true]) {
      const W = w(0, 0, 500, 0, "W", 40)
      const S = w(100, 0, 300, 0, "S", 20)
      const scene = placeAll(swap ? [S, W] : [W, S])
      expect(dimsOf(scene, "S"), `swap=${swap}`).toEqual([])
      expect(dimsOf(scene, "W"), `swap=${swap}`).toHaveLength(4)
      expect(scene.dimensions, `swap=${swap}`).toHaveLength(4)
    }
  })
})

// раунд 2 валидации новой модели: пороги по размеру, сдвиг одной точки, стык в допуске, поворот чертежа
describe("AD-33: короткие куски и стена с большим числом размеров", () => {
  const W = () => w(0, 0, 500, 0, "W")
  const legs = () => [w(60, -10, 60, -300, "S1"), w(150, -10, 150, -300, "S2"), w(250, -10, 250, -300, "S3"), w(486, -10, 486, -300, "S4")]

  it("каждый видимый кусок получает размер, в том числе короткий (4 и 50 см); четыре ножки подряд", () => {
    for (const reverse of [false, true]) {
      const order = reverse ? [W(), ...legs().reverse()] : [W(), ...legs()]
      const scene = placeAll(order)
      const Ws = W()
      const s = split(scene, Ws)
      const pieces: [number, number][] = [[0, 50], [70, 140], [160, 240], [260, 476], [496, 500]]
      expect(s.minus, `reverse=${reverse}`).toHaveLength(5)
      pieces.forEach(([t0, t1], i) => expectLength(s.minus[i], Ws, -1, t0, t1))
      expect(s.plus).toHaveLength(1)
      expectLength(s.plus[0], Ws, 1, 0, 500)
      expect(s.thickness).toHaveLength(2)
      expect(dimsOf(scene, "W"), `reverse=${reverse}`).toHaveLength(8)
    }
  })
})

describe("AD-34: короткая стена", () => {
  it("стена длиной 10 см получает четыре размера: длины по 10 и толщины по 20", () => {
    const S = w(0, 0, 10, 0, "S")
    const scene = placeAll([S])
    expect(scene.dimensions).toHaveLength(4)
    const s = split(scene, S)
    expectLength(s.plus[0], S, 1, 0, 10)
    expectLength(s.minus[0], S, -1, 0, 10)
    expectThickness(s.thickness[0], S, 0, -1)
    expectThickness(s.thickness[1], S, 10, 1)
  })
})

describe("AD-35: пересчёт стены с единственным автоматическим размером", () => {
  it("у стены остался один автоматический размер (остальные переданы пользователю) — новая стена заменяет его новым набором", () => {
    const base = placeAll([w(0, 0, 500, 0, "W")])
    const keep = base.dimensions.find((d) => d.offset === -20 && Math.abs(measure(d, base.walls).length - 500) < 1e-6)
    if (!keep) throw new Error("нет размера")
    const released: Dimension[] = base.dimensions.map((d) => (d === keep ? d : { from: d.from, to: d.to, offset: d.offset }))
    const prepared: Scene = { ...base, dimensions: released }
    const after = placeWall(prepared, w(250, -10, 250, -300, "S"))
    if (!after) throw new Error("стена не зафиксирована")
    expect(dimsOf(after, "W")).toHaveLength(5)
    expect(after.dimensions).not.toContainEqual(keep)
    expect(after.dimensions.filter((d) => d.auto === undefined)).toHaveLength(3)
  })
})

describe("AD-37: кусок укорачивается без изменения числа размеров", () => {
  it("ножка у края грани сдвигает только одну точку замера — размер заменён (оба конца, оба порядка)", () => {
    for (const x of [5, 495]) {
      for (const swap of [false, true]) {
        const Wl = w(0, 0, 500, 0, "W")
        const S = w(x, -300, x, -10, "S")
        const base = placeAll([Wl])
        const scene = placeAll(swap ? [S, Wl] : [Wl, S])
        const after = swap ? scene : placeWall(base, S)
        if (!after) throw new Error("стена не зафиксирована")
        const s = split(after, Wl)
        expect(dimsOf(after, "W"), `x=${x} swap=${swap}`).toHaveLength(4)
        expect(s.minus, `x=${x} swap=${swap}`).toHaveLength(1)
        if (x === 5) expectLength(s.minus[0], Wl, -1, 15, 500)
        else expectLength(s.minus[0], Wl, -1, 0, 485)
        expectLength(s.plus[0], Wl, 1, 0, 500)
        expect(s.thickness).toHaveLength(2)
      }
    }
  })
})

describe("AD-36: торец, стыкующийся с другой стеной в пределах допуска вершины стыка, толщины не получает", () => {
  it("угол: конец V смещён от конца W на 8 см (меньше полутолщины 10) — на стыкующихся торцах толщины нет, на свободных есть", () => {
    for (const swap of [false, true]) {
      const W = w(0, 0, 500, 0, "W")
      const V = w(500, 8, 500, 400, "V")
      const scene = placeAll(swap ? [V, W] : [W, V])
      const a = split(scene, W)
      expect(a.thickness, `swap=${swap}`).toHaveLength(1)
      expectThickness(a.thickness[0], W, 0, -1)
      const b = split(scene, V)
      expect(b.thickness, `swap=${swap}`).toHaveLength(1)
      expectThickness(b.thickness[0], V, 392, 1)
    }
  })
})

// AD-38: набор размеров не зависит от поворота чертежа целиком (T, угол, крест, комната в 24 порядках)
const rotate = (x: Wall, rad: number): Wall => {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const r = (p: { x: number; y: number }) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c })
  return { ...x, a: r(x.a), b: r(x.b) }
}
const signature = (walls: readonly Wall[]): string => {
  const scene = placeAll(walls)
  expectOutsideBodies(scene)
  return scene.dimensions
    .map((d) => `${d.auto} ${measure(d, scene.walls).length.toFixed(3)} ${d.offset}`)
    .sort()
    .join("|")
}
const ANGLES = [Math.PI / 6, Math.PI / 4, 0.1, Math.PI / 2, Math.PI]

describe("AD-38: поворот чертежа не меняет набор размеров", () => {
  const cases: [string, () => Wall[]][] = [
    ["ножка (T)", () => [w(0, 0, 500, 0, "W"), w(250, -10, 250, -300, "S")]],
    ["угол", () => [w(0, 0, 500, 0, "W"), w(500, 0, 500, 400, "V")]],
    ["крест", () => [w(0, 0, 500, 0, "W"), w(250, -200, 250, 200, "S")]],
  ]
  for (const [name, make] of cases) {
    it(`${name}: размеры повёрнутого чертежа совпадают с размерами неповёрнутого`, () => {
      const base = signature(make())
      for (const angle of ANGLES) expect(signature(make().map((x) => rotate(x, angle))), `${name} ${angle}`).toBe(base)
    })
  }

  it("комната из четырёх стен, повёрнутая на 30 и 45 градусов: во всех 24 порядках те же восемь размеров", () => {
    const make = (): Wall[] => [w(0, 0, 500, 0, "A"), w(500, 0, 500, 400, "B"), w(500, 400, 0, 400, "C"), w(0, 400, 0, 0, "D")]
    const base = signature(make())
    for (const angle of [Math.PI / 6, Math.PI / 4, 0.1]) {
      for (const order of permutations(make().map((x) => rotate(x, angle)))) {
        expect(signature(order), `${angle} ${order.map((x) => x.id).join("")}`).toBe(base)
      }
    }
  })
})


// проверка мутантами на реализации: узкие ножки и короткие куски
describe("AD-39: узкая ножка и куски короче сантиметра", () => {
  it("ножка толщиной 4 см делит грань на 98 и 398 с зазором 4 см — куски не склеиваются", () => {
    const Wl = w(0, 0, 500, 0, "W")
    const scene = placeAll([Wl, w(100, -10, 100, -300, "S", 4)])
    const s = split(scene, Wl)
    expect(s.minus).toHaveLength(2)
    expectLength(s.minus[0], Wl, -1, 0, 98)
    expectLength(s.minus[1], Wl, -1, 102, 500)
  })

  it("ножка у края оставляет кусок 0.5 см — он получает размер", () => {
    const Wl = w(0, 0, 500, 0, "W")
    const scene = placeAll([Wl, w(2.5, -10, 2.5, -300, "S", 4)])
    const s = split(scene, Wl)
    expect(s.minus).toHaveLength(2)
    expectLength(s.minus[0], Wl, -1, 0, 0.5)
    expectLength(s.minus[1], Wl, -1, 4.5, 500)
  })
})
