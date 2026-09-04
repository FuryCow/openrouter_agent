import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { useChatStore } from '@/stores/chatStore'

export function ApprovalDialog(): React.ReactElement {
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

  return (
    <Dialog open={Boolean(pendingApproval)} onOpenChange={() => setPendingApproval(null)}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Подтверждение: {pendingApproval?.name}</DialogTitle>
        </DialogHeader>

        {pendingApproval && (
          <div className="mt-4 space-y-4">
            {pendingApproval.preview && (
              <p className="text-sm text-zinc-300">{pendingApproval.preview}</p>
            )}

            <pre className="max-h-48 overflow-auto rounded-md bg-black/40 p-3 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap break-words">
              {pendingApproval.arguments}
            </pre>

            {pendingApproval.diff && (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500">Diff preview</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-black/40 p-3 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap">
                  {pendingApproval.diff}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleResponse(true)}>Approve</Button>
              <Button variant="outline" onClick={() => handleResponse(true, true)}>
                Always allow (session)
              </Button>
              <Button variant="ghost" onClick={() => handleResponse(false)}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
