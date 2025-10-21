import { Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
export default function AuthGuard({ children }) {
  const user = useSelector(s => s.auth.user)
  const loc = useLocation()
  if (!user) return <Navigate to="/signin" state={{ from: loc }} replace />
  return children
}
