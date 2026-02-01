import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { AddMatch } from './pages/AddMatch';
import { Fixtures } from './pages/Fixtures';
import { PlayersPage } from './pages/Players';
import { HistoryPage } from './pages/History';
import { Login } from './pages/Login';
import { UsersPage } from './pages/UsersPage';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { SeasonProvider, useSeason } from './context/SeasonContext';
import { Seasons } from './pages/Seasons';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { Settings } from './pages/Settings';
import { Chat } from './pages/Chat';
import { Match, Player } from './types';
import { supabase } from './lib/supabase';

function MainApp() {
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

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      if (supabase) {
        try {
          // Fetch Players
          const { data: playersData } = await supabase
            .from('players')
            .select('*');
          
          if (playersData) {
            const mappedPlayers: Player[] = playersData.map(p => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
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
          // For now, we fetch all and filter in memory or fetch by season_id if set
          let query = supabase.from('matches').select('*');
          if (currentSeasonId) {
            query = query.eq('season_id', currentSeasonId);
          }
          
          const { data: matchesData } = await query.order('date', { ascending: false });
          
          if (matchesData) {
            const mappedMatches: Match[] = matchesData.map(m => ({
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
              postponed: m.status === 'postponed'
            }));
            setMatches(mappedMatches);
          }

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

    fetchData();
  }, [currentSeasonId]);

  const handleAddMatch = async (data: any) => {
    // Calculate stats first (same logic as before)
    const newMatch: Match = {
      id: data.matchId || (supabase ? undefined : Math.random().toString(36).substr(2, 9)), // Let Supabase gen ID if not provided
      date: new Date().toISOString().split('T')[0],
      team1: data.team1,
      team2: data.team2,
      sets: [
        { team1: parseInt(data.sets[0].t1), team2: parseInt(data.sets[0].t2) },
        { team1: parseInt(data.sets[1].t1), team2: parseInt(data.sets[1].t2) },
      ],
      winner: 'team1', // Placeholder
      status: 'completed'
    };
    
    // Determine winner based on sets and tie-breaker
    let t1Sets = 0;
    let t2Sets = 0;
    let t1Games = 0;
    let t2Games = 0;

    newMatch.sets.forEach(s => {
      if (s.team1 > s.team2) t1Sets++;
      else if (s.team2 > s.team1) t2Sets++;
      t1Games += s.team1;
      t2Games += s.team2;
    });
    
    if (data.tieBreaker) {
        newMatch.tieBreaker = {
            team1: parseInt(data.tieBreaker.t1),
            team2: parseInt(data.tieBreaker.t2)
        };
        t1Games += newMatch.tieBreaker.team1;
        t2Games += newMatch.tieBreaker.team2;
    }

    let t1Points = 0;
    let t2Points = 0;

    if (t1Sets > t2Sets) {
        newMatch.winner = 'team1';
        t1Points = settings.points_win;
        t2Points = settings.points_loss;
    } else if (t2Sets > t1Sets) {
        newMatch.winner = 'team2';
        t2Points = settings.points_win;
        t1Points = settings.points_loss;
    } else {
        // Draw in sets (1-1)
        t1Points = 1; // Base point for winning 1 set
        t2Points = 1; // Base point for winning 1 set
        
        if (newMatch.tieBreaker) {
             if (newMatch.tieBreaker.team1 > newMatch.tieBreaker.team2) {
                 newMatch.winner = 'team1';
                 t1Points += 1; // Extra point for TB win -> 2 total
                 t1Sets++; // Count TB as set won
             } else if (newMatch.tieBreaker.team2 > newMatch.tieBreaker.team1) {
                 newMatch.winner = 'team2';
                 t2Points += 1; // Extra point for TB win -> 2 total
                 t2Sets++; // Count TB as set won
             } else {
                 newMatch.winner = 'draw';
                 // 8-8 tie breaker, neither gets extra point -> 1 total each
             }
        } else {
             newMatch.winner = 'draw';
        }
    }
    
    // Safety check for incomplete matches or weird states
    if (newMatch.sets.length === 1 || (newMatch.sets[1].team1 === 0 && newMatch.sets[1].team2 === 0 && !newMatch.tieBreaker)) {
         if (t1Sets > 0) { t1Points = 1; t2Points = 0; newMatch.winner = 'team1'; } 
         else if (t2Sets > 0) { t1Points = 0; t2Points = 1; newMatch.winner = 'team2'; }
    }

    if (supabase) {
      let insertedMatch;
      
      if (data.matchId) {
           // UPDATE existing match
           const { data: updatedData, error } = await supabase.from('matches').update({
             season_id: currentSeasonId, // Ensure season stays correct or update if needed
             date: newMatch.date, // Update to played date
             team1_player1_id: newMatch.team1[0],
             team1_player2_id: newMatch.team1[1],
             team2_player1_id: newMatch.team2[0],
             team2_player2_id: newMatch.team2[1],
             set1_score: `${newMatch.sets[0].team1}-${newMatch.sets[0].team2}`,
             set2_score: `${newMatch.sets[1].team1}-${newMatch.sets[1].team2}`,
             set3_score: newMatch.tieBreaker ? `${newMatch.tieBreaker.team1}-${newMatch.tieBreaker.team2}` : null,
             winner: newMatch.winner,
             status: 'completed'
           }).eq('id', data.matchId).select().single();

          if (error) {
            console.error('Error updating match:', error);
            return;
          }
          insertedMatch = updatedData;
      } else {
          // INSERT new match
          const { data: insertedData, error } = await supabase.from('matches').insert([{
            season_id: currentSeasonId,
            date: newMatch.date,
            team1_player1_id: newMatch.team1[0],
            team1_player2_id: newMatch.team1[1],
            team2_player1_id: newMatch.team2[0],
            team2_player2_id: newMatch.team2[1],
            set1_score: `${newMatch.sets[0].team1}-${newMatch.sets[0].team2}`,
            set2_score: `${newMatch.sets[1].team1}-${newMatch.sets[1].team2}`,
            set3_score: newMatch.tieBreaker ? `${newMatch.tieBreaker.team1}-${newMatch.tieBreaker.team2}` : null,
            winner: newMatch.winner,
            status: 'completed'
          }]).select().single();

          if (error) {
            console.error('Error inserting match:', error);
            return;
          }
          insertedMatch = insertedData;
      }
      
      // Update local state (optimistic or re-fetch)
      if (insertedMatch) {
         const m = insertedMatch;
         const mapped: Match = {
            id: m.id,
            date: new Date(m.date).toISOString().split('T')[0],
            team1: [m.team1_player1_id, m.team1_player2_id].filter(Boolean) as string[],
            team2: [m.team2_player1_id, m.team2_player2_id].filter(Boolean) as string[],
            sets: newMatch.sets,
            tieBreaker: newMatch.tieBreaker,
            winner: m.winner as any,
            status: m.status as any
         };
         
         if (data.matchId) {
             setMatches(prev => prev.map(match => match.id === data.matchId ? mapped : match));
         } else {
             setMatches(prev => [mapped, ...prev]);
         }
      }

      // 2. Update Players Stats in DB
      // We need to fetch current stats for each player involved and update them.
      // Or use an RPC function (better for concurrency).
      // For now, client-side update:
      const playersToUpdate = [...newMatch.team1, ...newMatch.team2];
      
      for (const pid of playersToUpdate) {
        const player = players.find(p => p.id === pid);
        if (player) {
            const isTeam1 = newMatch.team1.includes(pid);
            const myPoints = isTeam1 ? t1Points : t2Points;
            const myGamesWon = isTeam1 ? t1Games : t2Games;
            const myGamesLost = isTeam1 ? t2Games : t1Games;
            const mySetsWon = isTeam1 ? t1Sets : t2Sets;
            const mySetsLost = isTeam1 ? t2Sets : t1Sets;
            
            let statWin = 0, statLoss = 0, statDraw = 0;
            if (newMatch.winner === (isTeam1 ? 'team1' : 'team2')) statWin = 1;
            else if (newMatch.winner === (isTeam1 ? 'team2' : 'team1')) statLoss = 1;
            else statDraw = 1;

            const newStats = {
                played: (player.stats.matchesPlayed || 0) + 1,
                wins: (player.stats.wins || 0) + statWin,
                losses: (player.stats.losses || 0) + statLoss,
                draws: (player.stats.draws || 0) + statDraw,
                points: (player.stats.points || 0) + myPoints,
                sets_won: (player.stats.setsWon || 0) + mySetsWon,
                sets_lost: (player.stats.setsLost || 0) + mySetsLost,
                games_won: (player.stats.gamesWon || 0) + myGamesWon,
                games_lost: (player.stats.gamesLost || 0) + myGamesLost
            };
            
            await supabase.from('players').update(newStats).eq('id', pid);
        }
      }
      
      // Refresh players
      // ... (re-fetch or optimistic update)
      // Optimistic:
      setPlayers(prev => prev.map(p => {
        if (!playersToUpdate.includes(p.id)) return p;
        
        const isTeam1 = newMatch.team1.includes(p.id);
        const myPoints = isTeam1 ? t1Points : t2Points;
        const myGamesWon = isTeam1 ? t1Games : t2Games;
        const myGamesLost = isTeam1 ? t2Games : t1Games;
        const mySetsWon = isTeam1 ? t1Sets : t2Sets;
        const mySetsLost = isTeam1 ? t2Sets : t1Sets;
        
        let statWin = 0, statLoss = 0, statDraw = 0;
        if (myPoints >= settings.points_win) statWin = 1;
        else if (myPoints <= settings.points_loss) statLoss = 1;
        else statDraw = 1;

        return {
            ...p,
            stats: {
                ...p.stats,
                matchesPlayed: (p.stats.matchesPlayed || 0) + 1,
                wins: (p.stats.wins || 0) + statWin,
                losses: (p.stats.losses || 0) + statLoss,
                draws: (p.stats.draws || 0) + statDraw,
                points: (p.stats.points || 0) + myPoints,
                setsWon: (p.stats.setsWon || 0) + mySetsWon,
                setsLost: (p.stats.setsLost || 0) + mySetsLost,
                gamesWon: (p.stats.gamesWon || 0) + myGamesWon,
                gamesLost: (p.stats.gamesLost || 0) + myGamesLost,
                gameDifference: ((p.stats.gamesWon || 0) + myGamesWon) - ((p.stats.gamesLost || 0) + myGamesLost)
            }
        };
      }));
      
    } else {
        // MOCK MODE Logic (same as before)
        // ...
        // Re-implement the local state logic from previous file
        if (data.matchId) {
            setMatches(prev => prev.filter(m => m.id !== data.matchId));
        }
        setMatches(prev => [newMatch, ...prev]);
        
        // Update players locally
        setPlayers(prev => prev.map(p => {
            const isTeam1 = newMatch.team1.includes(p.id);
            const isTeam2 = newMatch.team2.includes(p.id);
            if (!isTeam1 && !isTeam2) return p;

            const myPoints = isTeam1 ? t1Points : t2Points;
            const myGamesWon = isTeam1 ? t1Games : t2Games;
            const myGamesLost = isTeam1 ? t2Games : t1Games;
            const mySetsWon = isTeam1 ? t1Sets : t2Sets;
            const mySetsLost = isTeam1 ? t2Sets : t1Sets;
            
            let statWin = 0, statLoss = 0, statDraw = 0;
            if (newMatch.winner === (isTeam1 ? 'team1' : 'team2')) statWin = 1;
            else if (newMatch.winner === (isTeam1 ? 'team2' : 'team1')) statLoss = 1;
            else statDraw = 1;

            return { 
                ...p, 
                stats: { 
                    ...p.stats, 
                    matchesPlayed: p.stats.matchesPlayed + 1,
                    wins: p.stats.wins + statWin,
                    losses: p.stats.losses + statLoss,
                    draws: p.stats.draws + statDraw,
                    points: p.stats.points + myPoints,
                    setsWon: p.stats.setsWon + mySetsWon,
                    setsLost: p.stats.setsLost + mySetsLost,
                    gamesWon: p.stats.gamesWon + myGamesWon,
                    gamesLost: p.stats.gamesLost + myGamesLost,
                    gameDifference: (p.stats.gameDifference || 0) + (myGamesWon - myGamesLost)
                } 
            };
        }));
    }
  };

  const handleEditMatchResult = async (updatedMatch: Match) => {
    // 1. Find original match to revert stats
    const originalMatch = matches.find(m => m.id === updatedMatch.id);
    if (!originalMatch) return;

    // Helper to calculate stats for a match
    const calculateStats = (match: Match) => {
        if (match.status !== 'completed') {
             return { t1Sets: 0, t2Sets: 0, t1Games: 0, t2Games: 0, t1Points: 0, t2Points: 0, winner: null };
        }

        let t1Sets = 0, t2Sets = 0;
        let t1Games = 0, t2Games = 0;
        
        let regularT1Sets = 0;
        let regularT2Sets = 0;

        match.sets.forEach(set => {
            if (set.team1 > set.team2) regularT1Sets++;
            else if (set.team2 > set.team1) regularT2Sets++;
            t1Games += set.team1;
            t2Games += set.team2;
        });
        
        t1Sets = regularT1Sets;
        t2Sets = regularT2Sets;

        if (match.tieBreaker) {
            if (match.tieBreaker.team1 > match.tieBreaker.team2) t1Sets++;
            else if (match.tieBreaker.team2 > match.tieBreaker.team1) t2Sets++;
            
            t1Games += match.tieBreaker.team1;
            t2Games += match.tieBreaker.team2;
        }

        // Determine points & Winner
        let t1Points = 0, t2Points = 0;
        let winner = 'draw';
        
        if (regularT1Sets === 1 && regularT2Sets === 1) {
             // Draw in regular sets (1-1) -> Tie Breaker Rules
             t1Points = 1;
             t2Points = 1;
             
             if (match.tieBreaker) {
                 if (match.tieBreaker.team1 > match.tieBreaker.team2) {
                     winner = 'team1';
                     t1Points += 1;
                 } else if (match.tieBreaker.team2 > match.tieBreaker.team1) {
                     winner = 'team2';
                     t2Points += 1;
                 } else {
                     winner = 'draw';
                 }
             } else {
                 winner = 'draw';
             }
        } else {
             // Standard Win/Loss (2-0 or 0-2)
             if (t1Sets > t2Sets) {
                 winner = 'team1';
                 t1Points = settings.points_win;
                 t2Points = settings.points_loss;
             } else if (t2Sets > t1Sets) {
                 winner = 'team2';
                 t2Points = settings.points_win;
                 t1Points = settings.points_loss;
             } else {
                 t1Points = settings.points_draw;
                 t2Points = settings.points_draw;
             }
        }
        
        return { t1Sets, t2Sets, t1Games, t2Games, t1Points, t2Points, winner };
    };

    const oldStats = calculateStats(originalMatch);
    // Force new match to be completed for stat calculation
    const newStats = calculateStats({ ...updatedMatch, status: 'completed' });

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
    }

    // Update Players
    setPlayers(prev => prev.map(p => {
        const inOldTeam1 = originalMatch.team1.includes(p.id);
        const inOldTeam2 = originalMatch.team2.includes(p.id);
        const inNewTeam1 = updatedMatch.team1.includes(p.id);
        const inNewTeam2 = updatedMatch.team2.includes(p.id);

        if (!inOldTeam1 && !inOldTeam2 && !inNewTeam1 && !inNewTeam2) return p;

        let diffWins = 0, diffLosses = 0, diffDraws = 0;
        let diffPoints = 0;
        let diffSetsWon = 0, diffSetsLost = 0;
        let diffGamesWon = 0, diffGamesLost = 0;

        // Revert Old Stats
        if (inOldTeam1 || inOldTeam2) {
             const isTeam1 = inOldTeam1;
             const myPoints = isTeam1 ? oldStats.t1Points : oldStats.t2Points;
             const myGamesWon = isTeam1 ? oldStats.t1Games : oldStats.t2Games;
             const myGamesLost = isTeam1 ? oldStats.t2Games : oldStats.t1Games;
             const mySetsWon = isTeam1 ? oldStats.t1Sets : oldStats.t2Sets;
             const mySetsLost = isTeam1 ? oldStats.t2Sets : oldStats.t1Sets;
             
             let statWin = 0, statLoss = 0, statDraw = 0;
             if (oldStats.winner) {
                if (oldStats.winner === (isTeam1 ? 'team1' : 'team2')) statWin = 1;
                else if (oldStats.winner === (isTeam1 ? 'team2' : 'team1')) statLoss = 1;
                else statDraw = 1;
             }

             diffWins -= statWin;
             diffLosses -= statLoss;
             diffDraws -= statDraw;
             diffPoints -= myPoints;
             diffSetsWon -= mySetsWon;
             diffSetsLost -= mySetsLost;
             diffGamesWon -= myGamesWon;
             diffGamesLost -= myGamesLost;
        }

        // Apply New Stats
        if (inNewTeam1 || inNewTeam2) {
             const isTeam1 = inNewTeam1;
             const myPoints = isTeam1 ? newStats.t1Points : newStats.t2Points;
             const myGamesWon = isTeam1 ? newStats.t1Games : newStats.t2Games;
             const myGamesLost = isTeam1 ? newStats.t2Games : newStats.t1Games;
             const mySetsWon = isTeam1 ? newStats.t1Sets : newStats.t2Sets;
             const mySetsLost = isTeam1 ? newStats.t2Sets : newStats.t1Sets;

             let statWin = 0, statLoss = 0, statDraw = 0;
             if (newStats.winner === (isTeam1 ? 'team1' : 'team2')) statWin = 1;
             else if (newStats.winner === (isTeam1 ? 'team2' : 'team1')) statLoss = 1;
             else statDraw = 1;

             diffWins += statWin;
             diffLosses += statLoss;
             diffDraws += statDraw;
             diffPoints += myPoints;
             diffSetsWon += mySetsWon;
             diffSetsLost += mySetsLost;
             diffGamesWon += myGamesWon;
             diffGamesLost += myGamesLost;
        }

        const updatedStats = {
            ...p.stats,
            wins: (p.stats.wins || 0) + diffWins,
            losses: (p.stats.losses || 0) + diffLosses,
            draws: (p.stats.draws || 0) + diffDraws,
            points: (p.stats.points || 0) + diffPoints,
            setsWon: (p.stats.setsWon || 0) + diffSetsWon,
            setsLost: (p.stats.setsLost || 0) + diffSetsLost,
            gamesWon: (p.stats.gamesWon || 0) + diffGamesWon,
            gamesLost: (p.stats.gamesLost || 0) + diffGamesLost,
            gameDifference: ((p.stats.gamesWon || 0) + diffGamesWon) - ((p.stats.gamesLost || 0) + diffGamesLost)
        };
        
        // Update DB player
        if (supabase) {
             supabase.from('players').update({
                wins: updatedStats.wins,
                losses: updatedStats.losses,
                draws: updatedStats.draws,
                points: updatedStats.points,
                sets_won: updatedStats.setsWon,
                sets_lost: updatedStats.setsLost,
                games_won: updatedStats.gamesWon,
                games_lost: updatedStats.gamesLost
             }).eq('id', p.id).then(({ error }) => {
                 if (error) console.error('Error updating player stats:', error);
             });
        }

        return { ...p, stats: updatedStats };
    }));

    // Update Matches State
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? { ...updatedMatch, winner: newStats.winner as any, status: 'completed' } : m));
  };

  const handleAddMatches = async (newMatches: Match[]) => {
    if (supabase) {
      const inserts = newMatches.map(m => ({
        season_id: currentSeasonId,
        date: m.date,
        team1_player1_id: m.team1[0],
        team1_player2_id: m.team1[1],
        team2_player1_id: m.team2[0],
        team2_player2_id: m.team2[1],
        status: m.status,
        winner: null, // Scheduled
        // ... scores are null for scheduled
      }));

      const { data, error } = await supabase.from('matches').insert(inserts).select();
      
      if (error) {
        console.error('Error adding matches:', error);
        return;
      }
      
      if (data) {
        const mapped: Match[] = data.map(m => ({
          id: m.id,
          date: new Date(m.date).toISOString().split('T')[0],
          team1: [m.team1_player1_id, m.team1_player2_id].filter(Boolean) as string[],
          team2: [m.team2_player1_id, m.team2_player2_id].filter(Boolean) as string[],
          sets: [], // Scheduled matches have no sets yet
          winner: null,
          status: m.status as any,
          postponed: m.status === 'postponed'
        }));
        setMatches(prev => [...prev, ...mapped]);
      }
    } else {
        setMatches(prev => [...prev, ...newMatches]);
    }
  };

  const handleUpdateMatch = async (updated: Match) => {
    if (supabase) {
        // Only handling status update (postponed) or basic info for now?
        // If rescheduling, we might update date.
        // Assuming 'updated' has the new values.
        await supabase.from('matches').update({
            date: updated.date,
            status: updated.status,
            winner: updated.winner
        }).eq('id', updated.id);
        
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

  const handleAddPlayer = async (name: string, avatar?: string) => {
    if (supabase) {
        const { data } = await supabase.from('players').insert([{ name, avatar }]).select().single();
        if (data) {
             const newPlayer: Player = {
                id: data.id,
                name: data.name,
                avatar: data.avatar,
                stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
             };
             setPlayers([...players, newPlayer]);
        }
    } else {
        const newPlayer: Player = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            avatar,
            stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
        };
        setPlayers([...players, newPlayer]);
    }
  };

  const handleUpdatePlayer = async (id: string, name: string, avatar?: string) => {
    if (supabase) {
        await supabase.from('players').update({ name, avatar }).eq('id', id);
        setPlayers(players.map(p => p.id === id ? { ...p, name, avatar } : p));
    } else {
        setPlayers(players.map(p => p.id === id ? { ...p, name, avatar } : p));
    }
  };

  if (loadingData && supabase) {
      return <div className="p-8 text-center">Loading Data...</div>;
  }

  return (
    <Routes>
        <Route path="/" element={<Layout />}>
        <Route index element={<Home players={players} />} />
        <Route path="fixtures" element={<Fixtures players={players} matches={matches} onAddMatches={handleAddMatches} onUpdateMatch={handleUpdateMatch} />} />
        <Route path="players" element={<PlayersPage players={players} onAddPlayer={handleAddPlayer} onUpdatePlayer={handleUpdatePlayer} />} />
        {/* <Route path="add-match" element={<AddMatch players={players} onAddMatch={handleAddMatch} matches={matches} />} /> */}
        <Route path="history" element={<HistoryPage matches={matches} players={players} onEditResult={handleEditMatchResult} />} />
        <Route path="login" element={<Login />} />
        <Route path="users" element={<UsersPage players={players} />} />
        <Route path="seasons" element={<Seasons players={players} matches={matches} onReset={handleResetForNewSeason} />} />
        <Route path="settings" element={<Settings />} />
        <Route path="chat" element={<Chat matches={matches} players={players} />} />
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
            <BrowserRouter>
               <MainApp />
            </BrowserRouter>
          </ChatProvider>
        </SeasonProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
