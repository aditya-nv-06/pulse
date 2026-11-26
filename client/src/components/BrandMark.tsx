type BrandMarkProps = { className?: string }

const BrandMark = ({ className = "" }: BrandMarkProps) => (
  <img src="/favicon.svg" alt="" aria-hidden="true" className={`size-7 shrink-0 ${className}`} />
)

export default BrandMark
