import { describe, expect, it, vi } from "vitest"
import { FURNITURE_KIND_ORDER } from "./furniture-kinds"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change furniture-items-catalog: плашка при нескольких видах мебели (spec furniture-plan «Пересечения стола», сценарий
// «Предметы разных видов»). Каталог подменён вторым видом «Стул»: настоящего второго вида пока нет.

vi.mock("./furniture-kinds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./furniture-kinds")>()
  const kinds = { ...actual.FURNITURE_KINDS, chair: { ...actual.FURNITURE_KINDS.table, label: "Стул", plaqueWord: "стул" } }
  return {
    ...actual,
    FURNITURE_KINDS: kinds,
    FURNITURE_KIND_ORDER: Object.keys(kinds),
    isFurnitureKind: (x: unknown) => typeof x === "string" && Object.hasOwn(kinds, x),
    kindEntry: (kind: keyof typeof kinds) => kinds[kind],
  }
})

const [table, chair] = FURNITURE_KIND_ORDER
if (!table || !chair) throw new Error("в подменённом каталоге нет двух видов")

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка при нескольких видах мебели", () => {
  it("FIK-40: все пересёкшиеся предметы одного вида — начало названием вида", () => {
    expect(warningText([wall(chair)])).toBe("Стул пересекается: стена")
    expect(warningText([wall(table)])).toBe("Стол пересекается: стена")
  })

  it("FIK-41: два предмета одного вида называются словом вида", () => {
    expect(warningText([pair(chair, chair)])).toBe("Стул пересекается: стул")
  })

  it("FIK-42: предметы разных видов — «Мебель», слова обоих видов в порядке каталога независимо от порядка предметов", () => {
    expect(warningText([pair(chair, table)])).toBe("Мебель пересекается: стол, стул")
    expect(warningText([pair(table, chair)])).toBe("Мебель пересекается: стол, стул")
  })

  it("FIK-43: пересекаются предметы разных видов, каждый со стеной — начало «Мебель», слов видов нет", () => {
    expect(warningText([wall(table), wall(chair)])).toBe("Мебель пересекается: стена")
  })

  it("FIK-44: слова объектов идут перед словами видов мебели", () => {
    expect(warningText([pair(table, chair), wall(table)])).toBe("Мебель пересекается: стена, стол, стул")
  })
})
