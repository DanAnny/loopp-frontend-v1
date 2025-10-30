// src/App.jsx
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './routes'
import { bootstrapAuthThunk } from '@/features/auth/authSlice'

export default function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    // fire-and-forget; do NOT block initial render
    // also wrap in microtask so first paint is uninterrupted
    queueMicrotask(() => dispatch(bootstrapAuthThunk()))
  }, [dispatch])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
    </>
  )
}
