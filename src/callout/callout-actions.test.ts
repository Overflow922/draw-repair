import { describe, expect, it } from "vitest"
import type { Callout } from "../types"
import { commitCallout, moveCalloutPoint, removeCallout } from "./callout-actions"
import { A, B, callout, deepFreeze } from "./callout.test-utils"

// change add-callout: операции над списком выносок — создание, правка текста, удаление, перенос точки
// (spec callout «Данные выноски», «Ввод текста на месте», «Выделение, перенос и правка выноски»; test-plan C-ACT-*, C-INV-*).

const NEW = { kind: "new" as const, id: "n", target: { x: 100.37, y: 20.5 }, at: { x: 10, y: 20 } }

describe("создание выноски", () => {
  it("C-ACT-1: непустой текст добавляет выноску в конец с точками ровно как заданы", () => {
    const list = [A(), B()]
    const r = commitCallout(list, NEW, "Монтаж радиатора\nв нишу")
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([A(), B(), { id: "n", target: { x: 100.37, y: 20.5 }, at: { x: 10, y: 20 }, text: "Монтаж радиатора\nв нишу" }])
  })

  it("C-ACT-1d: обе точки новой выноски — ровно там, где кликнули: дробные, не на сетке и не округлены (в том числе точка текста)", () => {
    const edit = { kind: "new" as const, id: "n", target: { x: 100.37, y: 20.5 }, at: { x: 10.37, y: 20.5 } }
    const r = commitCallout([], edit, "т")
    expect(r.list[0].target).toEqual({ x: 100.37, y: 20.5 })
    expect(r.list[0].at).toEqual({ x: 10.37, y: 20.5 })
    const odd = { kind: "new" as const, id: "o", target: { x: 3.3333, y: -7.77 }, at: { x: 101.01, y: 0.49 } }
    const q = commitCallout([], odd, "т")
    expect(q.list[0].target).toEqual({ x: 3.3333, y: -7.77 })
    expect(q.list[0].at).toEqual({ x: 101.01, y: 0.49 })
  })

  it("C-ACT-1b: один символ — выноска создаётся", () => {
    const r = commitCallout([], NEW, "Я")
    expect(r.changed).toBe(true)
    expect(r.list.map((c) => c.text)).toEqual(["Я"])
  })

  it("C-ACT-1c: текст нормализуется при сохранении", () => {
    const r = commitCallout([], NEW, "\n  а\n\nб  \n")
    expect(r.list[0].text).toBe("а\n\nб")
  })

  it("C-ACT-2: пустой текст, пробелы и переводы строк не создают выноску", () => {
    for (const raw of ["", "   ", "  \n \n", "\n"]) {
      const list = [A()]
      const r = commitCallout(list, NEW, raw)
      expect(r.changed).toBe(false)
      expect(r.list).toEqual([A()])
    }
  })
})

describe("правка текста существующей выноски", () => {
  it("C-ACT-3: другой текст заменяет только текст; точки, порядок и остальные выноски прежние", () => {
    const r = commitCallout([A(), B()], { kind: "edit", id: "a" }, "Новый\nтекст")
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([{ ...A(), text: "Новый\nтекст" }, B()])
  })

  it("C-ACT-3b: правка с лишними пробелами и переводами строк сохраняет нормализованный текст", () => {
    const r = commitCallout([A(), B()], { kind: "edit", id: "b" }, "\n  новый \n")
    expect(r.changed).toBe(true)
    expect(r.list[1].text).toBe("новый")
    const multi = commitCallout([A()], { kind: "edit", id: "a" }, "\n  а \n\n б  \n")
    expect(multi.list[0].text).toBe("а \n\n б")
  })

  it("C-ACT-4: стирание всего текста удаляет выноску", () => {
    for (const raw of ["", "  \n "]) {
      const r = commitCallout([A(), B()], { kind: "edit", id: "a" }, raw)
      expect(r.changed).toBe(true)
      expect(r.list).toEqual([B()])
    }
  })

  it("C-ACT-4b: стирание текста у единственной выноски удаляет её, список становится пустым", () => {
    const r = commitCallout([A()], { kind: "edit", id: "a" }, "  \n ")
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([])
  })

  it("C-ACT-5: тот же текст, в том числе после нормализации, изменением не считается", () => {
    const same = commitCallout([A(), B()], { kind: "edit", id: "b" }, "Тест")
    expect(same.changed).toBe(false)
    expect(same.list).toEqual([A(), B()])
    const padded = commitCallout([A(), B()], { kind: "edit", id: "b" }, "\n Тест \n")
    expect(padded.changed).toBe(false)
    expect(padded.list).toEqual([A(), B()])
  })

  it("C-ACT-6: неизвестный идентификатор — список без изменений", () => {
    const edit = commitCallout([A(), B()], { kind: "edit", id: "zzz" }, "текст")
    expect(edit.changed).toBe(false)
    expect(edit.list).toEqual([A(), B()])
    const eraseUnknown = commitCallout([A(), B()], { kind: "edit", id: "zzz" }, "")
    expect(eraseUnknown.changed).toBe(false)
    expect(eraseUnknown.list).toEqual([A(), B()])
    const move = moveCalloutPoint([A(), B()], "zzz", "at", { x: 1, y: 1 })
    expect(move.changed).toBe(false)
    expect(move.list).toEqual([A(), B()])
    const remove = removeCallout([A(), B()], "zzz")
    expect(remove.changed).toBe(false)
    expect(remove.list).toEqual([A(), B()])
  })
})

describe("перенос точки выноски", () => {
  it("C-ACT-7: перенос точки стрелки — точка ровно та, что передана; точка текста и текст прежние", () => {
    const r = moveCalloutPoint([A(), B()], "a", "target", { x: 123.456, y: -7.25 })
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([{ ...A(), target: { x: 123.456, y: -7.25 } }, B()])
  })

  it("C-ACT-7b: дробные координаты не округляются и не привязываются к сетке", () => {
    const r = moveCalloutPoint([A()], "a", "target", { x: 100.37, y: 20.5 })
    expect(r.list[0].target).toEqual({ x: 100.37, y: 20.5 })
  })

  it("C-ACT-8: перенос точки текста — точка стрелки и текст прежние", () => {
    const r = moveCalloutPoint([A(), B()], "b", "at", { x: 11.5, y: 12.5 })
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([A(), { ...B(), at: { x: 11.5, y: 12.5 } }])
  })

  it("C-ACT-7c: перенос только по одной оси — изменение, точка новая, вторая координата прежняя", () => {
    const x = moveCalloutPoint([A()], "a", "target", { x: 301, y: 100 })
    expect(x.changed).toBe(true)
    expect(x.list[0].target).toEqual({ x: 301, y: 100 })
    const y = moveCalloutPoint([A()], "a", "target", { x: 300, y: 101 })
    expect(y.changed).toBe(true)
    expect(y.list[0].target).toEqual({ x: 300, y: 101 })
    const ax = moveCalloutPoint([A()], "a", "at", { x: 101, y: 100 })
    expect(ax.changed).toBe(true)
    expect(ax.list[0].at).toEqual({ x: 101, y: 100 })
    const ay = moveCalloutPoint([A()], "a", "at", { x: 100, y: 99 })
    expect(ay.changed).toBe(true)
    expect(ay.list[0].at).toEqual({ x: 100, y: 99 })
  })

  it("C-ACT-8b: перенос в ту же точку изменением не считается", () => {
    const r = moveCalloutPoint([A()], "a", "at", { x: 100, y: 100 })
    expect(r.changed).toBe(false)
    expect(r.list).toEqual([A()])
    const t = moveCalloutPoint([A()], "a", "target", { x: 300, y: 100 })
    expect(t.changed).toBe(false)
  })
})

describe("удаление выноски", () => {
  it("C-ACT-9: удаляется только указанная выноска, порядок остальных прежний", () => {
    const c = callout("c", { x: 0, y: 0 }, { x: 1, y: 1 }, "ц")
    const r = removeCallout([A(), B(), c], "b")
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([A(), c])
  })

  it("C-ACT-9b: единственная выноска — список становится пустым", () => {
    const r = removeCallout([A()], "a")
    expect(r.changed).toBe(true)
    expect(r.list).toEqual([])
  })
})

describe("инварианты операций", () => {
  it("C-INV-4: входной список и его выноски не изменяются ни одной операцией", () => {
    const list: Callout[] = deepFreeze([A(), B()])
    const before = structuredClone(list)
    commitCallout(list, NEW, "новая")
    commitCallout(list, { kind: "edit", id: "a" }, "иначе")
    commitCallout(list, { kind: "edit", id: "a" }, "")
    moveCalloutPoint(list, "a", "target", { x: 1, y: 1 })
    moveCalloutPoint(list, "b", "at", { x: 2, y: 2 })
    removeCallout(list, "a")
    expect(list).toEqual(before)
  })

  it("C-INV-5: после любой фиксации текста в списке нет выносок с пустым текстом", () => {
    const inputs = ["", " ", "\n", "а", " а ", "а\n", "\n\nа\n\nб\n\n", "  \t "]
    for (const raw of inputs) {
      for (const edit of [NEW, { kind: "edit" as const, id: "a" }, { kind: "edit" as const, id: "zzz" }]) {
        const r = commitCallout([A(), B()], edit, raw)
        for (const c of r.list) expect(c.text.trim()).not.toBe("")
      }
    }
  })

  it("C-INV-1: перенос точки не меняет идентификатор и другие поля выноски", () => {
    const r = moveCalloutPoint([A()], "a", "at", { x: 1, y: 2 })
    expect(r.list[0].id).toBe("a")
    expect(r.list[0].text).toBe(A().text)
    expect(r.list[0].target).toEqual(A().target)
  })
})
