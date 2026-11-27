import SearchBar from "./SearchBar"

const SearchBarCom = () => {
  return (
    <div className=" w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3  sm:flex-row sm:items-center sm:p-4">
        <div className="min-w-0 flex-1">
          <SearchBar />
        </div>
        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            aria-label="Filter by status"
            className="w-full appearance-none mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 pr-10 text-sm font-medium text-neutral-700 outline-none transition hover:border-neutral-300 hover:bg-white focus:border-[#625BF6] focus:bg-white focus:ring-4 focus:ring-[#625BF6]/10"
            defaultValue=""
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="under-review">Under Review</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default SearchBarCom
