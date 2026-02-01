import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  users: AppUser[];
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithMagicLink: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  inviteUser: (email: string, role: AppUser['role'], playerId?: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUserStatus: (id: string, status: AppUser['status']) => Promise<void>;
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
            { id: data.user.id, email: data.user.email, role: 'admin' } // First user is admin by default? Or let them be viewer? Let's make them admin for now since they are setting it up.
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
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('cortapp_user_id');
  };

  const inviteUser = async (email: string, role: AppUser['role'], playerId?: string) => {
    if (supabase) {
      // 1. Store invite in user_invites table
      const { error: inviteError } = await supabase
        .from('user_invites')
        .insert([{ email, role, player_id: playerId }]);
        
      if (inviteError) {
        console.error('Error creating invite:', inviteError);
        return;
      }

      // 2. Send magic link
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (otpError) {
        console.error('Error sending invite email:', otpError);
      } else {
        alert(`Invite sent to ${email}! They will receive a magic link.`);
      }
      
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

  const isAdmin = user?.role === 'admin';
 
  return (
    <AuthContext.Provider value={{ user, isAdmin, users, login, signup, loginWithMagicLink, logout, inviteUser, deleteUser, updateUserStatus, loading }}>
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
