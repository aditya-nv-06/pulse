import { m, useReducedMotion } from "framer-motion"
import LoadingSpinner from "./LoadingSpinner"

const LoadingState = ({ label, error = false }: { label: string; error?: boolean }) => {
  const reduceMotion = useReducedMotion()

  return (
    <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-6" aria-busy={!error}>
      <m.div
        role={error ? "alert" : "status"}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm font-medium text-neutral-600 shadow-sm"
      >
        {!error && <LoadingSpinner />}
        <span>{label}</span>
      </m.div>
    </main>
  )
}

export default LoadingState
