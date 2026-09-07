import type { editor, IMarkdownString, Marker, Uri, IDisposable, Position } from 'monaco-editor'
import { buildResolveInChatPrompt, type ResolveInChatPayload } from './resolveInChatPrompt'
import { useUiStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'

export const RESOLVE_IN_CHAT_COMMAND_ID = 'openrouterAgent.resolveInChat'

const DIAGNOSTIC_LANGUAGES = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']

let setupDone = false

function configureTypeScriptLanguage(monaco: typeof import('monaco-editor')): void {
  const compilerOptions: import('monaco-editor').languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    allowJs: true,
    strict: false,
    skipLibCheck: true,
    jsx: monaco.languages.typescript.JsxEmit.React
  }

  for (const defaults of [
    monaco.languages.typescript.typescriptDefaults,
    monaco.languages.typescript.javascriptDefaults
  ]) {
    defaults.setCompilerOptions(compilerOptions)
    defaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    })
    defaults.setEagerModelSync(true)
  }

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `declare var Buffer: {
  from(input: string, encoding?: string): { toString(encoding?: string): string };
  from(input: Uint8Array): Uint8Array;
  isBuffer(value: unknown): value is unknown;
};
declare var process: { env: Record<string, string | undefined> };`,
    'file:///node-globals.d.ts'
  )
}

function buildPayload(model: editor.ITextModel, marker: Marker): ResolveInChatPayload {
  const line = marker.startLineNumber
  const column = marker.startColumn
  return {
    filePath: decodeModelPath(model.uri),
    line,
    column,
    message: marker.message,
    lineText: model.getLineContent(line)
  }
}

function decodeModelPath(uri: Uri): string {
  if (uri.scheme === 'file') {
    return decodeURIComponent(uri.path.replace(/^\/([A-Za-z]:)/, '$1'))
  }
  return uri.path
}

function findMarkerAt(
  monaco: typeof import('monaco-editor'),
  model: editor.ITextModel,
  position: Position
): Marker | undefined {
  return monaco.editor
    .getModelMarkers({ resource: model.uri })
    .find(
      (marker) =>
        position.lineNumber >= marker.startLineNumber &&
        position.lineNumber <= marker.endLineNumber &&
        (position.lineNumber !== marker.startLineNumber || position.column >= marker.startColumn) &&
        (position.lineNumber !== marker.endLineNumber || position.column <= marker.endColumn)
    )
}

function dispatchResolveInChat(payload: ResolveInChatPayload): void {
  useChatStore.getState().setChatMode('agent')
  useUiStore.getState().requestChatDraft(buildResolveInChatPrompt(payload))
}

function resolveInChatLink(
  monaco: typeof import('monaco-editor'),
  payload: ResolveInChatPayload
): IMarkdownString {
  const args = encodeURIComponent(JSON.stringify([payload]))
  return {
    value: `[Resolve in Chat](command:${RESOLVE_IN_CHAT_COMMAND_ID}?${args})`,
    isTrusted: true,
    supportHtml: false
  }
}

function registerResolveInChat(monaco: typeof import('monaco-editor')): void {
  monaco.editor.registerCommand(RESOLVE_IN_CHAT_COMMAND_ID, (_accessor, payload?: ResolveInChatPayload) => {
    if (!payload?.message) return
    dispatchResolveInChat(payload)
  })

  for (const language of DIAGNOSTIC_LANGUAGES) {
    monaco.languages.registerCodeActionProvider(language, {
      provideCodeActions(model, _range, context) {
        const markers =
          context.markers.length > 0
            ? context.markers
            : monaco.editor.getModelMarkers({ resource: model.uri })

        const actions = markers.map((marker) => {
          const payload = buildPayload(model, marker)
          return {
            title: 'Resolve in Chat',
            kind: monaco.languages.CodeActionKind.QuickFix,
            isPreferred: true,
            command: {
              id: RESOLVE_IN_CHAT_COMMAND_ID,
              title: 'Resolve in Chat',
              arguments: [payload]
            }
          }
        })

        return { actions, dispose: () => {} }
      }
    })

    monaco.languages.registerHoverProvider(language, {
      provideHover(model, position) {
        const marker = findMarkerAt(monaco, model, position)
        if (!marker) return null

        const payload = buildPayload(model, marker)
        return {
          range: new monaco.Range(
            marker.startLineNumber,
            marker.startColumn,
            marker.endLineNumber,
            marker.endColumn
          ),
          contents: [resolveInChatLink(monaco, payload)]
        }
      }
    })
  }
}

export function registerResolveInChatEditorActions(
  editorInstance: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor')
): IDisposable {
  return editorInstance.addAction({
    id: 'openrouterAgent.resolveInChat.context',
    label: 'Resolve in Chat',
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 0.5,
    run: (ed) => {
      const model = ed.getModel()
      const position = ed.getPosition()
      if (!model || !position) return
      const marker = findMarkerAt(monaco, model, position)
      if (!marker) return
      dispatchResolveInChat(buildPayload(model, marker))
    }
  })
}

export function setupMonacoEditorFeatures(monaco: typeof import('monaco-editor')): void {
  if (setupDone) return
  setupDone = true
  configureTypeScriptLanguage(monaco)
  registerResolveInChat(monaco)
}
