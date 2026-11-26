const SearchBar = () => {
  return (
    <div className="relative mt-4 mx-4 flex text-[#A3A3A3]">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[#A3A3A3]"
        >
          <path d="m21 21-4.34-4.34" />
          <circle cx="11" cy="11" r="8" />
        </svg>
      </div>
      <div className="w-full">
        <input
          type="text"
          placeholder="Search..."
          aria-label="Search"
          className="w-full rounded-xl border border-[#E5E5E1] bg-white py-3 pl-11 pr-4 text-sm text-[#171717] shadow-sm outline-none transition placeholder:text-[#A3A3A3] focus:border-[#A3A3A3] focus:ring-4 focus:ring-[#E5E5E1]"
        />
      </div>
    </div>
  )
}

export default SearchBar
