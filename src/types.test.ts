import { describe, expect, it } from "vitest"
import { MATERIALS, normalizeMaterial } from "./types"

// change new-wall-materials: каталог материалов и миграция старых типов
// (spec wall-types «Выбор типа стены», «Штриховка стены по материалу»; test-plan WM-C1, WM-C2, WM-C3).

describe("normalizeMaterial", () => {
  it("WM-C2: все legacy-типы, кроме reinforced и wood-long, мигрируют в brick", () => {
    expect(normalizeMaterial("partition")).toBe("brick")
    expect(normalizeMaterial("drywall")).toBe("brick")
    expect(normalizeMaterial("bearing")).toBe("brick")
    expect(normalizeMaterial("selfbearing")).toBe("brick")
    expect(normalizeMaterial("nonbearing")).toBe("brick")
    expect(normalizeMaterial("wood-cross")).toBe("brick")
  })

  it("WM-C2: reinforced мигрирует в concrete, а не в brick", () => {
    expect(normalizeMaterial("reinforced")).toBe("concrete")
  })

  it("WM-C3: wood-long остаётся деревом (id не меняется)", () => {
    expect(normalizeMaterial("wood-long")).toBe("wood-long")
  })

  it("WM-C3: текущие материалы каталога сохраняются", () => {
    expect(normalizeMaterial("blocks")).toBe("blocks")
    expect(normalizeMaterial("brick")).toBe("brick")
    expect(normalizeMaterial("concrete")).toBe("concrete")
    expect(normalizeMaterial("gkl")).toBe("gkl")
  })

  it("WM-C2: неизвестное значение даёт brick", () => {
    expect(normalizeMaterial("unknown")).toBe("brick")
    expect(normalizeMaterial("")).toBe("brick")
    expect(normalizeMaterial("Brick")).toBe("brick")
    expect(normalizeMaterial("Reinforced")).toBe("brick")
  })

  it("WM-C2: нормализация идемпотентна и всегда возвращает материал каталога", () => {
    const ids = MATERIALS.map((m) => m.id)
    for (const input of ["partition", "reinforced", "wood-long", "blocks", "gkl", "unknown", ""]) {
      const once = normalizeMaterial(input)
      expect(ids).toContain(once)
      expect(normalizeMaterial(once)).toBe(once)
    }
  })
})

describe("каталог материалов", () => {
  it("WM-C1: пять материалов в порядке «Блоки», «Кирпич», «Бетон», «ГКЛ», «Дерево»", () => {
    expect(MATERIALS.map((m) => m.label)).toEqual(["Блоки", "Кирпич", "Бетон", "ГКЛ", "Дерево"])
  })

  it("WM-C1: идентификаторы материалов — blocks, brick, concrete, gkl, wood-long", () => {
    expect(MATERIALS.map((m) => m.id)).toEqual(["blocks", "brick", "concrete", "gkl", "wood-long"])
  })

  it("WM-C1: подписей «Железобетон» и «Дерево (вдоль)» в каталоге нет", () => {
    const labels = MATERIALS.map((m) => m.label)
    expect(labels).not.toContain("Железобетон")
    expect(labels).not.toContain("Дерево (вдоль)")
    expect(MATERIALS.map((m) => m.id)).not.toContain("reinforced")
  })

  it("WM-U2: подписи и идентификаторы уникальны", () => {
    expect(new Set(MATERIALS.map((m) => m.id)).size).toBe(MATERIALS.length)
    expect(new Set(MATERIALS.map((m) => m.label)).size).toBe(MATERIALS.length)
  })

  it("WM-U4: порядок цикла стрелок замыкается — после «Дерева» идёт «Блоки», перед «Блоками» — «Дерево»", () => {
    const n = MATERIALS.length
    const at = (i: number) => MATERIALS[((i % n) + n) % n]?.label
    expect(at(n - 1)).toBe("Дерево")
    expect(at(n)).toBe("Блоки")
    expect(at(-1)).toBe("Дерево")
  })
})
