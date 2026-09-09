export type TaskStepStatus = 'pending' | 'in_progress' | 'done'

export interface TaskChecklistStep {
  text: string
  status: TaskStepStatus
}

export class RunTaskChecklist {
  private steps: TaskChecklistStep[] = []

  clear(): void {
    this.steps = []
  }

  create(rawSteps: string[]): string {
    this.steps = rawSteps
      .map((step) => step.trim())
      .filter(Boolean)
      .map((text) => ({ text, status: 'pending' as const }))

    if (this.steps.length === 0) {
      throw new Error('steps must contain at least one non-empty item')
    }

    return this.format('Task checklist created.')
  }

  update(stepNumber: number, status: TaskStepStatus): string {
    const index = stepNumber - 1
    if (!Number.isInteger(stepNumber) || index < 0 || index >= this.steps.length) {
      throw new Error(`Invalid step number: ${stepNumber}`)
    }

    this.steps[index] = { ...this.steps[index], status }
    return this.format(`Updated step ${stepNumber} to ${status}.`)
  }

  format(header?: string): string {
    const lines = this.steps.map((step, index) => {
      const marker =
        step.status === 'done' ? '[x]' : step.status === 'in_progress' ? '[>]' : '[ ]'
      return `${marker} ${index + 1}. ${step.text}`
    })

    return [header, ...lines].filter(Boolean).join('\n')
  }

  getSteps(): TaskChecklistStep[] {
    return [...this.steps]
  }
}
