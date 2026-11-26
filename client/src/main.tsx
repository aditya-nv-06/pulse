import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion"
import Login from "./components/Login.tsx"
import PublicBoard from "./components/PublicBoard.tsx"
import Changelog from "./components/Changelog.tsx"
import MainPage from "./components/MainPage.tsx"
import PostDetail from "./components/PostDetail.tsx"
import PostsDashboard from "./components/PostsDashboard.tsx"
import IntegrationsDashboard from "./components/IntegrationsDashboard.tsx"
import MeetingsDashboard from "./components/MeetingsDashboard.tsx"
import AnalyticsDashboard from "./components/AnalyticsDashboard.tsx"
import ChangelogDashboard from "./components/ChangelogDashboard.tsx"
import Payment from "./components/Payment.tsx"
import Blueprint from "./components/Blueprint.tsx"

const AppRoutes = () => {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<MainPage />} />
          <Route path="/home" element={<Navigate to="/dashboard/posts" replace />} />
          <Route path="/dashboard/posts" element={<PostsDashboard />} />
          <Route path="/dashboard/integrations" element={<IntegrationsDashboard />} />
          <Route path="/dashboard/meetings" element={<MeetingsDashboard />} />
          <Route path="/dashboard/analytics" element={<AnalyticsDashboard />} />
          <Route path="/dashboard/posts/:postId" element={<PostDetail />} />
          <Route path="/dashboard/changelog" element={<ChangelogDashboard />} />
          <Route path="/dashboard/blueprint" element={<Blueprint />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/login" element={<Login />} />
          <Route path="/board/:slug" element={<PublicBoard />} />
          <Route path="/changelog/:slug" element={<Changelog />} />
        </Routes>
      </m.div>
    </AnimatePresence>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LazyMotion>
  </StrictMode>,
)
