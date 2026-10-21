import { describe, expect, it, vi } from "vitest"
import { FURNITURE_KIND_ORDER } from "../furniture/furniture-kinds"
import type { FurnitureItem, Wall } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"

// change furniture-items-catalog: запись легенды по видам мебели (spec furniture-plan «Каталог видов мебели», design D6).
// Каталог подменён вторым видом «Стул»: настоящего второго вида пока нет.

vi.mock("../furniture/furniture-kinds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../furniture/furniture-kinds")>()
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

const wall: Wall = { id: "w", a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm: 20, type: "brick" }
const item = (id: string, kind: FurnitureItem["kind"]): FurnitureItem => ({ id, kind, x: 100, y: 100, widthCm: 50, lengthCm: 50, angleDeg: 0 })
const page = (items: FurnitureItem[]): PlanPage => ({ walls: [wall], dimensions: [], doorways: [], furniture: { items } })
const labels = (items: FurnitureItem[]): string[] => legendEntries(page(items)).map((e) => e.label)

describe("легенда страницы «Мебель» по видам", () => {
  it("FIK-50: запись на каждый вид, чьи предметы есть на странице; записи вида без предметов нет", () => {
    expect(labels([item("a", chair)])).toEqual(["Кирпич", "Стул"])
    expect(labels([item("a", table)])).toEqual(["Кирпич", "Стол"])
  })

  it("FIK-51: записи видов идут в порядке каталога независимо от порядка предметов, по одной на вид", () => {
    expect(labels([item("a", chair), item("b", table), item("c", chair)])).toEqual(["Кирпич", "Стол", "Стул"])
  })

  it("FIK-52: предметов нет — записей мебели нет", () => {
    expect(labels([])).toEqual(["Кирпич"])
  })
})
