import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FileText, Save, Plus, Trash2, GripVertical, AlertCircle, Check } from 'lucide-react';
import { Rule } from '../types';

const INITIAL_RULES = [
  "Throughout the season you will pair up with someone different each game.",
  "All games to have been played by the end of W/C the 9th February 2026.",
  "£10 entry fee to be paid before the 27th October 2025.",
  "The WhatsApp Green, Blue & Red groups will be used for arranging games. Example: If your next game is a green game, you will go to the green WhatsApp group within the community and arrange your game with the others. One of you will need to be responsible for booking the court and paying. The others will need to send you £6 each to cover the cost.",
  "You will be responsible of arranging and paying for your own games.",
  "Normal padel points to be used (40-15 etc).",
  "Golden point will be used if game goes to 40-40.",
  "Games will last for 1 hour. There will be no more than 2 competitive sets played over the hour. A team will either win 2-0 or tie 1-1. If the game finishes 1-1 on sets there will be a super tie breaker, which will be based on a Mexicano best of 16 points scoring system where each player serves 4 times. If after 16 points have been played it is 8-8 on points, the game will be tied and end on a draw and each player gets 1 point.",
  "If your team win the super tie-breaker you will both will receive an additional 1 point each so will have 2 points in total that week. You will get an additional game towards the +/- if you win a tiebreaker or super tie-breaker.",
  "If after the hour there has only been 1 full set played, the team who won the first set will get 1 point only. The games from the 2nd set will count towards the league table",
  "Please update the relevant colour WhatsApp group the score so the league can be updated. Scores will be recorded on the website each week.",
  "At the end of the league, the winner with the most points will win a prize equal to £60. The runner up will win a prize equal to £40."
];

export function Rules() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error('Supabase not configured');

      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "rules" does not exist')) {
          // Table doesn't exist yet, use initial rules
          const fallbackRules: Rule[] = INITIAL_RULES.map((content, index) => ({
            id: `temp-${index}`,
            content,
            display_order: index + 1
          }));
          setRules(fallbackRules);
        } else {
          throw error;
        }
      } else if (data && data.length > 0) {
        setRules(data);
      } else {
        // Table exists but empty
        const fallbackRules: Rule[] = INITIAL_RULES.map((content, index) => ({
          id: `temp-${index}`,
          content,
          display_order: index + 1
        }));
        setRules(fallbackRules);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      // Final fallback
      const fallbackRules: Rule[] = INITIAL_RULES.map((content, index) => ({
        id: `temp-${index}`,
        content,
        display_order: index + 1
      }));
      setRules(fallbackRules);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    const newRule: Rule = {
      id: `new-${Date.now()}`,
      content: '',
      display_order: rules.length > 0 ? Math.max(...rules.map(r => r.display_order)) + 1 : 1
    };
    setRules([...rules, newRule]);
  };

  const handleUpdateRuleContent = (id: string, content: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, content } : r));
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Delete all existing rules (simplified approach for small lists)
      // or we can upsert. Let's try upsert but clean up removed ones.
      
      // Filter out temporary IDs
      const rulesToSave = rules.map((r, index) => ({
        content: r.content,
        display_order: index + 1
      }));

      // In a real app, we'd handle IDs better, but for this simple list,
      // we'll clear and re-insert if possible, or just upsert.
      // Since we don't have a stable way to handle IDs without complex logic,
      // we'll try to delete all and insert new.
      
      const { error: deleteError } = await supabase
        .from('rules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('rules')
        .insert(rulesToSave);

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Rules saved successfully!' });
      setEditing(false);
      fetchRules();
    } catch (err: any) {
      console.error('Error saving rules:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save rules' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-slate-900">League Rules</h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              editing 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
            ) : editing ? (
              <Save className="w-5 h-5" />
            ) : (
              'Edit Rules'
            )}
            {editing ? 'Save Changes' : 'Edit Rules'}
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 space-y-6">
          {editing ? (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="flex gap-3 group">
                  <div className="pt-3 text-slate-400">
                    <GripVertical className="w-5 h-5 cursor-move" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <textarea
                      value={rule.content}
                      onChange={(e) => handleUpdateRuleContent(rule.id, e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none min-h-[80px]"
                      placeholder="Enter rule text..."
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    className="pt-3 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddRule}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Rule
              </button>
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setEditing(false);
                    fetchRules();
                    setMessage(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Save All Rules
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {rules.map((rule, index) => (
                <li key={rule.id} className="flex gap-4 group whitespace-pre-wrap">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center font-bold text-sm border border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                    {index + 1}
                  </div>
                  <div className="pt-1 text-slate-700 leading-relaxed">
                    {rule.content}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
        <h3 className="text-blue-800 font-bold mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Need help?
        </h3>
        <p className="text-blue-700 text-sm leading-relaxed">
          If you have any questions regarding these rules, please contact the league administrator via the WhatsApp community groups.
        </p>
      </div>
    </div>
  );
}
