import { m, useReducedMotion } from "framer-motion"

const LoadingSpinner = ({
  className = "h-5 w-5",
  light = false,
}: {
  className?: string
  light?: boolean
}) => {
  const reduceMotion = useReducedMotion()

  return (
    <m.span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-2 ${className}`}
      style={{
        borderColor: light ? "rgba(255,255,255,.4)" : "rgba(98,91,246,.25)",
        borderTopColor: light ? "#fff" : "#625BF6",
      }}
      animate={reduceMotion ? undefined : { rotate: 360 }}
      transition={{ duration: 0.8, ease: "linear", repeat: Infinity }}
    />
  )
}

export default LoadingSpinner
