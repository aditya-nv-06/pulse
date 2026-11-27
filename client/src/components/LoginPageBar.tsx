import BrandMark from "./BrandMark"
import { Link } from "react-router-dom"

const LoginPageBar = () => {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div className="flex min-w-0">
        <div className="inline-flex items-center gap-2 font-bold">
          <BrandMark />
          Pulse
        </div>
      </div>
      <div className="shrink-0">
        <Link to="/" className="text-neutral-400 underline">
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default LoginPageBar
