import { useState, useMemo, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, LayoutDashboard, Users, Settings, FileText, BarChart3, ChevronLeft, LogOut, Menu, UserPlus,
  MessageSquare, CheckSquare, ClipboardList
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logoutThunk } from '@/features/auth/authSlice';
import { ROLES } from '@/constants/roles';
import { toast } from 'sonner';
import useIsMobile from '@/hooks/useIsMobile';
import ConfirmSignOutModal from '@/components/auth/ConfirmSignOutModal';
import { connectSocket } from '@/lib/socket';

export default function Sidebar({ isOpen, setIsOpen }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showSignout, setShowSignout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile(); // < lg

  const user = useSelector((s) => s.auth.user);
  const userId = user?._id || user?.id;
  const role = (user?.role || '').toLowerCase();

  const itemsByRole = useMemo(() => {
    const commonHome = { icon: Home, label: 'Home', path: '/' };

    // Staff roles allowed full nav
    const STAFF_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.PM, ROLES.ENGINEER];

    // 🔒 Non-staff (clients/guests/unknown): Chat only
    if (!STAFF_ROLES.includes(role)) {
      return [
        { icon: MessageSquare, label: 'Chat', path: '/chat' },
      ];
    }

    if (role === ROLES.SUPERADMIN) {
      return [
        commonHome,
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Users, label: 'View Staffs', path: '/staffs' },
        { icon: UserPlus, label: 'Add Staff', path: '/staffs/new' },
        { icon: FileText, label: 'Management', path: '/management' }, // placeholder hub
        { icon: Settings, label: 'Settings', path: '/settings', comingSoon: true },
      ];
    }

    if (role === ROLES.ADMIN) {
      return [
        commonHome,
        { icon: Users, label: 'View Staffs', path: '/staffs' },
        { icon: UserPlus, label: 'Add Staff', path: '/staffs/new' },
        { icon: FileText, label: 'Documents', path: '/documents' },
        { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      ];
    }

    if (role === ROLES.PM) {
      return [
        commonHome,
        { icon: ClipboardList, label: 'Project Requests', path: '/project-requests' },
        { icon: MessageSquare, label: 'Chat', path: '/chat' },
      ];
    }

    // ENGINEER
    return [
      commonHome,
      { icon: CheckSquare, label: 'My Tasks', path: '/tasks' },
      { icon: MessageSquare, label: 'Chat', path: '/chat' },
    ];
  }, [role]);

  const handleSignOutConfirm = async () => {
    setSigningOut(true);
    try {
      const s = connectSocket(userId);
      s?.emit('auth:logout');         // immediate presence update
      await new Promise((r) => setTimeout(r, 150));

      await dispatch(logoutThunk());
      navigate('/signin', { replace: true });
    } finally {
      setSigningOut(false);
      setShowSignout(false);
    }
  };

  // Close sidebar after navigating (mobile)
  const handleNavClick = useCallback((comingSoon) => {
    if (comingSoon) {
      toast.message('Coming soon', { description: 'This screen is not wired yet.' });
      return;
    }
    if (isMobile) setIsOpen(false);
  }, [isMobile, setIsOpen]);

  // force re-render on route change for active state
  // eslint-disable-next-line no-unused-expressions
  location.pathname;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isOpen ? '280px' : '80px', x: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 flex flex-col shadow-lg"
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <motion.div
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isOpen && (
              <h1 className="text-sidebar-foreground text-lg font-semibold tracking-wide">
                Loopp
              </h1>
            )}
          </motion.div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
            aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <motion.div animate={{ rotate: isOpen ? 0 : 180 }} transition={{ duration: 0.3 }}>
              <ChevronLeft className="w-5 h-5" />
            </motion.div>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-2">
            {itemsByRole.map((item, index) => {
              const Icon = item.icon;
              const disabled = item.comingSoon === true;

              if (disabled) {
                return (
                  <li key={`${item.label}-${index}`}>
                    <button
                      type="button"
                      onClick={() => handleNavClick(true)}
                      className="relative w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 group"
                      onMouseEnter={() => setHoveredItem(index)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <AnimatePresence>
                        {isOpen && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            {item.label}
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-white/10">
                              Coming soon
                            </span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {!isOpen && hoveredItem === index && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute left-full ml-2 px-3 py-2 bg-sidebar-primary text-sidebar-primary-foreground rounded-lg shadow-lg whitespace-nowrap z-50"
                        >
                          {item.label}
                        </motion.div>
                      )}
                    </button>
                  </li>
                );
              }

              return (
                <li key={`${item.label}-${index}`}>
                  <NavLink
                    to={item.path}
                    onClick={() => handleNavClick(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group
                       ${isActive ? 'bg-primary/20 text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`
                    }
                    onMouseEnter={() => setHoveredItem(index)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <AnimatePresence>
                      {isOpen && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!isOpen && hoveredItem === index && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute left-full ml-2 px-3 py-2 bg-sidebar-primary text-sidebar-primary-foreground rounded-lg shadow-lg whitespace-nowrap z-50"
                      >
                        {item.label}
                      </motion.div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sign Out (opens modal) */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => setShowSignout(true)}
            className="relative w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 group"
            onMouseEnter={() => setHoveredItem('signout')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {isOpen && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
            {!isOpen && hoveredItem === 'signout' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-full ml-2 px-3 py-2 bg-sidebar-primary text-sidebar-primary-foreground rounded-lg shadow-lg whitespace-nowrap z-50"
              >
                Sign Out
              </motion.div>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Mobile toggle */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-30 lg:hidden p-2 bg-sidebar rounded-lg shadow-lg text-sidebar-foreground"
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Sign-out modal */}
      <ConfirmSignOutModal
        open={showSignout}
        onCancel={() => setShowSignout(false)}
        onConfirm={handleSignOutConfirm}
        loading={signingOut}
      />
    </>
  );
}
