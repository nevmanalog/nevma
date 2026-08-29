// Small DOM helpers for the file-backed project actions (open a saved project,
// pick an image to import). Kept framework-free so any panel can call them.

import { loadProjectFromFile } from '@/engine/project'
import { loadImageFile, type ImageSource } from '@/shared/loadImage'

export function openProjectDialog(onDone?: () => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.nevma,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) {
      try {
        await loadProjectFromFile(file)
      } catch (err) {
        console.error(err)
        alert('Could not open project file.')
      }
    }
    onDone?.()
  }
  input.click()
}

export function pickImage(onImage: (source: ImageSource, width: number, height: number) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    loadImageFile(file, onImage)
  }
  input.click()
}
