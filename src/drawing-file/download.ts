// Скачивание текстового файла браузером (change export-import-drawing-file, design D7)
export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
