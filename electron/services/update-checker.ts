import { app, net } from 'electron'
import { createWriteStream, createReadStream } from 'node:fs'
import { mkdir, chmod, rename, rm, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { AppSettings } from '../types'

const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/FuryCow/openrouter_agent/releases/latest'
const REQUEST_TIMEOUT_MS = 10_000
const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export interface UpdateAsset {
  name: string
  url: string
  size: number
  /** GitHub API digest (`sha256:<hex>`); missing on older releases. */
  digest?: string
}

export interface UpdateInfo {
  version: string
  releaseUrl: string
  releaseName: string
  releaseNotes: string
  assets: UpdateAsset[]
}

export interface UpdateDownloadProgress {
  version: string
  percent: number
  received: number
  total: number
}

interface GithubRelease {
  tag_name?: unknown
  name?: unknown
  html_url?: unknown
  body?: unknown
  draft?: unknown
  prerelease?: unknown
  assets?: unknown
}

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  pre: Array<string | number>
}

/** Minimal semver parse: `1.2.3` and `1.2.3-alpha.7` (leading `v` tolerated). */
export function parseVersion(raw: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(raw.trim())
  if (!match) return null
  const [, major, minor, patch, pre] = match
  const identifiers = pre
    ? pre.split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id))
    : []
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    pre: identifiers
  }
}

function comparePre(a: Array<string | number>, b: Array<string | number>): number {
  if (a.length === 0 && b.length === 0) return 0
  // No prerelease identifiers = a release, which outranks any prerelease.
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return left < right ? -1 : 1
    } else if (typeof left === 'string' && typeof right === 'string') {
      if (left !== right) return left < right ? -1 : 1
    } else {
      // Numeric identifiers rank below alphanumeric ones (semver rule 11).
      return typeof left === 'number' ? -1 : 1
    }
  }
  return 0
}

/** -1 | 0 | 1 like semver compare; null when either input is not a valid version. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return null
  if (left.major !== right.major) return left.major < right.major ? -1 : 1
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1
  return comparePre(left.pre, right.pre)
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const result = compareVersions(candidate, current)
  return result === 1
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toAssets(value: unknown): UpdateAsset[] {
  if (!Array.isArray(value)) return []
  const assets: UpdateAsset[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const record = raw as Record<string, unknown>
    const name = asString(record.name)
    const url = asString(record.browser_download_url)
    if (!name || !url) continue
    const digest = asString(record.digest)
    assets.push({
      name,
      url,
      size: typeof record.size === 'number' ? record.size : 0,
      ...(digest ? { digest } : {})
    })
  }
  return assets
}

function toUpdateInfo(release: GithubRelease): UpdateInfo | null {
  const version = asString(release.tag_name)
  const url = asString(release.html_url)
  if (!version || !url) return null
  return {
    version,
    releaseUrl: url,
    releaseName: asString(release.name) || version,
    releaseNotes: asString(release.body),
    assets: toAssets(release.assets)
  }
}

/**
 * Picks the installer asset for the current platform and architecture.
 * win32 → NSIS Setup exe, darwin → dmg (arm64 build on Apple Silicon),
 * linux → AppImage. Returns null when the release has no matching asset.
 */
export function pickInstallerAsset(
  assets: UpdateAsset[],
  platform: NodeJS.Platform,
  arch: string
): UpdateAsset | null {
  if (assets.length === 0) return null

  if (platform === 'win32') {
    const exes = assets.filter((asset) => asset.name.toLowerCase().endsWith('.exe'))
    return exes.find((asset) => asset.name.toLowerCase().includes('setup')) ?? exes[0] ?? null
  }

  if (platform === 'darwin') {
    const dmgs = assets.filter((asset) => asset.name.toLowerCase().endsWith('.dmg'))
    const arm64 = dmgs.find((asset) => asset.name.toLowerCase().includes('arm64'))
    const x64 = dmgs.find((asset) => !asset.name.toLowerCase().includes('arm64'))
    if (arch === 'arm64') return arm64 ?? x64 ?? dmgs[0] ?? null
    return x64 ?? arm64 ?? dmgs[0] ?? null
  }

  if (platform === 'linux') {
    return assets.find((asset) => asset.name.toLowerCase().endsWith('.appimage')) ?? null
  }

  return null
}

export interface DownloadProgress {
  received: number
  total: number
  percent: number
}

/** asset name → sha256 hex, parsed from a SHASUMS.txt release asset. */
export type ShasumsMap = Record<string, string>

/**
 * Parses a `sha256sum`-style manifest (`<hex>  <name>` per line, `*` binary
 * marker tolerated). Returns null for anything that does not look like one.
 */
export function parseShasums(text: string): ShasumsMap | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return null
  const map: ShasumsMap = {}
  for (const line of lines) {
    const match = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim())
    if (!match) return null
    map[match[2].trim()] = match[1].toLowerCase()
  }
  return Object.keys(map).length > 0 ? map : null
}

/** Fetches and parses SHASUMS.txt from the release assets, if present. */
export async function loadShasums(assets: UpdateAsset[]): Promise<ShasumsMap | undefined> {
  const shasumsAsset = assets.find(
    (asset) => asset.name.toLowerCase() === 'shasums.txt'
  )
  if (!shasumsAsset) return undefined
  try {
    const response = await net.fetch(shasumsAsset.url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) return undefined
    return parseShasums(await response.text())
  } catch {
    return undefined
  }
}

const DOWNLOAD_ATTEMPTS = 3
const RETRY_DELAY_MS = 300
const DOWNLOAD_STALL_TIMEOUT_MS = 30_000

/** Parses the GitHub API asset digest (`sha256:<hex>`); null for other formats. */
export function parseDigest(
  raw: string
): { algorithm: 'sha256' | 'sha512'; value: string } | null {
  const match = /^(sha256|sha512):([0-9a-fA-F]+)$/.exec(raw.trim())
  if (!match) return null
  const expectedLength = match[1] === 'sha256' ? 64 : 128
  if (match[2].length !== expectedLength) return null
  return { algorithm: match[1] as 'sha256' | 'sha512', value: match[2].toLowerCase() }
}

/** Throws when the file is truncated or fails its GitHub sha256/sha512 digest. */
export async function verifyInstallerFile(
  filePath: string,
  asset: Pick<UpdateAsset, 'size' | 'digest'>
): Promise<void> {
  await verifyInstallerFileDetailed(filePath, asset)
}

export interface VerificationResult {
  ok: boolean
  /** 'digest' = verified against the API digest; 'stable-bytes' = two independent
   *  downloads produced identical bytes that disagree with the digest (stale
   *  GitHub digest after asset re-upload); 'size-only' = no digest available. */
  mode: 'digest' | 'stable-bytes' | 'size-only'
  actualHash?: string
  expectedHash?: string
}

async function hashFile(algorithm: 'sha256' | 'sha512', filePath: string): Promise<string> {
  const hash = createHash(algorithm)
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

/**
 * Verifies the downloaded installer. On a digest mismatch the file is
 * re-downloaded once through an independent request: identical bytes across
 * two downloads that still disagree with the API digest prove the digest
 * itself is stale (a known GitHub artifact when release assets are
 * re-uploaded/overwritten) — the file is accepted with mode 'stable-bytes'.
 * Differing bytes across downloads indicate transport corruption and throw.
 */
export async function verifyInstallerFileDetailed(
  filePath: string,
  asset: Pick<UpdateAsset, 'size' | 'digest'>,
  redownload?: (destPath: string) => Promise<void>
): Promise<VerificationResult> {
  const stats = await stat(filePath)
  if (asset.size > 0 && stats.size !== asset.size) {
    throw new Error(`Downloaded file is incomplete: expected ${asset.size} bytes, got ${stats.size}`)
  }
  const digest = parseDigest(asset.digest ?? '')
  if (!digest) return { ok: true, mode: 'size-only' }

  const actual = await hashFile(digest.algorithm, filePath)
  if (actual === digest.value) {
    return { ok: true, mode: 'digest', actualHash: actual, expectedHash: digest.value }
  }

  // Ironclad disambiguation: fetch the same asset again independently and
  // compare bytes. Stable bytes + wrong digest = stale API digest, not a
  // corrupted download.
  const secondPath = `${filePath}.verify`
  try {
    if (redownload) {
      await redownload(secondPath)
    } else {
      await downloadOnce(asset as UpdateAsset, secondPath, () => {})
    }
    const second = await hashFile(digest.algorithm, secondPath)
    if (second === actual) {
      console.error(
        `[Updates] Digest mismatch with STABLE bytes — API digest is stale. ` +
          `asset=${asset.name} expected=${digest.algorithm}:${digest.value} ` +
          `actual=${actual} second=${second}`
      )
      return {
        ok: true,
        mode: 'stable-bytes',
        actualHash: actual,
        expectedHash: digest.value
      }
    }
    console.error(
      `[Updates] Digest mismatch with UNSTABLE bytes — transport corruption. ` +
        `asset=${asset.name} expected=${digest.algorithm}:${digest.value} ` +
        `first=${actual} second=${second}`
    )
    throw new Error(
      `Checksum mismatch (unstable transport): expected ${digest.algorithm} ${digest.value}, ` +
        `got ${actual} then ${second} on an independent re-download`
    )
  } finally {
    await rm(secondPath, { force: true }).catch(() => {})
  }
}

async function downloadOnce(
  asset: UpdateAsset,
  destPath: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  const controller = new AbortController()
  let stallTimer: ReturnType<typeof setTimeout> | null = null
  const armStallTimer = (): void => {
    if (stallTimer) clearTimeout(stallTimer)
    stallTimer = setTimeout(() => controller.abort(), DOWNLOAD_STALL_TIMEOUT_MS)
  }
  armStallTimer()
  try {
    const response = await net.fetch(asset.url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`)
    }
    const total = Number(response.headers.get('content-length')) || asset.size
    let received = 0
    let lastReportedPercent = -1

    const source = Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream<Uint8Array>
    )
    source.on('data', (chunk: Buffer) => {
      armStallTimer()
      received += chunk.length
      const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0
      if (percent !== lastReportedPercent) {
        lastReportedPercent = percent
        onProgress({ received, total, percent })
      }
    })

    await pipeline(source, createWriteStream(destPath))
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Download stalled: no data for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s`)
    }
    throw err
  } finally {
    if (stallTimer) clearTimeout(stallTimer)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Downloads the asset into a temp dir, reporting progress; returns the file path.
 * Bytes stream into `<name>.part`, the result is verified against the asset size
 * and digest, and only then renamed into place — truncated or corrupted
 * downloads are retried instead of launched (NSIS answers those with
 * "Installer integrity check has failed").
 *
 * Digest source priority: SHASUMS.txt published with the release (generated by
 * our CI from the exact uploaded bytes) > GitHub API asset digest (known to go
 * stale when assets are re-uploaded). When the API digest disagrees with
 * byte-stable downloads, the file is accepted with mode 'stable-bytes'.
 */
export async function downloadInstaller(
  asset: UpdateAsset,
  onProgress: (progress: DownloadProgress) => void,
  shasums?: ShasumsMap
): Promise<string> {
  const dir = join(tmpdir(), 'openrouter-agent-update')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, asset.name)
  const partPath = `${filePath}.part`

  // Prefer our own CI-generated checksum over the GitHub API digest.
  const shasumsEntry = shasums?.[asset.name]
  const effectiveAsset: UpdateAsset = shasumsEntry
    ? { ...asset, digest: `sha256:${shasumsEntry}` }
    : asset

  let lastError: unknown
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      await downloadOnce(asset, partPath, onProgress)
      const verification = await verifyInstallerFileDetailed(partPath, effectiveAsset)
      if (verification.mode === 'stable-bytes') {
        // Trusted by the byte-stability proof; skip further retries.
        await rm(filePath, { force: true })
        await rename(partPath, filePath)
        if (process.platform !== 'win32') {
          await chmod(filePath, 0o755).catch(() => {})
        }
        return filePath
      }
      await rm(filePath, { force: true })
      await rename(partPath, filePath)
      if (process.platform !== 'win32') {
        // AppImage needs the executable bit to open via shell.openPath.
        await chmod(filePath, 0o755).catch(() => {})
      }
      return filePath
    } catch (err) {
      lastError = err
      await rm(partPath, { force: true }).catch(() => {})
      if (attempt < DOWNLOAD_ATTEMPTS) await delay(RETRY_DELAY_MS * attempt)
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Installer download failed after ${DOWNLOAD_ATTEMPTS} attempts: ${message}`)
}

export interface UpdateCheckResult {
  update: UpdateInfo | null
  currentVersion: string
  checkedAt: string
  error?: string
}

export class UpdateChecker {
  private lastResult: UpdateCheckResult | null = null
  private lastCheckAt = 0
  private inFlight: Promise<UpdateCheckResult> | null = null

  constructor(private readonly fetchLatest: () => Promise<UpdateInfo | null> = fetchLatestRelease) {}

  /**
   * Checks GitHub for a newer release. Results are cached for the recheck
   * interval; concurrent calls share one in-flight request.
   */
  async check(currentVersion: string, force = false): Promise<UpdateCheckResult> {
    const now = Date.now()
    if (
      !force &&
      this.lastResult &&
      now - this.lastCheckAt < RECHECK_INTERVAL_MS &&
      this.lastResult.currentVersion === currentVersion
    ) {
      return this.lastResult
    }
    if (this.inFlight) return this.inFlight

    this.inFlight = this.fetchLatest()
      .then((update) => {
        const result: UpdateCheckResult = {
          update:
            update && isNewerVersion(update.version, currentVersion) ? update : null,
          currentVersion,
          checkedAt: new Date().toISOString()
        }
        this.lastResult = result
        this.lastCheckAt = Date.now()
        return result
      })
      .catch((err: unknown) => {
        const result: UpdateCheckResult = {
          update: null,
          currentVersion,
          checkedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err)
        }
        // Network failures are not cached — retry on the next check.
        this.inFlight = null
        throw err
      })
      .finally(() => {
        this.inFlight = null
      })

    return this.inFlight
  }

  /** Cached result without a network round-trip (for renderer re-mounts). */
  getCached(currentVersion: string): UpdateInfo | null {
    if (!this.lastResult || this.lastResult.currentVersion !== currentVersion) return null
    return this.lastResult.update
  }
}

async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  const response = await net.fetch(GITHUB_LATEST_RELEASE_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new Error(`GitHub API responded ${response.status}`)
  }
  const release = (await response.json()) as GithubRelease
  if (release.draft === true) return null
  return toUpdateInfo(release)
}

/** Runs the startup check unless the user disabled update notifications. */
export function scheduleStartupUpdateCheck(
  checker: UpdateChecker,
  getSettings: () => AppSettings,
  notify: (update: UpdateInfo) => void
): () => void {
  const settings = getSettings()
  if (settings.updateNotificationsEnabled === false) return () => {}

  const run = (): void => {
    const current = app.getVersion()
    void checker
      .check(current)
      .then((result) => {
        if (result.update) notify(result.update)
      })
      .catch((err: unknown) => {
        console.error('[Updates] Check failed:', err)
      })
  }

  setTimeout(run, 15_000)
  // Long-running sessions: re-check periodically (checker caches per interval).
  const timer = setInterval(run, RECHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}

export function shouldNotifyForUpdate(
  update: UpdateInfo,
  settings: Pick<AppSettings, 'updateNotificationsEnabled' | 'updateNotificationDismissedFor'>
): boolean {
  if (settings.updateNotificationsEnabled === false) return false
  return settings.updateNotificationDismissedFor !== update.version
}
