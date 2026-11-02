import { describe, expect, it } from "vitest"
import type { Point, SectionView } from "../types"
import { checkSectionLine, nextSectionLabel, sectionSegments, viewAxis } from "./section-line"

// change add-section-view: линия разреза (spec section-view «Линия разреза»)

const pts = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }))

describe("допустимость линии", () => {
  it("SV-01: прямая линия — один рабочий отрезок", () => {
    expect(checkSectionLine(pts([200, -100], [200, 100]), "right")).toEqual({ ok: true })
  })

  it("SV-02: ступенчатая линия из трёх отрезков допустима", () => {
    expect(checkSectionLine(pts([0, 0], [100, 0], [100, 40], [200, 40]), "down")).toEqual({ ok: true })
  })

  it("SV-03: Г-образная линия (два отрезка) отклоняется как чётная", () => {
    expect(checkSectionLine(pts([0, 0], [100, 0], [100, 40]), "down")).toEqual({ ok: false, reason: "even-segments" })
  })

  it("SV-04: возврат назад отклоняется", () => {
    expect(checkSectionLine(pts([0, 0], [100, 0], [100, 40], [40, 40]), "down")).toEqual({ ok: false, reason: "backwards" })
  })

  it("SV-05: косой отрезок отклоняется", () => {
    expect(checkSectionLine(pts([0, 0], [100, 30]), "down")).toEqual({ ok: false, reason: "not-axis" })
  })

  it("SV-06: рабочий отрезок вдоль взгляда отклоняется", () => {
    expect(checkSectionLine(pts([0, 0], [100, 0]), "right")).toEqual({ ok: false, reason: "not-axis" })
  })

  it("SV-07: меньше двух вершин отклоняется", () => {
    expect(checkSectionLine(pts([0, 0]), "up")).toEqual({ ok: false, reason: "too-few" })
  })

  it("SV-08: отрезок нулевой длины отклоняется", () => {
    expect(checkSectionLine(pts([0, 0], [0, 0]), "up")).toEqual({ ok: false, reason: "zero-length" })
  })

  it("SV-09: ступенька допускает обе стороны", () => {
    expect(checkSectionLine(pts([0, 0], [100, 0], [100, -40], [200, -40]), "down")).toEqual({ ok: true })
  })
})

describe("оси и отрезки", () => {
  it.each<[SectionView, Point]>([
    ["up", { x: 1, y: 0 }],
    ["down", { x: -1, y: 0 }],
    ["right", { x: 0, y: 1 }],
    ["left", { x: 0, y: -1 }],
  ])("SV-10: ось u для %s", (view, u) => {
    expect(viewAxis(view)).toEqual(u)
  })

  it("SV-11: рабочие отрезки и ступеньки чередуются, начиная с рабочего", () => {
    const segs = sectionSegments(pts([0, 0], [100, 0], [100, 40], [200, 40]))
    expect(segs.map((s) => s.working)).toEqual([true, false, true])
    expect(segs[1]).toEqual({ a: { x: 100, y: 0 }, b: { x: 100, y: 40 }, working: false, index: 0 })
  })

  it("SV-12: рабочие отрезки нумеруются по порядку без учёта ступенек", () => {
    const segs = sectionSegments(pts([0, 0], [100, 0], [100, 40], [200, 40], [200, 80], [300, 80]))
    expect(segs.filter((s) => s.working).map((s) => s.index)).toEqual([0, 1, 2])
  })
})

describe("обозначение", () => {
  it("SV-13: первая линия получает A", () => {
    expect(nextSectionLabel([])).toBe("A")
  })

  it("SV-14: после удаления A новая линия получает A, B остаётся", () => {
    expect(nextSectionLabel(["B"])).toBe("A")
  })

  it("SV-15: берётся первая свободная буква", () => {
    expect(nextSectionLabel(["A", "B", "D"])).toBe("C")
  })

  it("SV-16: после Z обозначение продолжается с цифрой", () => {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
    expect(nextSectionLabel(all)).toBe("A1")
    expect(nextSectionLabel([...all, "A1"])).toBe("B1")
  })
})
