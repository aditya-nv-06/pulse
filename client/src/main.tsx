import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
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
    </BrowserRouter>
  </StrictMode>,
)
