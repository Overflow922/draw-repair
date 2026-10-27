import { describe, expect, it } from "vitest"
import { LIGHT_SYMBOL_PX_PER_MM, SMOKE_FONT_MM } from "../ceiling/light-symbol"
import { LIGHT_PALETTE } from "../theme"
import { recordingContext } from "../room-area.test-utils"
import { PX_PER_CM } from "../types"
import { drawLineLabel, lineLabelAt, lineLabelBox, lineLabelCorner, LINE_LABEL_HIT_PAD_PX } from "./light-line-label"

// change add-light-lines: положение метки и рамка клика
// (spec light-lines «Метка линии на плане»: «Положение метки», «Масштаб просмотра»; design D5)
//
//  вид сверху, схематично, не в масштабе
//
//        L3        <-- левый нижний угол текста: +2 мм вправо, 2 мм вверх от центра
//       (+)
//        x         <-- центр светильника (100, 80)

describe("положение метки", () => {
  it("LL-40: на экране угол на 8 px правее и выше центра", () => {
    expect(lineLabelCorner({ x: 100, y: 80 }, LIGHT_SYMBOL_PX_PER_MM)).toEqual({ x: 108, y: 72 })
  })

  it("LL-41: на бумаге угол на 2 мм правее и выше центра", () => {
    expect(lineLabelCorner({ x: 100, y: 80 }, 1)).toEqual({ x: 102, y: 78 })
  })

  it("LL-42: рамка текста стоит над углом и имеет кегль подписи «ДПС»", () => {
    const u = LIGHT_SYMBOL_PX_PER_MM
    const box = lineLabelBox({ x: 100, y: 80 }, "L3", u)
    expect(box.x).toBe(108)
    expect(box.h).toBeCloseTo(SMOKE_FONT_MM * u)
    expect(box.y + box.h).toBe(72)
    expect(box.w).toBeGreaterThan(0)
  })
})

describe("попадание по метке", () => {
  const lights = [{ at: { x: 100, y: 80 }, name: "L3" }]
  const view = { zoom: 1, pan: { x: 0, y: 0 } }
  const px = (n: number): number => n / PX_PER_CM // пиксели → см при zoom 1

  it("LL-43: клик по тексту попадает, мимо — нет", () => {
    const box = lineLabelBox({ x: 100 * PX_PER_CM, y: 80 * PX_PER_CM }, "L3", LIGHT_SYMBOL_PX_PER_MM)
    const inside = { x: px(box.x + box.w / 2), y: px(box.y + box.h / 2) }
    expect(lineLabelAt(inside, lights, view, LIGHT_SYMBOL_PX_PER_MM)).toBe(lights[0])
    expect(lineLabelAt({ x: 100, y: 80 }, lights, view, LIGHT_SYMBOL_PX_PER_MM)).toBeNull()
  })

  it("LL-44: рамка расширена полем не менее 4 px", () => {
    expect(LINE_LABEL_HIT_PAD_PX).toBeGreaterThanOrEqual(4)
    const box = lineLabelBox({ x: 100 * PX_PER_CM, y: 80 * PX_PER_CM }, "L3", LIGHT_SYMBOL_PX_PER_MM)
    const justOutside = { x: px(box.x - LINE_LABEL_HIT_PAD_PX + 0.5), y: px(box.y + box.h / 2) }
    expect(lineLabelAt(justOutside, lights, view, LIGHT_SYMBOL_PX_PER_MM)).toBe(lights[0])
  })

  it("LL-45: при увеличении вдвое размер метки в пикселях и смещение от знака те же", () => {
    const zoomed = { zoom: 2, pan: { x: 0, y: 0 } }
    const k = PX_PER_CM * 2
    const box = lineLabelBox({ x: 100 * k, y: 80 * k }, "L3", LIGHT_SYMBOL_PX_PER_MM)
    expect(box.x - 100 * k).toBe(8)
    const inside = { x: (box.x + box.w / 2) / k, y: (box.y + box.h / 2) / k }
    expect(lineLabelAt(inside, lights, zoomed, LIGHT_SYMBOL_PX_PER_MM)).toBe(lights[0])
  })

  it("LL-46: из совпавших побеждает последняя", () => {
    const two = [
      { at: { x: 100, y: 80 }, name: "L3" },
      { at: { x: 100, y: 80 }, name: "L5" },
    ]
    const box = lineLabelBox({ x: 100 * PX_PER_CM, y: 80 * PX_PER_CM }, "L3", LIGHT_SYMBOL_PX_PER_MM)
    const inside = { x: px(box.x + 1), y: px(box.y + box.h / 2) }
    expect(lineLabelAt(inside, two, view, LIGHT_SYMBOL_PX_PER_MM)).toBe(two[1])
  })
})

describe("рисование метки", () => {
  it("LL-47: текст имени красным освещения в левом нижнем углу, горизонтально", () => {
    const rec = recordingContext()
    drawLineLabel(rec.ctx, "L3", { x: 100, y: 80 }, 4, LIGHT_PALETTE, "Face")
    expect(rec.ops).toHaveLength(1)
    expect(rec.ops[0]).toMatchObject({ kind: "fillText", text: "L3", at: { x: 108, y: 72 }, fillStyle: LIGHT_PALETTE.lightingRed, textAlign: "left", textBaseline: "bottom", font: "10px Face" })
  })

  it("LL-48: подсветка выделения рисуется рамкой цвета выделения", () => {
    const rec = recordingContext()
    drawLineLabel(rec.ctx, "L3", { x: 100, y: 80 }, 4, LIGHT_PALETTE, "Face", { color: LIGHT_PALETTE.selection, lineWidth: 2 })
    expect(rec.ops.flatMap((o) => (o.kind === "stroke" ? [o.strokeStyle] : []))).toEqual([LIGHT_PALETTE.selection])
  })
})
