import { describe, expect, it } from "vitest"
import { VIEW } from "../doorway/doorway.test-utils"
import { SCREEN_METRICS } from "../render"
import type { Point } from "../types"
import { calloutLayout } from "./callout-layout"
import { pickCallout } from "./callout-pick"
import { A, B, RADIUS_CM, callout, measure, worldOf } from "./callout.test-utils"

// change add-callout: попадание курсора в выноску — выделение и ластик (spec callout «Выделение, перенос и правка выноски»,
// «Удаление выноски ластиком»; design D6, D9; test-plan C-PICK-*).
// Радиус привязки 6 см = 12 px. Экранные точки A: текст в строках y 386…400 и 400…414 слева от x = 400, линия от (400, 400) до (800, 400).

const pick = (list = [A(), B()], p: Point) => pickCallout(list, p, VIEW, SCREEN_METRICS, measure, RADIUS_CM)
const w = (x: number, y: number): Point => worldOf({ x, y })

describe("попадание в выноску", () => {
  it("C-PICK-1: клик по тексту выбирает выноску", () => {
    const l = calloutLayout(A(), VIEW, SCREEN_METRICS, measure)
    const first = l.lines[0]
    expect(pick([A(), B()], w(first.x + measure(first.text) / 2, first.y - SCREEN_METRICS.labelPx / 2))?.id).toBe("a")
    const second = l.lines[1]
    expect(pick([A(), B()], w(second.x + 2, second.y - 4))?.id).toBe("a")
  })

  it("C-PICK-1b: клик у самого края текста изнутри — попадание", () => {
    const l = calloutLayout(A(), VIEW, SCREEN_METRICS, measure)
    const first = l.lines[0]
    expect(pick([A()], w(first.x + 1, first.y - 1))?.id).toBe("a")
  })

  it("C-PICK-2: клик по линии выноски выбирает выноску", () => {
    expect(pick([A(), B()], w(600, 400))?.id).toBe("a")
  })

  it("C-PICK-2b: клик в окрестности стрелки выбирает выноску", () => {
    expect(pick([A()], w(795, 400))?.id).toBe("a")
  })

  it("C-PICK-3: внутри радиуса от линии — попадание", () => {
    expect(pick([A()], w(600, 400 - 12 * 0.9))?.id).toBe("a")
    expect(pick([A()], w(600, 400 + 12 * 0.9))?.id).toBe("a")
  })

  it("C-PICK-4: за радиусом от линии — мимо", () => {
    expect(pick([A()], w(600, 400 - 12 * 1.1))).toBeNull()
    expect(pick([A()], w(600, 400 + 12 * 1.1))).toBeNull()
  })

  it("C-PICK-4b: далеко за стрелкой по линии — мимо", () => {
    expect(pick([A()], w(800 + 12 * 1.5, 400))).toBeNull()
  })

  it("C-PICK-3b: ровно на радиусе от линии — попадание, чуть дальше — мимо (координаты точные: 12 px = 6 см)", () => {
    // линия A на y = 400 px (мир y = 100); радиус 6 см = 12 px
    expect(pickCallout([A()], { x: 200, y: 94 }, VIEW, SCREEN_METRICS, measure, RADIUS_CM)?.id).toBe("a")
    expect(pickCallout([A()], { x: 200, y: 106 }, VIEW, SCREEN_METRICS, measure, RADIUS_CM)?.id).toBe("a")
    expect(pickCallout([A()], { x: 200, y: 93.99 }, VIEW, SCREEN_METRICS, measure, RADIUS_CM)).toBeNull()
    expect(pickCallout([A()], { x: 200, y: 106.01 }, VIEW, SCREEN_METRICS, measure, RADIUS_CM)).toBeNull()
  })

  it("C-PICK-3c: радиус привязки задан в пикселях и масштабируется с зумом: при зуме 2 радиус 3 см — те же 12 px", () => {
    const view = { zoom: 2, pan: { x: -100, y: -100 } } // 4 px на см; линия A на y = (100 + 100) * 4 = 800 px
    const pick2 = (y: number) => pickCallout([A()], { x: 200, y }, view, SCREEN_METRICS, measure, 3)
    expect(pick2(100 - 11 / 4)?.id).toBe("a") // 11 px
    expect(pick2(100 - 13 / 4)).toBeNull() // 13 px
    const view05 = { zoom: 0.5, pan: { x: -100, y: -100 } } // 1 px на см; радиус 12 см = 12 px
    const pick05 = (y: number) => pickCallout([A()], { x: 200, y }, view05, SCREEN_METRICS, measure, 12)
    expect(pick05(100 - 11)?.id).toBe("a")
    expect(pick05(100 - 13)).toBeNull()
  })

  it("C-PICK-1c: у текста работает тот же радиус: рядом с прямоугольником текста снаружи — попадание, за радиусом — мимо", () => {
    const l = calloutLayout(A(), VIEW, SCREEN_METRICS, measure)
    const first = l.lines[0]
    const midY = first.y - SCREEN_METRICS.labelPx / 2
    expect(pick([A()], w(first.x - 8, midY))?.id).toBe("a")
    expect(pick([A()], w(first.x - 20, midY))).toBeNull() // с запасом на поле подложки
  })

  it("C-PICK-1e: над и под прямоугольником текста работает тот же радиус: рядом — попадание, далеко — мимо", () => {
    const l = calloutLayout(A(), VIEW, SCREEN_METRICS, measure)
    const first = l.lines[0]
    const second = l.lines[1]
    const midX = first.x + measure(first.text) / 2
    const top = first.y - SCREEN_METRICS.labelPx // верхняя кромка первой строки
    const bottom = second.y // нижняя кромка второй строки
    expect(pick([A()], w(midX, top - 8))?.id).toBe("a")
    expect(pick([A()], w(midX, top - 24))).toBeNull()
    expect(pick([A()], w(second.x + 3, bottom + 8))?.id).toBe("a")
    expect(pick([A()], w(second.x + 3, bottom + 24))).toBeNull()
  })

  it("C-PICK-1d: попадание по второй, более длинной строке левостороннего текста", () => {
    const c = callout("c", { x: 0, y: 0 }, { x: 150, y: 200 }, "к\nочень длинная вторая строка")
    const l = calloutLayout(c, VIEW, SCREEN_METRICS, measure)
    const second = l.lines[1]
    const rightEdge = second.x + measure(second.text)
    expect(pickCallout([c], worldOf({ x: rightEdge - 2, y: second.y - 4 }), VIEW, SCREEN_METRICS, measure, RADIUS_CM)?.id).toBe("c")
  })

  it("C-PICK-5: пустой список и пустое место — null", () => {
    expect(pick([], w(600, 400))).toBeNull()
    expect(pick([A(), B()], w(1500, 1500))).toBeNull()
  })

  it("C-PICK-6: из двух разнесённых выносок выбирается та, по которой кликнули", () => {
    expect(pick([A(), B()], w(600, 400))?.id).toBe("a")
    const lb = calloutLayout(B(), VIEW, SCREEN_METRICS, measure)
    expect(pick([A(), B()], w(lb.lines[0].x + 3, lb.lines[0].y - 4))?.id).toBe("b")
  })

  it("C-PICK-7: при нескольких попавших выбирается ближайшая к курсору, а не первая или последняя", () => {
    const x = callout("x", { x: 300, y: 100 }, { x: 100, y: 100 }, "х") // линия на y = 400 px
    const y = callout("y", { x: 300, y: 103 }, { x: 100, y: 103 }, "у") // линия на y = 406 px
    expect(pick([x, y], w(650, 400))?.id).toBe("x")
    expect(pick([y, x], w(650, 400))?.id).toBe("x")
    expect(pick([x, y], w(650, 406))?.id).toBe("y")
    expect(pick([y, x], w(650, 406))?.id).toBe("y")
  })

  it("C-PICK-7b: при равном расстоянии выбирается последняя в списке", () => {
    const first = callout("first", { x: 300, y: 100 }, { x: 100, y: 100 }, "х")
    const last = callout("last", { x: 300, y: 100 }, { x: 100, y: 100 }, "х")
    expect(pick([first, last], w(650, 400))?.id).toBe("last")
    expect(pick([last, first], w(650, 400))?.id).toBe("first")
  })
})
