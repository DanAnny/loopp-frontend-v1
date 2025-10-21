// src/App.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './routes'
import { bootstrapAuthThunk } from '@/features/auth/authSlice'

export default function App() {
  const dispatch = useDispatch()
  const token = useSelector((s) => s.auth.accessToken)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // If there’s already a token (rehydrated by PersistGate), this returns quickly.
      await dispatch(bootstrapAuthThunk())
      if (mounted) setBooted(true)
    })()
    return () => { mounted = false }
  }, [dispatch])

  // Show a minimalist splash only when we have no token yet AND bootstrap hasn’t finished.
  if (!token && !booted) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm opacity-80">
          <span className="h-2 w-2 rounded-full animate-pulse bg-foreground/60" />
          <span>Starting up…</span>
        </div>
        <Toaster richColors closeButton />
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
    </>
  )
}
