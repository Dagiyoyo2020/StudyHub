
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';
import { Camera, Save, User, Loader2, Edit2, X, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Profile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Loading state for initial fetch
  const [fetchingProfile, setFetchingProfile] = useState(true);
  
  // To handle immediate image refresh
  const [avatarKey, setAvatarKey] = useState(Date.now());

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setFetchingProfile(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Try to fetch profile, if not exists, create one (backfill)
      let { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (!data && (error?.code === 'PGRST116' || !error)) {
        // Insert if missing
         const { data: newData } = await supabase.from('profiles').insert({ id: user.id, name: user.email?.split('@')[0], theme: 'dark' }).select().single();
         data = newData;
      }

      if (data) {
        setProfile(data);
        setName(data.name || '');
      }
    }
    setFetchingProfile(false);
  };

  const updateProfile = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('profiles').update({ name }).eq('id', user.id);
        if (error) throw error;
        
        // Optimistic update
        setProfile(prev => prev ? ({ ...prev, name }) : null);
        setMsg({ type: 'success', text: 'Profile updated successfully!' });
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error(error);
      setMsg({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setMsg(null);
      if (!event.target.files || event.target.files.length === 0) return;

      setUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Standard upload logic
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

      if (uploadError) {
         throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Add timestamp to force cache bust
        const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
        await supabase.from('profiles').update({ avatar_url: urlWithCacheBuster }).eq('id', user.id);
        
        // Update state immediately
        setProfile(prev => prev ? ({ ...prev, avatar_url: urlWithCacheBuster }) : null);
        setAvatarKey(Date.now()); // Force re-render of image
        
        setMsg({ type: 'success', text: 'Avatar uploaded!' });
      }

    } catch (error: any) {
      console.error(error);
      setMsg({ type: 'error', text: 'Failed to upload. Ensure "avatars" bucket exists.' });
    } finally {
      setUploading(false);
    }
  };

  const handleResetAccount = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Delete all related data
      await supabase.from('study_stats').delete().eq('user_id', user.id);
      await supabase.from('study_plans').delete().eq('user_id', user.id);
      await supabase.from('tutor_chats').delete().eq('user_id', user.id);
      await supabase.from('flashcard_decks').delete().eq('user_id', user.id);
      // We don't delete the profile row usually to keep auth valid, or we could.
      // Resetting name/avatar to default
      await supabase.from('profiles').update({ name: 'Student', avatar_url: null }).eq('id', user.id);
      
      alert("Account reset complete. All study data cleared.");
      window.location.reload();
    }
    setLoading(false);
    setShowResetConfirm(false);
  };

  if (fetchingProfile) {
    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="h-10 w-48 bg-white/10 rounded-lg animate-pulse mb-8" />
            <div className="glass-panel p-10 rounded-3xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-32 bg-white/5 animate-pulse"></div>
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start mt-10">
                    <div className="flex flex-col items-center mx-auto md:mx-0">
                        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse border-4 border-[#0f172a]" />
                    </div>
                    <div className="flex-1 w-full space-y-6">
                        <div className="text-center md:text-left">
                            <div className="h-8 w-64 bg-white/10 rounded animate-pulse mb-2 mx-auto md:mx-0" />
                            <div className="h-4 w-32 bg-white/5 rounded animate-pulse mx-auto md:mx-0" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-24 bg-white/5 rounded-xl animate-pulse border border-white/5" />
                            <div className="h-24 bg-white/5 rounded-xl animate-pulse border border-white/5" />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <div className="h-10 w-32 bg-white/10 rounded-lg animate-pulse" />
                            <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      
      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0f172a] border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl text-center">
               <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  <AlertTriangle size={32} />
               </div>
               <h2 className="text-xl font-bold text-white mb-2">Reset Account Data?</h2>
               <p className="text-slate-400 mb-6 text-sm">This will permanently delete ALL your flashcards, chat history, study plans, and analytics. This action cannot be undone.</p>
               <div className="flex gap-3">
                  <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium">Cancel</button>
                  <button onClick={handleResetAccount} disabled={loading} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-900/20">
                    {loading ? <Loader2 className="animate-spin inline" /> : 'Confirm Reset'}
                  </button>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">My Profile</h1>
      
      <div className="glass-panel p-10 md:p-12 rounded-3xl border border-white/10 relative overflow-hidden shadow-xl hover:border-purple-500/20 transition-all duration-300">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-r from-purple-900/60 to-blue-900/60 blur-xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start mt-10">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-[#0f172a] bg-slate-800 shadow-2xl ring-4 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all">
                {profile?.avatar_url ? (
                  <img key={avatarKey} src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 bg-gradient-to-br from-slate-700 to-slate-900">
                    <User size={56} />
                  </div>
                )}
              </div>
              
              {isEditing && (
                <label className="absolute bottom-0 right-0 p-3 bg-purple-600 rounded-full cursor-pointer hover:bg-purple-500 transition-all shadow-xl border-2 border-[#0f172a] hover:scale-110">
                  {uploading ? <Loader2 size={18} className="animate-spin text-white"/> : <Camera size={18} className="text-white" />}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            {isEditing && <p className="mt-3 text-xs text-slate-400 font-medium">Click icon to change</p>}
          </div>

          {/* Info Section - View vs Edit Mode */}
          <div className="flex-1 w-full">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div 
                  key="edit"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                    />
                  </div>
                  
                  {msg && (
                    <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {msg.text}
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={updateProfile}
                      disabled={loading}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Save Changes
                    </button>
                    <button 
                      onClick={() => { setIsEditing(false); setName(profile?.name || ''); setMsg(null); }}
                      className="px-6 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-bold flex items-center gap-2 transition-colors"
                    >
                      <X size={18}/> Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                   key="view"
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                >
                  <h2 className="text-3xl font-bold text-white mb-2 text-center md:text-left">{profile?.name || 'Student'}</h2>
                  <p className="text-slate-400 mb-6 text-center md:text-left">StudyHub Member</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <div className="bg-white/5 p-5 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all shadow-lg">
                        <span className="block text-xs text-slate-500 uppercase font-bold mb-2">Role</span>
                        <span className="text-white font-semibold text-lg">Student</span>
                     </div>
                     <div className="bg-white/5 p-5 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all shadow-lg">
                        <span className="block text-xs text-slate-500 uppercase font-bold mb-2">Plan</span>
                        <span className="text-purple-400 font-semibold text-lg">Free Tier</span>
                     </div>
                  </div>

                  <div className="flex gap-3 flex-wrap justify-center md:justify-start">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="px-7 py-3 bg-white text-black hover:bg-slate-200 rounded-xl font-bold flex items-center gap-2 transition-all shadow-xl hover:scale-105 border-2 border-transparent hover:border-white/20"
                    >
                      <Edit2 size={20}/> Edit Profile
                    </button>
                    <button 
                      onClick={() => setShowResetConfirm(true)}
                      className="px-7 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold flex items-center gap-2 transition-all border border-red-500/20 hover:border-red-500/40 shadow-lg hover:scale-105"
                    >
                      <Trash2 size={20}/> Reset Account
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
