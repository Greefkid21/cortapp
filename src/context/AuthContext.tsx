import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types';
import { supabase } from '../lib/supabase';
import { sendEmailNotification } from '../lib/notifications';

interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  users: AppUser[];
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithMagicLink: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  inviteUser: (email: string, role: AppUser['role'], playerId?: string) => Promise<{ success: boolean; emailSent: boolean; message?: string }>;
  deleteUser: (id: string) => Promise<void>;
  updateUserStatus: (id: string, status: AppUser['status']) => Promise<void>;
  updateUserProfile: (id: string, updates: { role?: AppUser['role'], playerId?: string | null }) => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial session
  useEffect(() => {
    const loadSession = async () => {
      let sessionFound = false;

      if (supabase) {
        try {
          // Get current session
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            sessionFound = true;
            // Fetch profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            if (profile) {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.email?.split('@')[0] || 'User',
                role: profile.role,
                status: profile.status,
                playerId: profile.player_id
              });
            } else {
              // Profile missing - Create it now (Self-healing)
              const newUser = {
                id: session.user.id,
                email: session.user.email || '',
                role: 'viewer' as const,
                status: 'active' as const
              };
              
              // Insert into database
              const client = supabase;
              if (client) {
                  client.from('profiles').insert([newUser]).then(({ error }) => {
                    if (error) console.error('Error auto-creating profile:', error);
                  });
              }

              setUser({
                ...newUser,
                name: session.user.email?.split('@')[0] || 'User',
                playerId: undefined
              });
            }
          }
          
          // Listen for auth changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user && supabase) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
                
              if (profile) {
                setUser({
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.email?.split('@')[0] || 'User',
                  role: profile.role,
                  status: profile.status,
                  playerId: profile.player_id
                });
              } else {
                 // Profile missing - Create it now (Self-healing)
                 const newUser = {
                   id: session.user.id,
                   email: session.user.email || '',
                   role: 'viewer' as const,
                   status: 'active' as const
                 };
                 
                 // Insert into database
                 const client = supabase;
                 if (client) {
                     client.from('profiles').insert([newUser]).then(({ error }) => {
                       if (error) console.error('Error auto-creating profile:', error);
                     });
                 }

                 setUser({
                   ...newUser,
                   name: session.user.email?.split('@')[0] || 'User',
                   playerId: undefined
                 });
              }
            } else {
              // Check for local admin fallback when Supabase session is cleared/missing
              const storedUserId = localStorage.getItem('cortapp_user_id');
              if (storedUserId === 'admin-local') {
                setUser({
                    id: 'admin-local',
                    email: 'admin@local',
                    name: 'Admin',
                    role: 'admin',
                    status: 'active'
                });
              } else {
                setUser(null);
              }
            }
            setLoading(false);
          });
          
          // If no session found initially, check local storage for admin override
          if (!sessionFound) {
             const storedUserId = localStorage.getItem('cortapp_user_id');
             if (storedUserId === 'admin-local') {
               setUser({
                   id: 'admin-local',
                   email: 'admin@local',
                   name: 'Admin',
                   role: 'admin',
                   status: 'active'
               });
             }
          }

          return () => {
            subscription.unsubscribe();
          };
        } catch (error) {
          console.error('Error loading session:', error);
        }
      } 
      
      setLoading(false);
    };
    
    loadSession();
  }, []);

  // Fetch all users (for admin)
  useEffect(() => {
    const fetchUsers = async () => {
      if (supabase && user?.role === 'admin') {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*');
          
        if (profiles) {
          const mappedUsers: AppUser[] = profiles.map(p => ({
            id: p.id,
            email: p.email,
            name: p.email.split('@')[0],
            role: p.role,
            status: p.status,
            playerId: p.player_id
          }));
          setUsers(mappedUsers);
        }
      }
    };
    
    fetchUsers();
  }, [user]);

  // Real-time subscription for profile updates
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel('public:profiles')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new;
            
            // 1. Update current user if it matches
            setUser((currentUser: AppUser | null) => {
              if (currentUser?.id === updatedProfile.id) {
                return {
                  ...currentUser,
                  role: updatedProfile.role,
                  status: updatedProfile.status,
                  playerId: updatedProfile.player_id || undefined
                } as AppUser;
              }
              return currentUser;
            });

            // 2. Update users list if we have it
            setUsers(currentUsers => {
              if (currentUsers.some(u => u.id === updatedProfile.id)) {
                return currentUsers.map(u => u.id === updatedProfile.id ? {
                  ...u,
                  role: updatedProfile.role,
                  status: updatedProfile.status,
                  playerId: updatedProfile.player_id || undefined
                } as AppUser : u);
              }
              return currentUsers;
            });
          } else if (payload.eventType === 'INSERT') {
            const newProfile = payload.new;
            const newUser: AppUser = {
              id: newProfile.id,
              email: newProfile.email,
              name: newProfile.email?.split('@')[0] || 'User',
              role: newProfile.role,
              status: newProfile.status,
              playerId: newProfile.player_id || undefined
            };
            
            setUsers(currentUsers => {
              if (!currentUsers.some(u => u.id === newUser.id)) {
                return [...currentUsers, newUser];
              }
              return currentUsers;
            });
          } else if (payload.eventType === 'DELETE') {
             const deletedId = payload.old.id;
             setUsers(currentUsers => currentUsers.filter(u => u.id !== deletedId));
             
             // If current user is deleted, logout? Maybe safer to let the session check handle it.
             // But we can update local state if needed.
             setUser((currentUser: AppUser | null) => {
                if (currentUser?.id === deletedId) {
                    return null;
                }
                return currentUser;
             });
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const login = async (email: string, password?: string) => {
    // Special backdoor for admin123 - allow if password matches, regardless of email
    if (password === 'admin123' || email === 'admin123') {
        const localAdmin: AppUser = {
            id: 'admin-local',
            email: 'admin@local',
            name: 'Admin',
            role: 'admin',
            status: 'active'
        };
        setUser(localAdmin);
        localStorage.setItem('cortapp_user_id', 'admin-local');
        return true;
    }

    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: password || 'dummy-pass' // Supabase requires password
      });
      
      if (error) {
        console.error('Supabase login error:', error);
        return false;
      }
      return true;
    } else {
      // MOCK MODE
      // Legacy support for "admin123" if just password is provided
      if (email === 'admin123' && !password) {
        const adminUser = users.find(u => u.role === 'admin');
        if (adminUser) {
          setUser(adminUser);
          localStorage.setItem('cortapp_user_id', adminUser.id);
          return true;
        }
        return false;
      }

      const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (foundUser && foundUser.status === 'active') {
        setUser(foundUser);
        localStorage.setItem('cortapp_user_id', foundUser.id);
        return true;
      }
      return false;
    }
  };

  const signup = async (email: string, password: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { id: data.user.id, email: data.user.email, role: 'viewer' }
          ]);
        
        if (profileError) {
             console.error('Error creating profile:', profileError);
             // If profile creation fails, we might want to clean up auth user, but for now just report error
        }
        
        return { success: true };
      }
      return { success: false, error: 'User creation failed' };
    }
    return { success: false, error: 'Supabase not configured' };
  };

  const loginWithMagicLink = async (email: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        console.error('Error sending magic link:', error);
        return false;
      }
      return true;
    }
    return false;
  };

  const logout = async () => {
    // Clear local state immediately to prevent UI delay
    setUser(null);
    localStorage.removeItem('cortapp_user_id');
    
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    }
  };

  const inviteUser = async (email: string, role: AppUser['role'], playerId?: string): Promise<{ success: boolean; emailSent: boolean; message?: string }> => {
    if (supabase) {
      // 1. Store invite in user_invites table
      const { error: inviteError } = await supabase
        .from('user_invites')
        .insert([{ email, role, player_id: playerId }]);
        
      if (inviteError) {
        console.error('Error creating invite:', inviteError);
        return { success: false, emailSent: false, message: inviteError.message };
      }

      // 2. Send magic link via Supabase (primary auth method)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (otpError) {
        console.error('Error sending invite email (Supabase):', otpError);
      }

      // 3. Send custom notification email via Resend
      const subject = "You've been invited to join Cortapp League";
      const html = `
        <h1>You've been invited!</h1>
        <p>You have been invited to join the Cortapp Padel League.</p>
        <p>We have sent a separate email with a secure login link (Magic Link).</p>
        <p>If you don't see it, you can also login directly here:</p>
        <p><a href="https://cortapp.vercel.app/login">Login to Cortapp</a></p>
        <p>Use your email: <strong>${email}</strong></p>
      `;
      
      const { error: emailError } = await sendEmailNotification(email, subject, html);
      
      // Refresh users list (optimistic update)
      const newUser: AppUser = {
        id: 'pending-' + Math.random(),
        email,
        name: email.split('@')[0],
        role,
        status: 'invited',
        playerId
      };
      setUsers([...users, newUser]);

      if (emailError) {
        return { success: true, emailSent: false, message: 'Invite created but email failed.' };
      } else {
        return { success: true, emailSent: true, message: 'Invite sent successfully.' };
      }
      
    } else {
      // MOCK MODE
      const newUser: AppUser = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name: email.split('@')[0], // Default name from email
        role,
        status: 'invited',
        playerId
      };
      setUsers([...users, newUser]);
      return { success: true, emailSent: false, message: 'Mock invite created.' };
    }
  };

  const deleteUser = async (id: string) => {
    if (supabase) {
      // Admin only - delete from profiles (and ideally auth.users via Edge Function, but we can't do that from client)
      // For now, we'll just soft-delete or delete profile
      await supabase.from('profiles').delete().eq('id', id);
      setUsers(users.filter(u => u.id !== id));
    } else {
      setUsers(users.filter(u => u.id !== id));
      if (user?.id === id) {
        logout();
      }
    }
  };

  const updateUserStatus = async (id: string, status: AppUser['status']) => {
    if (supabase) {
      await supabase.from('profiles').update({ status }).eq('id', id);
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, status } : u)));
    } else {
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, status } : u)));
    }
  };

  const updateUserProfile = async (id: string, updates: { role?: AppUser['role'], playerId?: string | null }) => {
    if (supabase) {
      const updateData: any = {};
      if (updates.role) updateData.role = updates.role;
      if (updates.playerId !== undefined) updateData.player_id = updates.playerId; // Allow null to unlink

      const { data, error } = await supabase.from('profiles').update(updateData).eq('id', id).select();

      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }

      if (!data || data.length === 0) {
          console.warn('Update succeeded but no data returned. Possible RLS blocking.');
          // If RLS blocks the update, we shouldn't update local state blindly.
          // However, throwing might break UI flow. Let's log and alert.
          alert('Update failed: You might not have permission to update this user. Please check database policies.');
          return;
      }
      
      setUsers(prev => prev.map(u => (u.id === id ? { 
          ...u, 
          role: updates.role || u.role,
          playerId: updates.playerId !== undefined ? (updates.playerId as string | undefined) : u.playerId
      } : u)));
      
      // Update local user if it's me
      if (user?.id === id) {
          setUser(prev => prev ? {
              ...prev,
              role: updates.role || prev.role,
              playerId: updates.playerId !== undefined ? (updates.playerId as string | undefined) : prev.playerId
          } : null);
      }
    } else {
       setUsers(prev => prev.map(u => (u.id === id ? { 
          ...u, 
          role: updates.role || u.role,
          playerId: updates.playerId !== undefined ? (updates.playerId as string | undefined) : u.playerId
      } : u)));
    }
  };

  const resetPassword = async (email: string) => {
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`
      });
      
      if (error) {
        console.error('Error resetting password:', error);
        return false;
      }
      return true;
    }
    return true;
  };

  const isAdmin = user?.role === 'admin';
 
  return (
    <AuthContext.Provider value={{ user, isAdmin, users, login, signup, loginWithMagicLink, logout, inviteUser, deleteUser, updateUserStatus, updateUserProfile, resetPassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
