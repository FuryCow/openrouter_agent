import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { useFileStore } from '@/stores/fileStore'
import type { SkillInfo } from '@/types'
import { cn } from '@/lib/utils'

const SKILL_NAME_RE = /^[a-z0-9-]{1,64}$/

export function SkillsSettings(): React.ReactElement {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [content, setContent] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [statusSuccess, setStatusSuccess] = useState(false)

  const selected = skills.find((s) => s.path === selectedPath) ?? null
  const isProjectSkill = selected?.source === 'project' || (!selected && Boolean(nameDraft))

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.api.skills.list(workingDirectory || undefined)
      setSkills(list)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('skills.loadFailed'))
      setStatusSuccess(false)
    } finally {
      setLoading(false)
    }
  }, [workingDirectory, t])

  useEffect(() => {
    void reload()
  }, [reload])

  const selectSkill = async (skill: SkillInfo): Promise<void> => {
    setSelectedPath(skill.path)
    setNameDraft(skill.name)
    setStatus('')
    try {
      const body = await window.api.skills.read(skill.path)
      setContent(body)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('skills.loadFailed'))
      setStatusSuccess(false)
      setContent('')
    }
  }

  const startNewSkill = (): void => {
    setSelectedPath('')
    setNameDraft('')
    setContent('---\nname: \ndescription: \n---\n')
    setShowEditor(true)
    setStatus('')
  }

  const handleSave = async (): Promise<void> => {
    if (!workingDirectory) return
    const name = nameDraft.trim()
    if (!SKILL_NAME_RE.test(name)) {
      setStatus(t('skills.invalidName'))
      setStatusSuccess(false)
      return
    }
    setSaving(true)
    setStatus('')
    try {
      const path = await window.api.skills.save(workingDirectory, name, content)
      setStatus(t('skills.saved', { path }))
      setStatusSuccess(true)
      await reload()
      const saved: SkillInfo[] = await window.api.skills.list(workingDirectory).catch(() => [])
      const match = saved.find((s) => s.name === name && s.source === 'project')
      if (match) {
        setSelectedPath(match.path)
        setContent(await window.api.skills.read(match.path))
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('skills.saveFailed'))
      setStatusSuccess(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected || selected.source !== 'project') return
    setSaving(true)
    setStatus('')
    try {
      await window.api.skills.delete(selected.path)
      setSelectedPath('')
      setNameDraft('')
      setContent('')
      await reload()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('skills.deleteFailed'))
      setStatusSuccess(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div>
        <p className="text-sm text-zinc-200">{t('skills.title')}</p>
        <p className="text-[11px] text-zinc-500">{t('skills.description')}</p>
      </div>

      {!workingDirectory ? (
        <p className="text-[11px] text-zinc-500">{t('skills.noWorkspace')}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowEditor((open) => !open)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.04]"
          >
            {showEditor ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
            {t('skills.manage')}
            {!loading && skills.length > 0 && (
              <span className="ml-auto text-[10px] text-zinc-500">
                {t('skills.count', { count: skills.length })}
              </span>
            )}
          </button>

          {showEditor && (
            <div className="space-y-3 rounded-lg border border-white/5 bg-black/10 p-3">
              {skills.length === 0 && !loading && (
                <p className="text-[11px] text-zinc-500">{t('skills.empty')}</p>
              )}

              <div className="space-y-1">
                {skills.map((skill) => (
                  <button
                    key={skill.path}
                    type="button"
                    onClick={() => void selectSkill(skill)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                      selectedPath === skill.path
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-100'
                        : 'border-white/5 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.04]'
                    )}
                  >
                    <span className="truncate font-medium">{skill.name}</span>
                    <span className="truncate text-[10px] text-zinc-500">{skill.description}</span>
                    <span
                      className={cn(
                        'ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase',
                        skill.source === 'project'
                          ? 'border-emerald-500/30 text-emerald-300'
                          : 'border-zinc-600/40 text-zinc-500'
                      )}
                    >
                      {skill.source === 'project' ? t('skills.projectBadge') : t('skills.globalBadge')}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={startNewSkill}>
                  {t('skills.newSkill')}
                </Button>
                {selected?.source === 'project' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="text-red-300 hover:text-red-200"
                    disabled={saving}
                    onClick={() => void handleDelete()}
                  >
                    {tCommon('actions.delete')}
                  </Button>
                )}
              </div>

              {(selected || nameDraft !== '') && (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                      {t('skills.name')}
                    </label>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      disabled={Boolean(selected) && selected?.source === 'global'}
                      placeholder={t('skills.namePlaceholder')}
                      className="input-field max-w-xs font-mono text-xs"
                    />
                    {selected?.source === 'global' && (
                      <p className="mt-1 text-[10px] text-zinc-500">{t('skills.readOnlyHint')}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                      {t('skills.content')}
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={10}
                      disabled={Boolean(selected) && selected?.source === 'global'}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-zinc-200"
                    />
                  </div>
                  {isProjectSkill && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving || loading}
                      onClick={() => void handleSave()}
                    >
                      {saving ? tCommon('actions.saving') : t('skills.save')}
                    </Button>
                  )}
                </div>
              )}

              {status && (
                <span className={cn('text-[11px]', statusSuccess ? 'text-emerald-400' : 'text-zinc-500')}>
                  {status}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
