import { describe, expect, it } from "vitest"
import { normalizeMaterial } from "./types"

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
