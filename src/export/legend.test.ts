import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import type { DemolitionMark, Doorway, Drawing, Wall, WallDoor, WallWindow } from "../types"
import type { PlanPage } from "./pdf"
import { pagesOf } from "./pdf"
import { legendEntries, legendWidthMm, wrapLabel } from "./legend"

// change pdf-legend: состав записей легенды страницы, перенос подписи и ширина столбца легенды документа
// (spec pdf-export «Легенда на странице PDF»; design D1, D2, D7; test-plan LG-1…LG-9, LG-15).
// Ревизия 2: проёмы, двери и окна в легенду не входят; подпись, не помещающаяся в предел, переносится по пробелам.

const wall = (id: string, type: Wall["type"] = "brick", y = 0): Wall => ({
  id,
  a: { x: 0, y },
  b: { x: 500, y },
  thicknessCm: 20,
  type,
})

const DOORWAY: Doorway = { id: "dw", wallId: "w1", anchor: "a", offsetCm: 20, widthCm: 90, heightCm: 210 }
const DOOR: WallDoor = { kind: "door", id: "dr", wallId: "w1", anchor: "a", offsetCm: 150, widthCm: 90, heightCm: 210, hinge: "a", swing: "left" }
const WINDOW: WallWindow = { kind: "window", id: "wn", wallId: "w1", anchor: "a", offsetCm: 300, widthCm: 120, heightCm: 150, sillCm: 85 }

const mark = (id: string, fromCm: number, toCm: number): DemolitionMark => ({ id, wallId: "w1", anchor: "a", fromCm, toCm })

const page = (walls: Wall[], doorways: PlanPage["doorways"] = [], demolition?: PlanPage["demolition"]): PlanPage =>
  demolition === undefined ? { walls, dimensions: [], doorways } : { walls, dimensions: [], doorways, demolition }

const labels = (p: PlanPage): string[] => legendEntries(p).map((e) => e.label)

describe("легенда: материалы страницы", () => {
  it("LG-1: кирпич и бетон — записи «Кирпич», «Бетон» в порядке каталога, а не порядка стен", () => {
    expect(labels(page([wall("w2", "concrete", 300), wall("w1", "brick")]))).toEqual(["Кирпич", "Бетон"])
  })

  it("LG-1: все пять материалов — в порядке каталога материалов", () => {
    const walls = [wall("a", "wood-long", 0), wall("b", "gkl", 100), wall("c", "concrete", 200), wall("d", "brick", 300), wall("e", "blocks", 400)]
    expect(labels(page(walls))).toEqual(["Блоки", "Кирпич", "Бетон", "ГКЛ", "Дерево"])
  })

  it("WM-L2: блоки, ГКЛ и дерево — в порядке каталога, а не порядка стен", () => {
    const walls = [wall("a", "wood-long", 0), wall("b", "gkl", 100), wall("c", "blocks", 200)]
    expect(labels(page(walls))).toEqual(["Блоки", "ГКЛ", "Дерево"])
  })

  it("WM-L4: стена, сохранённая как reinforced (после загрузки — бетон), даёт запись «Бетон», а не «Железобетон»", () => {
    const legacy: Wall = JSON.parse('{"id":"w1","a":{"x":0,"y":0},"b":{"x":500,"y":0},"thicknessCm":20,"type":"reinforced"}')
    expect(labels(page([legacy]))).toEqual(["Бетон"])
  })

  it("WM-L4: стена reinforced и стена concrete вместе — одна запись «Бетон»", () => {
    const legacy: Wall = JSON.parse('{"id":"w2","a":{"x":0,"y":300},"b":{"x":500,"y":300},"thicknessCm":20,"type":"reinforced"}')
    expect(labels(page([wall("w1", "concrete"), legacy]))).toEqual(["Бетон"])
  })

  it("WM-L4: стена wood-long даёт запись «Дерево», а не «Дерево (вдоль)»", () => {
    expect(labels(page([wall("w1", "wood-long")]))).toEqual(["Дерево"])
  })

  it("LG-2: только кирпич без элементов — единственная запись «Кирпич»", () => {
    expect(labels(page([wall("w1")]))).toEqual(["Кирпич"])
  })

  it("LG-1: несколько стен одного материала дают одну запись", () => {
    expect(labels(page([wall("a", "concrete", 0), wall("b", "concrete", 100), wall("c", "concrete", 200)]))).toEqual(["Бетон"])
  })

  it("LG-1: неизвестный материал стены считается кирпичом", () => {
    const legacy: Wall = JSON.parse('{"id":"w1","a":{"x":0,"y":0},"b":{"x":500,"y":0},"thicknessCm":20,"type":"granite"}')
    expect(labels(page([legacy]))).toEqual(["Кирпич"])
  })

  it("LG-1: неизвестный материал и кирпич вместе — одна запись «Кирпич»", () => {
    const legacy: Wall = JSON.parse('{"id":"w2","a":{"x":0,"y":300},"b":{"x":500,"y":300},"thicknessCm":20,"type":"granite"}')
    expect(labels(page([wall("w1"), legacy]))).toEqual(["Кирпич"])
  })
})

describe("легенда: элементы стены в неё не входят", () => {
  const FORBIDDEN = ["Проём", "Дверь", "Окно"]

  it("LG-3: окно, дверь и проём вместе — записи только материалов", () => {
    expect(labels(page([wall("w1")], [WINDOW, DOOR, DOORWAY]))).toEqual(["Кирпич"])
  })

  it.each([
    ["окно", WINDOW],
    ["дверь", DOOR],
    ["проём", DOORWAY],
  ] as const)("LG-3: только %s — записей элементов нет", (_name, element) => {
    const all = labels(page([wall("w1")], [element]))
    for (const f of FORBIDDEN) expect(all).not.toContain(f)
    expect(all).toEqual(["Кирпич"])
  })

  it("LG-3: несколько элементов одного вида и элемент без стены на странице записей не создают", () => {
    const second: WallDoor = { ...DOOR, id: "dr2", offsetCm: 400 }
    const dangling: WallDoor = { ...DOOR, id: "far", wallId: "gone" }
    expect(labels(page([wall("w1")], [DOOR, second, dangling]))).toEqual(["Кирпич"])
  })

  it("LG-3: ширина колонки с элементами и без них одинакова", () => {
    const bare = page([wall("w1")])
    const full = page([wall("w1")], [WINDOW, DOOR, DOORWAY])
    expect(legendWidthMm([full])).toBe(legendWidthMm([bare]))
  })

  it("LG-2, WM-L3: на странице из одной стены ГКЛ лишних записей нет", () => {
    const all = labels(page([wall("w1", "gkl")]))
    expect(all).toEqual(["ГКЛ"])
    for (const absent of ["Проём", "Дверь", "Окно", "Блоки", "Кирпич", "Бетон", "Дерево", "Железобетон", "Дерево (вдоль)", "Демонтируемая стена"])
      expect(all).not.toContain(absent)
  })
})

describe("легенда: снос", () => {
  const W1 = wall("w1")

  it("LG-4: «Демонтаж» с кирпичной стеной и одной действующей пометкой — «Кирпич», «Демонтируемая стена»", () => {
    expect(labels(page([W1], [], effectiveMarks([mark("m1", 100, 190)], [W1], [])))).toEqual(["Кирпич", "Демонтируемая стена"])
  })

  it("LG-4: «Демонтируемая стена» стоит последней, элементы стены записей не дают", () => {
    const marks = effectiveMarks([mark("m1", 100, 190)], [W1], [])
    expect(marks.length).toBe(1)
    expect(labels(page([W1], [DOOR, WINDOW], marks))).toEqual(["Кирпич", "Демонтируемая стена"])
  })

  it("LG-5: «Демонтаж» стены есть, пометок нет — записи «Демонтируемая стена» нет", () => {
    expect(labels(page([W1], [], []))).toEqual(["Кирпич"])
  })

  it("LG-5, WM-D4: пометка на бетоне недействующая — «Демонтируемая стена» нет, «Бетон» есть", () => {
    const rc = wall("w1", "concrete")
    const marks = effectiveMarks([mark("m1", 100, 190)], [rc], [])
    expect(marks).toEqual([])
    expect(labels(page([rc], [], marks))).toEqual(["Бетон"])
  })

  it("LG-5: пометка на несуществующую стену недействующая — записи нет", () => {
    const marks = effectiveMarks([{ ...mark("m1", 100, 190), wallId: "gone" }], [W1], [])
    expect(labels(page([W1], [], marks))).toEqual(["Кирпич"])
  })

  it("LG-5: несколько действующих пометок дают одну запись", () => {
    const marks = effectiveMarks([mark("m1", 10, 60), mark("m2", 100, 190), mark("m3", 300, 350)], [W1], [])
    expect(marks.length).toBe(3)
    expect(labels(page([W1], [], marks))).toEqual(["Кирпич", "Демонтируемая стена"])
  })

  it("LG-5: на странице «Обмерочный план» записи сноса нет, даже если в чертеже есть пометки", () => {
    const d: Drawing = {
      id: "a",
      name: "Чертёж 1",
      walls: [W1],
      dimensions: [],
      view: { zoom: 1, pan: { x: 0, y: 0 } },
      demolition: [mark("m1", 100, 190)],
    }
    const pages = pagesOf(d)
    expect(labels(pages[0] as PlanPage)).toEqual(["Кирпич"])
    expect(labels(pages[1] as PlanPage)).toEqual(["Кирпич", "Демонтируемая стена"])
  })

  it("LG-4, WM-L5: максимум записей — пять материалов и снос (6)", () => {
    const walls = [wall("w1", "brick", 0), wall("w2", "concrete", 100), wall("w3", "gkl", 200), wall("w4", "wood-long", 300), wall("w5", "blocks", 400)]
    const marks = effectiveMarks([mark("m1", 100, 190)], walls, [])
    expect(marks.length).toBe(1)
    expect(labels(page(walls, [DOORWAY, DOOR, WINDOW], marks))).toEqual(["Блоки", "Кирпич", "Бетон", "ГКЛ", "Дерево", "Демонтируемая стена"])
  })
})

describe("легенда: страница без стен и запрещённые записи", () => {
  it("LG-7: страница без стен — записей нет", () => {
    expect(legendEntries(page([]))).toEqual([])
  })

  it("LG-7: элементы без стен не создают записей (без стен легенды нет)", () => {
    expect(legendEntries(page([], [DOOR]))).toEqual([])
  })

  it("LG-2: ни в какой комбинации нет записей для объектов, которых нет в приложении", () => {
    const walls = [wall("w1", "brick", 0), wall("w2", "concrete", 100), wall("w3", "gkl", 200), wall("w4", "wood-long", 300)]
    const all = labels(page(walls, [DOORWAY, DOOR, WINDOW], effectiveMarks([mark("m1", 100, 190)], walls, [])))
    for (const absent of ["Газобетон", "Вентканал", "Канализационные коммуникации", "Радиатор"]) expect(all).not.toContain(absent)
  })

  it("legendEntries не мутирует страницу", () => {
    const p = page([wall("w2", "concrete", 300), wall("w1")], [DOOR])
    const before = structuredClone(p)
    legendEntries(p)
    expect(p).toEqual(before)
  })
})

describe("легенда: ширина столбца документа", () => {
  const brickOnly = page([wall("w1")])
  const concreteOnly = page([wall("w1", "concrete")])
  const demolitionPage = page([wall("w1")], [], effectiveMarks([mark("m1", 100, 190)], [wall("w1")], []))

  it("LG-8: ни на одной странице нет стен — ширина 0", () => {
    expect(legendWidthMm([page([]), page([])])).toBe(0)
    expect(legendWidthMm([])).toBe(0)
  })

  it("LG-9: есть стены — ширина положительная и умеренная (заведомо меньше половины полосы A4)", () => {
    const w = legendWidthMm([brickOnly])
    expect(w).toBeGreaterThan(10)
    expect(w).toBeLessThan(100)
  })

  it("LG-9: ширина по самой длинной подписи среди всех страниц: страница со сносом расширяет столбец для остальных", () => {
    const narrow = legendWidthMm([brickOnly, concreteOnly])
    const wide = legendWidthMm([brickOnly, demolitionPage, concreteOnly])
    expect(wide).toBeGreaterThan(narrow)
  })

  it("LG-9: ширина не зависит от порядка страниц и от пустых страниц", () => {
    const a = legendWidthMm([brickOnly, demolitionPage, page([])])
    const b = legendWidthMm([page([]), demolitionPage, brickOnly])
    expect(a).toBe(b)
    expect(legendWidthMm([demolitionPage])).toBe(a)
  })

  it("LG-9: ширина равна ширине самой широкой легенды (одиночной страницы), а не их сумме", () => {
    const widest = Math.max(legendWidthMm([brickOnly]), legendWidthMm([demolitionPage]))
    expect(legendWidthMm([brickOnly, demolitionPage])).toBe(widest)
  })

  it("LG-9: более длинная подпись даёт более широкую колонку («Кирпич» шире «ГКЛ»)", () => {
    expect(legendWidthMm([page([wall("w1", "gkl")])])).toBeLessThan(legendWidthMm([brickOnly]))
  })

  it("LG-9: число записей на ширину не влияет, только самая длинная подпись", () => {
    const many = page([wall("a", "blocks", 0), wall("b", "brick", 100), wall("c", "gkl", 200)])
    // самая длинная подпись у обеих — «Кирпич»
    expect(legendWidthMm([many])).toBe(legendWidthMm([brickOnly]))
  })

  it("LG-6: ширина столбца одна для всего документа — страницы с разным составом дают общий результат", () => {
    expect(legendWidthMm([brickOnly, concreteOnly])).toBe(legendWidthMm([concreteOnly, brickOnly]))
  })

  it("LG-9, LG-15: ширина — по самой широкой строке после переноса: «Демонтируемая стена» шире «Кирпич» лишь на разницу слов «Демонтируемая» и «Кирпич»", () => {
    const brick = legendWidthMm([brickOnly])
    const demolition = legendWidthMm([demolitionPage])
    // «Демонтируемая» (13 знаков) шире «Кирпич» (6) на 7 знаков; без переноса «Демонтируемая стена» (19) была бы шире на 13
    expect(demolition).toBeGreaterThan(brick)
    expect(demolition - brick).toBeLessThan(10 * 0.6 * 3.5)
  })
})

describe("легенда: перенос подписи", () => {
  it("LG-15: «Демонтируемая стена» — две строки по пробелу", () => {
    expect(wrapLabel("Демонтируемая стена")).toEqual(["Демонтируемая", "стена"])
  })

  it.each(["Блоки", "Кирпич", "Бетон", "ГКЛ", "Дерево"])("LG-15: короткая подпись «%s» — одна строка", (label) => {
    expect(wrapLabel(label)).toEqual([label])
  })

  it("LG-15: строки, склеенные пробелом, дают исходную подпись; пустых строк нет; слов не разрывает", () => {
    for (const label of ["Демонтируемая стена", "Дерево", "Кирпич", "один два три четыре пять шесть семь восемь"]) {
      const lines = wrapLabel(label)
      expect(lines.join(" "), label).toBe(label)
      for (const line of lines) expect(line.length, label).toBeGreaterThan(0)
    }
  })

  it("LG-15: слово длиннее предела остаётся целым в одной строке", () => {
    const word = "Сверхдлинноеслововообщенеделящееся"
    expect(wrapLabel(word)).toEqual([word])
    expect(wrapLabel(`${word} ещё`)).toEqual([word, "ещё"])
  })

  it("LG-15: длинная подпись из многих слов распадается на несколько строк, а короткая — нет", () => {
    expect(wrapLabel("один два три четыре пять шесть семь восемь").length).toBeGreaterThan(2)
    expect(wrapLabel("а б в")).toEqual(["а б в"])
  })
})
