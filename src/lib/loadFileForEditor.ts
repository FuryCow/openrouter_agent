import { isImagePath } from './utils'

export async function loadFileForEditor(path: string): Promise<string> {
  if (isImagePath(path)) {
    return window.api.fs.readFileDataUrl(path)
  }
  return window.api.fs.readFile(path)
}
