import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { IsmPage } from './pages/IsmPage'
import { ResearchPaperPage } from './pages/ResearchPaperPage'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:slug" element={<ProjectPage />} />
        <Route path="/research/:slug" element={<ResearchPaperPage />} />
        <Route path="/ism" element={<IsmPage />} />
        <Route path="/ism/:section" element={<IsmPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}
