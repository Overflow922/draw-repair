import { describe, expect, it } from "vitest"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "./wall-edit"
import {
  FREE, ORTHO, body, expectPoint, expectWall, overlapArea, overlapDepth, restore, sceneCM, sceneCR, snapshot, unchanged, w,
} from "./wall-edit.test-utils"

// change wall-move-bounds: wall-collision «Стены не проходят сквозь друг друга»
// (test-plan C-*, LI-4, LI-5; API — design D1).

describe("перемещение: остановка в касании", () => {
  it("C-1: перемещение останавливается в касании торца с гранью препятствия", () => {
    const { walls, X, M } = sceneCM()
    const v = moveWallsBounded(walls, [M], { x: 150, y: 0 }, FREE)
    expectPoint(v, 90, 0)
    expectWall(M, 90, 200, 190, 200)
    expectWall(X, 200, 0, 200, 400)
  })

  it("C-2: большой шаг не проносит стену через препятствие", () => {
    const { walls, M } = sceneCM()
    expectPoint(moveWallsBounded(walls, [M], { x: 400, y: 0 }, FREE), 90, 0)
    expectWall(M, 90, 200, 190, 200)
  })

  it("C-3: скольжение вдоль препятствия — составляющая вдоль применена", () => {
    const { walls, M } = sceneCM()
    expectPoint(moveWallsBounded(walls, [M], { x: 150, y: 60 }, FREE), 90, 60)
    expectWall(M, 90, 260, 190, 260)
  })

  it("C-4: от препятствия стена сразу отходит за указателем (повтор от снимка жеста)", () => {
    const { walls, M } = sceneCM()
    const snap = snapshot(walls)
    moveWallsBounded(walls, [M], { x: 150, y: 0 }, FREE)
    restore(walls, snap)
    expectPoint(moveWallsBounded(walls, [M], { x: 50, y: 0 }, FREE), 50, 0)
    expectWall(M, 50, 200, 150, 200)
  })

  it("C-5: перемещение ровно до касания применяется полностью", () => {
    const { walls, M } = sceneCM()
    expectPoint(moveWallsBounded(walls, [M], { x: 90, y: 0 }, FREE), 90, 0)
  })

  it("C-13: наложение 0.009 см (не больше 0.01) пересечением не считается", () => {
    const { walls, M } = sceneCM()
    const v = moveWallsBounded(walls, [M], { x: 90.009, y: 0 }, FREE)
    expect(v.x).toBeCloseTo(90.009, 6)
    expect(v.y).toBe(0)
  })

  it("C-14: при запросе глубже допуска — остановка в касании (глубина 0), а не на глубине 0.01", () => {
    const { walls, X, M } = sceneCM()
    const v = moveWallsBounded(walls, [M], { x: 90.5, y: 0 }, FREE)
    expect(Math.abs(v.x - 90)).toBeLessThanOrEqual(1e-4)
    expect(v.y).toBe(0)
    expect(Math.abs(overlapDepth(body(M), body(X)))).toBeLessThanOrEqual(1e-4)
  })

  it("C-15: тонкое препятствие (2 см) не пропускается большим шагом", () => {
    const X = w(200, 0, 200, 400, "X", 2)
    const M = w(0, 200, 100, 200, "M", 10)
    expectPoint(moveWallsBounded([X, M], [M], { x: 400, y: 0 }, FREE), 99, 0)
  })

  it("C-15b: тонкая стена боком не проходит через тонкое препятствие (нет туннелирования)", () => {
    const X = w(200, 0, 200, 400, "X", 2)
    const M = w(3, 100, 3, 300, "M", 2)
    expectPoint(moveWallsBounded([X, M], [M], { x: 400, y: 0 }, FREE), 195, 0)
    expectWall(M, 198, 100, 198, 300)
  })

  it("C-6: сдвиг стрелкой укорачивается до касания", () => {
    const X = w(200, 0, 200, 400, "X", 20)
    const M = w(0, 200, 186, 200, "M", 10)
    expectPoint(moveWallsBounded([X, M], [M], { x: 10, y: 0 }, FREE), 4, 0)
    expectWall(M, 4, 200, 190, 200)
  })

  it("C-7: сдвиг стрелкой в упоре ничего не меняет", () => {
    const X = w(200, 0, 200, 400, "X", 20)
    const M = w(0, 200, 190, 200, "M", 10)
    const walls = [X, M]
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [M], { x: 10, y: 0 }, FREE), 0, 0)
    expect(unchanged(walls, snap)).toBe(true)
  })

  it("C-8: группа ограничивается целиком, когда в препятствие упирается одна стена", () => {
    const { walls, M } = sceneCM()
    const N = w(0, 500, 100, 500, "N", 10)
    walls.push(N)
    expectPoint(moveWallsBounded(walls, [M, N], { x: 150, y: 0 }, FREE), 90, 0)
    expectWall(M, 90, 200, 190, 200)
    expectWall(N, 90, 500, 190, 500)
  })
})

describe("увлекаемые стены", () => {
  it("C-9: примкнутая стена, увлекаемая перемещением, останавливает всю правку в касании", () => {
    const A = w(0, 0, 200, 0, "A", 10)
    const W = w(100, 0, 100, 100, "W", 10)
    const Z = w(0, 140, 200, 140, "Z", 10)
    const v = moveWallsBounded([A, W, Z], [A], { x: 0, y: 100 }, FREE)
    expectPoint(v, 0, 35)
    expectWall(A, 0, 35, 200, 35)
    expectWall(W, 100, 35, 100, 135)
    expectWall(Z, 0, 140, 200, 140)
  })

  it("C-10: орто-растяжение — верхняя стена до касания, боковые удлиняются на столько же", () => {
    const { walls, top, right, bottom, left } = sceneCR()
    walls.push(w(-50, -50, 350, -50, "O", 20))
    const v = moveWallsBounded(walls, [top], { x: 0, y: -100 }, ORTHO)
    expectPoint(v, 0, -30)
    expectWall(top, 0, -30, 300, -30)
    expectWall(right, 300, -30, 300, 200)
    expectWall(left, 0, 200, 0, -30)
    expectWall(bottom, 300, 200, 0, 200)
  })

  it("C-9b: сосед по стыку, поворачиваясь вслед за перемещаемой стеной, останавливает правку в касании", () => {
    const A = w(0, 0, 100, 0, "A", 10)
    const B = w(100, 0, 100, 100, "B", 10)
    const Z = w(130, 40, 130, 200, "Z", 10)
    const v = moveWallsBounded([A, B, Z], [A], { x: 100, y: 0 }, FREE)
    // A сама до Z не достаёт (Z ниже её тела); упирается повёрнутая B. Касание по прямой —
    // при dx ≈ 32.894; скольжение вдоль контакта допустимо и может дать v.y ≠ 0 (спецификация:
    // ближайшее к запрошенному), поэтому проверяется то, что верно при любом скольжении
    expect(v.x).toBeGreaterThan(30)
    expectWall(A, v.x, v.y, 100 + v.x, v.y)
    expectPoint(B.a, 100 + v.x, v.y)
    expectPoint(B.b, 100, 100)
    const d = overlapDepth(body(B), body(Z))
    expect(d).toBeGreaterThanOrEqual(-1e-3)
    expect(d).toBeLessThanOrEqual(0.01)
    // не дальше от запроса, чем касание без скольжения
    expect(Math.hypot(100 - v.x, v.y)).toBeLessThanOrEqual(67.106 + 1e-3)
  })

  it("C-16: состыкованные стены не препятствуют друг другу", () => {
    const { walls, top } = sceneCR()
    expectPoint(moveWallsBounded(walls, [top], { x: 0, y: -30 }, FREE), 0, -30)
    expectWall(top, 0, -30, 300, -30)
  })
})

describe("перетаскивание конца", () => {
  it("C-11: конец останавливается в касании с гранью", () => {
    const { walls, M } = sceneCM()
    expectPoint(moveEndpointBounded(walls, M, "b", { x: 300, y: 200 }, FREE), 190, 200)
    expectWall(M, 0, 200, 190, 200)
  })

  it("C-12: конец, привязанный к линии оси препятствия, допустим", () => {
    const { walls, X, M } = sceneCM()
    expectPoint(moveEndpointBounded(walls, M, "b", { x: 200, y: 200 }, { ortho: false, snappedAxis: X }), 200, 200)
    expectWall(M, 0, 200, 200, 200)
  })

  it("C-12c: тот же конец на оси без привязки — остановка у грани", () => {
    const { walls, M } = sceneCM()
    expectPoint(moveEndpointBounded(walls, M, "b", { x: 200, y: 200 }, FREE), 190, 200)
  })

  it("C-12a: перемещение, ставящее конец на ось препятствия только по сетке, останавливается у грани", () => {
    const { walls, M } = sceneCM()
    expectPoint(moveWallsBounded(walls, [M], { x: 100, y: 0 }, FREE), 90, 0)
    expectWall(M, 90, 200, 190, 200)
  })

  it("C-12b: опорный конец, привязанный к оси при перемещении, допустим; без привязки — касание", () => {
    const X = w(200, 0, 200, 400, "X", 20)
    const M = w(300, 200, 400, 200, "M", 10)
    expectPoint(moveWallsBounded([X, M], [M], { x: -100, y: 0 }, { ortho: false, snappedAxis: X }), -100, 0)
    expectWall(M, 200, 200, 300, 200)
    const X2 = w(200, 0, 200, 400, "X", 20)
    const M2 = w(300, 200, 400, 200, "M", 10)
    expectPoint(moveWallsBounded([X2, M2], [M2], { x: -100, y: 0 }, FREE), -90, 0)
  })

  it("C-12e: привязка к оси X не разрешает телу пройти сквозь саму X", () => {
    const { walls, X, M } = sceneCM()
    expectPoint(moveWallsBounded(walls, [M], { x: 200, y: 0 }, { ortho: false, snappedAxis: X }), 90, 0)
    expectWall(M, 90, 200, 190, 200)
  })

  it("C-12d: привязка к оси не разрешает остальной части тела пройти сквозь стену", () => {
    // конец b привязан к оси X, но стена при этом пересекала бы X серединой тела
    const X = w(200, 0, 200, 400, "X", 20)
    const Y = w(150, 300, 150, 500, "Y", 20)
    const M = w(100, 450, 130, 450, "M", 10)
    const walls = [X, Y, M]
    // путь конца b по прямой в (200, 300) проводит тело M через Y
    const p = moveEndpointBounded(walls, M, "b", { x: 200, y: 300 }, { ortho: false, snappedAxis: X })
    expect(p.x === 200 && p.y === 300).toBe(false)
    expect(overlapDepth(body(M), body(Y))).toBeLessThanOrEqual(0.01)
  })
})

describe("ввод длины", () => {
  it("LI-4: введённая длина укорачивается до касания", () => {
    const { walls, M } = sceneCM()
    expect(resizeWallBounded(walls, M, 300, FREE)).toEqual({ kind: "applied", lengthCm: expect.closeTo(190, 3) })
    expectWall(M, 0, 200, 190, 200)
  })

  it("LI-5: торец в касании с гранью — это примыкание: удлиняется свободный конец a, b остаётся на грани", () => {
    // test-change-request LI-5: конец на грани в пределах длины без углового стыка — примыкание
    // (wall-selection), подвижный конец при вводе длины — непримкнутый a
    const X = w(200, 0, 200, 400, "X", 20)
    const M = w(0, 200, 190, 200, "M", 10)
    expect(resizeWallBounded([X, M], M, 250, FREE)).toEqual({ kind: "applied", lengthCm: 250 })
    expectWall(M, -60, 200, 190, 200)
    expectWall(X, 200, 0, 200, 400)
  })

  it("LI-5b: в упоре без примыкания (угол торца касается косой грани) удлинение не меняет стену", () => {
    // грань X — прямая x + y = 395 через угол торца M (190, 205); тело X справа-сверху от неё,
    // тело M целиком по другую сторону; конец M.b не на грани и не у концов X
    const k = 395 + 10 * Math.SQRT2
    const X = w(150, k - 150, 250, k - 250, "X", 20)
    const M = w(0, 200, 190, 200, "M", 10)
    const walls = [X, M]
    expect(Math.abs(overlapDepth(body(M), body(X)))).toBeLessThanOrEqual(1e-9)
    const snap = snapshot(walls)
    expect(resizeWallBounded(walls, M, 250, FREE)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(unchanged(walls, snap)).toBe(true)
  })

  it("ввод текущей длины — без изменений", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    expect(resizeWallBounded([M], M, 100, FREE)).toEqual({ kind: "rejected", reason: "no-change" })
  })
})

describe("существующие наложения", () => {
  const sceneCO = (): { A: ReturnType<typeof w>; B: ReturnType<typeof w> } => ({
    A: w(0, 0, 200, 0, "A", 20),
    B: w(100, -5, 100, 100, "B", 10),
  })

  it("сцена CO действительно налагается (15 см × 10 см)", () => {
    const { A, B } = sceneCO()
    expect(overlapDepth(body(A), body(B))).toBeCloseTo(10, 6)
    expect(overlapArea(body(A), body(B))).toBeCloseTo(150, 6)
  })

  it("C-17: наложение можно развести", () => {
    const { A, B } = sceneCO()
    expectPoint(moveWallsBounded([A, B], [B], { x: 0, y: 30 }, FREE), 0, 30)
    expectWall(B, 100, 25, 100, 130)
  })

  it("C-17a: сдвиг вдоль, не увеличивающий площадь наложения, допустим", () => {
    const { A, B } = sceneCO()
    expectPoint(moveWallsBounded([A, B], [B], { x: 30, y: 0 }, FREE), 30, 0)
  })

  it("C-18: наложение нельзя углубить", () => {
    const { A, B } = sceneCO()
    const walls = [A, B]
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [B], { x: 0, y: -10 }, FREE), 0, 0)
    expect(unchanged(walls, snap)).toBe(true)
  })
})
