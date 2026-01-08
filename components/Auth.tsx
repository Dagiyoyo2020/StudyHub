import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AppRoutes } from '../constants';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session check on component mount
  useEffect(() => {
    checkSession();
    
    // Set up auth state change listener for Googleg OAuth callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Store session in localStorage
          localStorage.setItem('supabase.auth.token', JSON.stringify(session));
          
          // Create profile if user is new (for Google sign-in)
          if (event === 'SIGNED_IN') {
            await handleNewUserProfile(session.user);
          }
          
          // Redirect to dashboard
          navigate(AppRoutes.DASHBOARD);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Function to check if user is already logged in
  const checkSession = async () => {
    try {
      // Check localStorage first for faster redirect
      const storedSession = localStorage.getItem('supabase.auth.token');
      
      if (storedSession) {
        // Validate the stored session with Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!error && session) {
          // Session is valid, redirect to dashboard
          navigate(AppRoutes.DASHBOARD);
          return;
        } else {
          // Invalid session, clear localStorage
          localStorage.removeItem('supabase.auth.token');
        }
      }
    } catch (err) {
      console.error('Session check error:', err);
      localStorage.removeItem('supabase.auth.token');
    }
  };

  // Handle profile creation for new users (both email and Google sign-up)
  const handleNewUserProfile = async (user: any) => {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const profileData: any = {
          id: user.id,
          email: user.email,
          theme: 'dark'
        };

        // Add name if available (from Google or sign-up form)
        if (user.user_metadata?.full_name) {
          profileData.name = user.user_metadata.full_name;
        } else if (name) {
          profileData.name = name;
        }

        // Add username from email
        if (user.email) {
          profileData.username = user.email.split('@')[0];
        }

        await supabase.from('profiles').insert(profileData);
      }
    } catch (err) {
      console.error('Profile creation error:', err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        
        if (data.user) {
          // Store session in localStorage
          if (data.session) {
            localStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
          }
          
          // Create profile with searchable fields
          await supabase.from('profiles').insert({
            id: data.user.id,
            name: name,
            email: email,
            username: email.split('@')[0],
            theme: 'dark'
          });
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        
        // Store session in localStorage
        if (data.session) {
          localStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
        }
      }
      
      navigate(AppRoutes.DASHBOARD);
    } catch (err: any) {
      setError(err.message);
      // Clear localStorage on error
      localStorage.removeItem('supabase.auth.token');
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`, // Changed to dashboard
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) throw error;
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };
  // Helper function to clear all auth data
  const clearAuthData = () => {
    localStorage.removeItem('supabase.auth.token');
    supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex bg-[#030712] text-white">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="glass-panel p-8 md:p-12 rounded-3xl shadow-2xl border border-white/10">
            <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-slate-400 mb-8">Enter your details to access your workspace.</p>

            <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    placeholder="John Doe"
                    required={isSignUp}
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  placeholder="student@university.edu"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] flex justify-center items-center"
              >
                {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </form>



            <div className="mt-6 text-center text-sm text-slate-400">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{' '}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                disabled={loading}
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </div>
            
            {/* Debug/Reset button (optional - can be removed in production) */}
            <div className="mt-4 text-center">
              <button 
                onClick={clearAuthData}
                className="text-xs text-slate-500 hover:text-slate-400"
              >
                Clear Session Data
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Side - Visuals */}
      <div className="hidden lg:flex w-1/2 relative bg-[#050a18] items-center justify-center overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
         <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent"></div>
         
         <div className="relative z-10 text-center p-12">
           <motion.h1 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="text-6xl font-bold text-white mb-4 tracking-tight"
           >
             STUDYHUB
           </motion.h1>
           <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-purple-200/80 font-light tracking-widest uppercase"
           >
             Intelligence Meets Productivity
           </motion.p>
         </div>
      </div>
    </div>
  );
};

export default Auth;