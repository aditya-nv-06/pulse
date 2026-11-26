const SideBar = () => {
  return (
    <div
      className="flex min-h-screen w-64 flex-col justify-between bg-[#171717] p-5 text-white"
      style={{ fontFamily: '"DM Sans", sans-serif' }}
    >
      <div className="space-y-8">
        <div className="text-xl font-bold tracking-tight text-white">logo</div>
        <div className="space-y-3">
          <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
            WorkSpace
          </h4>
          <div className="space-y-1  p-2">
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-[#E5E5E1] transition hover:bg-[#525252]/40 hover:text-white">
              Post
            </button>
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-[#E5E5E1] transition hover:bg-[#525252]/40 hover:text-white">
              Changelog
            </button>
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-[#E5E5E1] transition hover:bg-[#525252]/40 hover:text-white">
              Settings
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-[#525252] pt-4">
        <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 shadow-lg backdrop-blur-md transition hover:border-white/30 hover:bg-white/15">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#171717]">
            U
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">username</p>
            <p className="text-xs text-[#A3A3A3]">Account</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SideBar
