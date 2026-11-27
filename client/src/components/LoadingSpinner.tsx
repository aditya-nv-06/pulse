const LoadingSpinner = ({
  className = "h-5 w-5",
  light = false,
}: {
  className?: string
  light?: boolean
}) => {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none ${className}`}
      style={{
        borderColor: light ? "rgba(255,255,255,.4)" : "rgba(98,91,246,.25)",
        borderTopColor: light ? "#fff" : "#625BF6",
      }}
    />
  )
}

export default LoadingSpinner
