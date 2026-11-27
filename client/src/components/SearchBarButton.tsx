const SearchBarButton = () => {
  return (
    <div className="flex  justify-end gap-4  mt-2 bg-white p-3 ">
      <div>
        <select
          className="appearance-none rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 pr-10 text-sm font-medium text-neutral-700 outline-none transition focus:border-[#625BF6] focus:ring-2 focus:ring-[#625BF6]/20"
          defaultValue="All Status"
        >
          <option>All Status</option>
          <option>Open</option>
          <option>Completed</option>
          <option>In Progress</option>
          <option>Under Review</option>
        </select>
      </div>
      <div>
        <button className="rounded-lg bg-[#625BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#625BF6] focus:outline-none focus:ring-2 focus:ring-[#625BF6]/40 focus:ring-offset-2">
          New Post
        </button>
      </div>
    </div>
  )
}

export default SearchBarButton
