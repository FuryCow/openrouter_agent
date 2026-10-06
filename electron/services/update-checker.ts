import { app, net } from 'electron'
import type { AppSettings } from '../types'

const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/FuryCow/openrouter_agent/releases/latest'
const REQUEST_TIMEOUT_MS = 10_000
const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export interface UpdateInfo {
  version: string
  releaseUrl: string
  releaseName: string
  releaseNotes: string
}

interface GithubRelease {
  tag_name?: unknown
  name?: unknown
  html_url?: unknown
  body?: unknown
  draft?: unknown
  prerelease?: unknown
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

function toUpdateInfo(release: GithubRelease): UpdateInfo | null {
  const version = asString(release.tag_name)
  const url = asString(release.html_url)
  if (!version || !url) return null
  return {
    version,
    releaseUrl: url,
    releaseName: asString(release.name) || version,
    releaseNotes: asString(release.body)
  }
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
