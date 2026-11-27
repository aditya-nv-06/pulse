const HomePageBar = () => {
  return (
    <div className="flex w-full flex-col justify-between gap-3 border-y border-neutral-400 px-4 pb-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
      <div className="mt-4 min-w-0">
        <h2 className="mb-2 font-bold">Features</h2>
        <p className="text-neutral-400">Manage and priortise consumer feedback</p>
      </div>
      <div>
        <button className="rounded-lg bg-[#625BF6] px-3 py-2 text-sm text-white sm:mx-4 sm:mt-4">
          View the board
        </button>
      </div>
    </div>
  )
}

export default HomePageBar
