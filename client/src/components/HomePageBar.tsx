const HomePageBar = () => {
  return (
    <div className="flex w-full justify-between border-y border-neutral-400 shadow-sm pb-4">
      <div className="mx-4 mt-4">
        <h2 className="mb-2 font-bold">Features</h2>
        <p className="text-neutral-400">Manage and priortise consumer feedback</p>
      </div>
      <div>
        <button className="mt-4 mx-4 text-sm  bg-[#625BF6] text-white px-1.5 py-1.5 rounded-lg">
          View the board
        </button>
      </div>
    </div>
  )
}

export default HomePageBar
