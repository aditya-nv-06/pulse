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
      <div className="grid grid-cols-5 gap-4 rounded-t-xl bg-neutral-100 px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
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
            className="grid grid-cols-5 items-center gap-4 border-b border-neutral-200 bg-white p-5 last:border-b-0"
          >
            <div>
              <div className="mb-1.5 font-semibold">{d.title}</div>
              <div className="text-sm text-neutral-500">by @{d.username}</div>
            </div>
            <div className="font-medium text-blue-600">{d.status}</div>
            <div className="text-neutral-600">{d.votes}</div>
            <div className="text-neutral-600">{d.comments}</div>
            <div className="text-sm text-neutral-500">{d.date.toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Posts
