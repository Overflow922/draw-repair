import { describe, expect, it } from "vitest"
import { sceneF, sceneFree, sceneR, sceneR2, sceneU } from "./ortho-axis.test-utils"
import { endpointGesture, moveGesture } from "./ortho-gesture.test-utils"
import type { Point, Wall } from "./types"
import { expectWall, snapshot } from "./wall-edit.test-utils"
import type { Snapshot } from "./wall-edit.test-utils"

// change ortho-axis-lock: жесты правки при орто (spec wall-selection «Орто без боковой
// составляющей», «Перемещение стены за средний маркер», «Изменение длины перетаскиванием конца»;
// multi-selection «Групповое перетаскивание стен»). Жест повторяет последовательность main.ts.

function untouched(wall: Wall, walls: readonly Wall[], snap: Snapshot): void {
  const c = snap.coords[walls.indexOf(wall)]
  expect(wall.a).toEqual(c.a)
  expect(wall.b).toEqual(c.b)
}

describe("перемещение стены: ось жеста", () => {
  it("GS-1: в любом направлении первого смещения стена движется строго вдоль оси жеста", () => {
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4 + 0.3
      const d: Point = { x: Math.cos(ang), y: Math.sin(ang) }
      const { walls, A } = sceneFree()
      const grab = { x: 100, y: 0 }
      const r = moveGesture(walls, [A], A, grab, [{ x: 100 + d.x * 3, y: d.y * 3 }, { x: 100 + d.x * 60, y: d.y * 60 }])
      const horizontal = Math.abs(d.x) >= Math.abs(d.y)
      expect(r.axis).toBe(horizontal ? "x" : "y")
      if (horizontal) {
        expect(A.a.y).toBe(0)
        expect(A.b.y).toBe(0)
        expect(A.a.x).toBe(Math.round((d.x * 60) / 10) * 10)
      } else {
        expect(A.a.x).toBe(0)
        expect(A.b.x).toBe(200)
        expect(A.a.y).toBe(Math.round((d.y * 60) / 10) * 10)
      }
    }
  })

  it("GS-2: комната, сначала вверх, затем указатель в (30, −40) от нажатия — сдвиг (0, −40), нижняя не тронута", () => {
    const { walls, top, right, bottom, left } = sceneR()
    const snap = snapshot(walls)
    const r = moveGesture(walls, [top], top, { x: 200, y: 0 }, [{ x: 200, y: -3 }, { x: 230, y: -40 }])
    expect(r.axis).toBe("y")
    expectWall(top, 0, -40, 400, -40, 6)
    expectWall(right, 400, -40, 400, 300, 6)
    expectWall(left, 0, 300, 0, -40, 6)
    untouched(bottom, walls, snap)
  })

  it("GS-3: ось сохраняется до отпускания — первый шаг горизонтальный, затем (10, 80): сдвиг только на 10 по горизонтали", () => {
    const { walls, A } = sceneFree()
    const r = moveGesture(walls, [A], A, { x: 100, y: 0 }, [{ x: 103, y: 0 }, { x: 110, y: 80 }])
    expect(r.axis).toBe("x")
    expectWall(A, 10, 0, 210, 0, 9)
  })

  it("GS-4: возврат указателя в точку нажатия не сбрасывает ось — вертикальный ход после возврата не применяется", () => {
    const { walls, A } = sceneFree()
    const snap = snapshot(walls)
    const r = moveGesture(walls, [A], A, { x: 100, y: 0 }, [{ x: 103, y: 0 }, { x: 100, y: 0 }, { x: 100, y: -50 }])
    expect(r.axis).toBe("x")
    untouched(A, walls, snap)
  })

  it("GS-5: новый жест выбирает ось заново", () => {
    const { walls, A } = sceneFree()
    expect(moveGesture(walls, [A], A, { x: 100, y: 0 }, [{ x: 103, y: 1 }, { x: 130, y: 2 }]).axis).toBe("x")
    expectWall(A, 30, 0, 230, 0, 9)
    expect(moveGesture(walls, [A], A, { x: 130, y: 0 }, [{ x: 130, y: -3 }, { x: 160, y: -50 }]).axis).toBe("y")
    expectWall(A, 30, -50, 230, -50, 9)
  })

  it("GS-6: первое смещение под 30° — орто действует, стена на горизонтали", () => {
    const { walls, A } = sceneFree()
    const r = moveGesture(walls, [A], A, { x: 100, y: 0 }, [{ x: 152, y: 30 }])
    expect(r.axis).toBe("x")
    expectWall(A, 50, 0, 250, 0, 9)
  })

  it("GS-7: орто выключено — тот же жест привязывается по обеим координатам", () => {
    const { walls, A } = sceneFree()
    moveGesture(walls, [A], A, { x: 100, y: 0 }, [{ x: 152, y: 30 }], false)
    expectWall(A, 50, 30, 250, 30, 9)
  })

  it("GS-8: две комнаты, диагональный жест вверх — нижняя стена B не сдвинута", () => {
    const { walls, T1, T2, B, P } = sceneR2()
    const snap = snapshot(walls)
    moveGesture(walls, [T1], T1, { x: 200, y: 0 }, [{ x: 200, y: -2 }, { x: 240, y: -40 }])
    expectWall(T1, 0, -40, 400, -40, 6)
    expectWall(T2, 400, -40, 800, -40, 6)
    expectWall(P, 400, -40, 400, 300, 6)
    untouched(B, walls, snap)
  })

  it("GS-U: раскладка пользователя, диагональный жест — двигаются только S и концы её соседей", () => {
    const { walls, S, L, M1, M2, V } = sceneU()
    const snap = snapshot(walls)
    moveGesture(walls, [S], S, { x: 120, y: 170 }, [{ x: 120, y: 167 }, { x: 150, y: 130 }])
    expectWall(S, 0, 130, 240, 130, 6)
    expectWall(L, 0, 0, 0, 130, 6)
    expectWall(V, 100, 140, 100, 310, 6)
    for (const x of walls) if (![S, L, M1, M2, V].includes(x)) untouched(x, walls, snap)
  })

  it("AX-8: нулевое смещение до выбора оси — стена не сдвигается и ось не выбрана", () => {
    const { walls, top } = sceneR()
    const snap = snapshot(walls)
    expect(moveGesture(walls, [top], top, { x: 200, y: 0 }, [{ x: 200, y: 0 }]).axis).toBeNull()
    for (const x of walls) untouched(x, walls, snap)
  })

  it("AX-8b: после нулевого шага первое ненулевое смещение вверх выбирает вертикаль", () => {
    const { walls, top } = sceneR()
    expect(moveGesture(walls, [top], top, { x: 200, y: 0 }, [{ x: 200, y: 0 }, { x: 200, y: -20 }]).axis).toBe("y")
    expectWall(top, 0, -20, 400, -20, 6)
  })

  it("AX-9: первое смещение ровно 45° (10, −10) — горизонталь", () => {
    const { walls, A } = sceneFree()
    const r = moveGesture(walls, [A], A, { x: 100, y: 0 }, [{ x: 110, y: -10 }, { x: 140, y: -60 }])
    expect(r.axis).toBe("x")
    expectWall(A, 40, 0, 240, 0, 9)
  })
})

describe("перемещение стены: инвариант защёлки (INV-LATCH)", () => {
  const sequences: Point[][] = [
    [{ x: 104, y: 1 }, { x: 90, y: 70 }, { x: 160, y: -90 }, { x: 100, y: 0 }],
    [{ x: 101, y: -4 }, { x: 180, y: -10 }, { x: 40, y: 50 }],
    [{ x: 97, y: 2 }, { x: 100, y: 200 }, { x: 0, y: 0 }],
    [{ x: 100, y: 5 }, { x: 300, y: 6 }, { x: -50, y: 0 }],
    [{ x: 99, y: -3 }, { x: 99, y: 0 }, { x: 400, y: 0 }],
    [{ x: 106, y: 6 }, { x: 100, y: 120 }],
    [{ x: 106, y: 6.5 }, { x: 300, y: 10 }],
    [{ x: 100, y: 0 }, { x: 100, y: 0 }, { x: 102, y: -1 }, { x: 100, y: -300 }],
  ]

  it("после выбора оси координата опорного конца поперёк оси не меняется ни на одном шаге", () => {
    for (const seq of sequences) {
      let axis: "x" | "y" | null = null
      for (let k = 1; k <= seq.length; k++) {
        const { walls, A } = sceneFree()
        const r = moveGesture(walls, [A], A, { x: 100, y: 0 }, seq.slice(0, k))
        if (axis === null) axis = r.axis
        else expect(r.axis).toBe(axis)
        if (r.axis === "x") expect(A.a.y).toBe(0)
        if (r.axis === "y") expect(A.a.x).toBe(0)
      }
    }
  })
})

describe("перетаскивание конца: ось через противоположный конец", () => {
  it("GE-1: комната, конец верхней стены сначала вправо, затем в (30, −40) от нажатия — горизонталь; левая стена не сдвинута", () => {
    const { walls, top, right, bottom, left } = sceneR()
    const snap = snapshot(walls)
    const r = endpointGesture(walls, top, "b", [{ x: 403, y: 0 }, { x: 430, y: -40 }])
    expect(r.axis).toBe("x")
    expectWall(top, 0, 0, 430, 0, 6)
    expectWall(right, 430, 0, 430, 300, 6)
    expectWall(bottom, 430, 300, 0, 300, 6)
    untouched(left, walls, snap)
  })

  it("GE-2: наклонная стена (0,0)–(100,58) — горизонталь через a, конец b на y = 0", () => {
    const D = { id: "D", a: { x: 0, y: 0 }, b: { x: 100, y: 58 }, thicknessCm: 20, type: "brick" as const }
    const r = endpointGesture([D], D, "b", [{ x: 101, y: 58 }])
    expect(r.axis).toBe("x")
    expectWall(D, 0, 0, 100, 0, 9)
  })

  it("GE-3: первое смещение конца 5 см вверх — ось по направлению от противоположного конца (горизонталь), стена не поворачивается", () => {
    const H = { id: "H", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" as const }
    const r = endpointGesture([H], H, "b", [{ x: 300, y: -5 }, { x: 300, y: -80 }])
    expect(r.axis).toBe("x")
    expect(H.b).toEqual({ x: 300, y: 0 })
    expect(H.a).toEqual({ x: 0, y: 0 })
  })

  it("GE-6: первый шаг указателя без смещения от точки нажатия не выбирает ось; ось — по первому ненулевому смещению", () => {
    // стена под 45°: если бы ось выбиралась на первом шаге по вектору от противоположного конца (100, 100),
    // она стала бы горизонталью; по спецификации ось выбирается при смещении в (100, 130) — вертикаль
    const D = { id: "D", a: { x: 0, y: 0 }, b: { x: 100, y: 100 }, thicknessCm: 20, type: "brick" as const }
    const first = endpointGesture([D], D, "b", [{ x: 100, y: 100 }])
    expect(first.axis).toBeNull()
    expectWall(D, 0, 0, 100, 100, 9)
    const r = endpointGesture([D], D, "b", [{ x: 100, y: 100 }, { x: 100, y: 130 }])
    expect(r.axis).toBe("y")
    expectWall(D, 0, 0, 0, 130, 9)
  })
})

describe("групповое перетаскивание: ось жеста", () => {
  it("GG-1: две стены, сначала вправо, затем (30, −40) от нажатия — обе сдвинуты на (30, 0)", () => {
    const { walls, A, B } = sceneF()
    const r = moveGesture(walls, [A, B], A, { x: 100, y: 0 }, [{ x: 103, y: 0 }, { x: 130, y: -40 }])
    expect(r.axis).toBe("x")
    expectWall(A, 30, 0, 230, 0, 9)
    expectWall(B, 30, 100, 230, 100, 9)
  })
})
