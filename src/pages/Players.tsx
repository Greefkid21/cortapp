import { useState, useRef } from 'react';
import { Player } from '../types';
import { User, Edit2, Plus, Upload, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PlayersPageProps {
  players: Player[];
  onAddPlayer: (name: string, avatar?: string, email?: string) => void;
  onUpdatePlayer: (id: string, name: string, avatar?: string) => void;
}

export function PlayersPage({ players, onAddPlayer, onUpdatePlayer }: PlayersPageProps) {
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState<string | null>(null); // 'new' or player ID
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startNew = () => {
    setEditName('');
    setEditEmail('');
    setEditAvatar(undefined);
    setIsEditing('new');
  };

  const startEdit = (player: Player) => {
    setEditName(player.name);
    setEditEmail(''); // Don't allow editing email for existing players here yet
    setEditAvatar(player.avatar);
    setIsEditing(player.id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    if (isEditing === 'new') {
      onAddPlayer(editName, editAvatar, editEmail);
    } else if (isEditing) {
      onUpdatePlayer(isEditing, editName, editAvatar);
    }
    setIsEditing(null);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Players</h2>
        {isAdmin && (
        <button
          onClick={startNew}
          className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Add Player
        </button>
        )}
      </div>

      {/* Edit/Add Form Modal/Overlay */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                {isEditing === 'new' ? 'Add New Player' : 'Edit Player'}
              </h3>
              <button onClick={() => setIsEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {editAvatar ? (
                    <img src={editAvatar} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  {editAvatar ? 'Change Photo' : 'Upload Photo'}
                </button>
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Player Name"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all font-medium"
                  autoFocus
                />
              </div>

              {/* Email Input (New Player Only) */}
              {isEditing === 'new' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email (Optional - Sends Invite)</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all font-medium"
                  />
                  <p className="text-xs text-slate-500">
                    If provided, this player will receive an email to join the league and manage their profile.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(null)}
                  className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-white font-bold bg-primary rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Players List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {players.map((player) => (
          <div key={player.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100">
                {player.avatar ? (
                  <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-slate-400 text-lg">
                    {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{player.name}</h3>
                <p className="text-xs text-slate-500">{player.stats.matchesPlayed} matches played</p>
              </div>
            </div>
            {isAdmin && (
            <button 
              onClick={() => startEdit(player)}
              className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
