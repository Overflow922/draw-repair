// Поле ввода текста выноски на месте (change add-callout, design D5): многострочное поле поверх холста на образце openNumberEditor
// (src/doorway/doorway-tool.ts). Отличия: Enter — новая строка; Esc и потеря фокуса (клик вне поля) сохраняют набранный текст;
// клавиши поля не доходят до холста, поэтому Delete, стрелки и Ctrl+Z правят текст, а не чертёж.

// положение и вид поля — в пикселях холста: подложка раскладки выноски, шрифт и интервал совпадают с холстовыми
export interface EditorGeometry {
  x: number
  y: number
  w: number
  h: number
  align: "left" | "right"
  padPx: number
  lineHeightPx: number
  font: string // значение CSS font
}

export interface TextEditor {
  commit(): void // сохранить текст и закрыть поле
  close(): void // закрыть без сохранения
}

function apply(input: HTMLTextAreaElement, g: EditorGeometry): void {
  input.style.left = `${g.x}px`
  input.style.top = `${g.y}px`
  input.style.width = `${g.w}px`
  input.style.height = `${g.h}px`
  input.style.padding = `${g.padPx}px`
  // сокращённое свойство font сбрасывает line-height, поэтому интервал задаётся после него
  input.style.font = g.font
  input.style.lineHeight = `${g.lineHeightPx}px`
  input.style.textAlign = g.align
}

// resize вызывается при каждом изменении текста и возвращает новую геометрию (поле растёт вместе с текстом)
export function openTextEditor(
  parent: HTMLElement,
  initial: string,
  geometry: EditorGeometry,
  resize: (text: string) => EditorGeometry,
  onCommit: (text: string) => void,
  onClose: () => void,
): TextEditor {
  const input = document.createElement("textarea")
  input.className = "callout-text-input"
  input.value = initial
  input.wrap = "off"
  input.spellcheck = false
  apply(input, geometry)
  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    input.remove()
    onClose()
  }
  const commit = (): void => {
    if (closed) return
    const text = input.value
    close()
    onCommit(text)
  }
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Escape") commit()
  })
  input.addEventListener("input", () => apply(input, resize(input.value)))
  input.addEventListener("blur", commit)
  parent.append(input)
  // фокус — после нажатия мыши: по умолчанию mousedown на холсте сразу снимает фокус с поля и закрывает его по blur
  setTimeout(() => {
    if (closed) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  })
  return { commit, close }
}
