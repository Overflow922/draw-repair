import { describe, expect, it } from "vitest"
import { chooseFace } from "./battery-face"
import { sceneF, sceneR, sceneRT } from "./battery.test-utils"

// change add-battery: грань установки (spec battery «Грань установки»; design D9; test-plan B-FACE-*).
// Грань +1 — знак нормали (−d.y, d.x) оси стены. В сцене R все четыре стены обходятся так, что грань +1 смотрит внутрь комнаты.

describe("внутри помещения — внутренняя грань", () => {
  it("B-FACE-1: курсор у внешней стороны стены W комнаты → внутренняя грань +1 (y = 10)", () => {
    const { walls, W } = sceneR()
    expect(chooseFace(W, { x: 250, y: -8 }, walls)).toBe(1)
  })

  it("B-FACE-1b: курсор у внутренней стороны → та же грань +1", () => {
    const { walls, W } = sceneR()
    expect(chooseFace(W, { x: 250, y: 6 }, walls)).toBe(1)
  })

  it("B-FACE-1c: все четыре стены комнаты — грань +1 смотрит внутрь, курсор снаружи не влияет", () => {
    const { walls, W, R, B, L } = sceneR()
    expect(chooseFace(R, { x: 520, y: 200 }, walls)).toBe(1) // x = 490 внутри
    expect(chooseFace(B, { x: 250, y: 420 }, walls)).toBe(1) // y = 390 внутри
    expect(chooseFace(L, { x: -20, y: 200 }, walls)).toBe(1) // x = 10 внутри
    expect(chooseFace(W, { x: 100, y: -30 }, walls)).toBe(1)
  })
})

describe("вне помещения — грань ближе к курсору", () => {
  it("B-FACE-2: свободная стена: курсор над осью (y < 0) → −1, под осью (y > 0) → +1", () => {
    const { walls, W } = sceneF()
    expect(chooseFace(W, { x: 250, y: -5 }, walls)).toBe(-1)
    expect(chooseFace(W, { x: 250, y: 5 }, walls)).toBe(1)
  })

  it("B-FACE-2b: на самой оси (y = 0) выбор детерминирован: одно и то же значение при повторе", () => {
    const { walls, W } = sceneF()
    const first = chooseFace(W, { x: 250, y: 0 }, walls)
    expect([1, -1]).toContain(first)
    expect(chooseFace(W, { x: 250, y: 0 }, walls)).toBe(first)
  })
})

describe("стена между двумя помещениями — грань ближе к курсору", () => {
  it("B-FACE-3: перегородка Q (x = 250) разделяет две комнаты: у грани x = 245 → +1, у грани x = 255 → −1", () => {
    const { walls, Q } = sceneRT()
    expect(chooseFace(Q, { x: 246, y: 200 }, walls)).toBe(1)
    expect(chooseFace(Q, { x: 254, y: 200 }, walls)).toBe(-1)
  })
})

describe("помещение определяется по текущим стенам", () => {
  it("B-FACE-4: без стен комнаты та же стена W даёт грань по курсору; с комнатой — внутреннюю", () => {
    const { walls, W } = sceneR()
    expect(chooseFace(W, { x: 250, y: -8 }, [W])).toBe(-1)
    expect(chooseFace(W, { x: 250, y: -8 }, walls)).toBe(1)
  })
})
