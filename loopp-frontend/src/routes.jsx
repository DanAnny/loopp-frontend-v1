// src/router.jsx
import { createBrowserRouter } from 'react-router-dom'
import Shell from '@/components/layout/Shell'
import AuthGuard from '@/features/auth/components/AuthGuard'
import SignIn from '@/features/auth/pages/SignIn'
import SignUp from '@/features/auth/pages/SignUp'
import RoleHome from '@/features/home/RoleHome'
import ComingSoon from '@/components/ComingSoon'
import EngineerTasks from './features/tasks/pages/EngineerTasks'
import Room from './features/chat/pages/Room'
import Projects from './features/projects/pages/Projects'
import SuperAdminDashboardFull from './features/dashboard/pages/Overview'
import AddStaff from './features/users/pages/AddStaff'
import StaffDirectory from './features/users/pages/UsersList'
import Management from './features/users/pages/Management'
import AdminAnalytics from './features/dashboard/pages/Analytics'
import ClientChat from './features/chat/pages/ClientChat'
import ClientSignUp from './features/auth/pages/ClientSignUp'
import ClientSignIn from './features/auth/pages/ClientSignIn'

const Text = ({ title }) => (
  <div className="p-2">
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className="text-muted-foreground mt-2">This is the {title} page.</p>
  </div>
)

export const router = createBrowserRouter([
  // ---------- Public / Auth ----------
  { path: '/signin', element: <SignIn /> },
  { path: '/signup', element: <SignUp /> },
  { path: '/client-sign-up', element: <ClientSignUp /> },
  { path: '/client-sign-in', element: <ClientSignIn /> },

  // ---------- Chat pages OUTSIDE Shell, BUT protected ----------
  // Staff/Member room chat (no navbar/sidebar)
  { path: '/chat', element: <AuthGuard><Room /></AuthGuard> },

  // Client chat (no navbar/sidebar) — authenticated required
  { path: '/client-chat', element: <ClientChat /> },
  { path: '/client-chat/:clientKey', element: <ClientChat /> },

  // ---------- App routes INSIDE Shell ----------
  {
    path: '/',
    element: (
      <AuthGuard>
        <Shell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <RoleHome /> },

      // SuperAdmin
      { path: 'dashboard', element: <SuperAdminDashboardFull /> },
      { path: 'staffs', element: <StaffDirectory /> },
      { path: 'staffs/new', element: <AddStaff /> },
      { path: 'management', element: <Management/> },
      { path: 'settings', element: <ComingSoon title="Settings" note="This screen is not wired yet." /> },

      // Admin
      { path: 'documents', element: <Text title="Documents" /> },
      { path: 'analytics', element: <AdminAnalytics /> },

      // PM
      { path: 'project-requests', element: <Projects /> },
      { path: 'performance', element: <Text title="My Performance" /> },

      // Engineer
      { path: 'tasks', element: <EngineerTasks /> },

      // Shared
      { path: 'profile', element: <Text title="Profile" /> },

      // The standalone /chat route above is the one without navbar/sidebar.)
      { path: 'chat/:roomId', element: <Text title="Chat Room" /> },
    ],
  },
])
