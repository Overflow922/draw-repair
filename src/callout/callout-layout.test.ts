import { describe, expect, it } from "vitest"
import { VIEW, toScreen } from "../doorway/doorway.test-utils"
import { PDF_METRICS, SCREEN_METRICS } from "../render"
import type { Point, View } from "../types"
import { calloutLayout } from "./callout-layout"
import type { CalloutLayout } from "./callout-layout"
import { A, B, callout, measure } from "./callout.test-utils"

// change add-callout: раскладка текста, выравнивание, линия и стрелка (spec callout «Отображение выноски»; design D6; test-plan C-LAY-*).
// Вид VIEW: 2 px на см, pan (−100, −100): at A (100,100) → (400,400), target A (300,100) → (800,400);
// at B (150,200) → (500,600), target B (50,100) → (300,400). Шрифт 14 px, ширина строки — 7 px на символ.

const m = SCREEN_METRICS
const lay = (c = A(), view: View = VIEW, metrics = m): CalloutLayout => calloutLayout(c, view, metrics, measure)

const insideBox = (p: Point, box: CalloutLayout["box"]): boolean => {
  const eps = 1e-6
  return p.x > box.x + eps && p.x < box.x + box.w - eps && p.y > box.y + eps && p.y < box.y + box.h - eps
}

describe("выравнивание по стороне стрелки", () => {
  it("C-LAY-1: стрелка правее текста — выравнивание вправо: правый край каждой строки у точки текста", () => {
    const l = lay(A())
    expect(l.align).toBe("right")
    expect(l.lines).toHaveLength(2)
    expect(l.lines[0].x + measure("Монтаж радиатора")).toBeCloseTo(400, 6)
    expect(l.lines[1].x + measure("в нишу")).toBeCloseTo(400, 6)
  })

  it("C-LAY-2: стрелка левее текста — выравнивание влево: левый край строки у точки текста", () => {
    const l = lay(B())
    expect(l.align).toBe("left")
    expect(l.lines[0].x).toBeCloseTo(500, 6)
    expect(l.lines[0].y).toBeCloseTo(600, 6)
  })

  it("C-LAY-3: стрелка на одной вертикали с текстом — выравнивание влево", () => {
    const l = lay(callout("c", { x: 150, y: 50 }, { x: 150, y: 200 }, "Тест"))
    expect(l.align).toBe("left")
    expect(l.lines[0].x).toBeCloseTo(toScreen({ x: 150, y: 0 }).x, 6)
  })

  it("C-LAY-3b: стрелка на 0,01 см правее — выравнивание вправо", () => {
    const l = lay(callout("c", { x: 150.01, y: 50 }, { x: 150, y: 200 }, "Тест"))
    expect(l.align).toBe("right")
    expect(l.lines[0].x + measure("Тест")).toBeCloseTo(toScreen({ x: 150, y: 0 }).x, 6)
  })

  it("C-LAY-3c: перенос текста на другую сторону от стрелки меняет выравнивание", () => {
    const before = lay(callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "Тест"))
    const after = lay(callout("c", { x: 300, y: 100 }, { x: 400, y: 100 }, "Тест"))
    expect(before.align).toBe("right")
    expect(after.align).toBe("left")
  })
})

describe("строки текста", () => {
  it("C-LAY-4: две строки — первая выше второй, порядок ввода, нижняя кромка первой на уровне точки текста", () => {
    const l = lay(A())
    expect(l.lines.map((s) => s.text)).toEqual(["Монтаж радиатора", "в нишу"])
    expect(l.lines[0].y).toBeCloseTo(400, 6)
    const gap = l.lines[1].y - l.lines[0].y
    expect(gap).toBeGreaterThanOrEqual(m.labelPx)
    expect(gap).toBeLessThanOrEqual(2 * m.labelPx)
  })

  it("C-LAY-5: пять строк с пустой — все строки на месте, интервал между строками один и тот же", () => {
    const l = lay(callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "а\n\nб\nв\nг"))
    expect(l.lines.map((s) => s.text)).toEqual(["а", "", "б", "в", "г"])
    const gaps = l.lines.slice(1).map((s, i) => s.y - l.lines[i].y)
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 9)
    expect(gaps[0]).toBeGreaterThanOrEqual(m.labelPx)
  })

  it("C-LAY-5b: интервал не зависит от числа строк и от текста", () => {
    const two = lay(callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "а\nб"))
    const five = lay(callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "а\nб\nв\nг\nд"))
    expect(five.lines[1].y - five.lines[0].y).toBeCloseTo(two.lines[1].y - two.lines[0].y, 9)
  })

  it("C-LAY-5c: при выравнивании влево строки разной длины начинаются на одном левом краю", () => {
    const l = lay(callout("c", { x: 0, y: 0 }, { x: 150, y: 200 }, "длинная строка\nк"))
    expect(l.lines[0].x).toBeCloseTo(500, 6)
    expect(l.lines[1].x).toBeCloseTo(500, 6)
  })
})

describe("линия, стрелка и подложка", () => {
  it("C-LAY-6: вправо — линия начинается на уровне нижней кромки первой строки у её правого края, снаружи текста", () => {
    const l = lay(A())
    expect(l.lineStart.y).toBeCloseTo(400, 6)
    expect(l.lineStart.x).toBeGreaterThanOrEqual(400 - 1e-6)
    expect(l.lineStart.x).toBeLessThanOrEqual(400 + 0.5 * m.labelPx + 1e-6)
  })

  it("C-LAY-7: влево — линия начинается у левого края первой строки, снаружи текста, на её нижней кромке", () => {
    const l = lay(B())
    expect(l.lineStart.y).toBeCloseTo(600, 6)
    expect(l.lineStart.x).toBeLessThanOrEqual(500 + 1e-6)
    expect(l.lineStart.x).toBeGreaterThanOrEqual(500 - 0.5 * m.labelPx - 1e-6)
  })

  it("C-LAY-7b: линия от начала до стрелки не заходит внутрь подложки (обе выноски сцены)", () => {
    for (const c of [A(), B()]) {
      const l = lay(c)
      for (let i = 0; i <= 50; i++) {
        const t = i / 50
        const p = { x: l.lineStart.x + (l.arrowTip.x - l.lineStart.x) * t, y: l.lineStart.y + (l.arrowTip.y - l.lineStart.y) * t }
        expect(insideBox(p, l.box), `${c.id} t=${t}`).toBe(false)
      }
    }
  })

  it("C-LAY-8: подложка охватывает прямоугольники всех строк", () => {
    for (const c of [A(), B(), callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "а\n\nб\nвсё длинное\nг")]) {
      const l = lay(c)
      expect(l.box.w).toBeGreaterThan(0)
      expect(l.box.h).toBeGreaterThan(0)
      for (const s of l.lines) {
        expect(l.box.x).toBeLessThanOrEqual(s.x + 1e-6)
        expect(l.box.x + l.box.w).toBeGreaterThanOrEqual(s.x + measure(s.text) - 1e-6)
        expect(l.box.y).toBeLessThanOrEqual(s.y - m.labelPx + 1e-6)
        expect(l.box.y + l.box.h).toBeGreaterThanOrEqual(s.y - 1e-6)
      }
    }
  })

  it("C-LAY-8b: подложка охватывает самую длинную строку, а не только первую", () => {
    const l = lay(callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "к\nочень длинная вторая строка"))
    expect(l.box.w).toBeGreaterThanOrEqual(measure("очень длинная вторая строка"))
  })

  it("C-LAY-8c: при выравнивании влево подложка охватывает самую длинную строку, а не первую", () => {
    const c = callout("c", { x: 0, y: 0 }, { x: 150, y: 200 }, "к\nочень длинная вторая строка")
    const l = lay(c)
    expect(l.align).toBe("left")
    expect(l.box.x + l.box.w).toBeGreaterThanOrEqual(l.lines[1].x + measure("очень длинная вторая строка") - 1e-6)
    expect(l.box.w).toBeGreaterThanOrEqual(measure("очень длинная вторая строка"))
  })

  it("C-LAY-8d: выравнивание влево, самая длинная строка первая или средняя — подложка охватывает её", () => {
    for (const text of ["очень длинная первая строка\nк", "к\nочень длинная средняя строка\nм"]) {
      const l = lay(callout("c", { x: 0, y: 0 }, { x: 150, y: 200 }, text))
      const longest = Math.max(...text.split("\n").map(measure))
      expect(l.align).toBe("left")
      expect(l.box.x + l.box.w).toBeGreaterThanOrEqual(l.lines[0].x + longest - 1e-6)
      expect(l.box.w).toBeGreaterThanOrEqual(longest)
    }
  })

  it("C-LAY-10: конец стрелки — точка стрелки в экранных координатах", () => {
    const l = lay(A())
    expect(l.arrowTip.x).toBeCloseTo(800, 6)
    expect(l.arrowTip.y).toBeCloseTo(400, 6)
  })
})

describe("перевод в экранные координаты и зум", () => {
  it("C-LAY-9: pan и зум учитываются: зум 2, pan (0, 0)", () => {
    const view: View = { zoom: 2, pan: { x: 0, y: 0 } }
    const l = lay(A(), view)
    expect(l.arrowTip.x).toBeCloseTo(300 * 4, 6)
    expect(l.arrowTip.y).toBeCloseTo(100 * 4, 6)
    expect(l.lines[0].y).toBeCloseTo(100 * 4, 6)
    expect(l.lines[0].x + measure("Монтаж радиатора")).toBeCloseTo(100 * 4, 6)
  })

  it("C-LAY-12: дробные координаты не округляются", () => {
    const c = callout("c", { x: 300.37, y: 20.5 }, { x: 100.37, y: 20.5 }, "Тест")
    const l = lay(c)
    const s = toScreen({ x: 100.37, y: 20.5 })
    expect(l.lines[0].y).toBeCloseTo(s.y, 9)
    expect(l.lines[0].x + measure("Тест")).toBeCloseTo(s.x, 9)
    expect(l.arrowTip.x).toBeCloseTo(toScreen({ x: 300.37, y: 0 }).x, 9)
  })

  it("C-LAY-13: размеры текстового блока не зависят от зума (в пикселях), положение — зависит", () => {
    const small = lay(A(), { zoom: 0.5, pan: { x: -100, y: -100 } })
    const big = lay(A(), { zoom: 4, pan: { x: -100, y: -100 } })
    expect(big.box.w).toBeCloseTo(small.box.w, 9)
    expect(big.box.h).toBeCloseTo(small.box.h, 9)
    expect(big.lines[1].y - big.lines[0].y).toBeCloseTo(small.lines[1].y - small.lines[0].y, 9)
    expect(big.arrowTip.x).not.toBeCloseTo(small.arrowTip.x, 3)
  })

  it("C-LAY-14: размеры блока определяются метриками: меньший шрифт PDF — меньший интервал строк", () => {
    const screen = lay(A(), VIEW, m)
    const pdf = lay(A(), VIEW, PDF_METRICS)
    expect(pdf.lines[1].y - pdf.lines[0].y).toBeLessThan(screen.lines[1].y - screen.lines[0].y)
    expect(pdf.lines[1].y - pdf.lines[0].y).toBeGreaterThanOrEqual(PDF_METRICS.labelPx)
  })
})
