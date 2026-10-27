import { describe, expect, it } from "vitest"
import { lineMenu } from "./line-menu"

// change line-dropdown: пункты выпадающего меню «Линия» (spec light-lines «Меню «Линия» панели линии освещения»,
// light-switch «Панель выключателя и меню «Линия»»)

const values = (selected: string | null): string[] => lineMenu(selected).items.map((i) => i.value)

describe("lineMenu", () => {
  it("L1–L10, выбранный пункт; светильники и вытяжки не разделяются", () => {
    const menu = lineMenu("L3")
    expect(values("L3")).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"])
    expect(menu.selected).toBe("L3")
    expect(menu.items.every((i) => !i.disabled)).toBe(true)
  })

  it("без линии первым идёт недоступный «—», выбран он", () => {
    const menu = lineMenu(null)
    expect(menu.items[0]).toEqual({ value: "", text: "—", disabled: true })
    expect(menu.items).toHaveLength(11)
    expect(menu.selected).toBe("")
  })

  it("имя вне списка добавляется последним пунктом и выбирается", () => {
    const menu = lineMenu("L12")
    expect(menu.items).toHaveLength(11)
    expect(menu.items[10]).toEqual({ value: "L12", text: "L12", disabled: false })
    expect(menu.selected).toBe("L12")
  })

  it("метка LV из чертежа, созданного раньше, остаётся дополнительным пунктом", () => {
    expect(values("LV1")).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "LV1"])
  })

  it("имя из списка не дублируется", () => {
    expect(values("L10").filter((v) => v === "L10")).toHaveLength(1)
  })
})
