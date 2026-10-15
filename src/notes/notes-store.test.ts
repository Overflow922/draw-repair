import { describe, expect, it } from "vitest"
import { make } from "../callout/callout.test-utils"
import type { Drawing } from "../types"
import { normalizeNotes, notesOf, withNotes } from "./notes-store"

// change add-plan-notes: данные примечаний (spec plan-notes «Данные примечаний плана»).

describe("normalizeNotes", () => {
  it("пустые и пробельные строки не становятся пунктами, края обрезаются", () => {
    expect(normalizeNotes("Первый\n\n   \n  Второй  ")).toEqual(["Первый", "Второй"])
  })

  it("пустой текст — пустой список", () => {
    expect(normalizeNotes("")).toEqual([])
  })

  it("переводы строк \\r\\n и \\r разделяют пункты", () => {
    expect(normalizeNotes("a\r\nb\rc")).toEqual(["a", "b", "c"])
  })

  it("сохраняется не больше 15 пунктов, первые", () => {
    const text = Array.from({ length: 16 }, (_, i) => `п${i + 1}`).join("\n")
    const list = normalizeNotes(text)
    expect(list).toHaveLength(15)
    expect(list[14]).toBe("п15")
  })

  it("ровно 15 пунктов сохраняются все", () => {
    expect(normalizeNotes(Array.from({ length: 15 }, () => "x").join("\n"))).toHaveLength(15)
  })

  it("пункт обрезается до 300 символов", () => {
    expect(normalizeNotes("а".repeat(301))[0]).toBe("а".repeat(300))
    expect(normalizeNotes("а".repeat(300))[0]).toBe("а".repeat(300))
  })

  it("пустые строки не занимают место в лимите пунктов", () => {
    const text = Array.from({ length: 15 }, (_, i) => `п${i}\n`).join("\n")
    expect(normalizeNotes(text)).toHaveLength(15)
  })
})

describe("notesOf / withNotes", () => {
  const all = (): Drawing => make({ notes: ["обмер"], demolitionNotes: ["снос"], mounting: { walls: [], dimensions: [], notes: ["монтаж"] } })

  it("без списка — пустой список для каждого плана", () => {
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(notesOf(make(), plan)).toEqual([])
  })

  it("каждый план получает только свои примечания", () => {
    const d = all()
    expect(notesOf(d, "measure")).toEqual(["обмер"])
    expect(notesOf(d, "demolition")).toEqual(["снос"])
    expect(notesOf(d, "mounting")).toEqual(["монтаж"])
  })

  it("withNotes меняет только список своего плана и не меняет исходный чертёж", () => {
    const d = all()
    const before = JSON.stringify(d)
    for (const plan of ["measure", "demolition", "mounting"] as const) {
      const next = withNotes(d, plan, ["новое"])
      expect(notesOf(next, plan)).toEqual(["новое"])
      for (const other of ["measure", "demolition", "mounting"] as const) {
        if (other !== plan) expect(notesOf(next, other)).toEqual(notesOf(d, other))
      }
    }
    expect(JSON.stringify(d)).toBe(before)
  })

  it("withNotes для «Монтажа» без объектов создаёт пустой «Монтаж» с примечаниями", () => {
    const next = withNotes(make(), "mounting", ["a"])
    expect(next.mounting).toEqual({ walls: [], dimensions: [], notes: ["a"] })
  })

  it("withNotes для «Монтажа» сохраняет собственные объекты плана", () => {
    const wall = { id: "m", a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thicknessCm: 10, type: "brick" as const }
    const next = withNotes(make({ mounting: { walls: [wall], dimensions: [] } }), "mounting", ["a"])
    expect(next.mounting?.walls).toEqual([wall])
  })
})
