import { useSelector } from 'react-redux'
import { ROLES } from '@/constants/roles'
import PMHome from './PMHome'
import EngineerHomePage from './EngineerHomePage'
import SuperAdminHomePage from './SuperAdminHomePage'
import AdminHomePage from './AdminHomePage'

export default function RoleHome() {
  const user = useSelector((s) => s.auth.user)
  const role = user?.role?.toLowerCase()
  if (role === ROLES.SUPERADMIN) return <SuperAdminHomePage />
  if (role === ROLES.ADMIN)      return <AdminHomePage />
  if (role === ROLES.PM)         return <PMHome />
  if (role === ROLES.ENGINEER)   return <EngineerHomePage />
  return <div>Welcome</div>
}
