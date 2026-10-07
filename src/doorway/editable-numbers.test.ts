import { describe, expect, it } from "vitest"
import { drawScene } from "../render"
import { findRooms } from "../room-area"
import type { Point, Unit, Wall, WallElement } from "../types"
import { PX_PER_CM } from "../types"
import { editableNumbers, numberAt } from "./editable-numbers"
import type { EditableNumber } from "./editable-numbers"
import { D0, UO, VIEW, door, recorder, sceneF, sceneR, texts, toScreen, w } from "./doorway.test-utils"
import { DR } from "./door.test-utils"
import { win } from "./window.test-utils"
import { CHAR_PX, LABEL_PX, chainOffsetCm, chainTextLiftCm, labelGapCm, numberOffsetPx } from "./selection-editing.test-utils"

// change popups-buttons-only: раскладка правимых чисел выделенного элемента — числа цепочек и числа подписи
// (spec doorway «Ввод чисел размеров проёма», window «Правка подписи окна»; design D1, D9).
// Эталоны: числа цепочки — середина размера на выносе 1.2 · кегль от грани; подпись — по центру проёма за
// полосой цепочки; центр числа подписи — по оценке ширины символа 0.6 · кегль.

const K = PX_PER_CM // зум 1
const off = chainOffsetCm()
const gap = labelGapCm()
const lift = chainTextLiftCm() // текст числа цепочки — над размерной линией, «вверх» на экране — к y < 0

const numbers = (d: WallElement, walls: Wall[], elements: WallElement[] = [d], unit: Unit = "cm"): EditableNumber[] =>
  editableNumbers(d, walls, elements, findRooms(walls), unit, K, LABEL_PX)

const tag = (n: EditableNumber): string => `${JSON.stringify(n.target)} ${n.text}`
const find = (list: EditableNumber[], target: object, text: string): EditableNumber => {
  const hit = list.filter((n) => JSON.stringify(n.target) === JSON.stringify(target) && n.text === text)
  if (hit.length === 0) throw new Error(`нет числа ${JSON.stringify(target)} ${text}: ${list.map(tag).join(" | ")}`)
  return hit[0]
}
const expectAt = (p: Point, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 3)
  expect(p.y).toBeCloseTo(y, 3)
}

describe("числа проёма", () => {
  it("PB-EN-01: шесть чисел цепочек и число высоты — цели, тексты и положения", () => {
    const { walls } = sceneR()
    const list = numbers(D0(), walls)
    expect(list.map(tag).sort()).toEqual(
      [
        `{"kind":"distance","side":1,"part":"a"} 90`,
        `{"kind":"width"} 90`,
        `{"kind":"distance","side":1,"part":"b"} 300`,
        `{"kind":"distance","side":-1,"part":"a"} 110`,
        `{"kind":"width"} 90`,
        `{"kind":"distance","side":-1,"part":"b"} 320`,
        `{"kind":"height"} 210`,
      ].sort(),
    )
    // грань y = 10 (side 1): 10…100 | 100…190 | 190…490; грань y = −10: −10…100 | 100…190 | 190…510
    expectAt(find(list, { kind: "distance", side: 1, part: "a" }, "90").center, 55, 10 + off - lift)
    expectAt(find(list, { kind: "distance", side: 1, part: "b" }, "300").center, 340, 10 + off - lift)
    expectAt(find(list, { kind: "distance", side: -1, part: "a" }, "110").center, 45, -10 - off - lift)
    expectAt(find(list, { kind: "distance", side: -1, part: "b" }, "320").center, 350, -10 - off - lift)
    const widths = list.filter((n) => n.target.kind === "width").map((n) => n.center.y).sort((p, q) => p - q)
    expect(widths[0]).toBeCloseTo(-10 - off - lift, 3)
    expect(widths[1]).toBeCloseTo(10 + off - lift, 3)
    for (const n of list) {
      expect(n.widthCm, tag(n)).toBeCloseTo((n.text.length * CHAR_PX) / K, 6)
      expect(n.heightCm, tag(n)).toBeCloseTo(LABEL_PX / K, 6)
    }
    // подпись — со стороны помещения (y > 0), число «210» правее центра подписи на 1 символ
    const h = find(list, { kind: "height" }, "210")
    expectAt(h.center, 145 + numberOffsetPx(["H=210"], 0, 2) / K, 10 + gap)
    expectAt(h.dir, 1, 0)
  })

  it("PB-EN-01b: нулевое расстояние — правимое число «0» у откоса", () => {
    const { walls } = sceneR()
    const list = numbers(UO(), walls)
    // «0» без размерной линии — у откоса x = 10, текст между гранью и выносом цепочки
    const zero = find(list, { kind: "distance", side: 1, part: "a" }, "0")
    expect(zero.center.x).toBeCloseTo(10, 3)
    expect(zero.center.y).toBeGreaterThan(10)
    expect(zero.center.y).toBeLessThan(10 + off)
  })

  it("PB-EN-01c: тексты в текущей единице — мм и м с запятой", () => {
    const { walls } = sceneR()
    const mm = numbers(D0(), walls, [D0()], "mm").map(tag)
    expect(mm).toContain(`{"kind":"height"} 2100`)
    expect(mm).toContain(`{"kind":"distance","side":1,"part":"b"} 3000`)
    const m = numbers(D0(), walls, [D0()], "m").map(tag)
    expect(m).toContain(`{"kind":"height"} 2,1`)
    expect(m).toContain(`{"kind":"width"} 0,9`)
  })

  it("PB-EN-01d: у проёма и двери нет числа подоконника; у двери есть высота", () => {
    const { walls } = sceneF()
    expect(numbers(D0(), walls).some((n) => n.target.kind === "sill")).toBe(false)
    const d = DR()
    const list = numbers(d, walls)
    expect(list.some((n) => n.target.kind === "sill")).toBe(false)
    expect(find(list, { kind: "height" }, "210").center.y).toBeCloseTo(-10 - gap, 3)
  })

  it("PB-EN-01e: соседний элемент — стык цепочки (число до окна, а не до угла)", () => {
    const { walls } = sceneR()
    const d = D0()
    const x = win("W", "b", 100, 120, 150, 85, "x") // участок 280…400
    expect(numbers(d, walls, [d, x]).map(tag)).toContain(`{"kind":"distance","side":1,"part":"b"} 90`)
  })
})

describe("числа окна", () => {
  it("PB-EN-02: в подписи два числа — высота и подоконник; «H=» левее «H под.» по направлению текста", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100) // участок 100…220, подпись над стеной (y < −10)
    const list = numbers(x, walls)
    const parts = ["H=150", "H под.=85"]
    const h = find(list, { kind: "height" }, "150")
    const s = find(list, { kind: "sill" }, "85")
    expectAt(h.center, 160 + numberOffsetPx(parts, 0, 2) / K, -10 - gap)
    expectAt(s.center, 160 + numberOffsetPx(parts, 1, 7) / K, -10 - gap)
    expect(h.center.x).toBeLessThan(s.center.x)
    expect(list.filter((n) => n.target.kind === "width")).toHaveLength(2)
  })

  it("PB-EN-02b: подоконник 0 — правимое число «0»", () => {
    const { walls } = sceneF()
    expect(numbers(win("W", "a", 100, 120, 150, 0), walls).map(tag)).toContain(`{"kind":"sill"} 0`)
  })
})

describe("попадание в число", () => {
  const { walls } = sceneR()
  const list = numbers(D0(), walls)
  const n300 = find(list, { kind: "distance", side: 1, part: "b" }, "300")
  const half = (3 * CHAR_PX) / 2 / K // половина ширины «300», см
  const halfH = LABEL_PX / 2 / K

  it("PB-EN-03: точка в прямоугольнике числа, расширенном на допуск, — это число", () => {
    expect(numberAt(n300.center, list, 0.5)).toBe(n300)
    expect(numberAt({ x: 340 + half, y: n300.center.y }, list, 0.5)).toBe(n300)
    expect(numberAt({ x: 340 - half - 0.4, y: n300.center.y }, list, 0.5)).toBe(n300)
    expect(numberAt({ x: 340, y: n300.center.y + halfH + 0.4 }, list, 0.5)).toBe(n300)
  })

  it("PB-EN-03b: за прямоугольником с допуском — нет числа", () => {
    expect(numberAt({ x: 340 + half + 0.6, y: n300.center.y }, list, 0.5)).toBeNull()
    expect(numberAt({ x: 340, y: n300.center.y + halfH + 0.6 }, list, 0.5)).toBeNull()
    expect(numberAt({ x: 250, y: 60 }, list, 0.5)).toBeNull()
  })

  it("PB-EN-03c: из двух близких чисел выбирается ближайший центр", () => {
    const a = find(list, { kind: "distance", side: 1, part: "a" }, "90")
    // широкий допуск накрывает и «90» (x 55), и ширину (x 145); точка ближе к 55
    expect(numberAt({ x: 80, y: a.center.y }, list, 60)).toBe(a)
  })

  it("PB-EN-03d: на наклонной стене прямоугольник повёрнут вдоль текста", () => {
    const S: Wall = w(0, 0, 400, -300, "W") // направление (0.8, −0.6)
    const d = door("W", "a", 100)
    const h = find(numbers(d, [S]), { kind: "height" }, "210")
    const dx = (3 * CHAR_PX) / 2 / K - 0.2
    // вдоль текста на почти полширины — попадание; поперёк на ту же величину — мимо (полувысота 3.5 см)
    expect(numberAt({ x: h.center.x + h.dir.x * dx, y: h.center.y + h.dir.y * dx }, [h], 0)).toBe(h)
    expect(numberAt({ x: h.center.x - h.dir.y * dx, y: h.center.y + h.dir.x * dx }, [h], 0)).toBeNull()
  })
})

describe("согласованность с отрисовкой", () => {
  function drawnTexts(walls: Wall[], elements: WallElement[]): { text: string; at: Point }[] {
    const { ctx, ops } = recorder()
    drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: false, doorways: elements })
    return texts(ops)
  }

  it("PB-EN-04: центр числа подписи проёма — центр нарисованной подписи плюс префикс, и на наклонной стене", () => {
    const S: Wall = w(0, 0, 500, -100, "W")
    const d = door("W", "a", 100)
    const drawn = drawnTexts([S], [d]).find((t) => t.text === "H=210")
    expect(drawn).toBeDefined()
    if (!drawn) return
    const h = find(editableNumbers(d, [S], [d], [], "cm", K, LABEL_PX), { kind: "height" }, "210")
    const len = Math.hypot(500, 100)
    const dir = { x: 500 / len, y: -100 / len }
    expectAt(h.dir, dir.x, dir.y)
    const at = toScreen(h.center, VIEW)
    const o = numberOffsetPx(["H=210"], 0, 2)
    expect(at.x).toBeCloseTo(drawn.at.x + dir.x * o, 1)
    expect(at.y).toBeCloseTo(drawn.at.y + dir.y * o, 1)
  })

  it("PB-EN-04b: центры чисел окна — от начала нарисованных частей подписи", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const drawn = drawnTexts(walls, [x])
    const hText = drawn.find((t) => t.text === "H=150")
    const sText = drawn.find((t) => t.text === "H под.=85")
    expect(hText && sText).toBeTruthy()
    if (!hText || !sText) return
    const list = editableNumbers(x, walls, [x], [], "cm", K, LABEL_PX)
    const h = toScreen(find(list, { kind: "height" }, "150").center, VIEW)
    const s = toScreen(find(list, { kind: "sill" }, "85").center, VIEW)
    expect(h.x).toBeCloseTo(hText.at.x + 3.5 * CHAR_PX, 1)
    expect(h.y).toBeCloseTo(hText.at.y, 1)
    expect(s.x).toBeCloseTo(sText.at.x + 8 * CHAR_PX, 1)
    expect(s.y).toBeCloseTo(sText.at.y, 1)
  })
})
