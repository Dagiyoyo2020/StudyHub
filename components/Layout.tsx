
import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../constants';
import { supabase } from '../services/supabaseClient';
import { LogOut, Home, LayoutDashboard, Calendar, Layers, MessageSquare, PieChart, User, NotebookPen, PanelLeftClose, PanelLeftOpen, Swords, Users, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, active, collapsed, onClick }: { to: string; icon: any; label: string; active: boolean, collapsed: boolean, onClick?: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    title={collapsed ? label : ''}
    className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl transition-all duration-300 group ${
      active 
        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon size={20} className={`${active ? 'text-purple-400' : 'text-slate-500 group-hover:text-white'} ${collapsed ? '' : 'mr-3'}`} />
    {!collapsed && <span className="font-medium whitespace-nowrap overflow-hidden">{label}</span>}
  </Link>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === AppRoutes.AUTH;
  const isLandingPage = location.pathname === AppRoutes.HOME;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine if the current page should be full width (no padding/container)
  // Added NOTES to this list
  const isFullWidthPage = location.pathname === AppRoutes.CHAT || location.pathname === AppRoutes.SOCIAL || location.pathname === AppRoutes.NOTES;

  // Sync Profile Email for Searchability
  useEffect(() => {
    const syncProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single();
        if (!profile || profile.email !== user.email) {
            await supabase.from('profiles').upsert({ 
                id: user.id, 
                email: user.email,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
        }
      }
    };
    if (!isAuthPage && !isLandingPage) {
        syncProfile();
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(AppRoutes.HOME);
  };

  if (isAuthPage || isLandingPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen overflow-hidden relative bg-[#030712] text-slate-200">
      
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-[#0f172a] border-r border-white/10 z-50 flex flex-col p-4 md:hidden shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 px-2">
                 <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">StudyHub</h1>
                 <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={24}/></button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                  <NavItem to={AppRoutes.DASHBOARD} icon={LayoutDashboard} label="Dashboard" active={location.pathname === AppRoutes.DASHBOARD} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.SCHEDULER} icon={Swords} label="Scheduler" active={location.pathname === AppRoutes.SCHEDULER} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.PLANNER} icon={Calendar} label="AI Planner" active={location.pathname === AppRoutes.PLANNER} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.FLASHCARDS} icon={Layers} label="Flashcards" active={location.pathname === AppRoutes.FLASHCARDS} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.NOTES} icon={NotebookPen} label="Smart Notes" active={location.pathname === AppRoutes.NOTES} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.CHAT} icon={MessageSquare} label="AI Tutor" active={location.pathname === AppRoutes.CHAT} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.SOCIAL} icon={Users} label="Community" active={location.pathname === AppRoutes.SOCIAL} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.ANALYTICS} icon={PieChart} label="Analytics" active={location.pathname === AppRoutes.ANALYTICS} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
                  <NavItem to={AppRoutes.PROFILE} icon={User} label="Profile" active={location.pathname === AppRoutes.PROFILE} collapsed={false} onClick={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="pt-4 mt-4 border-t border-white/5">
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl w-full transition-all">
                  <LogOut size={20} /> <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside 
        className={`
          border-r z-20 hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out
          ${collapsed ? 'w-20' : 'w-64'}
          glass-panel border-white/5 bg-black/20 backdrop-blur-xl
        `}
      >
        <div className={`p-6 flex items-center ${collapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
          {!collapsed ? (
             <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 truncate">
               StudyHub
             </h1>
          ) : (
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
               SF
             </div>
          )}
          
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-white/10`}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-x-hidden custom-scrollbar overflow-y-auto">
          <NavItem to={AppRoutes.DASHBOARD} icon={LayoutDashboard} label="Dashboard" active={location.pathname === AppRoutes.DASHBOARD} collapsed={collapsed} />
          <NavItem to={AppRoutes.SCHEDULER} icon={Swords} label="Scheduler" active={location.pathname === AppRoutes.SCHEDULER} collapsed={collapsed} />
          <NavItem to={AppRoutes.PLANNER} icon={Calendar} label="AI Planner" active={location.pathname === AppRoutes.PLANNER} collapsed={collapsed} />
          <NavItem to={AppRoutes.FLASHCARDS} icon={Layers} label="Flashcards" active={location.pathname === AppRoutes.FLASHCARDS} collapsed={collapsed} />
          <NavItem to={AppRoutes.NOTES} icon={NotebookPen} label="Smart Notes" active={location.pathname === AppRoutes.NOTES} collapsed={collapsed} />
          <NavItem to={AppRoutes.CHAT} icon={MessageSquare} label="AI Tutor" active={location.pathname === AppRoutes.CHAT} collapsed={collapsed} />
          <NavItem to={AppRoutes.SOCIAL} icon={Users} label="Community" active={location.pathname === AppRoutes.SOCIAL} collapsed={collapsed} />
          <NavItem to={AppRoutes.ANALYTICS} icon={PieChart} label="Analytics" active={location.pathname === AppRoutes.ANALYTICS} collapsed={collapsed} />
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2 flex flex-col">
          <NavItem to={AppRoutes.PROFILE} icon={User} label="Profile" active={location.pathname === AppRoutes.PROFILE} collapsed={collapsed} />
          <button 
            onClick={handleLogout}
            title="Sign Out"
            className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all`}
          >
            <LogOut size={20} />
            {!collapsed && <span className="font-medium whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Nav Header (Hidden on full width pages for immersive feel, or just streamlined) */}
      {!isFullWidthPage && (
        <div className="md:hidden fixed top-0 w-full z-30 px-4 py-3 flex justify-between items-center border-b shadow-lg backdrop-blur-xl bg-[#030712]/90 border-white/5">
          <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white rounded-lg">
                  <Menu size={24} />
              </button>
              <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">StudyHub</span>
          </div>
          
          <div className="flex gap-2">
              <Link to={AppRoutes.DASHBOARD} className={`p-2 rounded-lg ${location.pathname === AppRoutes.DASHBOARD ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400'}`}><LayoutDashboard size={20}/></Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 relative z-10 overflow-y-auto h-screen scroll-smooth ${isFullWidthPage ? 'p-0' : 'p-4 md:p-8 pt-20 md:pt-8'}`}>
        <div className={`${isFullWidthPage ? 'w-full h-full' : 'max-w-7xl mx-auto h-full'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
