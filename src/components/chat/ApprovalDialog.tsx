import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { useChatStore } from '@/stores/chatStore'
import { DiffView } from './DiffView'
import { FilePathLink } from './FilePathLink'

export function ApprovalDialog(): React.ReactElement {
  const { t } = useTranslation('chat')
  const { t: tc } = useTranslation('common')
  const pendingApproval = useChatStore((s) => s.pendingApproval)
  const setPendingApproval = useChatStore((s) => s.setPendingApproval)

  const handleResponse = async (approved: boolean, alwaysAllow = false): Promise<void> => {
    if (!pendingApproval) return
    if (alwaysAllow && approved) {
      await window.api.agent.setSessionAutoApprove(pendingApproval.name)
    }
    await window.api.agent.approve(pendingApproval.id, approved)
    setPendingApproval(null)
  }

  const showDiff = Boolean(pendingApproval?.fileDiff || pendingApproval?.diff)

  return (
    <Dialog
      open={Boolean(pendingApproval)}
      onOpenChange={(open) => {
        if (!open && pendingApproval) void handleResponse(false)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-2">
            <span>{t('approval.title', { toolName: pendingApproval?.name ?? '' })}</span>
            {pendingApproval?.filePath && (
              <>
                <span className="font-normal text-zinc-500">·</span>
                <FilePathLink
                  path={pendingApproval.filePath}
                  className="text-sm font-normal"
                  fileDiff={pendingApproval.fileDiff}
                />
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {pendingApproval && (
          <div className="mt-4 space-y-4">
            {pendingApproval.preview && (
              <p className="text-sm text-zinc-300">{pendingApproval.preview}</p>
            )}

            {showDiff ? (
              <DiffView
                fileDiff={pendingApproval.fileDiff}
                diff={pendingApproval.diff}
              />
            ) : (
              <pre className="max-h-48 overflow-auto rounded-md bg-black/40 p-3 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap break-words">
                {pendingApproval.arguments}
              </pre>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleResponse(true)}>{tc('actions.approve')}</Button>
              <Button variant="outline" onClick={() => handleResponse(true, true)}>
                {t('approval.alwaysAllowSession')}
              </Button>
              <Button variant="ghost" onClick={() => handleResponse(false)}>
                {tc('actions.reject')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
