export interface KeyboardShortcut {
  keys: string
  description: string
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: 'Enter', description: 'Отправить сообщение в чате' },
  { keys: 'Shift + Enter', description: 'Новая строка в поле ввода' },
  { keys: 'Ctrl + S', description: 'Сохранить текущий файл' },
  { keys: 'Ctrl + P', description: 'Быстрое открытие файла' },
  { keys: 'Ctrl + L', description: 'Настройки' },
  { keys: 'Ctrl + `', description: 'Показать / скрыть терминал' },
  { keys: 'Ctrl + /', description: 'Список горячих клавиш' }
]
