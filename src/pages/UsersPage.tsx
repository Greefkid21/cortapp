import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Player } from '../types';
import { UserPlus, Trash2, Shield, User, Edit2 } from 'lucide-react';
import { AppUser } from '../types';

export function UsersPage({ players }: { players: Player[] }) {
  const { users, inviteUser, deleteUser, isAdmin, updateUserStatus, updateUserProfile } = useAuth();
  const [isInviting, setIsInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null); // For editing existing users

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppUser['role']>('viewer');
  const [invitePlayerId, setInvitePlayerId] = useState<string | undefined>(undefined);

  const startEdit = (user: AppUser) => {
      setInviteEmail(user.email);
      setInviteRole(user.role);
      setInvitePlayerId(user.playerId);
      setEditingUser(user);
      setIsInviting(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
        // Safety check: Prevent admin from accidentally demoting themselves
        if (editingUser.id === users.find(u => u.email === inviteEmail)?.id && editingUser.role === 'admin' && inviteRole !== 'admin') {
             if (!confirm('Warning: You are about to remove your own Admin privileges. You will lose access to this page. Are you sure?')) {
                 return;
             }
        }

        // Update existing user
        await updateUserProfile(editingUser.id, {
            role: inviteRole,
            playerId: invitePlayerId
        });
    } else {
        // Invite new user
        if (inviteEmail.trim()) {
            await inviteUser(inviteEmail, inviteRole, invitePlayerId);
        }
    }
    
    setIsInviting(false);
    setEditingUser(null);
    setInviteEmail('');
    setInvitePlayerId(undefined);
    setInviteRole('viewer');
  };

  if (!isAdmin) {
    return <div className="p-8 text-center">You do not have permission to view this page.</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <button
          onClick={() => {
              setEditingUser(null);
              setInviteEmail('');
              setInviteRole('viewer');
              setInvitePlayerId(undefined);
              setIsInviting(true);
          }}
          className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-teal-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" /> Invite User
        </button>
      </div>

      {isInviting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
                {editingUser ? 'Edit User' : 'Invite New User'}
            </h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary outline-none"
                  autoFocus
                  disabled={!!editingUser} // Cannot change email of existing user
                />
              </div>
              
              <div>
                <label className="text-sm font-bold text-slate-700">App Access Role</label>
                <div className="flex gap-2 mt-1">
                    <button
                        type="button"
                        onClick={() => setInviteRole('admin')}
                        className={`flex-1 p-2 rounded-lg border text-sm ${inviteRole === 'admin' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-slate-200 text-slate-500'}`}
                    >
                        Admin (Full Access)
                    </button>
                    <button
                        type="button"
                        onClick={() => setInviteRole('viewer')}
                        className={`flex-1 p-2 rounded-lg border text-sm ${inviteRole === 'viewer' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-slate-200 text-slate-500'}`}
                    >
                        Viewer (Read Only)
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                    Admins can manage scores and users. Viewers can only see results.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">Link to Player (optional)</label>
                <select
                  value={invitePlayerId || ''}
                  onChange={(e) => setInvitePlayerId(e.target.value || undefined)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">No player link</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsInviting(false)}
                  className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-white font-bold bg-primary rounded-xl hover:bg-teal-700"
                >
                  {editingUser ? 'Save Changes' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-4 font-bold text-slate-500">User</th>
              <th className="p-4 font-bold text-slate-500">Role</th>
              <th className="p-4 font-bold text-slate-500">Status</th>
              <th className="p-4 font-bold text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    <Shield className="w-3 h-3" />
                    {user.role === 'admin' ? 'Admin' : 'Player'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {user.status === 'active' ? 'Active' : 'Invited'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {user.status === 'invited' && (
                      <button
                        onClick={() => updateUserStatus(user.id, 'active')}
                        className="text-green-600 hover:text-green-700 p-2 hover:bg-green-50 rounded-lg transition-colors text-xs font-bold"
                        title="Activate User"
                      >
                        Activate
                      </button>
                    )}
                    
                    <button
                        onClick={() => startEdit(user)}
                        className="text-slate-400 hover:text-primary p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Edit User"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>

                    {user.role !== 'admin' && (
                      <button 
                          onClick={() => deleteUser(user.id)}
                          className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove User"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
