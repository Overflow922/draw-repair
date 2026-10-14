// Нормализация введённого текста выноски (spec callout «Ввод текста на месте»): \r\n → \n; пустые и пробельные строки
// и пробелы в начале и в конце всего текста отбрасываются; строки внутри текста, в том числе пустые, и пробелы внутри
// строк не меняются. Пустой или пробельный текст — пустая строка.
export function normalizeCalloutText(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n")
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === "") start++
  while (end > start && lines[end - 1].trim() === "") end--
  const kept = lines.slice(start, end)
  if (kept.length === 0) return ""
  kept[0] = kept[0].replace(/^\s+/, "")
  kept[kept.length - 1] = kept[kept.length - 1].replace(/\s+$/, "")
  return kept.join("\n")
}
