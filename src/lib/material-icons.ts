import { generateManifest, type Manifest } from 'material-icon-theme'

const manifest = generateManifest({
  activeIconPack: 'react',
  folders: { theme: 'specific' }
})

const iconUrlLoaders = import.meta.glob<string>(
  '../../node_modules/material-icon-theme/icons/*.svg',
  { query: '?url', import: 'default' }
)

const loaderBySvgFile = new Map<string, () => Promise<string>>()

for (const [path, loader] of Object.entries(iconUrlLoaders)) {
  const fileName = path.split('/').pop()
  if (fileName) {
    loaderBySvgFile.set(fileName, loader)
  }
}

const iconUrlCache = new Map<string, string>()

function svgFileNameForIconKey(iconKey: string): string {
  const iconPath = manifest.iconDefinitions?.[iconKey]?.iconPath
  if (!iconPath) return `${iconKey}.svg`

  const fileName = iconPath.split('/').pop()
  return fileName || `${iconKey}.svg`
}

export function resolveFileIconKey(fileName: string): string {
  const lower = fileName.toLowerCase()
  const dotIndex = lower.lastIndexOf('.')
  const extension = dotIndex > 0 ? lower.slice(dotIndex + 1) : ''

  return (
    manifest.fileNames?.[lower] ||
    (extension ? manifest.fileExtensions?.[extension] : undefined) ||
    manifest.file ||
    'file'
  )
}

export function resolveFolderIconKey(folderName: string, isOpen: boolean): string {
  const lower = folderName.toLowerCase()

  if (isOpen) {
    return (
      manifest.folderNamesExpanded?.[lower] ||
      manifest.rootFolderNamesExpanded?.[lower] ||
      manifest.folderExpanded ||
      'folder-open'
    )
  }

  return (
    manifest.folderNames?.[lower] ||
    manifest.rootFolderNames?.[lower] ||
    manifest.folder ||
    'folder'
  )
}

export async function loadMaterialIconUrl(iconKey: string): Promise<string | null> {
  const cached = iconUrlCache.get(iconKey)
  if (cached) return cached

  const svgFileName = svgFileNameForIconKey(iconKey)
  const loader = loaderBySvgFile.get(svgFileName)
  if (!loader) return null

  const url = await loader()
  iconUrlCache.set(iconKey, url)
  return url
}

export function getMaterialIconManifest(): Manifest {
  return manifest
}
