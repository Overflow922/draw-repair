import { describe, expect, it, vi } from "vitest"
import { FURNITURE_KIND_ORDER } from "./furniture-kinds"
import { defaultParams, editParams, initialKindParams, paramsOfKind, withKindParams } from "./item-params"

// change furniture-items-catalog: значения для новых предметов по видам (spec furniture-plan «Каталог видов мебели», сценарий
// «Значения новых предметов по видам»). Каталог подменён вторым видом «Стул» с другими размерами: настоящего второго вида пока нет.

vi.mock("./furniture-kinds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./furniture-kinds")>()
  const kinds = { ...actual.FURNITURE_KINDS, chair: { ...actual.FURNITURE_KINDS.table, label: "Стул", plaqueWord: "стул", defaults: { widthCm: 45, lengthCm: 45, angleDeg: 0 } } }
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

describe("значения для новых предметов по видам", () => {
  it("FIK-60: начальные значения каждого вида — из каталога", () => {
    const all = initialKindParams()
    expect(paramsOfKind(all, table)).toEqual({ widthCm: 80, lengthCm: 160, angleDeg: 0 })
    expect(paramsOfKind(all, chair)).toEqual({ widthCm: 45, lengthCm: 45, angleDeg: 0 })
    expect(defaultParams(chair)).toEqual(paramsOfKind(all, chair))
  })

  it("FIK-61: правка значений вида A не меняет значения вида B; значения A сохраняются при переключении на B и обратно", () => {
    let all = initialKindParams()
    all = withKindParams(all, table, editParams(paramsOfKind(all, table), null, { widthCm: 100 }).params)
    expect(paramsOfKind(all, table).widthCm).toBe(100)
    expect(paramsOfKind(all, chair)).toEqual({ widthCm: 45, lengthCm: 45, angleDeg: 0 })
    expect(paramsOfKind(all, table).widthCm).toBe(100)
  })

  it("FIK-62: withKindParams не мутирует прежний набор", () => {
    const before = initialKindParams()
    withKindParams(before, table, { widthCm: 1, lengthCm: 1, angleDeg: 0 })
    expect(paramsOfKind(before, table).widthCm).toBe(80)
  })
})
