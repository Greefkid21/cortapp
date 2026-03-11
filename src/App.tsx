import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Fixtures } from './pages/Fixtures';
import { PlayersPage } from './pages/Players';
import { HistoryPage } from './pages/History';
import { Login } from './pages/Login';
import { UsersPage } from './pages/UsersPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { SeasonProvider, useSeason } from './context/SeasonContext';
import { AvailabilityProvider } from './context/AvailabilityContext';
import { Seasons } from './pages/Seasons';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { Settings } from './pages/Settings';
import { Chat } from './pages/Chat';
import { AddMatch } from './pages/AddMatch';
import { PlayerProfile } from './pages/PlayerProfile';
import { Rules } from './pages/Rules';
import { Match, Player } from './types';
import { supabase } from './lib/supabase';
import { sendEmailNotification, getParticipantsFromData } from './lib/notifications';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Helper to calculate stats for a match
const calculateMatchStats = (match: Match, settings: any) => {
    if (match.status !== 'completed') {
         return { t1Sets: 0, t2Sets: 0, t1Games: 0, t2Games: 0, t1Points: 0, t2Points: 0, winner: null as any };
    }

    let t1Sets = 0, t2Sets = 0;
    let t1Games = 0, t2Games = 0;
    let t1Points = 0, t2Points = 0;

    match.sets.forEach(set => {
        t1Games += set.team1;
        t2Games += set.team2;

        // Rule: 1 point per FULL set won.
        // A full set is defined as one where at least one team reaches 6 games.
        if (set.team1 >= 6 || set.team2 >= 6) {
            if (set.team1 > set.team2) {
                t1Sets++;
                t1Points++;
            } else if (set.team2 > set.team1) {
                t2Sets++;
                t2Points++;
            }
        }
    });

    if (match.tieBreaker) {
        if (match.tieBreaker.team1 > match.tieBreaker.team2) {
            // Rule: Win the super tie-breaker -> additional 1 point
            t1Points += 1;
            // Rule: Additional game towards +/- for STB win
            t1Games += 1;
        } else if (match.tieBreaker.team2 > match.tieBreaker.team1) {
            t2Points += 1;
            t2Games += 1;
        }
        // If STB is 8-8 (draw), no additional points are added.
        // Teams keep their 1 point each from the regular sets.
    }

    // Determine winner based on total points for the match
    let winner = 'draw' as any;
    if (t1Points > t2Points) winner = 'team1';
    else if (t2Points > t1Points) winner = 'team2';
    else winner = 'draw';
    
    return { t1Sets, t2Sets, t1Games, t2Games, t1Points, t2Points, winner };
};

function MainApp() {
  const { inviteUser, users } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const { currentSeasonId } = useSeason();
  const { settings } = useSettings();
  const [loadingData, setLoadingData] = useState(true);

  // Update document title
  useEffect(() => {
    if (settings?.league_name) {
      document.title = `${settings.league_name} - Padel League`;
    }
  }, [settings?.league_name]);

  const fetchData = async () => {
    setLoadingData(true);
    if (supabase) {
      try {
        let mappedPlayers: Player[] = [];
        let mappedMatches: Match[] = [];

        // Fetch Players
        const { data: playersData } = await supabase
          .from('players')
          .select('*');
        
        if (playersData) {
          mappedPlayers = playersData.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            seed: p.seed,
            stats: {
              matchesPlayed: p.played || 0,
              wins: p.wins || 0,
              losses: p.losses || 0,
              draws: p.draws || 0,
              points: p.points || 0,
              setsWon: p.sets_won || 0,
              setsLost: p.sets_lost || 0,
              gamesWon: p.games_won || 0,
              gamesLost: p.games_lost || 0,
              gameDifference: (p.games_won || 0) - (p.games_lost || 0)
            }
          }));
          setPlayers(mappedPlayers);
        }

        // Fetch Matches (filtered by current season if applicable)
        let query = supabase.from('matches').select('*');
        if (currentSeasonId) {
          query = query.eq('season_id', currentSeasonId);
        }
        
        const { data: matchesData } = await query.order('date', { ascending: false });
        
        if (matchesData) {
          mappedMatches = matchesData.map(m => ({
            id: m.id,
            date: new Date(m.date).toISOString().split('T')[0],
            team1: [m.team1_player1_id, m.team1_player2_id].filter(Boolean) as string[],
            team2: [m.team2_player1_id, m.team2_player2_id].filter(Boolean) as string[],
            sets: [
              { team1: parseInt(m.set1_score?.split('-')[0] || '0'), team2: parseInt(m.set1_score?.split('-')[1] || '0') },
              { team1: parseInt(m.set2_score?.split('-')[0] || '0'), team2: parseInt(m.set2_score?.split('-')[1] || '0') }
            ],
            tieBreaker: m.set3_score ? {
              team1: parseInt(m.set3_score.split('-')[0] || '0'),
              team2: parseInt(m.set3_score.split('-')[1] || '0')
            } : undefined,
            winner: m.winner as 'team1' | 'team2' | 'draw',
            status: m.status as 'scheduled' | 'completed' | 'postponed',
            postponed: m.status === 'postponed',
            availability: m.availability || {}
          }));
        }

        // Derive ALL player stats from completed matches to ensure accuracy
        if (mappedPlayers.length > 0) {
          const playerStats: Record<string, any> = {};
          mappedPlayers.forEach(p => {
              playerStats[p.id] = {
                  matchesPlayed: 0,
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  points: 0,
                  setsWon: 0,
                  setsLost: 0,
                  gamesWon: 0,
                  gamesLost: 0
              };
          });

          mappedMatches.forEach(match => {
            if (match.status === 'completed') {
              const stats = calculateMatchStats(match, settings);
              if (stats.winner) {
                  match.team1.forEach(pid => {
                      if (!playerStats[pid]) return;
                      playerStats[pid].matchesPlayed++;
                      playerStats[pid].points += stats.t1Points;
                      playerStats[pid].gamesWon += stats.t1Games;
                      playerStats[pid].gamesLost += stats.t2Games;
                      playerStats[pid].setsWon += stats.t1Sets;
                      playerStats[pid].setsLost += stats.t2Sets;
                      if (stats.winner === 'team1') playerStats[pid].wins++;
                      else if (stats.winner === 'team2') playerStats[pid].losses++;
                      else playerStats[pid].draws++;
                  });
                  match.team2.forEach(pid => {
                      if (!playerStats[pid]) return;
                      playerStats[pid].matchesPlayed++;
                      playerStats[pid].points += stats.t2Points;
                      playerStats[pid].gamesWon += stats.t2Games;
                      playerStats[pid].gamesLost += stats.t1Games;
                      playerStats[pid].setsWon += stats.t2Sets;
                      playerStats[pid].setsLost += stats.t1Sets;
                      if (stats.winner === 'team2') playerStats[pid].wins++;
                      else if (stats.winner === 'team1') playerStats[pid].losses++;
                      else playerStats[pid].draws++;
                  });
              }
            }
          });

          const playersWithStats = mappedPlayers.map(p => ({
            ...p,
            stats: {
              ...playerStats[p.id],
              gameDifference: (playerStats[p.id]?.gamesWon || 0) - (playerStats[p.id]?.gamesLost || 0)
            }
          }));

          setPlayers(playersWithStats);
        } else if (mappedPlayers.length === 0 && playersData) {
          setPlayers(mappedPlayers);
        }

        setMatches(mappedMatches);

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    } else {
      // No Supabase connection - empty state
      setPlayers([]);
      setMatches([]);
    }
    setLoadingData(false);
  };

  // Fetch Data
  useEffect(() => {
    fetchData();
  }, [currentSeasonId, settings]);


  const handleEditMatchResult = async (updatedMatch: Match) => {
    // 1. Find original match to ensure it exists
    const originalMatch = matches.find(m => m.id === updatedMatch.id);
    if (!originalMatch) return;

    // Force new match to be completed for stat calculation
    const matchForStats = { ...updatedMatch, status: 'completed' as const };
    const newStats = calculateMatchStats(matchForStats, settings);

    // Update DB Match
    if (supabase) {
        const { error } = await supabase.from('matches').update({
            set1_score: `${updatedMatch.sets[0].team1}-${updatedMatch.sets[0].team2}`,
            set2_score: `${updatedMatch.sets[1].team1}-${updatedMatch.sets[1].team2}`,
            set3_score: updatedMatch.tieBreaker ? `${updatedMatch.tieBreaker.team1}-${updatedMatch.tieBreaker.team2}` : null,
            winner: newStats.winner,
            status: 'completed'
        }).eq('id', updatedMatch.id);

        if (error) {
            console.error('Error updating match:', error);
            return;
        }

        // Recalculate and update player stats in DB (for caching/sync)
        // We'll trigger a full re-fetch locally which will derive stats correctly
        await fetchData();

        // Send Email Notification
        const participants = getParticipantsFromData(updatedMatch, players, users);
        const subject = `Match Update: ${participants.names.join(' vs ')}`;
        const html = `
          <h1>Match Result Updated</h1>
          <p>The match between <strong>${participants.names[0]} & ${participants.names[1]}</strong> and <strong>${participants.names[2]} & ${participants.names[3]}</strong> has been updated.</p>
          <p><strong>Winner:</strong> ${newStats.winner === 'team1' ? 'Team 1' : newStats.winner === 'team2' ? 'Team 2' : 'Draw'}</p>
          <p><strong>Score:</strong> ${updatedMatch.sets.map(s => `${s.team1}-${s.team2}`).join(', ')}</p>
          <p><a href="https://cortapp.vercel.app/history">View Match History</a></p>
        `;
        
        if (participants.emails.length > 0) {
            sendEmailNotification(participants.emails, subject, html);
        }
    } else {
        // Offline mode
        setMatches(prev => prev.map(m => m.id === updatedMatch.id ? { ...updatedMatch, winner: newStats.winner, status: 'completed' } : m));
        // Recalculate players locally
        fetchData();
    }
  };

  const handleUpdateMatch = async (updated: Match) => {
    if (supabase) {
        const { error } = await supabase.from('matches').update({
            date: updated.date,
            status: updated.status,
            winner: updated.winner,
            team1_player1_id: updated.team1[0],
            team1_player2_id: updated.team1[1],
            team2_player1_id: updated.team2[0],
            team2_player2_id: updated.team2[1]
        }).eq('id', updated.id);
        
        if (error) {
            console.error('Error updating match:', error);
            alert('Failed to update match: ' + error.message);
            return;
        }

        setMatches(prev => prev.map(m => (m.id === updated.id ? updated : m)));
    } else {
        setMatches(prev => prev.map(m => (m.id === updated.id ? updated : m)));
    }
  };

  const handleResetForNewSeason = async () => {
    if (supabase) {
        // Reset all player stats to 0
        const zeroStats = {
            points: 0, wins: 0, losses: 0, draws: 0, played: 0,
            sets_won: 0, sets_lost: 0, games_won: 0, games_lost: 0
        };
        
        // This updates ALL players. Be careful.
        // Supabase usually requires WHERE clause for updates.
        // We can loop or use a broader query.
        // update players set ... where id in (all ids)
        // Or better, just loop for now.
        const { data: allPlayers } = await supabase.from('players').select('id');
        if (allPlayers) {
            for (const p of allPlayers) {
                await supabase.from('players').update(zeroStats).eq('id', p.id);
            }
        }
        
        setMatches([]); // Clear local matches
        setPlayers(prev => prev.map(p => ({
            ...p,
            stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
        })));
    } else {
        setMatches([]);
        setPlayers(prev => prev.map(p => ({
            ...p,
            stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
        })));
    }
  };

  const handleAddPlayer = async (name: string, avatar?: string, email?: string, seed?: number) => {
    if (supabase) {
        const { data, error } = await supabase.from('players').insert([{ name, avatar, seed }]).select().single();
        
        if (error) {
            console.error('Error adding player:', error);
            alert('Failed to add player: ' + error.message);
            throw error;
        }

        if (data) {
             const newPlayer: Player = {
                id: data.id,
                name: data.name,
                avatar: data.avatar,
                seed: data.seed,
                stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
             };
             // Use functional update to ensure fresh state
             setPlayers(prev => [...prev, newPlayer]);

             // Invite user if email provided
             if (email && email.trim()) {
                 try {
                    const result = await inviteUser(email, 'viewer', data.id);
                    
                    if (result && !result.emailSent) {
                        // Email failed (or we just want to be safe), show copy link dialog
                        const inviteLink = `https://cortapp.vercel.app/login`; // Or specific signup link
                        const message = `Player added! \n\nBecause email delivery can be unreliable without a custom domain, please manually send this link to ${name}:\n\n${inviteLink}\n\n(Ask them to sign up with: ${email})`;
                        
                        // Small timeout to ensure UI updates first
                        setTimeout(() => {
                            window.prompt(message, inviteLink);
                        }, 100);
                    } else if (result && result.emailSent) {
                        alert(`Player added and invite email sent to ${email}!`);
                    }
                 } catch (err) {
                    console.error("Failed to invite user:", err);
                    alert("Player added, but failed to send invite email.");
                 }
             }
        }
    } else {
        const newPlayer: Player = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            avatar,
            stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
        };
        setPlayers(prev => [...prev, newPlayer]);

        if (email) {
            alert('Cannot invite user in offline mode');
        }
    }
  };

  const handleUpdatePlayer = async (id: string, name: string, avatar?: string, seed?: number) => {
    if (supabase) {
        const { error } = await supabase.from('players').update({ name, avatar, seed }).eq('id', id);
        
        if (error) {
            console.error('Error updating player:', error);
            alert('Failed to update player: ' + error.message);
            return;
        }

        setPlayers(players.map(p => p.id === id ? { ...p, name, avatar, seed } : p));
    } else {
        setPlayers(players.map(p => p.id === id ? { ...p, name, avatar, seed } : p));
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this player? This cannot be undone.')) return;

    if (supabase) {
        const { error } = await supabase.from('players').delete().eq('id', id);
        
        if (error) {
            console.error('Error deleting player:', error);
            if (error.code === '23503') { // Foreign key violation
                alert('Cannot delete player because they are part of existing matches or invites. Please delete those first.');
            } else {
                alert('Failed to delete player: ' + error.message);
            }
            return;
        }

        setPlayers(players.filter(p => p.id !== id));
    } else {
        setPlayers(players.filter(p => p.id !== id));
    }
  };

  if (loadingData && supabase) {
      return <div className="p-8 text-center">Loading Data...</div>;
  }

  return (
    <Routes>
        <Route path="/" element={<Layout />}>
        {/* Public Route */}
        <Route path="login" element={<Login />} />

        {/* Protected Routes */}
        <Route index element={<RequireAuth><Home players={players} /></RequireAuth>} />
        <Route path="fixtures" element={<RequireAuth><Fixtures players={players} matches={matches} onUpdateMatch={handleUpdateMatch} /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="rules" element={<RequireAuth><Rules /></RequireAuth>} />
        <Route path="player/:id" element={<RequireAuth><PlayerProfile players={players} matches={matches} /></RequireAuth>} />
        <Route path="chat" element={<RequireAuth><Chat matches={matches} players={players} /></RequireAuth>} />
        <Route path="add-match" element={<RequireAuth><AddMatch matches={matches} players={players} onAddResult={handleEditMatchResult} /></RequireAuth>} />
        
        {/* Admin Routes (already guarded by UI but good to add check) */}
        <Route path="players" element={<RequireAuth><PlayersPage players={players} onAddPlayer={handleAddPlayer} onUpdatePlayer={handleUpdatePlayer} onDeletePlayer={handleDeletePlayer} /></RequireAuth>} />
        <Route path="history" element={<RequireAuth><HistoryPage matches={matches} players={players} onEditResult={handleEditMatchResult} /></RequireAuth>} />
        <Route path="users" element={<RequireAuth><UsersPage players={players} /></RequireAuth>} />
        <Route path="seasons" element={<RequireAuth><Seasons players={players} matches={matches} onReset={handleResetForNewSeason} /></RequireAuth>} />
        </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <SeasonProvider>
          <ChatProvider>
            <AvailabilityProvider>
              <BrowserRouter>
                 <MainApp />
              </BrowserRouter>
            </AvailabilityProvider>
          </ChatProvider>
        </SeasonProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
