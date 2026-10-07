import { describe, expect, it } from "vitest"
import { initialParams, inheritFrom } from "./element-kind"
import { D0, door } from "./doorway.test-utils"
import { dr } from "./door.test-utils"
import { win } from "./window.test-utils"
import { INITIAL } from "./selection-editing.test-utils"

// change popups-buttons-only: параметры новых элементов — начальные значения и наследование от правки
// (spec doorway «Инструмент «Проём» и параметры новых проёмов», door «Инструмент «Дверь» и параметры новых
// дверей», window «Инструмент «Окно» и параметры новых окон»; design D4).

describe("начальные параметры", () => {
  it("PB-PAR-01: проём 90×210, дверь 90×210 с петлями у a, окно 120×150×85; сторона открывания не входит", () => {
    const p = initialParams()
    expect(p).toEqual(INITIAL)
    expect("swing" in p.door).toBe(false)
  })

  it("PB-PAR-01b: каждый вызов — новый объект: правка результата не протекает в следующий", () => {
    const first = initialParams()
    first.doorway.widthCm = 10
    first.door.hinge = "b"
    first.window.sillCm = 0
    expect(initialParams()).toEqual(INITIAL)
  })
})

describe("наследование от правки", () => {
  it("PB-PAR-02: проём 80×200 меняет только параметры проёмов", () => {
    const next = inheritFrom(initialParams(), door("W", "a", 100, 80, 200))
    expect(next).toEqual({ ...INITIAL, doorway: { widthCm: 80, heightCm: 200 } })
  })

  it("PB-PAR-03: правка двери не меняет проёмы и окна; правка окна не меняет проёмы и двери", () => {
    const afterDoor = inheritFrom(initialParams(), dr("W", "a", 100, "a", "left", 70, 200))
    expect(afterDoor.doorway).toEqual(INITIAL.doorway)
    expect(afterDoor.window).toEqual(INITIAL.window)
    expect(afterDoor.door).toEqual({ widthCm: 70, heightCm: 200, hinge: "a" })

    const afterWindow = inheritFrom(initialParams(), win("W", "a", 100, 100, 140, 0))
    expect(afterWindow.doorway).toEqual(INITIAL.doorway)
    expect(afterWindow.door).toEqual(INITIAL.door)
    expect(afterWindow.window).toEqual({ widthCm: 100, heightCm: 140, sillCm: 0 })
  })

  it("PB-PAR-04: дверь b/right передаёт петли b, сторона открывания в параметры не попадает", () => {
    const next = inheritFrom(initialParams(), dr("W", "a", 100, "b", "right", 80, 210))
    expect(next.door).toEqual({ widthCm: 80, heightCm: 210, hinge: "b" })
    expect("swing" in next.door).toBe(false)
  })

  it("PB-PAR-05: подоконник 0 наследуется как 0, а не как значение по умолчанию", () => {
    expect(inheritFrom(initialParams(), win("W", "a", 100, 120, 150, 0)).window.sillCm).toBe(0)
  })

  it("PB-PAR-06: вход не мутируется", () => {
    const p = initialParams()
    const copy = structuredClone(p)
    const d = D0()
    const dCopy = { ...d }
    inheritFrom(p, d)
    expect(p).toEqual(copy)
    expect(d).toEqual(dCopy)
  })
})
