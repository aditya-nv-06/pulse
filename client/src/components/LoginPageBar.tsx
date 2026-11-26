import BrandMark from "./BrandMark"
import { Link } from "react-router-dom"

const LoginPageBar = () => {
  return (
    <div className="flex justify-between">
      <div className="flex m-4">
        <div className="mt -4 mx-4 inline-flex items-center gap-2 font-bold">
          <BrandMark />
          Pulse
        </div>
      </div>
      <div className="mt-4 mx-4">
        <Link to="/" className="text-neutral-400 underline">
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default LoginPageBar
