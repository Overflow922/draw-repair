import { describe, expect, it } from "vitest"
import { readFurnitureItem } from "./storage"

// change add-toilet: четыре размера унитаза в документе (spec drawing-storage «Размеры унитаза в документе»).

const raw = (extra: Record<string, unknown> = {}, toilet: Record<string, unknown> | null = { bowlWidthCm: 40, bowlLengthCm: 55, blockWidthCm: 60, blockDepthCm: 25 }): Record<string, unknown> => ({
  id: "t",
  kind: "toilet",
  x: 100,
  y: 200,
  widthCm: 60,
  lengthCm: 80,
  angleDeg: 30,
  ...(toilet ? { toilet } : null),
  ...extra,
})

describe("унитаз в документе", () => {
  it("TLS-01: размеры 40 / 55 / 60 / 25 восстанавливаются, ширина предмета 60, длина 80", () => {
    expect(readFurnitureItem(raw())).toEqual({
      id: "t",
      kind: "toilet",
      x: 100,
      y: 200,
      widthCm: 60,
      lengthCm: 80,
      angleDeg: 30,
      toilet: { bowlWidthCm: 40, bowlLengthCm: 55, blockWidthCm: 60, blockDepthCm: 25 },
    })
  })

  it("TLS-02: ширина и длина предмета при чтении выводятся из четырёх размеров, а не берутся из документа", () => {
    expect(readFurnitureItem(raw({ widthCm: 10, lengthCm: 10 }))).toMatchObject({ widthCm: 60, lengthCm: 80 })
  })

  it("TLS-03: без поля размеров унитаз битый", () => {
    expect(readFurnitureItem(raw({}, null))).toBeNull()
  })

  it.each(["bowlWidthCm", "bowlLengthCm", "blockWidthCm", "blockDepthCm"])("TLS-04: без размера %s унитаз битый", (key) => {
    const all: Record<string, number> = { bowlWidthCm: 40, bowlLengthCm: 55, blockWidthCm: 60, blockDepthCm: 25 }
    const rest = Object.fromEntries(Object.entries(all).filter(([k]) => k !== key))
    expect(readFurnitureItem(raw({}, rest))).toBeNull()
  })

  it.each([0, -1, Number.NaN, "40"])("TLS-05: размер %s не положительное число — унитаз битый", (v) => {
    expect(readFurnitureItem(raw({}, { bowlWidthCm: v, bowlLengthCm: 55, blockWidthCm: 60, blockDepthCm: 25 }))).toBeNull()
    expect(readFurnitureItem(raw({}, { bowlWidthCm: 40, bowlLengthCm: 55, blockWidthCm: 60, blockDepthCm: v }))).toBeNull()
  })

  it("TLS-06: чаша шире блока — унитаз битый", () => {
    expect(readFurnitureItem(raw({}, { bowlWidthCm: 80, bowlLengthCm: 55, blockWidthCm: 70, blockDepthCm: 20 }))).toBeNull()
  })

  it("TLS-07: длина чаши меньше половины её ширины — унитаз битый, ровно половина — читается", () => {
    expect(readFurnitureItem(raw({}, { bowlWidthCm: 40, bowlLengthCm: 19, blockWidthCm: 60, blockDepthCm: 25 }))).toBeNull()
    expect(readFurnitureItem(raw({}, { bowlWidthCm: 40, bowlLengthCm: 20, blockWidthCm: 60, blockDepthCm: 25 }))).toMatchObject({ lengthCm: 45 })
  })

  it("TLS-08: предметы других видов поля унитаза не получают", () => {
    const sink = readFurnitureItem({ id: "s", kind: "sink", x: 0, y: 0, widthCm: 45, lengthCm: 40, angleDeg: 0, toilet: { bowlWidthCm: 1, bowlLengthCm: 1, blockWidthCm: 1, blockDepthCm: 1 } })
    expect(sink).not.toBeNull()
    expect(sink).not.toHaveProperty("toilet")
  })

  it("TLS-09: угол приводится к [0, 360), как у других видов", () => {
    expect(readFurnitureItem(raw({ angleDeg: -90 }))).toMatchObject({ angleDeg: 270 })
  })

  it("TLS-10: унитаз без вида в документе — стол, поле размеров не переносится", () => {
    const noKind = Object.fromEntries(Object.entries(raw()).filter(([k]) => k !== "kind"))
    expect(readFurnitureItem(noKind)).toMatchObject({ kind: "table" })
    expect(readFurnitureItem(noKind)).not.toHaveProperty("toilet")
  })
})
