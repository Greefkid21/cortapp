import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, PlatformRole, WorkspaceAccessSummary, WorkspaceMembershipRole } from '../types';
import { supabase } from '../lib/supabase';
import { sendEmailNotification } from '../lib/notifications';

function workspaceRoleToAppRole(role: WorkspaceMembershipRole): AppUser['role'] {
  return role === 'viewer' ? 'viewer' : 'admin';
}

function appRoleToWorkspaceRole(role: AppUser['role']): WorkspaceMembershipRole {
  return role === 'admin' ? 'admin' : 'viewer';
}

interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  actualIsAdmin: boolean;
  viewerPreview: boolean;
  users: AppUser[];
  workspaces: WorkspaceAccessSummary[];
  activeWorkspace: WorkspaceAccessSummary | null;
  workspaceRole: WorkspaceMembershipRole | null;
  platformRole: PlatformRole;
  hasWorkspaceAdminAccess: boolean;
  createWorkspace: (workspaceName: string, slug?: string) => Promise<{ success: boolean; workspaceId?: string; error?: string }>;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string; autoSignedIn?: boolean; requiresEmailConfirmation?: boolean }>;
  loginWithMagicLink: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  inviteUser: (email: string, role: AppUser['role'], playerId?: string) => Promise<{ success: boolean; emailSent: boolean; message?: string }>;
  deleteUser: (id: string) => Promise<void>;
  updateUserStatus: (id: string, status: AppUser['status']) => Promise<void>;
  updateUserProfile: (id: string, updates: { role?: AppUser['role'], playerId?: string | null }) => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  refreshUsers: () => Promise<number>;
  checkUserDbValue: (id: string) => Promise<any>;
  setViewerPreview: (enabled: boolean) => void;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  buildPath: (path: string) => string;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceAccessSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => localStorage.getItem('cortapp_active_workspace_id'));
  const [loading, setLoading] = useState(true);
  const [viewerPreview, setViewerPreview] = useState(false);

  const setActiveWorkspaceId = (workspaceId: string | null) => {
    setActiveWorkspaceIdState(workspaceId);
    if (workspaceId) {
      localStorage.setItem('cortapp_active_workspace_id', workspaceId);
    } else {
      localStorage.removeItem('cortapp_active_workspace_id');
    }
  };

  const loadWorkspaceAccess = async (userId: string) => {
    if (!supabase) return [] as WorkspaceAccessSummary[];

    const { data, error } = await supabase
      .from('workspace_memberships')
      .select(`
        id,
        workspace_id,
        user_id,
        role,
        player_id,
        workspace:workspaces (
          id,
          name,
          slug,
          billing_status,
          billing_plan,
          is_billing_exempt,
          billing_exempt_reason,
          grace_period_ends_at,
          billing_pending_started_at,
          owner_user_id,
          paypal_subscription_status,
          paypal_subscription_id,
          paypal_plan_id,
          paypal_payer_id,
          paypal_subscription_started_at,
          paypal_subscription_ends_at,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.warn('Workspace access not available yet:', error.message);
      return [] as WorkspaceAccessSummary[];
    }

    const mapped = (data || [])
      .map((item: any) => {
        if (!item.workspace) return null;

        return {
          workspace: {
            id: item.workspace.id,
            name: item.workspace.name,
            slug: item.workspace.slug,
            billingStatus: item.workspace.billing_status,
            billingPlan: item.workspace.billing_plan,
            isBillingExempt: item.workspace.is_billing_exempt,
            billingExemptReason: item.workspace.billing_exempt_reason,
            gracePeriodEndsAt: item.workspace.grace_period_ends_at,
            billingPendingStartedAt: item.workspace.billing_pending_started_at,
            ownerUserId: item.workspace.owner_user_id,
            paypalSubscriptionStatus: item.workspace.paypal_subscription_status,
            paypalSubscriptionId: item.workspace.paypal_subscription_id,
            paypalPlanId: item.workspace.paypal_plan_id,
            paypalPayerId: item.workspace.paypal_payer_id,
            paypalSubscriptionStartedAt: item.workspace.paypal_subscription_started_at,
            paypalSubscriptionEndsAt: item.workspace.paypal_subscription_ends_at,
            createdAt: item.workspace.created_at,
            updatedAt: item.workspace.updated_at,
          },
          membershipRole: item.role,
          playerId: item.player_id || undefined,
        } as WorkspaceAccessSummary;
      })
      .filter(Boolean) as WorkspaceAccessSummary[];

    setWorkspaces(mapped);

    const preferred = mapped.find((entry) => entry.workspace.id === activeWorkspaceId) || mapped[0] || null;
    if (preferred?.workspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(preferred?.workspace.id || null);
    }

    return mapped;
  };

  // Define fetchUsers outside useEffect so it can be exposed
  const fetchUsers = async () => {
    if (!supabase) return 0;

    const currentWorkspaceId = activeWorkspaceId || workspaces[0]?.workspace.id;
    const currentWorkspaceRole = workspaces.find((entry) => entry.workspace.id === currentWorkspaceId)?.membershipRole;
    const canManageUsers =
      user?.platformRole === 'platform_admin' ||
      user?.role === 'admin' ||
      currentWorkspaceRole === 'owner_admin' ||
      currentWorkspaceRole === 'admin';

    if (!currentWorkspaceId || !canManageUsers) {
      setUsers([]);
      return 0;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('user_id, role, player_id')
      .eq('workspace_id', currentWorkspaceId);

    if (membershipError) {
      console.error('Error fetching workspace memberships:', membershipError);
      return 0;
    }

    const userIds = Array.from(new Set((memberships || []).map((membership: any) => membership.user_id).filter(Boolean)));

    let profilesById = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, status, platform_role')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching workspace profiles:', profilesError);
        return 0;
      }

      profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    }

    const mappedUsers: AppUser[] = (memberships || []).map((membership: any) => {
      const profile = profilesById.get(membership.user_id);
      return {
        id: membership.user_id,
        email: profile?.email || 'Invited user',
        name: profile?.email?.split('@')[0] || 'User',
        role: workspaceRoleToAppRole(membership.role),
        platformRole: profile?.platform_role || 'user',
        status: profile?.status || 'active',
        playerId: membership.player_id || undefined,
      };
    });

    setUsers(mappedUsers);
    return mappedUsers.length;
  };

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
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
                // Do not downgrade to viewer if it's a genuine error (not just missing)
            }
              
            if (profile) {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.email?.split('@')[0] || 'User',
                role: profile.role,
                platformRole: profile.platform_role || 'user',
                status: profile.status,
                playerId: profile.player_id
              });
              await loadWorkspaceAccess(session.user.id);
            } else if (error && error.code === 'PGRST116') {
              // Only create new profile if it genuinely doesn't exist (PGRST116)
              console.log('Profile not found, creating new viewer profile...');
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
              setWorkspaces([]);
            }
          }
          
          // Listen for auth changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user && supabase) {
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
                
              if (error && error.code !== 'PGRST116') {
                  console.error('Error fetching profile (onAuthStateChange):', error);
              }
                
              if (profile) {
                setUser({
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.email?.split('@')[0] || 'User',
                  role: profile.role,
                  platformRole: profile.platform_role || 'user',
                  status: profile.status,
                  playerId: profile.player_id
                });
                await loadWorkspaceAccess(session.user.id);
              } else if (error && error.code === 'PGRST116') {
                 // Only create new profile if it genuinely doesn't exist
                 console.log('Profile not found (auth change), creating new viewer profile...');
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
                 setWorkspaces([]);
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
                setWorkspaces([]);
                setActiveWorkspaceId(null);
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
    fetchUsers();
  }, [user, activeWorkspaceId, workspaces.length]);

  // Auto-refresh on window focus (for mobile switching)
  useEffect(() => {
    const handleFocus = () => {
      const currentWorkspaceRole = workspaces.find((entry) => entry.workspace.id === (activeWorkspaceId || workspaces[0]?.workspace.id))?.membershipRole;
      if (user?.role === 'admin' || currentWorkspaceRole === 'owner_admin' || currentWorkspaceRole === 'admin') {
        console.log('App focused, refreshing users...');
        fetchUsers();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, activeWorkspaceId, workspaces]);

  // Real-time subscription for profile updates
  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;

    const profileChangeConfig = user.role === 'admin'
      ? { event: '*' as const, schema: 'public', table: 'profiles' }
      : { event: '*' as const, schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` };

    const channel = client
      .channel(`public:profiles:${user.role}:${user.id}`)
      .on('postgres_changes', 
        profileChangeConfig, 
        (payload) => {
          console.log('Realtime profile update:', payload);
          if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new;
            
            // 1. Update current user if it matches
            setUser((currentUser: AppUser | null) => {
              if (!currentUser || currentUser.id !== updatedProfile.id) {
                return currentUser;
              }

              const existingPlatformRole = currentUser.platformRole || 'user';
              return {
                ...currentUser,
                role: updatedProfile.role,
                platformRole: updatedProfile.platform_role || existingPlatformRole,
                status: updatedProfile.status,
                playerId: updatedProfile.player_id || undefined
              } as AppUser;
            });

            // 2. Update users list if we have it
            setUsers(currentUsers => {
              // Check if user exists in list
              const exists = currentUsers.some(u => u.id === updatedProfile.id);
              
              if (exists) {
                return currentUsers.map(u => u.id === updatedProfile.id ? {
                  ...u,
                  role: updatedProfile.role,
                  platformRole: updatedProfile.platform_role || u.platformRole || 'user',
                  status: updatedProfile.status,
                  playerId: updatedProfile.player_id || undefined
                } as AppUser : u);
              } else {
                // If not in list but we received an update, maybe we should add it?
                // Or maybe fetchUsers wasn't called yet.
                // Safest to trigger a fetch if we are admin?
                // But we can't call fetchUsers easily from here without dependency issues if it wasn't stable.
                // For now, just return current.
                return currentUsers;
              }
            });
          } else if (payload.eventType === 'INSERT') {
            const newProfile = payload.new;
            const newUser: AppUser = {
              id: newProfile.id,
              email: newProfile.email,
              name: newProfile.email?.split('@')[0] || 'User',
              role: newProfile.role,
              platformRole: newProfile.platform_role || 'user',
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
                    setWorkspaces([]);
                    setActiveWorkspaceId(null);
                    return null;
                }
                return currentUser;
             });
          }
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
            console.warn('Profiles subscription status:', status);
        }
      });

    return () => {
      client.removeChannel(channel);
    };
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
        setWorkspaces([]);
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
        
        return {
          success: true,
          autoSignedIn: !!data.session,
          requiresEmailConfirmation: !data.session,
        };
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

  const createWorkspace = async (workspaceName: string, slug?: string) => {
    if (!supabase || !user) {
      return { success: false, error: 'You must be logged in to create a workspace.' };
    }

    const { data, error } = await supabase.rpc('create_workspace_for_owner', {
      workspace_name: workspaceName,
      requested_slug: slug || null,
    });

    if (error) {
      console.error('Error creating workspace:', error);
      return { success: false, error: error.message };
    }

    await loadWorkspaceAccess(user.id);
    if (data) {
      setActiveWorkspaceId(data);
    }

    return { success: true, workspaceId: data };
  };

  const inviteUser = async (email: string, role: AppUser['role'], playerId?: string): Promise<{ success: boolean; emailSent: boolean; message?: string }> => {
    if (supabase) {
      if (!activeWorkspaceId) {
        return { success: false, emailSent: false, message: 'No active workspace selected.' };
      }

      // 1. Store invite in user_invites table
      const { error: inviteError } = await supabase
        .from('user_invites')
        .insert([{ workspace_id: activeWorkspaceId, email, role, player_id: playerId }]);
        
      if (inviteError) {
        console.error('Error creating invite:', inviteError);
        return { success: false, emailSent: false, message: inviteError.message };
      }

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, status, platform_role')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile?.id) {
        const { error: membershipError } = await supabase
          .from('workspace_memberships')
          .upsert({
            workspace_id: activeWorkspaceId,
            user_id: existingProfile.id,
            role: appRoleToWorkspaceRole(role),
            player_id: playerId || null,
          }, { onConflict: 'workspace_id,user_id' });

        if (membershipError) {
          console.error('Error creating workspace membership:', membershipError);
          return { success: false, emailSent: false, message: membershipError.message };
        }
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
        id: existingProfile?.id || ('pending-' + Math.random()),
        email,
        name: email.split('@')[0],
        role,
        platformRole: existingProfile?.platform_role || 'user',
        status: existingProfile ? (existingProfile.status || 'active') : 'invited',
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
        platformRole: 'user',
        status: 'invited',
        playerId
      };
      setUsers([...users, newUser]);
      return { success: true, emailSent: false, message: 'Mock invite created.' };
    }
  };

  const deleteUser = async (id: string) => {
    if (supabase) {
      if (!activeWorkspaceId) return;
      await supabase.from('workspace_memberships').delete().eq('workspace_id', activeWorkspaceId).eq('user_id', id);
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
      if (!activeWorkspaceId) {
        throw new Error('No active workspace selected.');
      }

      const updateData: any = {};
      if (updates.role) updateData.role = appRoleToWorkspaceRole(updates.role);
      if (updates.playerId !== undefined) updateData.player_id = updates.playerId;

      const { error } = await supabase
        .from('workspace_memberships')
        .update(updateData)
        .eq('workspace_id', activeWorkspaceId)
        .eq('user_id', id);

      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
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

  const activeWorkspace = workspaces.find((entry) => entry.workspace.id === activeWorkspaceId) || workspaces[0] || null;
  const workspaceRole = activeWorkspace?.membershipRole || null;
  const platformRole = user?.platformRole || 'user';
  const hasWorkspaceAdminAccess = platformRole === 'platform_admin' || workspaceRole === 'owner_admin' || workspaceRole === 'admin';
  const actualIsAdmin = (user?.role === 'admin') || hasWorkspaceAdminAccess;
  const isAdmin = actualIsAdmin && !viewerPreview;

  const buildPath = (path: string) => {
    if (!path.startsWith('/')) return path;
    if (!viewerPreview) return path;
    if (path === '/viewer' || path.startsWith('/viewer/')) return path;
    return `/viewer${path}`;
  };

  const checkUserDbValue = async (id: string) => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) {
        console.error('checkUserDbValue error:', error);
        return { error: error.message };
    }
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, actualIsAdmin, viewerPreview, users, workspaces, activeWorkspace, workspaceRole, platformRole, hasWorkspaceAdminAccess, createWorkspace, login, signup, loginWithMagicLink, logout, inviteUser, deleteUser, updateUserStatus, updateUserProfile, resetPassword, refreshUsers: fetchUsers, checkUserDbValue, setViewerPreview, setActiveWorkspaceId, buildPath, loading }}>
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
