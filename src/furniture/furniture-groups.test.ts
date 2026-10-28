import { describe, expect, it } from "vitest"
import { FURNITURE_GROUPS, FURNITURE_KIND_ORDER, groupOf, kindsOfGroup } from "./furniture-kinds"
import type { FurnitureGroup } from "./furniture-kinds"
import { clickGroup, groupIsActive, initialMenu, pickKind, placed, revealSelection, withActive, withoutPanel } from "./furniture-groups"
import { initialKindParams, paramsOfKind, withKindParams } from "./item-params"

// change furniture-kind-groups: четыре группы видов на панели инструментов (spec furniture-plan «Группы видов мебели»).
// Состояние меню — чистая модель: кнопки групп и панели; main.ts только отражает её в разметке.

const opened = () => withActive(initialMenu(), true)

describe("состав групп (FKG-01)", () => {
  it("FKG-01: группы идут «Комната», «Спальня», «Кухня», «Санузел»", () => {
    expect(FURNITURE_GROUPS.map((g) => g.label)).toEqual(["Комната", "Спальня", "Кухня", "Санузел"])
  })

  it("FKG-02: виды групп — по спеке, в порядке каталога (8 / 4 / 11 / 4)", () => {
    expect(kindsOfGroup("room")).toEqual(["table", "chair", "sofa", "desk", "officeChair", "tv", "wallCabinet", "curtains"])
    expect(kindsOfGroup("bedroom")).toEqual(["bed", "nightstand", "slidingWardrobe", "doubleWardrobe"])
    expect(kindsOfGroup("kitchen")).toEqual(["kitchenCabinet", "fridge", "wineCabinet", "hob", "dishwasher", "sink", "kitchenColumn", "oven", "microwave", "washer", "dryer"])
    expect(kindsOfGroup("bathroom")).toEqual(["toilet", "tropicalShower", "wallShowerDrain", "washbasin"])
  })

  it("FKG-03: каждый вид каталога — ровно в одной группе, вместе двадцать семь", () => {
    const all = FURNITURE_GROUPS.flatMap((g) => kindsOfGroup(g.key))
    expect(all).toHaveLength(27)
    expect([...all].sort()).toEqual([...FURNITURE_KIND_ORDER].sort())
    for (const kind of FURNITURE_KIND_ORDER) expect(kindsOfGroup(groupOf(kind))).toContain(kind)
  })

  it("FKG-04: иконка группы — иконка вида «Диван», «Кровать», «Кухонный шкаф», «Унитаз»", () => {
    expect(FURNITURE_GROUPS.map((g) => g.iconKind)).toEqual(["sofa", "bed", "kitchenCabinet", "toilet"])
  })
})

describe("состояние при открытии плана «Мебель» (FKG-10)", () => {
  it("FKG-10: активен «Стол», группа «Комната» активна, панели закрыты", () => {
    const m = opened()
    expect(m.kind).toBe("table")
    expect(m.panel).toBeNull()
    expect(groupIsActive(m, "room")).toBe(true)
    for (const g of ["bedroom", "kitchen", "bathroom"] as const) expect(groupIsActive(m, g), g).toBe(false)
  })

  it("FKG-11: текущий вид каждой группы по умолчанию — её первый вид", () => {
    const m = initialMenu()
    for (const g of FURNITURE_GROUPS) expect(m.current[g.key]).toBe(kindsOfGroup(g.key)[0])
  })
})

describe("клик по кнопке группы (FKG-20)", () => {
  it("FKG-20: «Спальня» при активном «Столе» — активна «Кровать», панель «Спальни» открыта, «Комната» не активна", () => {
    const m = clickGroup(opened(), "bedroom")
    expect(m.kind).toBe("bed")
    expect(m.panel).toBe("bedroom")
    expect(groupIsActive(m, "bedroom")).toBe(true)
    expect(groupIsActive(m, "room")).toBe(false)
  })

  it("FKG-21: клик по кнопке, когда инструмент снят — активируется текущий вид группы и открывается панель", () => {
    const m = clickGroup(withActive(initialMenu(), false), "room")
    expect(m.kind).toBe("table")
    expect(m.active).toBe(true)
    expect(m.panel).toBe("room")
  })

  it("FKG-22: повторный клик закрывает панель, вид остаётся активным", () => {
    const m = clickGroup(clickGroup(opened(), "bathroom"), "bathroom")
    expect(m.panel).toBeNull()
    expect(m.kind).toBe("toilet")
    expect(m.active).toBe(true)
  })

  it("FKG-23: повторный клик по закрытой панели активной группы открывает её", () => {
    const m = clickGroup(opened(), "room")
    expect(m.panel).toBe("room")
    expect(m.kind).toBe("table")
  })
})

describe("выбор вида в панели (FKG-30)", () => {
  it("FKG-30: вид становится текущим видом группы и активным, панель остаётся открытой", () => {
    const m = pickKind(clickGroup(opened(), "bedroom"), "slidingWardrobe")
    expect(m.kind).toBe("slidingWardrobe")
    expect(m.current.bedroom).toBe("slidingWardrobe")
    expect(m.panel).toBe("bedroom")
    expect(m.active).toBe(true)
  })

  it("FKG-31: группа помнит последний вид после переключения на другие группы", () => {
    let m = pickKind(clickGroup(opened(), "bedroom"), "slidingWardrobe")
    m = clickGroup(m, "kitchen")
    m = clickGroup(m, "bedroom")
    expect(m.kind).toBe("slidingWardrobe")
    expect(m.panel).toBe("bedroom")
  })

  it("FKG-32: выбор вида одной группы не меняет текущие виды других групп", () => {
    const m = pickKind(clickGroup(opened(), "kitchen"), "sink")
    expect(m.current.room).toBe("table")
    expect(m.current.bedroom).toBe("bed")
    expect(m.current.bathroom).toBe("toilet")
  })
})

describe("панели не накапливаются (FKG-40)", () => {
  it("FKG-40: клик по «Санузлу» при открытой «Комнате» закрывает её панель, открывает панель «Санузла», активен «Унитаз»", () => {
    const m = clickGroup(clickGroup(opened(), "room"), "bathroom")
    expect(m.panel).toBe("bathroom")
    expect(m.kind).toBe("toilet")
  })

  it("FKG-41: открытой может быть панель одной группы — панель хранит одну группу", () => {
    let m: ReturnType<typeof initialMenu> = opened()
    for (const g of ["room", "bedroom", "kitchen", "bathroom"] as FurnitureGroup[]) {
      m = clickGroup(m, g)
      expect(m.panel).toBe(g)
    }
  })
})

describe("выделение и установка (FKG-50)", () => {
  it("FKG-50: выделение кровати при открытой панели «Комнаты» открывает панель «Спальни»", () => {
    const m = revealSelection(clickGroup(opened(), "room"), "bed")
    expect(m.panel).toBe("bedroom")
  })

  it("FKG-51: выделение не меняет ни текущий вид группы, ни активный вид, ни активность инструмента", () => {
    const before = withActive(initialMenu(), false)
    const m = revealSelection(before, "washbasin")
    expect(m.panel).toBe("bathroom")
    expect(m.current).toEqual(before.current)
    expect(m.kind).toBe(before.kind)
    expect(m.active).toBe(false)
  })

  it("FKG-52: установка умывальника при закрытой панели снимает инструмент и оставляет открытой панель «Санузла»", () => {
    const closedBefore = withoutPanel(pickKind(clickGroup(opened(), "bathroom"), "washbasin"))
    expect(closedBefore.panel).toBeNull()
    expect(closedBefore.active).toBe(true)
    const after = placed(closedBefore)
    expect(after.active).toBe(false)
    expect(after.kind).toBe("washbasin")
    expect(after.panel).toBe("bathroom")
  })

  it("FKG-53: сброс панелей (смена плана, чертежа) закрывает панель", () => {
    expect(withoutPanel(clickGroup(opened(), "kitchen")).panel).toBeNull()
  })
})

describe("значения для новых предметов (FKG-60)", () => {
  it("FKG-60: значения «Стола» пережили переключение групп: меню их не затрагивает", () => {
    const table = paramsOfKind(initialKindParams(), "table")
    const params = withKindParams(initialKindParams(), "table", { ...table, widthCm: 100 })
    let m = clickGroup(opened(), "kitchen")
    m = clickGroup(m, "room")
    expect(m.kind).toBe("table")
    expect(paramsOfKind(params, m.kind).widthCm).toBe(100)
  })
})
