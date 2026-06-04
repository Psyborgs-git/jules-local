import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { HomeView } from './components/home/HomeView'
import { ChatView } from './components/chat/ChatView'
import { SourceHubView } from './components/source/SourceHubView'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomeView />} />
          <Route path="session/:id" element={<ChatView />} />
          <Route path="source/*" element={<SourceHubView />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
