import { describe, expect, it } from "vitest"
import { defaultToolOf, toolsOf } from "../plans"
import { mountingScene } from "../mounting/mounting-scene"
import { drawing } from "../mounting/mounting.test-utils"
import { demolitionColor, drawDemolitionScene } from "../demolition/demolition-render"
import { SCREEN_METRICS } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Communication, Drawing, Point } from "../types"
import { PX_PER_CM } from "../types"
import { VIEW, strokes, toScreen } from "../doorway/doorway.test-utils"
import type { StrokeOp } from "../doorway/doorway.test-utils"
import { circleRecorder, duct, riser } from "./communications.test-utils"

// change add-communications: коммуникации и планы (spec drawing-plans «Каталог планов», «Инструменты плана»;
// communications «Коммуникации на всех планах»; mounting-plan «Коммуникации на плане «Монтаж»»;
// demolition-plan «Коммуникации на плане «Демонтаж»»; test-plan CT-03, DP-*, MP-*, DM-*, CV-*).

const sorted = (xs: readonly string[]): string[] => [...xs].sort()

const withCommunications = (communications: Communication[], base: Drawing = drawing()): Drawing => ({ ...base, communications })

describe("инструменты планов", () => {
  it("DP-01: обмерочный план — «Стена», «Проём», «Дверь», «Окно», «Стояк», «Воздуховод», «Размер», «Линейка», «Ластик» в этом порядке", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "riser", "duct", "dimension", "ruler", "eraser"])
  })

  it("CT-03: на планах «Демонтаж» и «Монтаж» инструментов «Стояк» и «Воздуховод» нет", () => {
    for (const plan of ["demolition", "mounting"] as const) {
      expect(toolsOf(plan)).not.toContain("riser")
      expect(toolsOf(plan)).not.toContain("duct")
    }
  })

  it("DP-02: набор «Монтажа» — как у обмерочного плана, кроме коммуникаций, и в том же порядке", () => {
    expect(toolsOf("mounting")).toEqual(toolsOf("measure").filter((t) => t !== "riser" && t !== "duct"))
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "dimension", "ruler", "eraser"])
  })

  it("DP-03: наборы и инструменты по умолчанию остальных планов не изменились", () => {
    expect(toolsOf("demolition")).toEqual(["demolition", "ruler", "eraser"])
    expect(defaultToolOf("measure")).toBe("wall")
    expect(defaultToolOf("mounting")).toBe("wall")
    expect(defaultToolOf("demolition")).toBe("demolition")
  })

  it("DP-04: инструменты коммуникаций присутствуют только на обмерочном плане", () => {
    const plans = (["measure", "demolition", "mounting"] as const).filter((p) => toolsOf(p).includes("riser"))
    expect(plans).toEqual(["measure"])
    expect(sorted((["measure", "demolition", "mounting"] as const).filter((p) => toolsOf(p).includes("duct")))).toEqual(["measure"])
  })
})

describe("план «Монтаж»", () => {
  it("MP-01: коммуникации не входят ни в остатки, ни в собственные объекты, ни в элементы и размеры", () => {
    const base = drawing()
    const scene = mountingScene(base)
    const withComm = mountingScene(withCommunications([riser(250, 150, 11), duct(100, 150)], base))
    expect(withComm.walls).toEqual(scene.walls)
    expect(withComm.remnants).toEqual(scene.remnants)
    expect(withComm.own).toEqual(scene.own)
    expect(withComm.doorways).toEqual(scene.doorways)
    expect(withComm.dimensions).toEqual(scene.dimensions)
    expect([...withComm.oldElementIds]).toEqual([...scene.oldElementIds])
  })

  it("MP-02: коммуникации не меняются (и не теряются) при построении сцены «Монтажа»", () => {
    const list = [riser(250, 150, 11)]
    const d = withCommunications(list)
    mountingScene(d)
    expect(d.communications).toEqual([riser(250, 150, 11)])
    expect(d.communications).toBe(list)
  })
})

describe("план «Демонтаж»: холст", () => {
  const rec = (communications: Communication[]): StrokeOp[] => {
    const { ctx, ops } = circleRecorder()
    drawDemolitionScene(ctx, 800, 600, { walls: [], doorways: [], marks: [], communications }, "cm", VIEW, {
      color: demolitionColor("light"),
      grid: false,
      palette: LIGHT_PALETTE,
    })
    return strokes(ops)
  }
  const circleAt = (ops: StrokeOp[], center: Point, r: number, style: string): boolean =>
    ops
      .filter((o) => o.strokeStyle === style && o.lineWidth === SCREEN_METRICS.contourPx)
      .some((o) =>
        o.subpaths.some((sp) => sp.length >= 16 && sp.every((p) => Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - r) <= 0.6)),
      )

  it("DM-02: стояк на плане «Демонтаж» рисуется цветом контура (ink), а не серой подложкой", () => {
    const ops = rec([riser(100, 100, 11)])
    const c = toScreen({ x: 100, y: 100 })
    expect(circleAt(ops, c, 5.5 * PX_PER_CM * VIEW.zoom, LIGHT_PALETTE.ink)).toBe(true)
    expect(circleAt(ops, c, 5.5 * PX_PER_CM * VIEW.zoom, LIGHT_PALETTE.muted)).toBe(false)
  })

  it("DM-02b: без коммуникаций окружности нет", () => {
    const ops = rec([])
    expect(circleAt(ops, toScreen({ x: 100, y: 100 }), 11, LIGHT_PALETTE.ink)).toBe(false)
  })
})
