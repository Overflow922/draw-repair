import { describe, expect, it } from "vitest"
import { moveWalls, snapOthers } from "./geometry"
import { snapRadiusCm, snapVertex } from "./wall-geometry"
import type { Point, Wall } from "./types"

// change wall-move-face-joints: угловой стык на грани (концы на расстоянии ≤ √(h₁²+h₂²))
// и T-примыкание к грани при перемещении стен. Толщина по умолчанию 20 см (h = 10),
// диагональ угла 10√2 ≈ 14.142, прежний допуск 1.25·h = 12.5.

const wall = (ax: number, ay: number, bx: number, by: number, id: string, thicknessCm = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

const D: Point = { x: 7, y: 3 }
const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })

// прямоугольник 400×300, замыкающая стена w4 оканчивается на грани w1 у торца —
// точка, которую ставит прилипание к грани у торца: (hN, hG) от конца оси w1
const loop = (): Wall[] => [
  wall(0, 0, 400, 0, "w1"),
  wall(400, 0, 400, 300, "w2"),
  wall(400, 300, 0, 300, "w3"),
  wall(0, 300, 10, 10, "w4"),
]

// пары концов в углах контура: [w1.b, w2.a], [w2.b, w3.a], [w3.b, w4.a], [w4.b, w1.a]
const cornerVectors = (w: Wall[]): Point[] => [
  sub(w[0].b, w[1].a),
  sub(w[1].b, w[2].a),
  sub(w[2].b, w[3].a),
  sub(w[3].b, w[0].a),
]

describe("moveWalls: угловой стык на грани", () => {
  it("FJ-1: конец соседа в угловом стыке на грани смещается тем же вектором, второй конец на месте", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(10, 10, 10, 90, "n")
    const before = sub(n.a, g1.a)
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 17, y: 13 })
    expect(n.b).toEqual({ x: 10, y: 90 })
    expect(sub(n.a, g1.a)).toEqual(before)
  })

  it("FJ-1b: угол на противоположной грани следует концом", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(10, -10, 10, -90, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 17, y: -7 })
    expect(n.b).toEqual({ x: 10, y: -90 })
  })

  it("FJ-1c: угол у дальнего торца (конец b) следует концом", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(90, 10, 90, 90, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 97, y: 13 })
    expect(n.b).toEqual({ x: 90, y: 90 })
  })

  it("FJ-2: перемещение опирающейся стены уводит стыковой конец стены, на грань которой она опирается", () => {
    const w1 = wall(0, 0, 400, 0, "w1")
    const w4 = wall(0, 300, 10, 10, "w4")
    const before = sub(w4.b, w1.a)
    moveWalls([w1, w4], [w4], D)
    expect(w1.a).toEqual({ x: 7, y: 3 })
    expect(w1.b).toEqual({ x: 400, y: 0 })
    expect(sub(w4.b, w1.a)).toEqual(before)
  })

  it("FJ-3: замкнутый контур не рвётся при перемещении любой его стены", () => {
    for (let i = 0; i < 4; i++) {
      const w = loop()
      const orig = loop()
      const corners = cornerVectors(w)
      moveWalls(w, [w[i]], D)
      expect(cornerVectors(w)).toEqual(corners)
      // противоположная стена контура — не соседняя с перемещаемой — не сдвинулась
      const opp = (i + 2) % 4
      expect(w[opp].a).toEqual(orig[opp].a)
      expect(w[opp].b).toEqual(orig[opp].b)
    }
  })

  it("FJ-3i: контур, замкнутый реальным прилипанием к грани (snapVertex), не рвётся", () => {
    const w1 = wall(0, 0, 400, 0, "w1")
    const w2 = wall(400, 0, 400, 300, "w2")
    const w3 = wall(400, 300, 0, 300, "w3")
    // курсор в теле w1 у торца — вершина прилипает к грани с отступом полутолщины новой стены
    const snapped = snapVertex({ x: 4, y: 6 }, [w1, w2, w3], snapRadiusCm(1), 10, 20)
    expect(snapped.source).toBe("wall")
    const w4 = wall(0, 300, snapped.point.x, snapped.point.y, "w4")
    const w = [w1, w2, w3, w4]
    const corners = cornerVectors(w)
    moveWalls(w, [w1], D)
    expect(cornerVectors(w)).toEqual(corners)
    expect(w4.a).toEqual({ x: 0, y: 300 })
  })

  it("FJ-4: протяжка серией шагов равна одному суммарному шагу (прямое направление)", () => {
    const s = loop()
    for (let k = 0; k < 20; k++) moveWalls(s, [s[0]], { x: 0, y: 5 })
    const one = loop()
    moveWalls(one, [one[0]], { x: 0, y: 100 })
    expect(s.map((w) => [w.a, w.b])).toEqual(one.map((w) => [w.a, w.b]))
    expect(s[3].b).toEqual({ x: 10, y: 110 })
  })

  it("FJ-4b: протяжка опирающейся стены с поворотом соседа не теряет стык", () => {
    const s = loop()
    for (let k = 0; k < 20; k++) moveWalls(s, [s[3]], { x: 0, y: 5 })
    const one = loop()
    moveWalls(one, [one[3]], { x: 0, y: 100 })
    expect(s.map((w) => [w.a, w.b])).toEqual(one.map((w) => [w.a, w.b]))
    // w1 повернулась вокруг неподвижного конца b, её конец a ушёл за w4 на весь путь
    expect(s[0].a).toEqual({ x: 0, y: 100 })
    expect(s[0].b).toEqual({ x: 400, y: 0 })
  })
})

describe("moveWalls: граница углового стыка и допуск конца", () => {
  it("FJ-B1: конец ровно на диагонали угла от конца оси (граница включительно) привязан", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const x = 100 + 10 * Math.SQRT2
    const n = wall(x, 0, x, 80, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: x + 7, y: 3 })
    expect(n.b).toEqual({ x, y: 80 })
  })

  it("FJ-B2: конец на грани чуть дальше диагонали с запасом 1 см — T к грани, стена смещается целиком", () => {
    // change fix-wall-move-joints: порог 10√2 + 1 ≈ 15.14; √(11.5² + 10²) ≈ 15.24
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(11.5, 10, 11.5, 90, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 18.5, y: 13 })
    expect(n.b).toEqual({ x: 18.5, y: 93 })
  })

  it("FJ-B0: конец на оси за торцом в 14 см (внутри диагонали, вне прежних 12.5) привязан", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(114, 0, 114, 80, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 121, y: 3 })
    expect(n.b).toEqual({ x: 114, y: 80 })
  })

  it("FJ-B3: разные толщины — действует бо́льший допуск 1.25·h (25 см > диагонали 20.6)", () => {
    const g1 = wall(0, 0, 100, 0, "g1", 40)
    const n = wall(124, 0, 124, 80, "n", 10)
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 131, y: 3 })
    expect(n.b).toEqual({ x: 124, y: 80 })
  })

  it("FJ-B4: разные толщины — чуть за допуском 1.25·h сосед не смещается", () => {
    const g1 = wall(0, 0, 100, 0, "g1", 40)
    const n = wall(126, 0, 126, 80, "n", 10)
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 126, y: 0 })
    expect(n.b).toEqual({ x: 126, y: 80 })
  })
})

describe("moveWalls: T-примыкание к грани", () => {
  it("FJ-5: стена, примкнутая к грани в середине, смещается целиком; точка примыкания сохраняется", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const t = wall(50, 10, 50, 80, "t")
    moveWalls([g1, t], [g1], D)
    expect(t.a).toEqual({ x: 57, y: 13 })
    expect(t.b).toEqual({ x: 57, y: 83 })
    expect(sub(t.a, g1.a)).toEqual({ x: 50, y: 10 })
  })

  it("FJ-5b: примыкание к противоположной грани тоже смещается целиком", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const t = wall(50, -10, 50, -80, "t")
    moveWalls([g1, t], [g1], D)
    expect(t.a).toEqual({ x: 57, y: -7 })
    expect(t.b).toEqual({ x: 57, y: -77 })
  })

  it("FJ-5c: примыкание к грани наклонной стены смещается целиком", () => {
    // ось g1 под 45°, конец t на грани: середина оси + нормаль × 10
    const g1 = wall(0, 0, 100, 100, "g1")
    const e = { x: 50 - 10 / Math.SQRT2, y: 50 + 10 / Math.SQRT2 }
    const t = wall(e.x, e.y, e.x - 60, e.y + 60, "t")
    const a0 = { ...t.a }
    const b0 = { ...t.b }
    moveWalls([g1, t], [g1], D)
    expect(t.a).toEqual({ x: a0.x + 7, y: a0.y + 3 })
    expect(t.b).toEqual({ x: b0.x + 7, y: b0.y + 3 })
  })

  it("FJ-10: стена между гранями двух стен группы смещается ровно на один вектор", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const g2 = wall(0, 100, 100, 100, "g2")
    const t = wall(50, 10, 50, 90, "t")
    moveWalls([g1, g2, t], [g1, g2], D)
    expect(t.a).toEqual({ x: 57, y: 13 })
    expect(t.b).toEqual({ x: 57, y: 93 })
  })
})

describe("moveWalls: отсутствие привязки", () => {
  it("FJ-N1: конец в 1 см за гранью (не на грани, не в углу) — сосед не смещается", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(50, 11, 50, 80, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 50, y: 11 })
    expect(n.b).toEqual({ x: 50, y: 80 })
  })

  it("FJ-N2: конец на продолжении грани за торцом дальше диагонали — сосед не смещается", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(-15, 10, -15, 90, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: -15, y: 10 })
    expect(n.b).toEqual({ x: -15, y: 90 })
  })

  it("FJ-6: ножка T к грани при своём перемещении не увлекает стену", () => {
    const bar = wall(0, 0, 100, 0, "bar")
    const stem = wall(50, 10, 50, 80, "stem")
    moveWalls([bar, stem], [stem], D)
    expect(bar.a).toEqual({ x: 0, y: 0 })
    expect(bar.b).toEqual({ x: 100, y: 0 })
    expect(stem.a).toEqual({ x: 57, y: 13 })
  })

  it("FJ-6b: ножка T к оси при своём перемещении не увлекает стену", () => {
    const bar = wall(0, 0, 100, 0, "bar")
    const stem = wall(50, 0, 50, 80, "stem")
    moveWalls([bar, stem], [stem], D)
    expect(bar.a).toEqual({ x: 0, y: 0 })
    expect(bar.b).toEqual({ x: 100, y: 0 })
  })
})

describe("moveWalls: групповое перемещение и стыки на грани", () => {
  it("FJ-8: в группе работают оба направления углового стыка", () => {
    const ga = wall(0, 0, 100, 0, "ga")
    const n = wall(10, 10, 10, 90, "n") // угол на грани выделенной ga
    const m = wall(300, 0, 500, 0, "m")
    const gb = wall(300, 300, 310, 10, "gb") // конец выделенной gb — угол на грани невыделенной m
    moveWalls([ga, n, m, gb], [ga, gb], D)
    expect(n.a).toEqual({ x: 17, y: 13 })
    expect(n.b).toEqual({ x: 10, y: 90 })
    expect(m.a).toEqual({ x: 307, y: 3 })
    expect(m.b).toEqual({ x: 500, y: 0 })
  })

  it("FJ-9: групповое перемещение двух смежных стен контура не рвёт углы", () => {
    const w = loop()
    const corners = cornerVectors(w)
    moveWalls(w, [w[0], w[1]], D)
    expect(cornerVectors(w)).toEqual(corners)
    expect(w[3].a).toEqual({ x: 0, y: 300 })
    expect(w[2].b).toEqual({ x: 0, y: 300 })
  })
})

describe("moveWalls: разные толщины в стыках на грани", () => {
  // g1 20 см (hG = 10), сосед 18 см (hN = 9): угол прилипания (9, 10), диагональ ≈ 13.45 > 1.25·10 = 12.5
  const cornerPoint = (): Point => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const r = snapVertex({ x: 4, y: 6 }, [g1], snapRadiusCm(1), 10, 18)
    expect(r.source).toBe("wall")
    expect(r.point).toEqual({ x: 9, y: 10 })
    return r.point
  }

  it("FJ-T1: угол на грани между стенами 20 и 18 см — стыковой конец следует, второй на месте", () => {
    const p = cornerPoint()
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(p.x, p.y, p.x, 90, "n", 18)
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 16, y: 13 })
    expect(n.b).toEqual({ x: 9, y: 90 })
  })

  it("FJ-T2: угол 20/18 см в обратном направлении — перемещение опирающейся стены уводит конец стены с гранью", () => {
    const p = cornerPoint()
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(p.x, 90, p.x, p.y, "n", 18)
    moveWalls([g1, n], [n], D)
    expect(g1.a).toEqual({ x: 7, y: 3 })
    expect(g1.b).toEqual({ x: 100, y: 0 })
  })

  it("FJ-T3: перегородка 10 см примкнута к грани стены 20 см (lat = hG = 10) — смещается целиком", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const t = wall(50, 10, 50, 80, "t", 10)
    moveWalls([g1, t], [g1], D)
    expect(t.a).toEqual({ x: 57, y: 13 })
    expect(t.b).toEqual({ x: 57, y: 83 })
  })

  it("FJ-T4: стена 20 см примкнута к грани перегородки 10 см (lat = hG = 5) — смещается целиком", () => {
    const g1 = wall(0, 0, 100, 0, "g1", 10)
    const t = wall(50, 5, 50, 80, "t")
    moveWalls([g1, t], [g1], D)
    expect(t.a).toEqual({ x: 57, y: 8 })
    expect(t.b).toEqual({ x: 57, y: 83 })
  })

  it("FJ-T5: стыки на грани при разных толщинах исключены из привязки", () => {
    const p = cornerPoint()
    const g20 = wall(0, 0, 100, 0, "g20")
    const corner = wall(p.x, p.y, p.x, 90, "corner", 18)
    const t10 = wall(50, 10, 50, 80, "t10", 10)
    const f = wall(300, 0, 300, 100, "f")
    expect(snapOthers([g20, corner, t10, f], [g20])).toEqual([f])
    const g10 = wall(0, 0, 100, 0, "g10", 10)
    const t20 = wall(50, 5, 50, 80, "t20")
    expect(snapOthers([g10, t20, f], [g10])).toEqual([f])
  })
})

describe("moveWalls: устойчивость и точность T к грани", () => {
  it("FJ-4c: протяжка стены с T к грани серией шагов равна одному суммарному шагу", () => {
    const make = (): Wall[] => [wall(0, 0, 100, 0, "g1"), wall(50, 10, 50, 80, "t")]
    const s = make()
    for (let k = 0; k < 20; k++) moveWalls(s, [s[0]], { x: 1, y: 5 })
    const one = make()
    moveWalls(one, [one[0]], { x: 20, y: 100 })
    expect(s.map((w) => [w.a, w.b])).toEqual(one.map((w) => [w.a, w.b]))
    expect(s[1].a).toEqual({ x: 70, y: 110 })
    expect(s[1].b).toEqual({ x: 70, y: 180 })
  })

  it("FJ-N3: конец в 0.1 см от грани (не на грани, не в углу) — сосед не смещается", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(50, 10.1, 50, 80, "n")
    moveWalls([g1, n], [g1], D)
    expect(n.a).toEqual({ x: 50, y: 10.1 })
    expect(n.b).toEqual({ x: 50, y: 80 })
  })
})

describe("snapOthers: стыки на грани", () => {
  it("FJ-7: угловой стык на грани и T к грани исключены из привязки, несвязанная участвует", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const corner = wall(10, 10, 10, 90, "corner")
    const tFace = wall(50, 10, 50, 80, "tFace")
    const f = wall(300, 0, 300, 100, "f")
    expect(snapOthers([g1, corner, tFace, f], [g1])).toEqual([f])
  })

  it("FJ-7b: при перемещении опирающейся стены стена с гранью угла исключена из привязки", () => {
    const w = loop()
    expect(snapOthers(w, [w[3]])).toEqual([w[1]])
  })
})
