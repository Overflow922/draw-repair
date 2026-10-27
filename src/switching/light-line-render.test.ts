import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, TextOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Callout, LightFixture } from "../types"
import { PX_PER_CM } from "../types"
import { drawSwitchingScene } from "./switching-render"
import type { SwitchingView } from "./switching-render"

// change add-light-lines: слой меток линий на холсте плана «Группы включения»
// (spec light-lines «Метка линии на плане»; switching-plan «Отображение плана «Группы включения»»)
//
//  вид сверху, схематично, не в масштабе: светильник (+) в (100, 80), метка L3 правее и выше
//
//        L3
//       (+)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WALLS = rectWalls("w", -10, -10, 410, 310)
const spot: LightFixture = { id: "a", kind: "spot", x: 100, y: 80 }
const chandelier: LightFixture = { id: "x", kind: "chandelier", x: 250, y: 150 }
const callout: Callout = { id: "c", target: { x: 100, y: 80 }, at: { x: 150, y: 120 }, text: "Выключатель" }

const viewOf = (extra: Partial<SwitchingView> = {}): SwitchingView => ({
  walls: WALLS,
  doorways: [],
  pieces: [],
  drywall: [],
  items: [],
  lights: [spot],
  lineLabels: [{ id: "m", name: "L3", at: { x: 100, y: 80 } }],
  ...extra,
})

const draw = (view: SwitchingView): DrawOp[] => {
  const rec = recordingContext()
  drawSwitchingScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const texts = (ops: DrawOp[]): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText")

describe("метки линий на холсте", () => {
  it("LL-80: текст «L3» красным освещения правее и выше центра знака на 8 px", () => {
    const [label] = texts(draw(viewOf()))
    expect(label?.text).toBe("L3")
    expect(label?.fillStyle).toBe(LIGHT_PALETTE.lightingRed)
    expect(label?.at.x).toBeCloseTo(100 * PX_PER_CM + 8)
    expect(label?.at.y).toBeCloseTo(80 * PX_PER_CM - 8)
  })

  it("LL-81: метка нарисована после знака светильника", () => {
    const ops = draw(viewOf())
    const lastStroke = ops.map((o) => o.kind).lastIndexOf("stroke")
    expect(ops.findIndex((o) => o.kind === "fillText")).toBeGreaterThan(lastStroke)
  })

  it("LL-82: метка нарисована до выноски", () => {
    const ops = draw(viewOf({ callouts: [callout] }))
    const t = texts(ops).map((o) => o.text)
    expect(t.indexOf("L3")).toBeLessThan(t.indexOf("Выключатель"))
  })

  it("LL-83: без меток текста нет", () => {
    expect(texts(draw(viewOf({ lineLabels: [] }))).map((t) => t.text)).toEqual([])
  })

  it("LL-84: у пяти светильников пять меток", () => {
    const lights: LightFixture[] = [spot, chandelier]
    const labels = [
      { id: "m1", name: "L3", at: { x: 100, y: 80 } },
      { id: "m2", name: "L2", at: { x: 250, y: 150 } },
    ]
    expect(texts(draw(viewOf({ lights, lineLabels: labels }))).map((t) => t.text)).toEqual(["L3", "L2"])
  })

  it("LL-85: выделенная и стираемая метка обведены рамкой своего цвета", () => {
    const frames = (view: SwitchingView): string[] =>
      draw(view).flatMap((o) => (o.kind === "stroke" && o.subpaths.length === 1 && o.subpaths[0]?.length === 4 ? [o.strokeStyle] : []))
    expect(frames(viewOf({ selectedLineId: "m" }))).toEqual([LIGHT_PALETTE.selection])
    expect(frames(viewOf({ erasingLineId: "m" }))).toEqual([LIGHT_PALETTE.erase])
    expect(frames(viewOf())).toEqual([])
  })
})
