const PublicCatchBoard = () => {
  return (
    <div className="m-4 w-full flex justify-center border-b border-neutral-200 pb-4 shadow-sm">
      <div className="w-full max-w-4xl text-left">
        <div className="text-base font-medium text-[#625BF6] uppercase">NorthStar Board</div>
        <h1 className="text-3xl font-bold mt-4">What should we build next?</h1>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h4 className="text-neutral-400">
            Share your ideas and vote for the features that matter to you
          </h4>
          <button className="text-white bg-[#625BF6] px-4 py-2 mb-1.5 text-sm rounded-lg">
            Submit Idea
          </button>
        </div>
      </div>
    </div>
  )
}

export default PublicCatchBoard
