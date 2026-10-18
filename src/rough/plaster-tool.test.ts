import { describe, expect, it } from "vitest"
import { markDimensions } from "../demolition/mark-dimensions"
import type { Drawing, PlasterMark, Point } from "../types"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { demolitionMark, drawing, idGen, plaster, r6, wall } from "./rough.test-utils"

// change add-rough-works-plan: инструмент «Штукатурка» — протяжка, выделение, числа, ластик
// (spec rough-works-plan «Инструмент «Штукатурка»», «Выделение штукатурки и правка на месте», «Ластик на плане «Черновые работы»»)

const NONE: PlasterMark[] = []

function setup(initial: Drawing, thicknessMm = 20) {
  let d = initial
  const log = { records: 0, changes: 0, redraws: 0 }
  const host: PlasterToolHost = {
    drawing: () => d,
    scene: () => roughScene(d),
    marks: () => d.roughPlaster ?? NONE,
    setMarks: (next) => {
      d = { ...d, roughPlaster: next }
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changes++
    },
    redraw: () => {
      log.redraws++
    },
    radiusCm: () => 5,
    newId: idGen(),
    newThicknessMm: () => thicknessMm,
  }
  return { tool: createPlasterTool(host), log, marks: () => d.roughPlaster ?? [], drawing: () => d }
}

const px = (x: number, y = 0): Point => ({ x, y })
// протяжка по стене: нажатие в (x0, y), отпускание в (x1, y); экранные точки далеко друг от друга (вне мёртвой зоны)
const drag = (tool: ReturnType<typeof setup>["tool"], x0: number, x1: number, y = 5): string | null => {
  tool.down(px(x0, y), px(0))
  tool.move(px(x1, y), px(100))
  return tool.up(px(x1, y), px(100))
}

describe("протяжка", () => {
  it("RW-140: протяжка со стороны y > 0 ставит пометку на грани +1 с участком 100–300 и толщиной из панели; один шаг истории", () => {
    const s = setup(drawing(), 30)
    const id = drag(s.tool, 100, 300, 5)
    expect(id).toBe("n1")
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 300, 30)])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("RW-141: грань определяется стороной нажатия: со стороны y < 0 — грань −1", () => {
    const s = setup(drawing())
    drag(s.tool, 100, 300, -5)
    expect(s.marks()[0]?.face).toBe(-1)
  })

  it("RW-142: клик (отпускание в мёртвой зоне) ничего не меняет и шага истории не создаёт", () => {
    const s = setup(drawing())
    s.tool.down(px(100, 5), px(0))
    expect(s.tool.up(px(100, 5), px(2))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RW-143: Escape (cancel) во время протяжки отменяет её без изменений", () => {
    const s = setup(drawing())
    s.tool.down(px(100, 5), px(0))
    s.tool.move(px(300, 5), px(100))
    expect(s.tool.dragging()).toBe(true)
    s.tool.cancel()
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.ghost()).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RW-144: слишком короткая протяжка (границы после округления совпали) ничего не создаёт", () => {
    const s = setup(drawing())
    expect(drag(s.tool, 100, 100.4)).toBeNull()
    expect(s.marks()).toEqual([])
  })

  it("RW-145: превью протяжки показывает участок, грань и толщину из панели", () => {
    const s = setup(drawing(), 40)
    s.tool.down(px(100, 5), px(0))
    s.tool.move(px(300, 5), px(100))
    const g = s.tool.ghost()
    expect([g?.from, g?.to, g?.face, g?.thicknessMm]).toEqual([100, 300, 1, 40])
  })

  it("RW-146: конец протяжки привязывается к концу стены в радиусе привязки: 497 → 500", () => {
    const s = setup(drawing())
    drag(s.tool, 100, 497)
    // участок 100–500 хранится от конца b (середина 300 > 250): 0–400, то есть граница ровно на конце стены
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "b", 0, 400, 20)])
  })

  it("RW-147: протяжка от конца до конца штукатурит грань целиком", () => {
    const s = setup(drawing())
    drag(s.tool, 0, 700)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 500, 20)])
  })

  it("RW-148: нажатие вне стен жеста не начинает", () => {
    const s = setup(drawing())
    s.tool.down(px(250, 200), px(0))
    s.tool.move(px(300, 200), px(100))
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.up(px(300, 200), px(100))).toBeNull()
  })

  it("RW-149: протяжка по остатку стены даёт пометку в координатах исходной стены", () => {
    const s = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 0, 200)] }))
    // остаток 200–500; протяжка по нему от x = 250 до x = 350
    drag(s.tool, 250, 350)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "b", 150, 250, 20)])
  })

  it("RW-150: протяжка не пересекает снесённый участок: участок обрезается границей остатка", () => {
    const s = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 200, 300)] }))
    // остаток 0–200; протяжка от 100 за границу сноса — участок 100–200
    drag(s.tool, 100, 400)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 100, 200, 20)])
  })

  it("RW-151: собственная стена «Монтажа» штукатурится", () => {
    const own = wall("own", 0, 300, 300, 300)
    const s = setup(drawing({ mounting: { walls: [own], dimensions: [] } }))
    drag(s.tool, 50, 250, 305)
    expect(s.marks()).toEqual([plaster("n1", "own", 1, "a", 50, 250, 20)])
  })

  it("RW-152: пересекающаяся протяжка сливается, слитая пометка выделена и берёт толщину из панели", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 200, 20)] }), 30)
    expect(drag(s.tool, 150, 300)).toBe("p")
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 100, 300, 30)])
    expect(s.tool.selectedId()).toBe("p")
  })

  it("RW-153: скрытая (недействующая) пометка в слиянии не участвует и остаётся без изменений", () => {
    const hidden = plaster("h", "gone", 1, "a", 100, 200)
    const s = setup(drawing({ roughPlaster: [hidden] }))
    drag(s.tool, 100, 300)
    expect(s.marks()).toEqual([hidden, plaster("n1", "W", 1, "a", 100, 300, 20)])
  })
})

describe("выделение, толщина и снятие", () => {
  const withMark = () => setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] }))

  it("RW-160: клик по полосе без инструмента выделяет пометку; клик мимо снимает выделение", () => {
    const s = withMark()
    expect(s.tool.select(px(200, 11))).toBe(true)
    expect(s.tool.selectedId()).toBe("p")
    expect(s.tool.select(px(450, 11))).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-161: правка толщины выделенной пометки — один шаг истории; то же значение шага не создаёт", () => {
    const s = withMark()
    s.tool.select(px(200, 11))
    expect(s.tool.setSelectedThickness(30)).toBe(true)
    expect(s.marks()[0]?.thicknessMm).toBe(30)
    expect(s.log.records).toBe(1)
    expect(s.tool.setSelectedThickness(30)).toBe(false)
    expect(s.log.records).toBe(1)
  })

  it("RW-162: Delete удаляет выделенную пометку одним шагом", () => {
    const s = withMark()
    s.tool.select(px(200, 11))
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-163: без выделения Delete и правка толщины ничего не делают", () => {
    const s = withMark()
    expect(s.tool.deleteSelected()).toBe(false)
    expect(s.tool.setSelectedThickness(30)).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("RW-164: ластик удаляет пометку под точкой одним шагом; мимо — ничего", () => {
    const s = withMark()
    expect(s.tool.eraseTarget(px(200, 11))).toBe("p")
    expect(s.tool.eraseTarget(px(450, 11))).toBeNull()
    expect(s.tool.erase(px(450, 11))).toBe(false)
    expect(s.log.records).toBe(0)
    expect(s.tool.erase(px(200, 11))).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(1)
  })

  it("RW-165: ластик не реагирует на тело стены", () => {
    const s = withMark()
    expect(s.tool.erase(px(200, 0))).toBe(false)
    expect(s.marks()).toHaveLength(1)
  })
})

describe("правка чисел на месте", () => {
  const withMark = () => setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 190, 20)] }))
  // числа цепочки грани +1 выделенной пометки на свободной стене: 100, 90, 310
  const spotAt = (s: ReturnType<typeof withMark>, target: "gapA" | "width" | "gapB") => {
    const scene = roughScene(s.drawing())
    const piece = scene.pieces[0]!
    const d = markDimensions(piece, scene.base.walls, "chain", "cm", 2, 14).find((x) => x.side === 1 && x.target === target)!
    return s.tool.numberAt(d.spot.center, "cm", 2, 14, 0)
  }

  it("RW-170: числа есть только у выделенной пометки", () => {
    const s = withMark()
    expect(spotAt(s, "width")).toBeNull()
    s.tool.select(px(150, 11))
    expect(spotAt(s, "width")?.text).toBe("90")
    expect(spotAt(s, "gapA")?.text).toBe("100")
    expect(spotAt(s, "gapB")?.text).toBe("310")
  })

  it("RW-171: ширина 200 — участок 100–300 одним шагом истории; пометка остаётся выделенной", () => {
    const s = withMark()
    s.tool.select(px(150, 11))
    const spot = spotAt(s, "width")!
    expect(s.tool.applyNumber(spot, 200)).toBe(true)
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 100, 300, 20)])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBe("p")
  })

  it("RW-172: недопустимый ввод — участок не изменился, шага нет", () => {
    const s = withMark()
    s.tool.select(px(150, 11))
    const spot = spotAt(s, "width")!
    expect(s.tool.applyNumber(spot, Number.NaN)).toBe(false)
    expect(s.tool.applyNumber(spot, 0)).toBe(false)
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 100, 190, 20)])
    expect(s.log.records).toBe(0)
  })

  it("RW-173: отступ до конца a: ввод 150 — участок 150–240", () => {
    const s = withMark()
    s.tool.select(px(150, 11))
    expect(s.tool.applyNumber(spotAt(s, "gapA")!, 150)).toBe(true)
    const [m] = s.marks()
    expect([m?.anchor, r6(m?.fromCm ?? 0), r6(m?.toCm ?? 0)]).toEqual(["a", 150, 240])
  })
})
