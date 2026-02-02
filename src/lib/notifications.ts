import { supabase } from './supabase';

/**
 * Sends an email notification using a Supabase Edge Function.
 * Note: You must deploy the 'send-email' function to your Supabase project for this to work.
 */
export const sendEmailNotification = async (
  to: string, 
  subject: string, 
  html: string
) => {
  if (!supabase) {
    console.log('[Mock Email]', { to, subject, html });
    return;
  }

  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html }
    });

    if (error) {
      console.warn('Failed to send email notification (check if Edge Function is deployed):', error);
    }
  } catch (err) {
    console.error('Error invoking send-email function:', err);
  }
};

/**
 * Helper to get participants (users with email) for a given match.
 */
export const getMatchParticipants = async (matchId: string) => {
  if (!supabase) return [];
  
  const { data: match } = await supabase
    .from('matches')
    .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
    .eq('id', matchId)
    .single();

  if (!match) return [];

  const playerIds = [
    match.team1_player1_id,
    match.team1_player2_id,
    match.team2_player1_id,
    match.team2_player2_id
  ].filter(Boolean) as string[];

  if (playerIds.length === 0) return [];

  const { data: participants } = await supabase
    .from('profiles')
    .select('id, email')
    .in('player_id', playerIds);
    
  return participants || [];
};

/**
 * Triggered when a new chat message is sent.
 * This should notify other participants in the match.
 */
export const notifyNewMessage = async (
  matchId: string, 
  senderName: string, 
  text: string,
  participants: { email?: string; id: string }[]
) => {
  console.log(`[Notification] Processing new message from ${senderName} in match ${matchId}`);

  // Filter out users who don't have an email or are the sender (logic should be handled by caller or here)
  // For this demo, we assume the caller passes relevant participants
  
  for (const p of participants) {
    if (p.email) {
      await sendEmailNotification(
        p.email,
        `New Message from ${senderName}`,
        `<p><strong>${senderName}</strong> sent a message in your match chat:</p>
         <blockquote>${text}</blockquote>
         <p><a href="https://cortapp.vercel.app/chat">Open Chat</a></p>`
      );
    }
  }
};

/**
 * Triggered when a match result is updated.
 */
export const notifyMatchUpdate = async (matchId: string, resultDescription: string) => {
    const participants = await getMatchParticipants(matchId);
    
    for (const p of participants) {
        if (p.email) {
            await sendEmailNotification(
                p.email,
                'Match Update',
                `<p>A match you are involved in has been updated:</p>
                 <p><strong>${resultDescription}</strong></p>
                 <p><a href="https://cortapp.vercel.app/history">View Match History</a></p>`
            );
        }
    }
};
