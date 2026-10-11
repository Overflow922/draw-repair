import { describe, expect, it } from "vitest"
import { chooseFormat } from "./page-format"

// spec pdf-export «Формат страницы выбирает пользователь»
describe("chooseFormat", () => {
  it("keeps the selected format while it is still available", () => {
    expect(chooseFormat("A3", ["A4", "A3", "A2"])).toBe("A3")
  })

  it("keeps the selected format when it is the only available one", () => {
    expect(chooseFormat("A0", ["A0"])).toBe("A0")
  })

  it("falls back to the smallest available format when the selected one is gone", () => {
    expect(chooseFormat("A4", ["A3", "A2", "A1", "A0"])).toBe("A3")
    expect(chooseFormat("A2", ["A1", "A0"])).toBe("A1")
  })

  it("returns null when nothing is available", () => {
    expect(chooseFormat("A3", [])).toBeNull()
  })

  it("falls back to the smallest available format when nothing is selected", () => {
    expect(chooseFormat(null, ["A3", "A2"])).toBe("A3")
  })
})
