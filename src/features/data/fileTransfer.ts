// Browser helpers for the data page: save a JSON string as a file the user can keep,
// and read a file the user picked so its text can be imported.

/** Largest file the import accepts. Export files are small, so anything bigger is a mistake. */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024

/**
 * Saves text as a file by clicking a temporary download link.
 * The browser decides where the file goes, usually its downloads folder.
 */
export function downloadTextFile(
  fileName: string,
  text: string,
  mimeType = 'application/json',
): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Give the browser a moment to start the download before the address is released.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Reads a file the user chose as text. Rejects with an Error whose message can be
 * shown as it is when the file is too big or cannot be read.
 */
export function readFileAsText(file: File): Promise<string> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    const limit = Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))
    return Promise.reject(
      new Error(`The file is too large to import (the limit is ${limit} MB).`),
    )
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('The file could not be read as text.'))
      }
    }
    reader.onerror = () => {
      reject(new Error(`The file "${file.name}" could not be read.`))
    }
    reader.onabort = () => {
      reject(new Error('Reading the file was cancelled.'))
    }
    reader.readAsText(file)
  })
}