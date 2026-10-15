import { CHAR_WIDTH } from "../doorway/element-label"

// Перенос текста по пробелам в заданную ширину листа (общий для таблицы экспликации и блока примечаний): ширина строки
// оценивается как число символов × кегль × CHAR_WIDTH; слово, не помещающееся целиком, разбивается по символам.
// Пустой текст даёт одну пустую строку.

export function wrapText(text: string, widthMm: number, fontMm: number): string[] {
  const textWidthMm = (s: string): number => s.length * fontMm * CHAR_WIDTH
  const lines: string[] = []
  let current = ""
  const push = (): void => {
    if (current !== "") lines.push(current)
    current = ""
  }
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    let rest = word
    while (textWidthMm(rest) > widthMm) {
      let cut = rest.length - 1
      while (cut > 1 && textWidthMm(rest.slice(0, cut)) > widthMm) cut--
      if (current !== "") push()
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    if (current === "") current = rest
    else if (textWidthMm(`${current} ${rest}`) <= widthMm) current = `${current} ${rest}`
    else {
      push()
      current = rest
    }
  }
  push()
  return lines.length > 0 ? lines : [""]
}
