-- Create rules table
CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- Rules for public viewing
CREATE POLICY "Rules are viewable by everyone" ON rules
  FOR SELECT USING (true);

-- Rules for admin editing
CREATE POLICY "Admins can insert rules" ON rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update rules" ON rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete rules" ON rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rules_updated_at
  BEFORE UPDATE ON rules
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insert initial rules
INSERT INTO rules (content, display_order) VALUES
('Throughout the season you will pair up with someone different each game.', 1),
('All games to have been played by the end of W/C the 9th February 2026.', 2),
('£10 entry fee to be paid before the 27th October 2025.', 3),
('The WhatsApp Green, Blue & Red groups will be used for arranging games. Example: If your next game is a green game, you will go to the green WhatsApp group within the community and arrange your game with the others. One of you will need to be responsible for booking the court and paying. The others will need to send you £6 each to cover the cost.', 4),
('You will be responsible of arranging and paying for your own games.', 5),
('Normal padel points to be used (40-15 etc).', 6),
('Golden point will be used if game goes to 40-40.', 7),
('Games will last for 1 hour. There will be no more than 2 competitive sets played over the hour. A team will either win 2-0 or tie 1-1. If the game finishes 1-1 on sets there will be a super tie breaker, which will be based on a Mexicano best of 16 points scoring system where each player serves 4 times. If after 16 points have been played it is 8-8 on points, the game will be tied and end on a draw and each player gets 1 point.', 8),
('If your team win the super tie-breaker you will both will receive an additional 1 point each so will have 2 points in total that week. You will get an additional game towards the +/- if you win a tiebreaker or super tie-breaker.', 9),
('If after the hour there has only been 1 full set played, the team who won the first set will get 1 point only. The games from the 2nd set will count towards the league table', 10),
('Please update the relevant colour WhatsApp group the score so the league can be updated. Scores will be recorded on the website each week.', 11),
('At the end of the league, the winner with the most points will win a prize equal to £60. The runner up will win a prize equal to £40.', 12);
