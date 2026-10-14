import { describe, expect, it } from "vitest"
import { deleteObjects, erasePick, pressPick } from "../doorway/doorway-scene"
import type { Scene } from "../history"
import type { Dimension, JambPoint } from "../types"
import { moveEndpointBounded } from "../wall-edit"
import { batteriesInRect, hitBattery } from "./battery-pick"
import { batteryRect } from "./battery-geometry"
import { bat, expectBox, sceneF, w, windowAt } from "./battery.test-utils"
import type { Battery } from "./battery.test-utils"

// change add-battery: попадание, рамка, ластик, удаление, следование за опорной стеной
// (spec battery «Батарея следует за опорной стеной», «Удаление батареи»; design D6, D10; test-plan B-FOL-*).
// Сцена: W (0,0)-(500,0) t20; батарея X [100,170]×[13,23] (грань y = 10).

const { W } = sceneF()
const X = bat("W", "a", 100)
const Y = bat("W", "a", 300, { id: "y" })
const corner = (batteryId: string): Dimension["from"] => ({ kind: "corner", batteryId, end: "a", side: "back" })
const jambOf = (elementId: string): JambPoint => ({ kind: "jamb", elementId, jamb: "a", face: 1 })
const WA = windowAt("W", "a", 200)

describe("следование за опорной стеной", () => {
  it("B-FOL-1: перемещение стены на (0, 50): батарея сместилась вместе, расстояние привязки 100, отступ 3", () => {
    const moved = { ...W, a: { x: 0, y: 50 }, b: { x: 500, y: 50 } }
    expectBox(batteryRect(X, moved), 100, 63, 170, 73)
  })

  it("B-FOL-2: растяжение конца b не двигает батарею с привязкой a; батарею с привязкой b двигает на ту же величину", () => {
    const longer = { ...W, b: { x: 700, y: 0 } }
    expectBox(batteryRect(X, longer), 100, 13, 170, 23)
    expectBox(batteryRect(bat("W", "b", 100), longer), 530, 13, 600, 23)
  })

  it("B-FOL-3: поворот стены: батарея повёрнута вместе с ней (t = 100…170, поперёк 13…23)", () => {
    const turned = w(0, 0, 0, 500, "W") // ось вниз: d = (0,1), нормаль (−1,0): грань +1 — x = −10
    expectBox(batteryRect(X, turned), -23, 100, -13, 170)
  })

  it("B-FOL-4: утолщение стены с 20 до 30: батарея на 3 см от новой грани (y ∈ [18,28])", () => {
    expectBox(batteryRect(X, { ...W, thicknessCm: 30 }), 100, 18, 170, 28)
  })

  it("B-FOL-5: укорочение стены до x = 150 вводом/перетаскиванием конца b ограничено: конец останавливается на x = 170 (торец батареи)", () => {
    const wall = w(0, 0, 500, 0, "W")
    const end = moveEndpointBounded([wall], wall, "b", { x: 150, y: 0 }, { ortho: false, batteries: [X] })
    expect(end.x).toBeCloseTo(170, 4)
    expect(end.y).toBeCloseTo(0, 4)
  })

  it("B-FOL-5b: без батареи тот же конец доходит до цели (контроль)", () => {
    const wall = w(0, 0, 500, 0, "W")
    expect(moveEndpointBounded([wall], wall, "b", { x: 150, y: 0 }, { ortho: false }).x).toBeCloseTo(150, 4)
  })
})

describe("попадание и рамка", () => {
  it("B-FOL-10: клик внутри прямоугольника батареи попадает в неё; клик в отступе (y = 11) и у стены — нет", () => {
    expect(hitBattery({ x: 135, y: 18 }, [W], [X], 0)).toEqual(X)
    expect(hitBattery({ x: 135, y: 11.5 }, [W], [X], 0)).toBeNull()
    expect(hitBattery({ x: 135, y: 0 }, [W], [X], 0)).toBeNull()
  })

  it("B-FOL-10b: радиус привязки расширяет попадание: клик на 2 см выше передней стороны попадает при tol 3, не попадает при 1", () => {
    expect(hitBattery({ x: 135, y: 25 }, [W], [X], 3)).toEqual(X)
    expect(hitBattery({ x: 135, y: 25 }, [W], [X], 1)).toBeNull()
  })

  it("B-FOL-10c: из двух непересекающихся батарей выбирается та, по которой клик (Y); порядок наложения спека не задаёт", () => {
    expect(hitBattery({ x: 335, y: 18 }, [W], [X, Y], 0)).toEqual(Y)
  })

  it("B-FOL-9: рамка, охватывающая батарею, выбирает её; рамка в стороне — нет", () => {
    expect(batteriesInRect({ x: 90, y: 5 }, { x: 180, y: 30 }, [W], [X, Y])).toEqual([X])
    expect(batteriesInRect({ x: 400, y: 5 }, { x: 480, y: 30 }, [W], [X, Y])).toEqual([])
  })

  it("B-FOL-9b: рамка, охватывающая обе батареи, выбирает обе в порядке списка", () => {
    expect(batteriesInRect({ x: 0, y: 5 }, { x: 500, y: 40 }, [W], [X, Y])).toEqual([X, Y])
  })
})

describe("ластик", () => {
  it("B-FOL-7: клик ластиком внутри батареи выбирает батарею, а не опорную стену", () => {
    const pick = erasePick({ x: 135, y: 18 }, { walls: [W], dimensions: [], doorways: [], batteries: [X] }, 2, 1)
    expect(pick).toEqual({ kind: "battery", battery: X })
  })

  it("B-FOL-7b: клик по телу стены под батареей по-прежнему выбирает стену", () => {
    const pick = erasePick({ x: 135, y: 0 }, { walls: [W], dimensions: [], doorways: [], batteries: [X] }, 2, 1)
    expect(pick?.kind).toBe("wall")
  })
})

describe("удаление", () => {
  const scene = (): Scene => ({
    walls: [W],
    dimensions: [
      { from: corner("b0"), to: jambOf("w0"), offset: 20 }, // на углу батареи
      { from: corner("y"), to: jambOf("w0"), offset: 20 }, // на углу другой батареи
      { from: jambOf("w0"), to: { kind: "jamb", elementId: "w0", jamb: "b", face: 1 }, offset: 20 }, // откосы окна
    ],
    doorways: [WA],
    batteries: [X, Y],
  })
  const none = { walls: [], dimensions: [], doorways: [] }

  it("B-FOL-8: удаление батареи удаляет размеры на её углах и только их; чужие размеры и вторая батарея остаются", () => {
    const next = deleteObjects(scene(), { ...none, batteries: [X] })
    expect(next.batteries).toEqual([Y])
    expect(next.dimensions).toHaveLength(2)
    expect(next.dimensions.some((d) => d.from.kind === "corner" && d.from.batteryId === "b0")).toBe(false)
    expect(next.walls).toEqual([W])
    expect(next.doorways).toEqual([WA])
  })

  it("B-FOL-6: удаление опорной стены удаляет её батареи и размеры на их углах", () => {
    const next = deleteObjects(scene(), { ...none, walls: [W] })
    expect(next.walls).toEqual([])
    expect(next.batteries ?? []).toEqual([])
    expect(next.dimensions.some((d) => d.from.kind === "corner")).toBe(false)
  })

  it("B-FOL-8b: удаление окна не трогает батарею и размеры на её углах, привязанные к другому откосу окна не нужны: размер на откосе удалённого окна уходит", () => {
    const next = deleteObjects(scene(), { ...none, doorways: [WA] })
    expect(next.batteries).toEqual([X, Y])
    expect(next.doorways).toEqual([])
    // оба размера «угол — откос окна» ссылались на откос окна и удалены; остальных размеров не осталось
    expect(next.dimensions).toEqual([])
  })

  it("B-FOL-8c: сцена не мутируется", () => {
    const s = scene()
    deleteObjects(s, { ...none, batteries: [X] })
    expect(s.batteries).toEqual([X, Y])
    expect(s.dimensions).toHaveLength(3)
  })

  it("B-FOL-8d: удаление нескольких батарей за раз удаляет все их размеры (одна операция)", () => {
    const next = deleteObjects(scene(), { ...none, batteries: [X, Y] })
    expect(next.batteries).toEqual([])
    expect(next.dimensions).toHaveLength(1)
  })
})

describe("рамка: пересечение с прямоугольником батареи", () => {
  it("B-FOL-9c: рамка, задевающая батарею частично ([150,299]×[0,40] против [100,170]×[13,23]), выбирает её, но не Y [300,370]", () => {
    expect(batteriesInRect({ x: 150, y: 0 }, { x: 299, y: 40 }, [W], [X, Y])).toEqual([X])
  })

  it("B-FOL-9d: рамка справа от X ([200,299]×[0,40]) её не выбирает", () => {
    expect(batteriesInRect({ x: 200, y: 0 }, { x: 299, y: 40 }, [W], [X, Y])).toEqual([])
  })

  it("B-FOL-9e: рамка, задевающая только стену под батареей (y ≤ 10), батарею не выбирает", () => {
    expect(batteriesInRect({ x: 100, y: -30 }, { x: 170, y: 10 }, [W], [X, Y])).toEqual([])
  })
})

describe("ластик: батарея раньше стены под допуском", () => {
  it("B-FOL-7c: допуск 14 (тело стены попадает по допуску оси: 14 ≤ 14), клик (135; 14) внутри батареи — выбирается батарея, а не стена", () => {
    const withoutBattery = erasePick({ x: 135, y: 14 }, { walls: [W], dimensions: [], doorways: [], batteries: [] }, 14, 1)
    expect(withoutBattery?.kind).toBe("wall") // контроль: без батареи тот же клик попадает в стену
    const pick = erasePick({ x: 135, y: 14 }, { walls: [W], dimensions: [], doorways: [], batteries: [X] }, 14, 1)
    expect(pick).toEqual({ kind: "battery", battery: X })
  })
})

describe("нажатие: приоритет целей", () => {
  const Xe = bat("W", "a", 10, { id: "xe" }) // [10,80]×[13,23] у конца a
  const Xm = bat("W", "a", 215, { id: "xm" }) // [215,285]×[13,23] у середины стены
  const base = { selectedWall: null, middleMarker: true, dimensions: true, elements: true }
  const scene = (batteries: Battery[]) => ({ walls: [W], dimensions: [], doorways: [], batteries })

  it("B-TOOL-6: батарея и тело стены в допуске одновременно (клик (135;14), допуск 14) — цель батарея, а не стена", () => {
    expect(pressPick({ x: 135, y: 14 }, scene([X]), 14, 1, { ...base, batteries: true })).toEqual({ kind: "battery", battery: X })
  })

  it("B-TOOL-6b: батареи отключены в опциях (другой инструмент, подложка) — тот же клик попадает в стену (допуск 14 ловит стену по оси)", () => {
    expect(pressPick({ x: 135, y: 14 }, scene([X]), 14, 1, { ...base, batteries: false })?.kind).toBe("wall")
    expect(pressPick({ x: 135, y: 14 }, scene([X]), 14, 1, base)?.kind).toBe("wall")
    expect(pressPick({ x: 135, y: 5 }, scene([X]), 6, 1, { ...base, batteries: true })?.kind).toBe("wall") // клик в теле стены, не в батарее
  })

  it("B-TOOL-6c: маркер конца выделенной стены главнее батареи в допуске: клик (4; 8), допуск 12 — «end a»", () => {
    const pick = pressPick({ x: 4, y: 8 }, scene([Xe]), 12, 1, { ...base, selectedWall: W, batteries: true })
    expect(pick).toEqual({ kind: "end", wall: W, end: "a" })
  })

  it("B-TOOL-6d: средний маркер выделенной стены главнее батареи у середины: клик (250; 8), допуск 12 — «middle»", () => {
    const pick = pressPick({ x: 250, y: 8 }, scene([Xm]), 12, 1, { ...base, selectedWall: W, batteries: true })
    expect(pick).toEqual({ kind: "middle", wall: W })
  })

  it("B-TOOL-6e: при выключенном среднем маркере тот же клик попадает в батарею", () => {
    const pick = pressPick({ x: 250, y: 18 }, scene([Xm]), 6, 1, { ...base, selectedWall: W, middleMarker: false, batteries: true })
    expect(pick).toEqual({ kind: "battery", battery: Xm })
  })

  it("B-TOOL-6f: клик мимо батареи — цель стена или ничего (батарея не выбирается за пределами допуска)", () => {
    expect(pressPick({ x: 135, y: 40 }, scene([X]), 6, 1, { ...base, batteries: true })).toBeNull()
  })
})

describe("рамка: внутри, полоса, наклонная стена", () => {
  it("B-FOL-9f: рамка целиком внутри прямоугольника батареи ([120,130]×[15,20] внутри [100,170]×[13,23]) выбирает её", () => {
    expect(batteriesInRect({ x: 120, y: 15 }, { x: 130, y: 20 }, [W], [X, Y])).toEqual([X])
  })

  it("B-FOL-9g: узкая полоса, пересекающая батарею насквозь ([90,180]×[17,18]), выбирает её", () => {
    expect(batteriesInRect({ x: 90, y: 17 }, { x: 180, y: 18 }, [W], [X, Y])).toEqual([X])
  })

  it("B-FOL-9h: наклонная стена (0,0)-(300,400): рамка [85,95]×[90,100] лежит в габарите батареи, но вне её повёрнутого прямоугольника — не выбирает", () => {
    const D = w(0, 0, 300, 400, "D")
    const onD = bat("D", "a", 100, { id: "d1" })
    expect(batteriesInRect({ x: 85, y: 90 }, { x: 95, y: 100 }, [D], [onD])).toEqual([])
  })

  it("B-FOL-9i: на той же наклонной стене рамка, пересекающая повёрнутый прямоугольник ([80,95]×[140,150], задевает угол (83,6; 149,8)), выбирает батарею", () => {
    const D = w(0, 0, 300, 400, "D")
    const onD = bat("D", "a", 100, { id: "d1" })
    expect(batteriesInRect({ x: 80, y: 140 }, { x: 95, y: 150 }, [D], [onD])).toEqual([onD])
  })
})
