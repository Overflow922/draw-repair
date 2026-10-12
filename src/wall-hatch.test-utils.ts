// Утилиты тестов change new-wall-materials: запись геометрии штриховки (штрихи и заливки с их стилем и порядком) из
// операций 2D-контекста холста и измерения по отрезкам: направление, шаг, решётка фазы.
// Координаты — пиксели контекста, ось y вниз.

export interface HPoint {
  x: number
  y: number
}

export interface HOp {
  kind: "stroke" | "fill"
  subpaths: readonly (readonly HPoint[])[]
  style: string // strokeStyle или fillStyle на момент операции
  width: number // lineWidth на момент операции
  dash: readonly number[]
  alpha: number
}

interface State {
  strokeStyle: string
  fillStyle: string
  lineWidth: number
  globalAlpha: number
  dash: readonly number[]
}

// Фейковый 2D-контекст: записывает операции stroke и fill с геометрией путей (линии и кривые — по вершинам) и стилем.
// Преобразования и клиппинг не применяются: штриховка в потоке длиннее стены (её обрезает клиппинг).
export function hatchRecorder(): { ctx: CanvasRenderingContext2D; ops: HOp[] } {
  const ops: HOp[] = []
  let state: State = { strokeStyle: "#000000", fillStyle: "#000000", lineWidth: 1, globalAlpha: 1, dash: [] }
  const stack: State[] = []
  let subpaths: HPoint[][] = []
  const last = (): HPoint[] | undefined => subpaths[subpaths.length - 1]
  const num = (v: unknown): number => (typeof v === "number" ? v : 0)
  const add = (x: unknown, y: unknown): void => {
    last()?.push({ x: num(x), y: num(y) })
  }
  const record = (kind: "stroke" | "fill"): void => {
    ops.push({
      kind,
      subpaths: subpaths.map((sp) => [...sp]),
      style: kind === "stroke" ? state.strokeStyle : state.fillStyle,
      width: state.lineWidth,
      dash: state.dash,
      alpha: state.globalAlpha,
    })
  }
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => {
      stack.push({ ...state })
    },
    restore: () => {
      state = stack.pop() ?? state
    },
    beginPath: () => {
      subpaths = []
    },
    moveTo: (x, y) => {
      subpaths.push([{ x: num(x), y: num(y) }])
    },
    lineTo: (x, y) => add(x, y),
    bezierCurveTo: (_a, _b, _c, _d, x, y) => add(x, y),
    quadraticCurveTo: (_a, _b, x, y) => add(x, y),
    rect: (x, y, w, h) => {
      const [x0, y0, ww, hh] = [num(x), num(y), num(w), num(h)]
      subpaths.push([
        { x: x0, y: y0 },
        { x: x0 + ww, y: y0 },
        { x: x0 + ww, y: y0 + hh },
        { x: x0, y: y0 + hh },
      ])
    },
    setLineDash: (list) => {
      state = { ...state, dash: Array.isArray(list) ? list.map(num) : [] }
    },
    stroke: () => record("stroke"),
    fill: () => record("fill"),
    measureText: (text) => ({ width: String(text).length * 7 }),
  }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(_t, key) {
      if (key === "strokeStyle" || key === "fillStyle" || key === "lineWidth" || key === "globalAlpha") return state[key]
      if (typeof key === "string" && key in methods) return methods[key]
      if (typeof key === "string" && key in target) return target[key]
      return () => undefined
    },
    set(_t, key, value) {
      if (key === "strokeStyle" || key === "fillStyle") state = { ...state, [key]: String(value) }
      else if (key === "lineWidth" || key === "globalAlpha") state = { ...state, [key]: Number(value) }
      else if (typeof key === "string") target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, ops }
}

export interface HSeg {
  a: HPoint
  b: HPoint
  op: HOp
}

export const segmentsOf = (ops: readonly HOp[]): HSeg[] =>
  ops.flatMap((op) => op.subpaths.flatMap((sp) => sp.slice(1).map((q, i) => ({ a: sp[i] as HPoint, b: q, op }))))

const lengthOf = (s: { a: HPoint; b: HPoint }): number => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)

// диагональ под 45° к осям (в обе стороны); вырожденные и короткие отрезки не считаются
export const isDiagonal = (s: { a: HPoint; b: HPoint }, minLen = 0.5): boolean =>
  lengthOf(s) >= minLen && Math.abs(Math.abs(s.b.x - s.a.x) - Math.abs(s.b.y - s.a.y)) <= 0.02 * lengthOf(s)

// линия вида x + y = const (45°, «/» на экране с осью y вниз)
export const isRising = (s: { a: HPoint; b: HPoint }): boolean => isDiagonal(s) && (s.b.x - s.a.x) * (s.b.y - s.a.y) < 0
// линия вида y − x = const (135°, «\» на экране)
export const isFalling = (s: { a: HPoint; b: HPoint }): boolean => isDiagonal(s) && (s.b.x - s.a.x) * (s.b.y - s.a.y) > 0

export const risingConstant = (s: { a: HPoint }): number => s.a.x + s.a.y
export const fallingConstant = (s: { a: HPoint }): number => s.a.y - s.a.x

const uniqueSorted = (values: readonly number[], tol = 1e-6): number[] => {
  const sorted = [...values].sort((p, q) => p - q)
  const out: number[] = []
  for (const v of sorted) {
    const prev = out[out.length - 1]
    if (prev === undefined || v - prev > tol) out.push(v)
  }
  return out
}

// наименьшее положительное расстояние между соседними параллельными линиями по константам (x + y или y − x),
// в единицах длины (константы делятся на √2)
export function pitchOf(constants: readonly number[], tol = 1e-3): number | null {
  const u = uniqueSorted(constants, tol)
  const gaps = u.slice(1).map((c, i) => c - (u[i] ?? 0)).filter((g) => g > tol)
  return gaps.length === 0 ? null : Math.min(...gaps) / Math.SQRT2
}

// все константы лежат на одной решётке c0 + k·step (step — шаг по константе, не по расстоянию)
export function onLattice(constants: readonly number[], stepConst: number, tol = 0.02): boolean {
  const [first] = constants
  if (first === undefined) return true
  return constants.every((c) => {
    const k = (c - first) / stepConst
    return Math.abs(k - Math.round(k)) * stepConst <= tol
  })
}

// длина-взвешенное среднее направление отрезков по удвоенному углу: { angleDeg по модулю 180, resultant 0…1 }
export function dominantDirection(segs: readonly { a: HPoint; b: HPoint }[]): { angleDeg: number; resultant: number } {
  let sx = 0
  let sy = 0
  let total = 0
  for (const s of segs) {
    const len = lengthOf(s)
    const theta = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x)
    sx += len * Math.cos(2 * theta)
    sy += len * Math.sin(2 * theta)
    total += len
  }
  if (total === 0) return { angleDeg: 0, resultant: 0 }
  const angle = (Math.atan2(sy, sx) / 2) * (180 / Math.PI)
  return { angleDeg: ((angle % 180) + 180) % 180, resultant: Math.hypot(sx, sy) / total }
}

// разность направлений по модулю 180°, 0…90
export const angleGap = (p: number, q: number): number => {
  const d = Math.abs(p - q) % 180
  return Math.min(d, 180 - d)
}

export const totalLength = (segs: readonly { a: HPoint; b: HPoint }[]): number => segs.reduce((sum, s) => sum + lengthOf(s), 0)
