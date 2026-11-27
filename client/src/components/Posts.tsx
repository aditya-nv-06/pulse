export type Post = {
  id: number
  title: string
  username: string
  status: string
  votes: number
  comments: number
  date: Date
}

const data: Post[] = [
  {
    id: 1,
    title: "Example feature",
    username: "aditya",
    status: "In progress",
    votes: 100,
    comments: 20,
    date: new Date(),
  },
  {
    id: 2,
    title: "Example features",
    username: "karan",
    status: "In progress",
    votes: 200,
    comments: 30,
    date: new Date(),
  },
]

const Posts = () => {
  return (
    <div className="mx-auto my-8 w-full px-4 font-sans text-neutral-800">
      <div className="hidden grid-cols-5 gap-4 rounded-t-xl bg-neutral-100 px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 sm:grid">
        <div>Features</div>
        <div>Status</div>
        <div>Votes</div>
        <div>Comments</div>
        <div>Added</div>
      </div>
      <div className="overflow-hidden rounded-b-xl border border-t-0 border-neutral-200">
        {data.map((d: Post) => (
          <div
            key={d.id}
            className="grid grid-cols-2 items-center gap-3 border-b border-neutral-200 bg-white p-4 last:border-b-0 sm:grid-cols-5 sm:gap-4 sm:p-5"
          >
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <div className="mb-1.5 break-words font-semibold">{d.title}</div>
              <div className="text-sm text-neutral-500">by @{d.username}</div>
            </div>
            <div className="font-medium text-blue-600">
              <span className="mr-1 text-xs font-normal text-neutral-400 sm:hidden">Status</span>
              {d.status}
            </div>
            <div className="text-neutral-600">
              <span className="mr-1 text-xs text-neutral-400 sm:hidden">Votes</span>
              {d.votes}
            </div>
            <div className="text-neutral-600">
              <span className="mr-1 text-xs text-neutral-400 sm:hidden">Comments</span>
              {d.comments}
            </div>
            <div className="text-sm text-neutral-500">
              <span className="mr-1 text-xs text-neutral-400 sm:hidden">Added</span>
              {d.date.toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Posts
