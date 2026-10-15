import { describe, expect, it } from "vitest"
import { applyNotesText, notesText } from "./notes-actions"

// change add-plan-notes: применение правки из панели (spec plan-notes «Кнопка и панель «Примечания»»).

describe("applyNotesText", () => {
  it("ввод трёх пунктов в пустой список — изменение", () => {
    expect(applyNotesText([], "а\nб\nв")).toEqual({ list: ["а", "б", "в"], changed: true })
  })

  it("тот же текст — шага нет", () => {
    expect(applyNotesText(["а", "б"], "а\nб").changed).toBe(false)
  })

  it("пустое поле при пустом списке — шага нет", () => {
    expect(applyNotesText([], "").changed).toBe(false)
    expect(applyNotesText([], "  \n \n").changed).toBe(false)
  })

  it("правка только пробелов и пустых строк вокруг пунктов — шага нет", () => {
    expect(applyNotesText(["а", "б"], "  а  \n\n б\n\n").changed).toBe(false)
  })

  it("изменение одного пункта, порядка или числа пунктов — изменение", () => {
    expect(applyNotesText(["а", "б"], "а\nв").changed).toBe(true)
    expect(applyNotesText(["а", "б"], "б\nа").changed).toBe(true)
    expect(applyNotesText(["а", "б"], "а").changed).toBe(true)
    expect(applyNotesText(["а"], "а\nб").changed).toBe(true)
  })

  it("очистка поля — изменение до пустого списка", () => {
    expect(applyNotesText(["а"], "")).toEqual({ list: [], changed: true })
  })

  it("применяются ограничения: 15 пунктов и 300 символов", () => {
    const many = Array.from({ length: 16 }, (_, i) => `п${i + 1}`).join("\n")
    expect(applyNotesText([], many).list).toHaveLength(15)
    expect(applyNotesText([], "а".repeat(301)).list[0]).toBe("а".repeat(300))
  })

  it("правка, дошедшая до лимита и ничего не изменившая, шага не даёт", () => {
    const stored = Array.from({ length: 15 }, (_, i) => `п${i + 1}`)
    expect(applyNotesText(stored, [...stored, "лишний"].join("\n")).changed).toBe(false)
  })

  it("входной список не меняется, результат — копия", () => {
    const current = ["а"]
    const res = applyNotesText(current, "а")
    res.list.push("б")
    expect(current).toEqual(["а"])
  })
})

describe("notesText", () => {
  it("один пункт — одна строка, пустой список — пустая строка", () => {
    expect(notesText(["а", "б"])).toBe("а\nб")
    expect(notesText([])).toBe("")
  })

  it("текст списка при применении возвращает тот же список", () => {
    const list = ["Все размеры указаны в мм.", "Замеры проводились по низу помещения."]
    expect(applyNotesText(list, notesText(list)).changed).toBe(false)
  })
})
