/* Layout Component - Authentication wrapper container */
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 antialiased selection:bg-[#0B3556] selection:text-white">
      <Outlet />
    </div>
  )
}
