import { describe, expect, it } from "vitest"
import { door } from "../doorway/doorway.test-utils"
import type { Drawing, PlasterMark, Point } from "../types"
import { plasterPieces } from "./plaster"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { drawing, idGen, rectWalls, wall } from "./rough.test-utils"

// change plaster-face-to-corners: сквозная проверка «клик → пометки → действующие куски» на чертеже со стыками, проёмом и
// короткой стеной (spec rough-works-plan «Штукатурка не прерывается на стыке коллинеарных стен», «Короткая стена»)

const NONE: PlasterMark[] = []

function setup(initial: Drawing) {
  let d = initial
  const host: PlasterToolHost = {
    drawing: () => d,
    scene: () => roughScene(d),
    marks: () => d.roughPlaster ?? NONE,
    setMarks: (next) => {
      d = { ...d, roughPlaster: next }
    },
    record: () => undefined,
    changed: () => undefined,
    redraw: () => undefined,
    radiusCm: () => 5,
    newId: idGen(),
    newThicknessMm: () => 20,
  }
  return { tool: createPlasterTool(host), drawing: () => d }
}

const px = (x: number, y = 0): Point => ({ x, y })
const click = (s: ReturnType<typeof setup>, x: number, y: number): void => {
  s.tool.down(px(0))
  s.tool.up(px(x, y), px(1))
}

// покрытие вдоль оси X (стены горизонтальные): склеенные интервалы полос, края — по x
const coverage = (d: Drawing): [number, number][] => {
  const spans = plasterPieces(d)
    .map((p) => {
      const dir = p.wall.b.x >= p.wall.a.x ? 1 : -1
      const x0 = p.wall.a.x + dir * p.from
      const x1 = p.wall.a.x + dir * p.to
      return [Math.min(x0, x1), Math.max(x0, x1)] as const
    })
    .sort((p, q) => p[0] - q[0])
  const out: [number, number][] = []
  for (const [lo, hi] of spans) {
    const last = out[out.length - 1]
    if (last && lo <= last[1] + 1e-6) last[1] = Math.max(last[1], hi)
    else out.push([lo, hi])
  }
  return out
}

describe("сквозной путь клика", () => {
  it("PL-1: стык стен разных материалов с дверным проёмом у стыка — полоса сплошная", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    const s = setup(drawing({ walls: [W1, W2], doorways: [door("W1", "b", 5, 90)] }))
    click(s, 450, 12)
    expect(coverage(s.drawing())).toEqual([[0, 600]])
  })

  it("PL-2: внешняя грань комнаты после клика покрыта от угла до угла (−10…510)", () => {
    const s = setup(drawing({ walls: rectWalls("R", 0, 0, 500, 300) }))
    click(s, 250, -12)
    expect(coverage(s.drawing())).toEqual([[-10, 510]])
  })

  it("PL-3: короткая стена между перпендикулярными — штукатурка ставится", () => {
    const V1 = wall("V1", 0, -300, 0, 0, 20)
    const S = wall("S", 0, 0, 15, 0, 20)
    const V2 = wall("V2", 15, 0, 15, 300, 20)
    const s = setup(drawing({ walls: [V1, S, V2] }))
    click(s, -5, 13)
    expect(s.drawing().roughPlaster?.some((m) => m.wallId === "S")).toBe(true)
  })
})
