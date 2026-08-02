import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { IsmPage } from './pages/IsmPage'
import { ResearchPaperPage } from './pages/ResearchPaperPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      {/* Catches stale-chunk failures after a redeploy, which would otherwise
          unmount the whole tree and leave a blank page. */}
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects/:slug" element={<ProjectPage />} />
          <Route path="/research/:slug" element={<ResearchPaperPage />} />
          <Route path="/ism" element={<IsmPage />} />
          <Route path="/ism/:section" element={<IsmPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
      <Analytics />
    </BrowserRouter>
  )
}
