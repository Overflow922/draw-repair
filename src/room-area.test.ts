import { describe, expect, it } from "vitest"
import { moveWalls } from "./geometry"
import { cloneScene } from "./history"
import { findRooms, formatArea } from "./room-area"
import type { Room } from "./room-area"
import { serializeStore } from "./storage"
import type { Point, Wall } from "./types"
import { hitWall } from "./wall-geometry"
import {
  L_REGION,
  RSLANT_AXES,
  W,
  area,
  distToBoundary,
  insetConvex,
  insidePolygon,
  orders,
  rect,
  sceneF,
  sceneL,
  sceneR,
  sceneR3,
  sceneRP,
  sceneRPgap,
  sceneRPnarrow,
  sceneRbox,
  sceneRisland,
  sceneRmixed,
  sceneRopen,
  sceneRslant,
  sceneSmall,
  sceneU,
  shiftWalls,
  transformWalls,
} from "./room-area.test-utils"

// Тесты change room-area-labels: определение помещений, площадь, подпись (spec room-areas).
// Площади — в см², допуск 1 см²; точка подписи — допуск 1 см (design D5).

const AREA_TOL = 1
const sortedAreas = (rooms: Room[]): number[] => rooms.map((r) => r.areaCm2).sort((a, b) => a - b)

function expectAreas(walls: Wall[], expected: number[]): Room[] {
  const rooms = findRooms(walls)
  const got = sortedAreas(rooms)
  const want = [...expected].sort((a, b) => a - b)
  expect(got).toHaveLength(want.length)
  want.forEach((v, i) => expect(Math.abs(got[i] - v)).toBeLessThanOrEqual(AREA_TOL))
  return rooms
}

const near = (p: Point, q: Point, tol: number): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= tol

const inRoom = (p: Point, room: Room): boolean => insidePolygon(p, room.outline) && !room.holes.some((h) => insidePolygon(p, h))

const deepCopy = (walls: Wall[]): Wall[] => structuredClone(walls)

function objectAt(v: unknown): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("ожидался объект")
  return Object.fromEntries(Object.entries(v))
}

function listAt(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new Error("ожидался массив")
  return [...v]
}

describe("findRooms — определение помещения", () => {
  it("ROOM-RECT-1: замкнутый прямоугольник — одно помещение 120 000 см²", () => {
    expectAreas(sceneR(), [120000])
  })

  it("ROOM-OPEN-1: П-образный контур — помещений нет", () => {
    expect(findRooms(sceneU())).toEqual([])
  })

  it("ROOM-NONE-1: пусто, одна стена, крест — помещений нет", () => {
    expect(findRooms([])).toEqual([])
    expect(findRooms([W(0, 0, 400, 0)])).toEqual([])
    expect(findRooms([W(0, 200, 400, 200), W(200, 0, 200, 400)])).toEqual([])
  })

  it("ROOM-FACE-1: контур из угловых стыков на грани — одно помещение 114 000", () => {
    expectAreas(sceneF(), [114000])
  })

  it("ROOM-T-1: перегородка на T-стыках делит прямоугольник на два помещения", () => {
    expect(findRooms(sceneRP())).toHaveLength(2)
  })

  it("ROOM-SLANT-1: непрямые углы с клиньями — площадь по внутренним граням", () => {
    const expected = area(insetConvex(RSLANT_AXES, 10))
    expectAreas(sceneRslant(), [expected])
  })

  it("ROOM-MIXED-1: швы стен разных материалов и толщин — не разрыв", () => {
    expectAreas(sceneRmixed(), [118500])
  })

  it("ROOM-ORDER-1: результат не зависит от порядка стен в массиве", () => {
    for (const [scene, expected] of [
      [sceneRP(), [54000, 60000]],
      [sceneR3(), [32400, 36000, 40000]],
      [sceneF(), [114000]],
    ] as const)
      for (const order of orders(scene)) expectAreas(order, [...expected])
  })

  it("ROOM-NOISE-1: повёрнутый и сдвинутый прямоугольник с нецелыми координатами", () => {
    expectAreas(transformWalls(sceneR(), 30, { x: 1234.567, y: 891.011 }), [120000])
  })

  it("ROOM-NOISE-2: шум на швах T-стыков не сливает комнаты", () => {
    expectAreas(transformWalls(sceneRP(), 30, { x: 1234.567, y: 891.011 }), [54000, 60000])
  })

  it("ROOM-FAR-1: далёкие координаты (10 км) — точная площадь", () => {
    expectAreas(shiftWalls(sceneR(), { x: 1_000_000, y: 1_000_000 }), [120000])
  })

  it("ROOM-BIG-1: план 100×100 м — точная площадь", () => {
    expectAreas(rect(0, 0, 10020, 10020), [100_000_000])
  })

  it("ROOM-TWO-1: два несоприкасающихся прямоугольника — два помещения", () => {
    expectAreas([...sceneR(), ...shiftWalls(sceneR(), { x: 1000, y: 0 })], [120000, 120000])
  })

  it("ROOM-SHARED-1: два прямоугольника с общей стеной — два помещения", () => {
    expectAreas([...sceneR(), W(420, 0, 840, 0), W(840, 0, 840, 320), W(840, 320, 420, 320)], [120000, 120000])
  })

  it("ROOM-DEGEN-1: вырожденная стена не ломает определение", () => {
    expectAreas([...sceneR(), W(100, 100, 100, 100)], [120000])
  })
})

describe("findRooms — вложенные контуры", () => {
  it("NEST-2-1: квартира с двумя комнатами — только площади комнат", () => {
    const rooms = expectAreas(sceneRP(), [54000, 60000])
    for (const r of rooms) {
      expect(Math.abs(r.areaCm2 - 120000)).toBeGreaterThan(AREA_TOL)
      expect(Math.abs(r.areaCm2 - 114000)).toBeGreaterThan(AREA_TOL)
    }
  })

  it("NEST-3-1: две комнаты и коридор — три помещения", () => {
    expectAreas(sceneR3(), [32400, 36000, 40000])
  })
})

describe("findRooms — разрыв соединяет области", () => {
  it("GAP-1: разрыв 10 см в перегородке — одно помещение 114 200", () => {
    expectAreas(sceneRPgap(), [114200])
  })

  it("GAP-NARROW-1: разрыв 1 мм — одно помещение 114 002", () => {
    expectAreas(sceneRPnarrow(), [114002])
  })

  it("GAP-OUTER-1: разрыв в наружной стене открывает только связанную с ним область", () => {
    expectAreas(sceneRopen(), [54000])
  })

  it("GAP-CLOSE-1: дорисованная стена закрывает разрыв — два помещения", () => {
    const walls = sceneRPgap()
    expectAreas(walls, [114200])
    expectAreas([...walls, W(200, 300, 200, 320)], [54000, 60000])
  })
})

describe("findRooms — площадь", () => {
  it("AREA-RECT-1: площадь по внутренним граням — 12,00 м²", () => {
    const [room] = expectAreas(sceneR(), [120000])
    expect(formatArea(room.areaCm2)).toBe("12,00 м²")
  })

  it("AREA-ISLAND-1: отдельная стена внутри вычитается — 11,80 м²", () => {
    const [room] = expectAreas(sceneRisland(), [118000])
    expect(formatArea(room.areaCm2)).toBe("11,80 м²")
  })

  it("AREA-BOX-1: короб внутри — отдельное помещение, внешнее за вычетом короба со стенами", () => {
    expectAreas(sceneRbox(), [36100, 755900])
  })

  it("AREA-MIN-1: область меньше 0,1 м² — не помещение", () => {
    expect(findRooms(sceneSmall(30, 30))).toEqual([])
    expect(findRooms(sceneSmall(40, 24.99))).toEqual([])
  })

  it("AREA-MIN-2: область ровно 0,1 м² и больше — помещение", () => {
    const [room] = expectAreas(sceneSmall(40, 25), [1000])
    expect(formatArea(room.areaCm2)).toBe("0,10 м²")
    expectAreas(sceneSmall(40, 26), [1040])
  })

  it("AREA-MIN-ISLAND-1: порог применяется к площади за вычетом острова", () => {
    // внутренняя область [10,50]×[10,40] = 1 200 см², остров [25,40]×[15,35] = 300 см², не касается стен
    expect(findRooms([...sceneSmall(40, 30), W(25, 25, 40, 25)])).toEqual([])
    expectAreas(sceneSmall(40, 30), [1200])
  })
})

describe("findRooms — точка подписи", () => {
  it("LBL-RECT-1: прямоугольник — подпись в центре", () => {
    const [room] = findRooms(sceneR())
    expect(near(room.labelAt, { x: 210, y: 160 }, 1)).toBe(true)
  })

  it("LBL-L-1: Г-образное помещение — подпись внутри, вдали от границы, не в центре масс", () => {
    const rooms = findRooms(sceneL())
    expect(rooms).toHaveLength(1)
    const p = rooms[0].labelAt
    expect(insidePolygon(p, L_REGION)).toBe(true)
    expect(distToBoundary(p, L_REGION)).toBeGreaterThanOrEqual(19)
    expect(near(p, { x: 114.7, y: 114.7 }, 5)).toBe(false)
  })

  it("LBL-ISLAND-1: колонна в центре — подпись вне колонны и вдали от неё", () => {
    const column: Point[] = [
      { x: 190, y: 140 },
      { x: 230, y: 140 },
      { x: 230, y: 180 },
      { x: 190, y: 180 },
    ]
    const rooms = findRooms([...sceneR(), W(190, 160, 230, 160, 40)])
    expect(rooms).toHaveLength(1)
    const p = rooms[0].labelAt
    expect(insidePolygon(p, column)).toBe(false)
    expect(distToBoundary(p, column)).toBeGreaterThanOrEqual(50)
    expect(distToBoundary(p, [{ x: 10, y: 10 }, { x: 410, y: 10 }, { x: 410, y: 310 }, { x: 10, y: 310 }])).toBeGreaterThanOrEqual(50)
  })

  it("LBL-BOX-1: подпись внешнего помещения вне короба, внутреннего — внутри короба", () => {
    const rooms = findRooms(sceneRbox())
    expect(rooms).toHaveLength(2)
    const [inner, outer] = [...rooms].sort((a, b) => a.areaCm2 - b.areaCm2)
    const inBox = (p: Point, x0: number, y0: number, x1: number, y1: number): boolean => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
    expect(inBox(outer.labelAt, 395, 295, 605, 505)).toBe(false)
    expect(inBox(inner.labelAt, 405, 305, 595, 495)).toBe(true)
  })

  it("LBL-INSIDE-1 / INV-LABEL-1: подпись каждого помещения внутри контура и вне дыр", () => {
    for (const scene of [sceneR(), sceneF(), sceneRP(), sceneR3(), sceneRisland(), sceneRbox(), sceneL(), sceneRslant()])
      for (const room of findRooms(scene)) expect(inRoom(room.labelAt, room)).toBe(true)
  })
})

describe("findRooms — подпись в центре масс (ревизия: вытянутые помещения)", () => {
  // центр масс простого многоугольника — независимо от реализации
  function centroidOf(poly: Point[]): Point {
    let a = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const c = p.x * q.y - q.x * p.y
      a += c
      cx += (p.x + q.x) * c
      cy += (p.y + q.y) * c
    }
    return { x: cx / (3 * a), y: cy / (3 * a) }
  }

  const loop = (pts: Point[]): Wall[] => pts.map((p, i) => W(p.x, p.y, pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y))

  // комната [0,400]×[0,300] с нишей [400,x1]×[0,100]; оси стен смещены наружу на 10
  const alcove = (x1: number): Wall[] =>
    loop([
      { x: -10, y: -10 },
      { x: x1 + 10, y: -10 },
      { x: x1 + 10, y: 110 },
      { x: 410, y: 110 },
      { x: 410, y: 310 },
      { x: -10, y: 310 },
    ])

  const alcoveRegion = (x1: number): Point[] => [
    { x: 0, y: 0 },
    { x: x1, y: 0 },
    { x: x1, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ]

  it("LBL-TILT-1: вытянутая комната 250×100 с перекосом стены 3 мм — подпись в центре масс", () => {
    const rooms = findRooms([W(0, 0, 270, 0.3), W(270, 0.3, 270, 120), W(270, 120, 0, 120), W(0, 120, 0, 0)])
    expect(rooms).toHaveLength(1)
    expect(near(rooms[0].labelAt, { x: 135, y: 60 }, 1)).toBe(true)
  })

  it("LBL-PARA-1: параллелограмм с наклонными длинными сторонами — подпись в центре масс", () => {
    const axes: Point[] = [
      { x: 0, y: 0 },
      { x: 270, y: 48.214 },
      { x: 270, y: 168.214 },
      { x: 0, y: 120 },
    ]
    const inner = insetConvex(axes, 10)
    const rooms = findRooms(loop(axes))
    expect(rooms).toHaveLength(1)
    expect(Math.abs(rooms[0].areaCm2 - area(inner))).toBeLessThanOrEqual(AREA_TOL)
    expect(near(rooms[0].labelAt, centroidOf(inner), 1)).toBe(true)
  })

  it("LBL-CENTROID-OK-1: центр масс в 2/3 R от границы — подпись в центре масс", () => {
    // область 160 000 см²; центр масс (300,125), до границы 100 см, R = 150 см
    const rooms = findRooms(alcove(800))
    expect(rooms).toHaveLength(1)
    expect(Math.abs(rooms[0].areaCm2 - area(alcoveRegion(800)))).toBeLessThanOrEqual(AREA_TOL)
    expect(near(rooms[0].labelAt, { x: 300, y: 125 }, 1)).toBe(true)
  })

  it("LBL-THRESHOLD-1: граница порога R/2 — ниша 870 даёт центр масс, ниша 885 — наиболее удалённую точку", () => {
    // 870: центр масс ≈ (322,4; 121,9), до границы ≈ 77,6 ≥ 75; 885: ≈ (327,4; 122,0), до границы ≈ 72,6 < 75
    const [ok] = findRooms(alcove(870))
    expect(near(ok.labelAt, { x: 322.43, y: 121.86 }, 1)).toBe(true)
    const region = alcoveRegion(885)
    const rooms = findRooms(alcove(885))
    expect(rooms).toHaveLength(1)
    const p = rooms[0].labelAt
    expect(distToBoundary(p, region)).toBeGreaterThanOrEqual(149)
    expect(near(p, { x: 327.4, y: 122 }, 50)).toBe(false)
  })

  it("LBL-ISLAND-NEAR-1: центр масс у колонны ближе R/2 — подпись в наиболее удалённой точке", () => {
    // колонна [230,270]×[140,180]; центр масс помещения ≈ (209,5; 160), до колонны ≈ 20,5 см
    const column: Point[] = [
      { x: 230, y: 140 },
      { x: 270, y: 140 },
      { x: 270, y: 180 },
      { x: 230, y: 180 },
    ]
    const rooms = findRooms([...sceneR(), W(230, 160, 270, 160, 40)])
    expect(rooms).toHaveLength(1)
    const p = rooms[0].labelAt
    expect(inRoom(p, rooms[0])).toBe(true)
    expect(distToBoundary(p, column)).toBeGreaterThanOrEqual(50)
    expect(near(p, { x: 209.46, y: 160 }, 20)).toBe(false)
  })

  it("LBL-ISLAND-CENTROID-1: центр масс считается за вычетом колонны", () => {
    // колонна [330,370]×[40,80]: центр масс (120000·(210;160) − 1600·(350;60)) / 118400 ≈ (208,11; 161,35)
    const rooms = findRooms([...sceneR(), W(330, 60, 370, 60, 40)])
    expect(rooms).toHaveLength(1)
    expect(near(rooms[0].labelAt, { x: 208.11, y: 161.35 }, 1)).toBe(true)
  })

  it("LBL-CENTROID-NEAR-1: центр масс ближе R/2 к границе — подпись в наиболее удалённой точке", () => {
    // область 170 000 см²; центр масс ≈ (332,4; 120,6), до границы ≈ 67,6 см < R/2 = 75 см
    const region = alcoveRegion(900)
    const rooms = findRooms(alcove(900))
    expect(rooms).toHaveLength(1)
    const p = rooms[0].labelAt
    expect(insidePolygon(p, region)).toBe(true)
    expect(distToBoundary(p, region)).toBeGreaterThanOrEqual(149)
    expect(near(p, { x: 332.4, y: 120.6 }, 50)).toBe(false)
  })
})

describe("formatArea", () => {
  it("FMT-1: 14,254 м² → «14,25 м²»", () => {
    expect(formatArea(142540)).toBe("14,25 м²")
  })

  it("FMT-2: 12 м² → «12,00 м²»", () => {
    expect(formatArea(120000)).toBe("12,00 м²")
  })

  it("FMT-ROUND-1: округление до сотых, половина вверх", () => {
    expect(formatArea(142550)).toBe("14,26 м²")
    expect(formatArea(142549)).toBe("14,25 м²")
    expect(formatArea(142451)).toBe("14,25 м²")
    // 1,005 м²: toFixed над дробными м² даёт «1,00» из-за двоичного представления
    expect(formatArea(10050)).toBe("1,01 м²")
  })

  it("FMT-SMALL-1: малые площади", () => {
    expect(formatArea(1000)).toBe("0,10 м²")
    expect(formatArea(100)).toBe("0,01 м²")
    expect(formatArea(4900)).toBe("0,49 м²")
  })

  it("FMT-LARGE-1: большая площадь без разделителя тысяч и экспоненты", () => {
    expect(formatArea(1_234_567_800)).toBe("123456,78 м²")
  })

  it("FMT-CHARS-1: запятая, обычный пробел, надстрочная двойка", () => {
    const s = formatArea(142540)
    expect([...s].map((c) => c.codePointAt(0))).toEqual([0x31, 0x34, 0x2c, 0x32, 0x35, 0x20, 0x43c, 0xb2])
    expect(s).not.toContain(".")
  })
})

describe("инварианты", () => {
  it("INV-PURE-1: findRooms не меняет стены, их порядок и объекты", () => {
    for (const scene of [sceneRP(), sceneRbox(), sceneF()]) {
      const before = deepCopy(scene)
      const refs = [...scene]
      findRooms(scene)
      expect(scene).toEqual(before)
      scene.forEach((w, i) => expect(w).toBe(refs[i]))
    }
  })

  it("INV-SUM-1: сумма площадей = внутренняя область минус перегородки внутри", () => {
    const sum = (walls: Wall[]): number => findRooms(walls).reduce((s, r) => s + r.areaCm2, 0)
    expect(Math.abs(sum(sceneR()) - 120000)).toBeLessThanOrEqual(AREA_TOL)
    expect(Math.abs(sum(sceneRP()) - (120000 - 20 * 300))).toBeLessThanOrEqual(AREA_TOL)
    expect(Math.abs(sum(sceneR3()) - (120000 - 400 * 20 - 180 * 20))).toBeLessThanOrEqual(AREA_TOL)
    expect(Math.abs(sum(sceneF()) - 114000)).toBeLessThanOrEqual(AREA_TOL)
  })

  it("INV-AREA-1: площадь ≥ 1000 и равна площади контура минус площади дыр", () => {
    for (const scene of [sceneR(), sceneF(), sceneRP(), sceneR3(), sceneRisland(), sceneRbox(), sceneL(), sceneRslant(), sceneRopen()])
      for (const room of findRooms(scene)) {
        expect(room.areaCm2).toBeGreaterThanOrEqual(1000)
        const geom = area(room.outline) - room.holes.reduce((s, h) => s + area(h), 0)
        expect(Math.abs(room.areaCm2 - geom)).toBeLessThanOrEqual(AREA_TOL)
      }
  })

  it("INV-STORE-1: сохранённый чертёж не содержит помещений", () => {
    const walls = sceneR()
    findRooms(walls)
    const raw = serializeStore({
      version: 3,
      activeId: "d1",
      drawings: [{ id: "d1", name: "План", walls, dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100 }],
    })
    const drawing = objectAt(listAt(objectAt(JSON.parse(raw)).drawings)[0])
    expect(Object.keys(drawing).sort()).toEqual(["dimensions", "id", "name", "scale", "view", "walls"])
    for (const w of listAt(drawing.walls)) expect(Object.keys(objectAt(w)).sort()).toEqual(["a", "b", "id", "thicknessCm", "type"])
  })
})

describe("актуальность и интеграция", () => {
  it("UPD-DELETE-1: удаление стены контура — помещение исчезает", () => {
    const walls = sceneR()
    expect(findRooms(walls)).toHaveLength(1)
    expect(findRooms(walls.filter((_, i) => i !== 2))).toEqual([])
  })

  it("UPD-UNDO-1: восстановление снимка сцены возвращает помещение", () => {
    const scene = { walls: sceneR(), dimensions: [] }
    const snapshot = cloneScene(scene)
    scene.walls = scene.walls.filter((_, i) => i !== 2)
    expect(findRooms(scene.walls)).toEqual([])
    expectAreas(snapshot.walls, [120000])
  })

  it("UPD-DRAG-1: перенос стены увеличивает помещение до 15,00 м²", () => {
    const walls = sceneR()
    moveWalls(walls, [walls[1]], { x: 100, y: 0 })
    const [room] = expectAreas(walls, [150000])
    expect(formatArea(room.areaCm2)).toBe("15,00 м²")
  })

  it("UPD-THICK-1: толщина стены 30 — площадь 118 500 по новой внутренней грани", () => {
    const walls = sceneR()
    walls[1].thicknessCm = 30
    expectAreas(walls, [118500])
  })

  it("HIT-ROOM-1: попадание курсора в помещение не выбирает ничего (регрессия)", () => {
    const walls = sceneR()
    findRooms(walls)
    expect(hitWall({ x: 210, y: 160 }, walls, 6)).toBeNull()
    expect(hitWall({ x: 210, y: 0 }, walls, 6)).toBe(walls[0])
  })
})
