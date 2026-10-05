import { describe, expect, it } from "vitest"
import { sceneR } from "./ortho-axis.test-utils"
import { orthoGestureStep, startOrthoGesture } from "./ortho-gesture"
import type { Wall } from "./types"
import { w } from "./wall-edit.test-utils"

// change ortho-axis-lock, wall-selection «Орто без боковой составляющей» (design D2): шаг
// орто-жеста — когда защёлкивается ось, какой направляющий вектор, где точка привязки и какие
// стены в ней участвуют.

const GRID = 10
const R = 5
const free = (): Wall[] => [w(0, 0, 200, 0, "A", 20)]
const MOVE_A = (walls: Wall[]) => ({ kind: "walls" as const, walls: [walls[0]] })

describe("startOrthoGesture", () => {
  it("OG-1: новый жест начинается без оси — следующий жест выбирает ось заново", () => {
    expect(startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 }).axis).toBeNull()
    expect(startOrthoGesture("end", { x: 300, y: 0 }, { x: 0, y: 0 }).axis).toBeNull()
  })
})

describe("orthoGestureStep: защёлка оси", () => {
  it("OG-2: указатель в точке нажатия — оси и цели нет", () => {
    const walls = free()
    const g = startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 100, y: 0 }, walls, MOVE_A(walls), GRID, R)
    expect(s.gesture.axis).toBeNull()
    expect(s.target).toBeNull()
  })

  it("OG-3: первое смещение (3, 1) — горизонталь; цель — опорная точка + смещение на оси", () => {
    const walls = free()
    const g = startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 133, y: 1 }, walls, MOVE_A(walls), GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 30, y: 0 })
  })

  it("OG-4: защёлкнутая ось не меняется — шаг (10, 80) после горизонтали даёт цель на горизонтали", () => {
    const walls = free()
    const g0 = startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 })
    const g1 = orthoGestureStep(g0, { x: 103, y: 1 }, walls, MOVE_A(walls), GRID, R).gesture
    const s = orthoGestureStep(g1, { x: 110, y: 80 }, walls, MOVE_A(walls), GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 10, y: 0 })
    const back = orthoGestureStep(s.gesture, { x: 100, y: 0 }, walls, MOVE_A(walls), GRID, R)
    expect(back.gesture.axis).toBe("x")
    expect(back.target?.point).toEqual({ x: 0, y: 0 })
  })

  it("OG-5: равные составляющие первого смещения (−10, 10) — горизонталь", () => {
    const walls = free()
    const g = startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 })
    expect(orthoGestureStep(g, { x: 90, y: 10 }, walls, MOVE_A(walls), GRID, R).gesture.axis).toBe("x")
  })

  it("OG-6: шаг не меняет исходное состояние жеста", () => {
    const walls = free()
    const g = startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 })
    orthoGestureStep(g, { x: 100, y: -20 }, walls, MOVE_A(walls), GRID, R)
    expect(g.axis).toBeNull()
  })
})

describe("orthoGestureStep: перемещение — точка привязки", () => {
  it("OG-7: первое смещение под 30° — цель на горизонтали через опорную точку", () => {
    const walls = free()
    const g = startOrthoGesture("move", { x: 100, y: 0 }, { x: 0, y: 0 })
    expect(orthoGestureStep(g, { x: 152, y: 30 }, walls, MOVE_A(walls), GRID, R).target?.point).toEqual({ x: 50, y: 0 })
  })

  it("OG-8: опорная точка вне сетки (5, 15) — координата поперёк оси сохраняется, вдоль — по сетке", () => {
    const walls = [w(5, 15, 205, 15, "A", 20)]
    const g = startOrthoGesture("move", { x: 100, y: 15 }, { x: 5, y: 15 })
    const s = orthoGestureStep(g, { x: 137, y: 18 }, walls, MOVE_A(walls), GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 40, y: 15 })
  })
})

describe("orthoGestureStep: перетаскивание конца", () => {
  it("OG-9: направляющий вектор — от противоположного конца: смещение конца 5 вверх даёт горизонталь", () => {
    const H = w(0, 0, 300, 0, "H", 20)
    const g = startOrthoGesture("end", { x: 300, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 300, y: -5 }, [H], { kind: "end", wall: H, end: "b" }, GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 300, y: 0 })
  })

  it("OG-10: указатель в точке нажатия — ось не выбрана, хотя вектор от противоположного конца ненулевой", () => {
    const D = w(0, 0, 100, 100, "D", 20)
    const g = startOrthoGesture("end", { x: 100, y: 100 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 100, y: 100 }, [D], { kind: "end", wall: D, end: "b" }, GRID, R)
    expect(s.gesture.axis).toBeNull()
    expect(s.target).toBeNull()
  })

  it("OG-11: цель конца — указатель на оси через противоположный конец", () => {
    const D = w(0, 0, 100, 58, "D", 20)
    const g = startOrthoGesture("end", { x: 100, y: 58 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 121, y: 60 }, [D], { kind: "end", wall: D, end: "b" }, GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 120, y: 0 })
  })
})

describe("orthoGestureStep: стены в привязке (design D4)", () => {
  it("OG-12: стена, увлекаемая правкой, не притягивает — правая стена комнаты при перетаскивании угла вправо", () => {
    const { walls, top } = sceneR()
    const g = startOrthoGesture("end", { x: 400, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 403, y: 0 }, walls, { kind: "end", wall: top, end: "b" }, GRID, R)
    expect(s.target?.point).toEqual({ x: 400, y: 0 })
    expect(s.target?.axisWall).toBeNull()
  })

  it("OG-13: неувлекаемая стена притягивает вдоль оси — пересечение оси с её линией", () => {
    const { walls: room, top } = sceneR()
    const X = w(452, 50, 452, 250, "X", 20)
    const walls = [...room, X]
    const g = startOrthoGesture("end", { x: 400, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 450, y: 2 }, walls, { kind: "end", wall: top, end: "b" }, GRID, R)
    expect(s.target?.point).toEqual({ x: 452, y: 0 })
    expect(s.target?.axisWall).toBe(X)
  })

  it("OG-15: перемещение — увлекаемая левая стена вне сетки (x = 3) не притягивает; цель по сетке (10, 0)", () => {
    const top = w(3, 0, 403, 0, "top", 20)
    const walls = [top, w(403, 0, 403, 300, "right", 20), w(403, 300, 3, 300, "bottom", 20), w(3, 300, 3, 0, "left", 20)]
    const g = startOrthoGesture("move", { x: 200, y: 0 }, { x: 3, y: 0 })
    const s = orthoGestureStep(g, { x: 204, y: 0 }, walls, { kind: "walls", walls: [top] }, GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 10, y: 0 })
    expect(s.target?.axisWall).toBeNull()
  })

  it("OG-16: перетаскивание конца — стена K, увлекаемая по цепочке (правая целиком → K целиком), не притягивает", () => {
    const top = w(0, 0, 400, 0, "top", 20)
    const walls = [top, w(400, 0, 400, 300, "right", 20), w(400, 300, 452, 3, "K", 20)]
    const g = startOrthoGesture("end", { x: 400, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 450, y: 1 }, walls, { kind: "end", wall: top, end: "b" }, GRID, R)
    expect(s.gesture.axis).toBe("x")
    expect(s.target?.point).toEqual({ x: 450, y: 0 })
  })

  it("OG-17: вертикальный сдвиг верхней стены — неувлекаемая нижняя стена вне сетки (y = 303) притягивает", () => {
    // план увлечения строится по защёлкнутой оси (вертикаль): боковые растягиваются, нижняя не увлекается
    const top = w(0, 0, 400, 0, "top", 20)
    const walls = [top, w(400, 0, 400, 303, "right", 20), w(400, 303, 0, 303, "bottom", 20), w(0, 303, 0, 0, "left", 20)]
    const g = startOrthoGesture("move", { x: 200, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 204, y: 301 }, walls, { kind: "walls", walls: [top] }, GRID, R)
    expect(s.gesture.axis).toBe("y")
    expect(s.target?.point).toEqual({ x: 0, y: 303 })
  })

  it("OG-18: перемещение — растягиваемая боковая стена не притягивает к прежнему стыку (комната вне сетки, y = 3)", () => {
    // боковые стены параллельны вертикальной оси и только растягиваются; их концы в (0, 3) — прежний стык
    const top = w(0, 3, 400, 3, "top", 20)
    const walls = [top, w(400, 3, 400, 303, "right", 20), w(400, 303, 0, 303, "bottom", 20), w(0, 303, 0, 3, "left", 20)]
    const g = startOrthoGesture("move", { x: 200, y: 3 }, { x: 0, y: 3 })
    const s = orthoGestureStep(g, { x: 200, y: 7 }, walls, { kind: "walls", walls: [top] }, GRID, R)
    expect(s.gesture.axis).toBe("y")
    expect(s.target?.point).toEqual({ x: 0, y: 10 })
  })

  it("OG-19: перетаскивание конца — растягиваемая соосная стена N не притягивает к прежнему стыку", () => {
    const V = w(0, 0, 0, 203, "V", 20)
    const walls = [V, w(0, 203, 0, 403, "N", 20)]
    const g = startOrthoGesture("end", { x: 0, y: 203 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 0, y: 206 }, walls, { kind: "end", wall: V, end: "b" }, GRID, R)
    expect(s.gesture.axis).toBe("y")
    expect(s.target?.point).toEqual({ x: 0, y: 210 })
  })

  it("OG-14: перемещение — стена, увлекаемая целиком, не притягивает", () => {
    // верхняя стена комнаты по горизонтали увлекает боковые целиком; левая (x = 0) не должна притягивать
    const { walls, top } = sceneR()
    const g = startOrthoGesture("move", { x: 200, y: 0 }, { x: 0, y: 0 })
    const s = orthoGestureStep(g, { x: 203, y: 0 }, walls, { kind: "walls", walls: [top] }, GRID, R)
    expect(s.target?.point).toEqual({ x: 0, y: 0 })
    expect(s.target?.axisWall).toBeNull()
  })
})
