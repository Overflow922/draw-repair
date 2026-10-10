import { describe, expect, it } from "vitest"
import { resumesAfterSelectionCleared } from "./tool-mode"

// Возврат инструмента «Демонтаж» после снятия выделения (spec demolition-plan «Инструмент «Демонтаж»»): после постановки
// пометки инструмент снят; когда выделение снято (Escape, клик мимо пометок, Delete), он включается снова, если его не
// заменил другой инструмент.

describe("возврат инструмента после снятия выделения", () => {
  it("TR-01: инструмент снят постановкой и выделение снято — инструмент возвращается", () => {
    expect(resumesAfterSelectionCleared(true, false)).toBe(true)
  })

  it("TR-02: выделение ещё есть (другая пометка выбрана, число правится) — инструмент не возвращается", () => {
    expect(resumesAfterSelectionCleared(true, true)).toBe(false)
  })

  it("TR-03: инструмент не снимался постановкой (выбран другой, плана сменили) — не возвращается ни с выделением, ни без", () => {
    expect(resumesAfterSelectionCleared(false, false)).toBe(false)
    expect(resumesAfterSelectionCleared(false, true)).toBe(false)
  })
})
