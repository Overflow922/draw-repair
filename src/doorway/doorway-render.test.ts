import { describe, expect, it } from "vitest"
import { SCREEN_METRICS, drawScene } from "../render"
import { findRooms } from "../room-area"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Doorway, Unit, View, Wall } from "../types"
import {
  AREA_LABEL,
  D0,
  UO,
  VIEW,
  clippedIn,
  door,
  heightTexts,
  numberTexts,
  onSegment,
  recorder,
  sameSegment,
  sceneF,
  sceneR,
  sceneRT,
  segments,
  sorted,
  strokes,
  texts,
  toScreen,
} from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"

// change add-doorway: отображение проёма, размеры выделенного проёма, подпись высоты, помещения
// (spec doorway «Размеры выделенного проёма», «Отображение проёма»; room-areas «Проём не разрывает помещение»;
// design D2, D7, D10). Ожидания — по геометрии сцен в экранных координатах.

const INK = LIGHT_PALETTE.ink
const PAPER = LIGHT_PALETTE.paper

function draw(walls: Wall[], opts: RenderOptions, unit: Unit = "cm", view: View = VIEW): Op[] {
  const { ctx, ops } = recorder()
  // без сетки: её тонкие линии на кратных 10 см совпали бы с гранями y = ±10
  drawScene(ctx, 1600, 1200, walls, null, unit, view, [], { grid: false, ...opts })
  return ops
}

const S = (x: number, y: number) => toScreen({ x, y })
const TOL = 0.5

// контурные линии стен: цвет чернил, толщина контура
const contour = (ops: Op[]) => strokes(ops).filter((o) => o.strokeStyle === INK && o.lineWidth === SCREEN_METRICS.contourPx)

describe("вырез проёма", () => {
  it("DL-01: штриховка стены не заходит на участок проёма, вне проёма — есть", () => {
    const { walls } = sceneR()
    const plain = draw(walls, {})
    expect(clippedIn(plain, S(145, 0))).toBe(true) // контроль: без проёма участок заштрихован
    const ops = draw(walls, { doorways: [D0()] })
    expect(clippedIn(ops, S(145, 0))).toBe(false)
    expect(clippedIn(ops, S(145, 8))).toBe(false)
    expect(clippedIn(ops, S(101, -8))).toBe(false)
    expect(clippedIn(ops, S(50, 0))).toBe(true)
    expect(clippedIn(ops, S(250, 0))).toBe(true)
    expect(clippedIn(ops, S(98, 0))).toBe(true)
  })

  it("DL-02: откосы — линии контура, грани в проёме контуром не рисуются", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [D0()] })
    const segs = contour(ops).flatMap(segments)
    for (const x of [100, 190]) expect(segs.some((s) => sameSegment(s, S(x, -10), S(x, 10), TOL))).toBe(true)
    for (const y of [-10, 10]) expect(segs.some((s) => onSegment(S(145, y), s, TOL))).toBe(false)
    // грани вне проёма — контуром
    for (const y of [-10, 10]) expect(segs.some((s) => onSegment(S(50, y), s, TOL))).toBe(true)
  })

  it("DL-02b: грани продолжаются через проём тонкими линиями не цвета чернил и не цвета фона", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [D0()] })
    const thin = strokes(ops).filter((o) => o.strokeStyle !== INK && o.strokeStyle !== PAPER && o.lineWidth < SCREEN_METRICS.contourPx)
    const segs = thin.flatMap(segments)
    for (const y of [-10, 10]) {
      expect(segs.some((s) => onSegment(S(101, y), s, TOL) && onSegment(S(189, y), s, TOL))).toBe(true)
      // продолжение только через проём, не по всей стене
      expect(segs.some((s) => onSegment(S(50, y), s, TOL))).toBe(false)
    }
  })

  it("DL-13: нарушенный проём — участок вне стены не вырезается и не рисуется", () => {
    const { walls } = sceneF()
    const broken = door("W", "a", 450) // откосы 450 … 540 при длине 500
    const ops = draw(walls, { doorways: [broken] })
    const limit = S(500, 0).x + TOL
    // контур и тонкие продолжения граней (штриховка — линии под отсечением, её проверяет clippedIn)
    const drawn = [...contour(ops), ...strokes(ops).filter((o) => o.strokeStyle !== INK && o.strokeStyle !== PAPER)]
    for (const o of drawn) for (const sp of o.subpaths) for (const p of sp) expect(p.x).toBeLessThanOrEqual(limit)
    expect(clippedIn(ops, S(475, 0))).toBe(false) // часть проёма на стене вырезана
    expect(clippedIn(ops, S(440, 0))).toBe(true)
    const segs = contour(ops).flatMap(segments)
    expect(segs.some((s) => sameSegment(s, S(450, -10), S(450, 10), TOL))).toBe(true)
  })

  it("DL-09: проём на отсутствующей стене не рисуется", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [door("nope", "a", 100)] })
    expect(heightTexts(ops)).toEqual([])
    expect(clippedIn(ops, S(145, 0))).toBe(true)
  })
})

describe("подпись высоты", () => {
  it("DL-03: подпись со стороны помещения в текущих единицах", () => {
    const { walls } = sceneR()
    for (const [unit, text] of [
      ["mm", "H=2100"],
      ["cm", "H=210"],
      ["m", "H=2,1"],
    ] as const) {
      const labels = heightTexts(draw(walls, { doorways: [D0()] }, unit))
      expect(labels.map((t) => t.text)).toEqual([text])
      expect(labels[0].at.y).toBeGreaterThan(S(0, 10).y) // помещение — y > 10
      expect(labels[0].at.x).toBeGreaterThan(S(100, 0).x)
      expect(labels[0].at.x).toBeLessThan(S(190, 0).x)
    }
  })

  it("DL-03b: у нижней стены комнаты подпись над стеной (со стороны помещения)", () => {
    const { walls } = sceneR()
    // B (500,400)-(0,400): откосы x = 400 … 310
    const labels = heightTexts(draw(walls, { doorways: [door("B", "a", 100)] }))
    expect(labels.map((t) => t.text)).toEqual(["H=210"])
    expect(labels[0].at.y).toBeLessThan(S(0, 390).y)
    expect(labels[0].at.x).toBeGreaterThan(S(310, 0).x)
    expect(labels[0].at.x).toBeLessThan(S(400, 0).x)
  })

  it("DL-03c: без помещения — слева на экране от a → b (нормаль (d.y, −d.x))", () => {
    const { walls } = sceneF()
    // W слева направо на экране: слева — над стеной, y < −10
    const labels = heightTexts(draw(walls, { doorways: [D0()] }))
    expect(labels).toHaveLength(1)
    expect(labels[0].at.y).toBeLessThan(S(0, -10).y)
    const flipped = [{ ...walls[0], a: { x: 500, y: 0 }, b: { x: 0, y: 0 } }]
    const back = heightTexts(draw(flipped, { doorways: [door("W", "b", 100)] }))
    expect(back[0].at.y).toBeGreaterThan(S(0, 10).y)
  })

  it("DL-03e: помещения с обеих сторон — слева на экране от a → b (нормаль (d.y, −d.x))", () => {
    const { walls } = sceneRT()
    // Q (250,10)-(250,390) идёт на экране вниз: слева — сторона x > 255 (нормаль (1, 0)); откосы y = 110 … 200
    const labels = heightTexts(draw(walls, { doorways: [door("Q", "a", 100)] }))
    expect(labels).toHaveLength(1)
    expect(labels[0].at.x).toBeGreaterThan(S(255, 0).x)
    expect(labels[0].at.y).toBeGreaterThan(S(0, 110).y)
    expect(labels[0].at.y).toBeLessThan(S(0, 200).y)
  })

  it("DL-03f: помещение со стороны minus (W развёрнута) — подпись всё равно со стороны помещения", () => {
    const r = sceneR()
    const Wr: Wall = { ...r.W, a: { x: 500, y: 0 }, b: { x: 0, y: 0 } }
    const walls = [Wr, r.R, r.B, r.L]
    expect(findRooms(walls)).toHaveLength(1) // контроль: комната та же
    // правило помещения проверяют DL-03 и DL-03b (там сторона «слева на экране» — снаружи помещения);
    // здесь — то же помещение при обратном направлении стены
    const labels = heightTexts(draw(walls, { doorways: [door("W", "b", 100)] }))
    expect(labels).toHaveLength(1)
    expect(labels[0].at.y).toBeGreaterThan(S(0, 10).y)
  })

  it("DL-03d: подпись видна без выделения у каждого проёма", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [D0(), door("W", "a", 300, 90, 200, "d2")] })
    expect(sorted(heightTexts(ops).map((t) => t.text))).toEqual(["H=200", "H=210"])
  })

  it("DL-10: размер шрифта подписи не зависит от зума", () => {
    const { walls } = sceneR()
    const f1 = heightTexts(draw(walls, { doorways: [D0()] }, "cm", { zoom: 1, pan: { x: -100, y: -100 } }))[0].font
    const f3 = heightTexts(draw(walls, { doorways: [D0()] }, "cm", { zoom: 3, pan: { x: -100, y: -100 } }))[0].font
    expect(f3).toBe(f1)
  })
})

describe("размеры выделенного проёма", () => {
  const above = (ops: Op[]): string[] => sorted(numberTexts(ops).filter((t) => t.at.y < S(0, -10).y).map((t) => t.text))
  const below = (ops: Op[]): string[] => sorted(numberTexts(ops).filter((t) => t.at.y > S(0, 10).y).map((t) => t.text))
  // цепочка грани по порядку вдоль x: каждое число в своём интервале (мировые x) — порядок a | ширина | b
  const expectChain = (ops: Op[], side: "above" | "below", expected: [string, number, number][]): void => {
    const onSide = numberTexts(ops)
      .filter((t) => (side === "above" ? t.at.y < S(0, -10).y : t.at.y > S(0, 10).y))
      .sort((p, q) => p.at.x - q.at.x)
    expect(onSide.map((t) => t.text)).toEqual(expected.map(([text]) => text))
    onSide.forEach((t, i) => {
      expect(t.at.x).toBeGreaterThanOrEqual(S(expected[i][1], 0).x)
      expect(t.at.x).toBeLessThanOrEqual(S(expected[i][2], 0).x)
    })
  }
  const D0_BELOW: [string, number, number][] = [
    ["90", 10, 100],
    ["90", 100, 190],
    ["300", 190, 490],
  ]
  const D0_ABOVE: [string, number, number][] = [
    ["110", -10, 100],
    ["90", 100, 190],
    ["320", 190, 510],
  ]

  it("DL-04: шесть чисел — 90 | 90 | 300 со стороны помещения, 110 | 90 | 320 снаружи", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [D0()], selectedDoorways: [D0()] })
    expect(numberTexts(ops)).toHaveLength(6)
    expectChain(ops, "below", D0_BELOW)
    expectChain(ops, "above", D0_ABOVE)
  })

  it("DL-04b: числа в выбранной единице (мм)", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [D0()], selectedDoorways: [D0()] }, "mm")
    expectChain(ops, "below", D0_BELOW.map(([t, a, b]) => [`${Number(t) * 10}`, a, b]))
    expectChain(ops, "above", D0_ABOVE.map(([t, a, b]) => [`${Number(t) * 10}`, a, b]))
  })

  it("DL-05: без выделения размеров проёма нет", () => {
    const { walls } = sceneR()
    expect(numberTexts(draw(walls, { doorways: [D0()] }))).toEqual([])
  })

  it("DL-06: при мультивыделении размеров проёмов нет", () => {
    const { walls } = sceneR()
    const d2 = door("W", "a", 300, 90, 210, "d2")
    expect(numberTexts(draw(walls, { doorways: [D0(), d2], selectedDoorways: [D0(), d2] }))).toEqual([])
  })

  it("DL-07: расстояние 0 — число «0» у откоса", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [UO()], selectedDoorways: [UO()] })
    // «0» — у откоса на x = 10 (в пределах ширины числа)
    expectChain(ops, "below", [
      ["0", -5, 25],
      ["90", 10, 100],
      ["390", 100, 490],
    ])
    expectChain(ops, "above", [
      ["20", -10, 10],
      ["90", 10, 100],
      ["410", 100, 510],
    ])
    expect(below(ops)).toEqual(sorted(["0", "90", "390"]))
    expect(above(ops)).toEqual(sorted(["20", "90", "410"]))
  })

  it("DL-08: призрак установки показывает размеры", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorwayGhost: D0() })
    expectChain(ops, "below", D0_BELOW)
    expectChain(ops, "above", D0_ABOVE)
  })
})

describe("подсветка выделения проёма", () => {
  // обводка участка проёма: откосы x = 100 и 190 от y = −10 до y = 10 цветом стиля
  const outlined = (ops: Op[], style: string, x1: number, x2: number): boolean => {
    const segs = strokes(ops)
      .filter((o) => o.strokeStyle === style)
      .flatMap(segments)
    return [x1, x2].every((x) => segs.some((s) => onSegment(S(x, -9), s, TOL) && onSegment(S(x, 9), s, TOL)))
  }

  it("DL-12: выделенный проём обведён цветом выделения по участку проёма", () => {
    const { walls } = sceneR()
    expect(outlined(draw(walls, { doorways: [D0()] }), LIGHT_PALETTE.selection, 100, 190)).toBe(false) // контроль
    expect(outlined(draw(walls, { doorways: [D0()], selectedDoorways: [D0()] }), LIGHT_PALETTE.selection, 100, 190)).toBe(true)
  })

  it("DL-12b: при мультивыделении каждый проём обведён, размеров нет", () => {
    const { walls } = sceneR()
    const d2 = door("W", "a", 300, 90, 210, "d2")
    const ops = draw(walls, { doorways: [D0(), d2], selectedDoorways: [D0(), d2] })
    expect(outlined(ops, LIGHT_PALETTE.selection, 100, 190)).toBe(true)
    expect(outlined(ops, LIGHT_PALETTE.selection, 300, 390)).toBe(true)
    expect(numberTexts(ops)).toEqual([])
  })

  it("DL-12c: проём, задетый рамкой, подсвечен мягким стилем рамки", () => {
    const { walls } = sceneR()
    const ops = draw(walls, { doorways: [D0()], marqueeHits: { walls: [], dims: [], doorways: [D0()] } })
    expect(outlined(ops, LIGHT_PALETTE.marqueeWall, 100, 190)).toBe(true)
    expect(outlined(ops, LIGHT_PALETTE.selection, 100, 190)).toBe(false)
  })
})

describe("помещения не видят проёмов", () => {
  const areas = (ops: Op[]): string[] => sorted(texts(ops).filter((t) => AREA_LABEL.test(t.text)).map((t) => t.text))

  it("DR-01: две комнаты с проёмом в перегородке — две прежние площади", () => {
    const { walls } = sceneRT()
    const plain = areas(draw(walls, {}))
    expect(plain).toHaveLength(2)
    const d: Doorway = door("Q", "a", 100)
    expect(areas(draw(walls, { doorways: [d] }))).toEqual(plain)
  })

  it("DR-02: проём в наружной стене — помещение сохраняется", () => {
    const { walls } = sceneR()
    const plain = areas(draw(walls, {}))
    expect(plain).toHaveLength(1)
    expect(areas(draw(walls, { doorways: [D0()] }))).toEqual(plain)
  })
})
