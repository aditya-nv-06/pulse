import { AsyncLocalStorage } from "node:async_hooks"

type BackgroundExecution = { waitUntil: (promise: Promise<unknown>) => void }

const executionContext = new AsyncLocalStorage<BackgroundExecution>()

export const runWithExecutionContext = <T>(context: BackgroundExecution, callback: () => T) =>
  executionContext.run(context, callback)

export const runInBackground = (task: Promise<unknown>, label: string) => {
  const handledTask = task.catch((error) => {
    console.error(label, error)
  })
  const context = executionContext.getStore()
  if (context) context.waitUntil(handledTask)
  else void handledTask
}
