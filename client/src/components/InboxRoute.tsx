import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import InboxDashboard from "./InboxDashboard"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 },
  },
})

const InboxRoute = () => (
  <QueryClientProvider client={queryClient}>
    <InboxDashboard />
  </QueryClientProvider>
)

export default InboxRoute
