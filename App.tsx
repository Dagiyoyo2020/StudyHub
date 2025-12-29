
import React, { useEffect, useState, PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import StudyPlanner from './pages/StudyPlanner';
import Flashcards from './pages/Flashcards';
import SubjectChat from './pages/SubjectChat';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Notes from './pages/Notes';
import Scheduler from './pages/Scheduler';
import Social from './pages/Social';
import { AppRoutes } from './constants';
import { supabase } from './services/supabaseClient';

// Protected Route Component
const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === null) return null; // Loading state
  if (!session) return <Navigate to={AppRoutes.AUTH} replace />;

  return <>{children}</>;
};

const App = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path={AppRoutes.HOME} element={<Home />} />
          <Route path={AppRoutes.AUTH} element={<Auth />} />

          {/* Protected Routes */}
          <Route path={AppRoutes.DASHBOARD} element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path={AppRoutes.PLANNER} element={
            <ProtectedRoute><StudyPlanner /></ProtectedRoute>
          } />
          <Route path={AppRoutes.FLASHCARDS} element={
            <ProtectedRoute><Flashcards /></ProtectedRoute>
          } />
          <Route path={AppRoutes.NOTES} element={
            <ProtectedRoute><Notes /></ProtectedRoute>
          } />
          <Route path={AppRoutes.CHAT} element={
            <ProtectedRoute><SubjectChat /></ProtectedRoute>
          } />
          <Route path={AppRoutes.ANALYTICS} element={
            <ProtectedRoute><Analytics /></ProtectedRoute>
          } />
          <Route path={AppRoutes.PROFILE} element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />
          <Route path={AppRoutes.SCHEDULER} element={
            <ProtectedRoute><Scheduler /></ProtectedRoute>
          } />
           <Route path={AppRoutes.SOCIAL} element={
            <ProtectedRoute><Social /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to={AppRoutes.HOME} replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;