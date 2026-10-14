import { describe, expect, it } from "vitest"
import { normalizeCalloutText } from "./callout-text"

// change add-callout: нормализация введённого текста (spec callout «Ввод текста на месте»; test-plan C-TXT-*).

describe("нормализация текста выноски", () => {
  it("C-TXT-1: пробелы и пустые строки по краям отбрасываются, текст внутри прежний", () => {
    expect(normalizeCalloutText("\n  а  \n")).toBe("а")
    expect(normalizeCalloutText("\n\n  Монтаж радиатора\nв нишу \n \n")).toBe("Монтаж радиатора\nв нишу")
  })

  it("C-TXT-2: пустой текст и текст из пробелов и переводов строк — пустая строка", () => {
    expect(normalizeCalloutText("")).toBe("")
    expect(normalizeCalloutText("   ")).toBe("")
    expect(normalizeCalloutText("  \n \n")).toBe("")
    expect(normalizeCalloutText("\t\r\n")).toBe("")
  })

  it("C-TXT-3: пустые строки внутри текста сохраняются, пробелы внутри строк не меняются", () => {
    expect(normalizeCalloutText("а\n\nб")).toBe("а\n\nб")
    expect(normalizeCalloutText("а  б\nв")).toBe("а  б\nв")
  })

  it("C-TXT-3b: две и более подряд идущие пустые строки внутри текста сохраняются все", () => {
    expect(normalizeCalloutText("а\n\n\nб")).toBe("а\n\n\nб")
    expect(normalizeCalloutText("\nа\n\n\n\nб\n")).toBe("а\n\n\n\nб")
  })

  it("C-TXT-4: \\r\\n приводится к \\n", () => {
    expect(normalizeCalloutText("а\r\nб")).toBe("а\nб")
  })

  it("C-TXT-6: у внутренних строк пробелы по краям сохраняются: обрезается только начало текста и его конец", () => {
    expect(normalizeCalloutText("а  \n  б")).toBe("а  \n  б")
    expect(normalizeCalloutText("а \n б")).toBe("а \n б")
    expect(normalizeCalloutText("  а  \n  б  \n  в  ")).toBe("а  \n  б  \n  в")
    expect(normalizeCalloutText("а\n   \nб")).toBe("а\n   \nб")
  })

  it("C-TXT-7: начальная пустая или пробельная строка и табуляция в начале и конце отбрасываются", () => {
    expect(normalizeCalloutText("  \nа")).toBe("а")
    expect(normalizeCalloutText("\t\nа\n\t")).toBe("а")
    expect(normalizeCalloutText("\tа")).toBe("а")
    expect(normalizeCalloutText("а\t")).toBe("а")
    expect(normalizeCalloutText("\n\n \n а \n\n \n")).toBe("а")
  })

  it("C-TXT-5: уже нормальный текст не меняется", () => {
    expect(normalizeCalloutText("Монтаж\nрадиатора")).toBe("Монтаж\nрадиатора")
  })
})
