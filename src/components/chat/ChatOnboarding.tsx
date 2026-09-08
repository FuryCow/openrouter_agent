import { useTranslation } from 'react-i18next'
import { Check, Circle, KeyRound, FolderOpen, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settingsStore'
import { useWorkspace } from '@/hooks/useWorkspace'
import { cn } from '@/lib/utils'

export function ChatOnboarding(): React.ReactElement {
  const { t } = useTranslation('chat')
  const settings = useSettingsStore((s) => s.settings)
  const models = useSettingsStore((s) => s.models)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const { workingDirectory, openFolderPicker } = useWorkspace()

  const hasApiKey = Boolean(settings.apiKey?.trim())
  const hasFolder = Boolean(workingDirectory)
  const hasModel = Boolean(settings.model && models.some((m) => m.id === settings.model))
  const allDone = hasApiKey && hasFolder && hasModel

  const steps = [
    {
      id: 'api',
      done: hasApiKey,
      title: t('onboarding.apiKey.title'),
      description: t('onboarding.apiKey.description'),
      action: () => setSettingsOpen(true),
      actionLabel: t('onboarding.apiKey.action'),
      icon: KeyRound
    },
    {
      id: 'folder',
      done: hasFolder,
      title: t('onboarding.folder.title'),
      description: t('onboarding.folder.description'),
      action: () => void openFolderPicker(),
      actionLabel: t('onboarding.folder.action'),
      icon: FolderOpen
    },
    {
      id: 'model',
      done: hasModel,
      title: t('onboarding.model.title'),
      description: t('onboarding.model.description'),
      action: () => setSettingsOpen(true),
      actionLabel: t('onboarding.model.action'),
      icon: Sparkles
    }
  ]

  return (
    <div className="mx-auto w-full max-w-sm text-left">
      <h3 className="text-sm font-medium text-zinc-200">{t('onboarding.title')}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        {allDone ? t('onboarding.allDone') : t('onboarding.incomplete')}
      </p>

      <ul className="mt-4 space-y-3">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <li key={step.id} className="flex gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                  step.done
                    ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                    : 'bg-white/5 text-zinc-500 ring-white/10'
                )}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-300">{step.title}</span>
                  {!step.done && <Circle className="h-2 w-2 fill-amber-400 text-amber-400" />}
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-600">{step.description}</p>
                {!step.done && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-2 text-[11px] text-indigo-300 hover:text-indigo-200"
                    onClick={step.action}
                  >
                    {step.actionLabel}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
