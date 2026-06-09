import { useState } from 'react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen warm-bg">
      <Sidebar />
      {/* Desktop: ml-64, Mobile: ml-0 with top padding for hamburger */}
      <main className="md:ml-64 pt-14 md:pt-0 px-4 pb-4 md:p-8 animate-fade-up">
        {children}
      </main>
    </div>
  )
}