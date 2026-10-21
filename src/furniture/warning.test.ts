import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change furniture-plan-table: текст плашки (spec furniture-plan «Пересечения стола»)

// TCR (change furniture-items-catalog): вид препятствия «стол» стал общим видом «furniture»; у пересечения есть вид предмета, а у
// пересечения двух предметов — и вид второго
const overlap = (kind: Overlap["kind"]): Overlap =>
  kind === "furniture" ? { kind, itemId: "t", itemKind: "table", otherKind: "table", region: [] } : { kind, itemId: "t", itemKind: "table", region: [] }

describe("текст плашки", () => {
  it("FP-320: без пересечений плашки нет", () => {
    expect(warningText([])).toBeNull()
  })

  it("FP-321: один вид — «Стол пересекается: стена»", () => {
    expect(warningText([overlap("wall")])).toBe("Стол пересекается: стена")
  })

  it("FP-322: виды без повторов в порядке «стена, гипсокартон, штукатурка, проём, дверь, окно, батарея, коммуникация, стол»", () => {
    const all = (["furniture", "communication", "battery", "window", "door", "opening", "plaster", "drywall", "wall", "wall"] as const).map(overlap)
    expect(warningText(all)).toBe("Стол пересекается: стена, гипсокартон, штукатурка, проём, дверь, окно, батарея, коммуникация, стол")
  })

  it("FP-322: штукатурка и гипсокартон называются вместе", () => {
    expect(warningText([overlap("plaster"), overlap("drywall")])).toBe("Стол пересекается: гипсокартон, штукатурка")
  })
})
