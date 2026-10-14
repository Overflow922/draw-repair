import { describe, expect, it } from "vitest"
import { batteryHolds } from "./battery-geometry"
import { DEFAULT_BATTERY_PARAMS, arrowSlideBattery, inheritBatteryParams, placeBattery, slideBattery } from "./battery-place"
import { applied, bat, ctxOf, door, duct, riser, sceneF, sceneR, sceneRP, w, windowAt } from "./battery.test-utils"
import type { Battery } from "./battery.test-utils"

// change add-battery: установка, перемещение вдоль стены, стрелки, ограничения размещения, центровка по окну, параметры новых
// (spec battery «Инструмент «Батарея» и параметры новых батарей», «Размещение батареи вдоль стены», «Перемещение батареи»,
// «Центровка по окну»; design D3; test-plan B-PLC-*, B-CTR-*, B-NUM-1..4).
// Сцена R: W (0,0)-(500,0) t20, внутренняя грань y = 10 от x = 10 до x = 490. Радиус прилипания 6 см (ctxOf по умолчанию).

const { walls, W } = sceneR()
const X = bat("W", "a", 100) // [100,170]
const offsetsOf = (b: Battery): [string, number] => [b.anchor, b.offsetCm]

describe("параметры новых батарей", () => {
  it("B-NUM-1: по умолчанию длина 70 см, толщина 10 см, отступ 3 см", () => {
    expect(DEFAULT_BATTERY_PARAMS).toEqual({ lengthCm: 70, thicknessCm: 10, gapCm: 3 })
  })

  it("B-NUM-2: правка батареи делает её длину, толщину и отступ параметрами новых", () => {
    const edited = bat("W", "a", 100, { lengthCm: 90, thicknessCm: 12, gapCm: 5 })
    expect(inheritBatteryParams(DEFAULT_BATTERY_PARAMS, edited)).toEqual({ lengthCm: 90, thicknessCm: 12, gapCm: 5 })
  })

  it("B-NUM-3: параметры новых не меняются через неизменяемый вход (функция чистая)", () => {
    const params = Object.freeze({ ...DEFAULT_BATTERY_PARAMS })
    const next = inheritBatteryParams(params, bat("W", "a", 100, { lengthCm: 90 }))
    expect(params).toEqual({ lengthCm: 70, thicknessCm: 10, gapCm: 3 })
    expect(next.lengthCm).toBe(90)
  })
})

describe("призрак и установка", () => {
  it("B-PLC-20: центр призрака — проекция курсора на ось, привязка a, расстояние округляется до сантиметра (203,4 − 35 = 168,4 → 168)", () => {
    const g = placeBattery(W, walls, { x: 203.4, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf())
    expect(g).toEqual({ id: "g", wallId: "W", face: 1, anchor: "a", offsetCm: 168, lengthCm: 70, thicknessCm: 10, gapCm: 3 })
  })

  it("B-PLC-21: призрак берёт длину, толщину и отступ из параметров новых батарей", () => {
    const g = placeBattery(W, walls, { x: 250, y: 5 }, { lengthCm: 100, thicknessCm: 12, gapCm: 0 }, "g", ctxOf())
    expect(g).toMatchObject({ offsetCm: 200, lengthCm: 100, thicknessCm: 12, gapCm: 0 })
  })

  it("B-TOOL-2: грань короче батареи (стена 60 см, батарея 70 см) — призрака нет", () => {
    const S = w(0, 0, 60, 0, "S")
    expect(placeBattery(S, [S], { x: 30, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf())).toBeNull()
  })

  it("B-PLC-22: призрак у стыка прижимается к нему вплотную (курсор x = 20 → торец на x = 10)", () => {
    const g = placeBattery(W, walls, { x: 20, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf())
    expect(g?.offsetCm).toBe(10)
  })

  it("B-PLC-23: призрак рядом с батареей встаёт вплотную к её торцу, не налегая на неё", () => {
    const g = placeBattery(W, walls, { x: 150, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf({ batteries: [X] }))
    expect(g).not.toBeNull()
    if (g) expect(batteryHolds(g, { walls, batteries: [X], communications: [] })).toBe(true)
  })

  it("B-PLC-24: на стене 200 см две батареи [0,70] и [120,190]: промежутки 50 и 10 меньше 70 — призрака нет", () => {
    const S = w(0, 0, 200, 0, "S")
    const left = bat("S", "a", 0, { id: "l" })
    const right = bat("S", "a", 120, { id: "r" })
    expect(placeBattery(S, [S], { x: 95, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf({ batteries: [left, right] }))).toBeNull()
  })

  it("B-PLC-16: проём на стене не мешает: напротив проёма [100,190] батарея ставится как есть", () => {
    const d = door("W", "a", 100)
    const g = placeBattery(W, walls, { x: 145, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf({ elements: [d], snapCm: 0 }))
    expect(g?.offsetCm).toBe(110)
  })

  it("B-FACE-5: призрак на грани, выбранной по помещению: курсор снаружи комнаты → грань +1", () => {
    const g = placeBattery(W, walls, { x: 250, y: -8 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf())
    expect(g?.face).toBe(1)
  })
})

describe("перемещение вдоль стены", () => {
  it("B-PLC-13: перетаскивание на (50, 30) — расстояние 150, стена и грань прежние", () => {
    const b = applied(slideBattery(X, walls, { x: 50, y: 30 }, ctxOf({ snapCm: 0 })))
    expect(offsetsOf(b)).toEqual(["a", 150])
    expect(b).toMatchObject({ wallId: "W", face: 1, lengthCm: 70, thicknessCm: 10, gapCm: 3 })
  })

  it("B-PLC-13b: смещение округляется до целого сантиметра (50,4 → 150, 50,6 → 151)", () => {
    expect(applied(slideBattery(X, walls, { x: 50.4, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBe(150)
    expect(applied(slideBattery(X, walls, { x: 50.6, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBe(151)
  })

  it("B-PLC-13c: на наклонной стене смещение проецируется на ось", () => {
    const D = { id: "D", a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, thicknessCm: 20, type: "brick" as const }
    // смещение (60, 80) = 100 см вдоль оси (0.6, 0.8)
    const b = applied(slideBattery(bat("D", "a", 100), [D], { x: 60, y: 80 }, ctxOf({ snapCm: 0 })))
    expect(b.offsetCm).toBeCloseTo(200, 6)
  })

  it("B-PLC-1: остановка у стыка: влево — торец на x = 10 (расстояние 10), вправо — конец на x = 490 (расстояние 420)", () => {
    expect(applied(slideBattery(X, walls, { x: -500, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBe(10)
    expect(applied(slideBattery(X, walls, { x: 1000, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBe(420)
  })

  it("B-PLC-1b: стыки и грань: батарея не заходит в угол ни на 1 см", () => {
    const b = applied(slideBattery(X, walls, { x: -95, y: 0 }, ctxOf({ snapCm: 0 }))) // запрошено offset 5 (< 10)
    expect(b.offsetCm).toBe(10)
  })

  it("B-PLC-2: батарея Y упирается в торец X: справа — расстояние 170, слева — 30 (конец на x = 100)", () => {
    const Y = bat("W", "a", 300, { id: "y" })
    expect(applied(slideBattery(Y, walls, { x: -300, y: 0 }, ctxOf({ batteries: [X], snapCm: 0 }))).offsetCm).toBeCloseTo(170, 4)
    const Z = bat("W", "a", 20, { id: "z" }) // [20,90]
    expect(applied(slideBattery(Z, walls, { x: 200, y: 0 }, ctxOf({ batteries: [X], snapCm: 0 }))).offsetCm).toBeCloseTo(30, 4)
  })

  it("B-PLC-3b: точное касание при перетаскивании допустимо (Y на offset 170 вплотную к X)", () => {
    const Y = bat("W", "a", 300, { id: "y" })
    expect(applied(slideBattery(Y, walls, { x: -130, y: 0 }, ctxOf({ batteries: [X], snapCm: 0 }))).offsetCm).toBe(170)
  })

  it("B-PLC-4b: батарея на противоположной грани X не мешает (грань −1)", () => {
    const Y = bat("W", "a", 300, { id: "y", face: -1 })
    expect(applied(slideBattery(Y, walls, { x: -200, y: 0 }, ctxOf({ batteries: [X], snapCm: 0 }))).offsetCm).toBe(100)
  })

  it("B-PLC-5: напротив окна [200,320] батарея [225,295] допустима, перемещение не ограничивается", () => {
    const win = windowAt("W", "a", 200)
    const b = applied(slideBattery(X, walls, { x: 125, y: 0 }, ctxOf({ elements: [win], snapCm: 0 })))
    expect(b.offsetCm).toBe(225)
  })

  it("B-PLC-6b: перегородка P (тело x ∈ [295,305]) останавливает батарею: торец на x = 295 (расстояние 225)", () => {
    const rp = sceneRP()
    expect(applied(slideBattery(X, rp.walls, { x: 300, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBeCloseTo(225, 4)
    // и с другой стороны: торец на x = 305
    const far = bat("W", "a", 400, { id: "f" })
    expect(applied(slideBattery(far, rp.walls, { x: -300, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBeCloseTo(305, 4)
  })

  it("B-PLC-7b: воздуховод 20×20 с центром (200,25) останавливает батарею: торец на x = 190 (расстояние 120)", () => {
    const D = duct(200, 25, 20, 20)
    expect(applied(slideBattery(X, walls, { x: 300, y: 0 }, ctxOf({ communications: [D], snapCm: 0 }))).offsetCm).toBeCloseTo(120, 4)
  })

  it("B-PLC-8b: стояк Ø20 с центром (200,25) останавливает батарею у круга (≈120,2 см), без наложения", () => {
    const R = riser(200, 25, 20)
    const b = applied(slideBattery(X, walls, { x: 300, y: 0 }, ctxOf({ communications: [R], snapCm: 0 })))
    expect(b.offsetCm).toBeGreaterThanOrEqual(120)
    expect(b.offsetCm).toBeLessThanOrEqual(120.21)
    expect(batteryHolds(b, { walls, batteries: [], communications: [R] })).toBe(true)
  })

  it("B-PLC-12: после упора батарея следует за указателем при движении обратно (смещение считается от исходного положения)", () => {
    const blocked = applied(slideBattery(X, walls, { x: 1000, y: 0 }, ctxOf({ snapCm: 0 })))
    expect(blocked.offsetCm).toBe(420)
    expect(applied(slideBattery(X, walls, { x: -10, y: 0 }, ctxOf({ snapCm: 0 }))).offsetCm).toBe(90)
  })

  it("B-PLC-11: сторона привязки, стена и грань не меняются даже при большом смещении поперёк стены", () => {
    const b = applied(slideBattery(X, walls, { x: 10, y: 5000 }, ctxOf({ snapCm: 0 })))
    expect(b).toMatchObject({ wallId: "W", face: 1, anchor: "a" })
  })

  it("B-PLC-11b: батарея с привязкой b едет по тем же правилам: смещение вправо уменьшает расстояние", () => {
    const b = applied(slideBattery(bat("W", "b", 100), walls, { x: 30, y: 0 }, ctxOf({ snapCm: 0 })))
    expect(offsetsOf(b)).toEqual(["b", 70])
  })

  it("B-PLC-13d: перетаскивание без изменения положения — отказ «без изменений» (записи истории не будет)", () => {
    expect(slideBattery(X, walls, { x: 0.2, y: 50 }, ctxOf({ snapCm: 0 }))).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("B-PLC-13e: исходная батарея не мутируется", () => {
    const frozen = Object.freeze({ ...X })
    expect(() => slideBattery(frozen, walls, { x: 50, y: 0 }, ctxOf({ snapCm: 0 }))).not.toThrow()
    expect(frozen.offsetCm).toBe(100)
  })
})

describe("стрелки", () => {
  const RIGHT = { x: 1, y: 0 }

  it("B-PLC-14: стрелка вправо сдвигает батарею с привязкой a на 10 см в сторону конца b (расстояние 110)", () => {
    expect(offsetsOf(applied(arrowSlideBattery(X, walls, RIGHT, 10, ctxOf())))).toEqual(["a", 110])
  })

  it("B-PLC-14b: с Shift шаг 1 см (расстояние 101)", () => {
    expect(applied(arrowSlideBattery(X, walls, RIGHT, 1, ctxOf())).offsetCm).toBe(101)
  })

  it("B-PLC-14c: стрелка влево — к концу a (расстояние 90)", () => {
    expect(applied(arrowSlideBattery(X, walls, { x: -1, y: 0 }, 10, ctxOf())).offsetCm).toBe(90)
  })

  it("B-PLC-14d: батарея с привязкой b: стрелка вправо уменьшает расстояние (100 → 90)", () => {
    expect(offsetsOf(applied(arrowSlideBattery(bat("W", "b", 100), walls, RIGHT, 10, ctxOf())))).toEqual(["b", 90])
  })

  it("B-PLC-14e: диагональная стрелка образует с осью острый угол — сдвиг на 10 см вдоль оси", () => {
    const d = Math.SQRT1_2
    expect(applied(arrowSlideBattery(X, walls, { x: d, y: d }, 10, ctxOf())).offsetCm).toBe(110)
  })

  it("B-PLC-15: стрелка поперёк стены не сдвигает батарею", () => {
    expect(arrowSlideBattery(X, walls, { x: 0, y: -1 }, 10, ctxOf())).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("B-PLC-15b: допуск прямого угла 0,5°: 89,6° — не сдвигает, 89,0° — сдвигает", () => {
    const rad = (deg: number) => (deg * Math.PI) / 180
    expect(arrowSlideBattery(X, walls, { x: Math.cos(rad(89.6)), y: Math.sin(rad(89.6)) }, 10, ctxOf()).kind).toBe("rejected")
    expect(arrowSlideBattery(X, walls, { x: Math.cos(rad(89)), y: Math.sin(rad(89)) }, 10, ctxOf()).kind).toBe("applied")
  })

  it("B-PLC-14f: стрелка ограничена до касания: вправо у конца участка не выходит за x = 490", () => {
    const edge = bat("W", "a", 415) // [415,485]
    expect(applied(arrowSlideBattery(edge, walls, RIGHT, 10, ctxOf())).offsetCm).toBe(420)
  })

  it("B-PLC-14g: вплотную к упору стрелка не двигает", () => {
    expect(arrowSlideBattery(bat("W", "a", 420), walls, RIGHT, 10, ctxOf()).kind).toBe("rejected")
  })

  it("B-CTR-8: стрелки не прилипают к центру окна: из 217 на 10 вправо — ровно 227, а не 225", () => {
    const win = windowAt("W", "a", 200) // центр 260
    expect(applied(arrowSlideBattery(bat("W", "a", 217), walls, RIGHT, 10, ctxOf({ elements: [win] }))).offsetCm).toBe(227)
  })
})

describe("центровка по окну", () => {
  const win = windowAt("W", "a", 200) // [200,320], центр 260
  const c = (over: Parameters<typeof ctxOf>[0] = {}) => ctxOf({ elements: [win], ...over })

  it("B-CTR-1: перетаскивание: центр батареи на x = 262 (в радиусе 6) → прилипает: расстояние 225, центр ровно 260", () => {
    // исходный центр 135, смещение 127 → центр 262
    const b = applied(slideBattery(X, walls, { x: 127, y: 0 }, c()))
    expect(b.offsetCm).toBe(225)
    expect(b.offsetCm + b.lengthCm / 2).toBe(260)
  })

  it("B-CTR-2: призрак: курсор на x = 258 → призрак центрирован (расстояние 225); клик ставит ту же батарею", () => {
    const g = placeBattery(W, walls, { x: 258, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c())
    expect(g?.offsetCm).toBe(225)
  })

  it("B-CTR-3: вне радиуса: центр на x = 270 (10 > 6) — обычное округление, расстояние 235", () => {
    expect(placeBattery(W, walls, { x: 270, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c())?.offsetCm).toBe(235)
  })

  it("B-CTR-3b: радиус задан в сантиметрах (учёт зума): центр на x = 265 прилипает при радиусе 6 и не прилипает при радиусе 2", () => {
    expect(placeBattery(W, walls, { x: 265, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c({ snapCm: 6 }))?.offsetCm).toBe(225)
    expect(placeBattery(W, walls, { x: 265, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c({ snapCm: 2 }))?.offsetCm).toBe(230)
  })

  it("B-CTR-9: граница радиуса: расстояние центров ровно 6 — прилипает, 6,2 — нет", () => {
    expect(applied(slideBattery(X, walls, { x: 131, y: 0 }, c())).offsetCm).toBe(225) // центр 266
    expect(applied(slideBattery(X, walls, { x: 131.2, y: 0 }, c())).offsetCm).toBe(231) // центр 266,2 → округление 131,2 + 100
  })

  it("B-CTR-4: нечётная длина 71 → расстояние привязки 224,5, центр на x = 260", () => {
    const g = placeBattery(W, walls, { x: 258, y: 5 }, { lengthCm: 71, thicknessCm: 10, gapCm: 3 }, "g", c())
    expect(g?.offsetCm).toBe(224.5)
  })

  it("B-CTR-5: два окна: прилипает к окну с ближайшим центром, а не к первому в списке", () => {
    const left = windowAt("W", "a", 100, 120, "wl") // [100,220], центр 160
    const right = windowAt("W", "a", 300, 120, "wr") // [300,420], центр 360
    const both = ctxOf({ elements: [right, left] })
    expect(applied(slideBattery(X, walls, { x: 22, y: 0 }, both)).offsetCm).toBe(125) // центр 157 → 160
    expect(applied(slideBattery(X, walls, { x: 220, y: 0 }, both)).offsetCm).toBe(325) // центр 355 → 360
  })

  it("B-CTR-5d: два окна в радиусе прилипания: выбирается окно с ближайшим центром (160), а не первое в списке (153)", () => {
    const first = windowAt("W", "a", 150, 6, "w1") // [150,156], центр 153
    const second = windowAt("W", "a", 157, 6, "w2") // [157,163], центр 160
    const b = applied(slideBattery(X, walls, { x: 22, y: 0 }, ctxOf({ elements: [first, second] }))) // центр 157
    expect(b.offsetCm + b.lengthCm / 2).toBe(160)
  })

  it("B-CTR-5b: окно на другой стене в расчёт не входит", () => {
    const other = windowAt("R", "a", 100) // на стене R; центр 160 в координатах R
    expect(applied(slideBattery(X, walls, { x: 22, y: 0 }, ctxOf({ elements: [other] }))).offsetCm).toBe(122)
  })

  it("B-CTR-5c: окно считается независимо от грани батареи (батарея на грани −1 тоже центрируется)", () => {
    const outer = bat("W", "a", 100, { face: -1 })
    expect(applied(slideBattery(outer, walls, { x: 127, y: 0 }, c())).offsetCm).toBe(225)
  })

  it("B-CTR-6: центровка не хранится: батарея не получает ссылки на окно", () => {
    const b = applied(slideBattery(X, walls, { x: 127, y: 0 }, c()))
    expect(Object.keys(b).sort()).toEqual(["anchor", "face", "gapCm", "id", "lengthCm", "offsetCm", "thicknessCm", "wallId"])
  })

  it("B-CTR-6b: после установки перемещение окна батарею не двигает (данные батареи от окна не зависят)", () => {
    const b = applied(slideBattery(X, walls, { x: 127, y: 0 }, c()))
    const moved = windowAt("W", "a", 230)
    expect(slideBattery(b, walls, { x: 0, y: 0 }, ctxOf({ elements: [moved] })).kind).toBe("rejected")
    expect(b.offsetCm).toBe(225)
  })

  it("B-CTR-7: центрированное положение недопустимо (сосед занимает [230,300]) — батарея у соседа, без прилипания", () => {
    const neighbour = bat("W", "a", 230, { id: "n" })
    const b = applied(slideBattery(X, walls, { x: 127, y: 0 }, c({ batteries: [neighbour] })))
    expect(b.offsetCm).toBeCloseTo(160, 4) // конец на x = 230 вплотную
    expect(batteryHolds(b, { walls, batteries: [neighbour], communications: [] })).toBe(true)
  })

  it("B-CTR-10: центрирование на узком окне: окно уже батареи — центры всё равно совмещаются", () => {
    const narrow = windowAt("W", "a", 230, 60) // [230,290], центр 260
    expect(applied(slideBattery(X, walls, { x: 125, y: 0 }, ctxOf({ elements: [narrow] }))).offsetCm).toBe(225)
  })
})

describe("батарея другой стены — препятствие", () => {
  // Wb [10,80]×[13,23] на W у угла с L; Lb на внутренней грани L (x ∈ [13,23]), идущая от конца a (0,400) вверх
  const Wb = bat("W", "a", 10, { id: "wb" })
  const lb = (offset: number) => bat("L", "a", offset, { id: "lb" }) // y ∈ [400 − offset − 70, 400 − offset]

  it("B-PLC-30: батарея на L касается батареи на W (y ∈ [23,93] против y ≤ 23) — допустимо; на 1 см глубже — нет", () => {
    expect(batteryHolds(lb(307), { walls, batteries: [Wb], communications: [] })).toBe(true)
    expect(batteryHolds(lb(308), { walls, batteries: [Wb], communications: [] })).toBe(false)
  })

  it("B-PLC-30b: симметрично: батарея на W не налегает на батарею на L", () => {
    const onL = lb(307)
    expect(batteryHolds(Wb, { walls, batteries: [onL], communications: [] })).toBe(true)
    expect(batteryHolds(bat("W", "a", 10, { id: "wb", gapCm: 5 }), { walls, batteries: [lb(307)], communications: [] })).toBe(false)
  })

  it("B-PLC-30c: перетаскивание батареи L к углу останавливается в касании с батареей W: расстояние 307", () => {
    const b = applied(slideBattery(lb(100), walls, { x: 0, y: -500 }, ctxOf({ batteries: [Wb], snapCm: 0 })))
    expect(b.offsetCm).toBeCloseTo(307, 4)
  })

  it("B-PLC-30d: призрак на L не накрывает батарею W (допустимое положение или нет призрака)", () => {
    const g = placeBattery(walls[3], walls, { x: 20, y: 60 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf({ batteries: [Wb], snapCm: 0 }))
    if (g) expect(batteryHolds(g, { walls, batteries: [Wb], communications: [] })).toBe(true)
  })
})

describe("видимая грань свободной стены ограничена торцами", () => {
  const free = sceneF()
  const walls1 = free.walls
  const A = bat("W", "a", 100)
  const c0 = ctxOf({ snapCm: 0 })

  it("B-PLC-31: перетаскивание влево упирается в торец a (расстояние 0), вправо — в торец b (500 − 70 = 430)", () => {
    expect(applied(slideBattery(A, walls1, { x: -500, y: 0 }, c0)).offsetCm).toBe(0)
    expect(applied(slideBattery(A, walls1, { x: 1000, y: 0 }, c0)).offsetCm).toBe(430)
  })

  it("B-PLC-31b: стрелки у торцов: из 5 влево на 10 — до 0; из 425 вправо на 10 — до 430", () => {
    expect(applied(arrowSlideBattery(bat("W", "a", 5), walls1, { x: -1, y: 0 }, 10, c0)).offsetCm).toBe(0)
    expect(applied(arrowSlideBattery(bat("W", "a", 425), walls1, { x: 1, y: 0 }, 10, c0)).offsetCm).toBe(430)
  })

  it("B-PLC-31c: призрак у торцов прижимается к ним: курсор x = 10 → расстояние 0, x = 495 → 430", () => {
    expect(placeBattery(free.W, walls1, { x: 10, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c0)?.offsetCm).toBe(0)
    expect(placeBattery(free.W, walls1, { x: 495, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c0)?.offsetCm).toBe(430)
  })

  it("B-PLC-31d: батарея с привязкой b тоже не выходит за торцы: влево до x = 0 (расстояние 430), вправо до x = 500 (расстояние 0)", () => {
    const fromB = bat("W", "b", 100)
    expect(applied(slideBattery(fromB, walls1, { x: -1000, y: 0 }, c0)).offsetCm).toBe(430)
    expect(applied(slideBattery(fromB, walls1, { x: 1000, y: 0 }, c0)).offsetCm).toBe(0)
  })
})

describe("центровка при перетаскивании: точность и цели", () => {
  const win = windowAt("W", "a", 200) // центр 260
  const c = ctxOf({ elements: [win] })

  it("B-CTR-11: нечётная длина 71 при перетаскивании: расстояние 224,5 (центр ровно 260, без округления)", () => {
    const odd = bat("W", "a", 100, { id: "o", lengthCm: 71 }) // центр 135,5
    expect(applied(slideBattery(odd, walls, { x: 126.5, y: 0 }, c)).offsetCm).toBe(224.5)
  })

  it("B-CTR-11b: то же при привязке b: мир [224,5; 295,5], расстояние от конца b — 204,5", () => {
    const odd = bat("W", "b", 100, { id: "o", lengthCm: 71 }) // мир [329,400], центр 364,5
    const b = applied(slideBattery(odd, walls, { x: -102.5, y: 0 }, c))
    expect(b.anchor).toBe("b")
    expect(b.offsetCm).toBe(204.5)
  })

  it("B-CTR-12: дверь и проём — не цели прилипания: при двери с центром 260 перетаскивание в 262 даёт обычное округление (227)", () => {
    const d = door("W", "a", 215, 90) // [215,305], центр 260
    expect(applied(slideBattery(X, walls, { x: 127, y: 0 }, ctxOf({ elements: [d] }))).offsetCm).toBe(227)
  })
})

describe("правки батареи, уже налегающей на объект (из документа)", () => {
  // воздуховод 20×20 с центром (135,30): y ∈ [20,40] налегает на батарею [100,170]×[13,23] на 3 см
  const free = sceneF()
  const D = duct(135, 30, 20, 20)
  const c = ctxOf({ communications: [D], snapCm: 0 })

  it("B-PLC-32: отойти можно: перетаскивание влево на 100 выводит батарею из наложения (расстояние 0)", () => {
    expect(applied(slideBattery(X, free.walls, { x: -100, y: 0 }, c)).offsetCm).toBe(0)
  })

  it("B-PLC-32b: движение вдоль воздуховода при той же глубине наложения (3 см) не блокируется: +5 → 105", () => {
    expect(applied(slideBattery(X, free.walls, { x: 5, y: 0 }, c)).offsetCm).toBe(105)
  })

  it("B-PLC-32c: стрелка вправо из наложения: можно, глубина не растёт (10 см → 110)", () => {
    expect(applied(arrowSlideBattery(X, free.walls, { x: 1, y: 0 }, 10, c)).offsetCm).toBe(110)
  })
})

describe("призрак: коммуникации, второй участок грани, округление, радиус", () => {
  const free = sceneF()
  const c0 = ctxOf({ snapCm: 0 })

  it("B-PLC-40: воздуховод на пути призрака: призрака нет или он допустим (воздуховод 20×20 в (135,18) налегает на полосу [13,23])", () => {
    const D = duct(135, 18, 20, 20)
    const g = placeBattery(free.W, free.walls, { x: 135, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf({ communications: [D], snapCm: 0 }))
    if (g) expect(batteryHolds(g, { walls: free.walls, batteries: [], communications: [D] })).toBe(true)
  })

  it("B-PLC-40b: воздуховод вне позиции курсора призрак не сдвигает: курсор x = 135, воздуховод в (400,40) — расстояние ровно 100", () => {
    const D = duct(400, 40, 20, 20)
    const g = placeBattery(free.W, free.walls, { x: 135, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", ctxOf({ communications: [D], snapCm: 0 }))
    expect(g?.offsetCm).toBe(100)
  })

  it("B-PLC-41: два участка грани (перегородка P делит грань на [10,295] и [305,490]): курсор x = 400 — призрак на втором участке, расстояние 365", () => {
    const rp = sceneRP()
    expect(placeBattery(rp.W, rp.walls, { x: 400, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c0)?.offsetCm).toBe(365)
  })

  it("B-PLC-41b: курсор x = 100 — призрак на первом участке, расстояние 65", () => {
    const rp = sceneRP()
    expect(placeBattery(rp.W, rp.walls, { x: 100, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c0)?.offsetCm).toBe(65)
  })

  it("B-PLC-42: округление призрака к ближайшему сантиметру: центр 250,6 → расстояние 215,6 → 216", () => {
    expect(placeBattery(free.W, free.walls, { x: 250.6, y: 5 }, DEFAULT_BATTERY_PARAMS, "g", c0)?.offsetCm).toBe(216)
  })

  it("B-CTR-13: радиус прилипания 2 см: центр на 5 см от центра окна (265 против 260) не прилипает — расстояние 230", () => {
    const win = windowAt("W", "a", 200)
    expect(applied(slideBattery(X, walls, { x: 130, y: 0 }, ctxOf({ elements: [win], snapCm: 2 }))).offsetCm).toBe(230)
  })
})
