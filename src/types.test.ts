import { describe, expect, it } from "vitest"
import { DEFAULT_SCALE, isScale, SCALE_DENOMINATORS, normalizeMaterial } from "./types"

describe("SCALE_DENOMINATORS", () => {
  it("ряд масштабов и дефолт", () => {
    expect(SCALE_DENOMINATORS).toEqual([50, 100, 200, 500])
    expect(DEFAULT_SCALE).toBe(100)
  })

  it("isScale допускает только знаменатели ряда", () => {
    for (const s of SCALE_DENOMINATORS) expect(isScale(s)).toBe(true)
    expect(isScale(25)).toBe(false)
    expect(isScale(0)).toBe(false)
    expect(isScale("100")).toBe(false)
    expect(isScale(undefined)).toBe(false)
  })
})

describe("normalizeMaterial", () => {
  it("все legacy-типы мигрируют в brick", () => {
    expect(normalizeMaterial("partition")).toBe("brick")
    expect(normalizeMaterial("drywall")).toBe("brick")
    expect(normalizeMaterial("bearing")).toBe("brick")
    expect(normalizeMaterial("selfbearing")).toBe("brick")
    expect(normalizeMaterial("nonbearing")).toBe("brick")
    expect(normalizeMaterial("wood-cross")).toBe("brick")
  })

  it("текущие материалы сохраняются", () => {
    expect(normalizeMaterial("brick")).toBe("brick")
    expect(normalizeMaterial("concrete")).toBe("concrete")
    expect(normalizeMaterial("reinforced")).toBe("reinforced")
    expect(normalizeMaterial("wood-long")).toBe("wood-long")
  })

  it("неизвестное значение даёт brick", () => {
    expect(normalizeMaterial("unknown")).toBe("brick")
    expect(normalizeMaterial("")).toBe("brick")
  })
})
