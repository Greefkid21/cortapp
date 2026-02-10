import React, { useState, useEffect } from 'react';
import { Check, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useAvailability } from '../context/AvailabilityContext';
import { cn, formatDate } from '../lib/utils';

interface AvailabilityWidgetProps {
  playerId: string;
  weekStartDate: string; // YYYY-MM-DD
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function AvailabilityWidget({ playerId, weekStartDate }: AvailabilityWidgetProps) {
  const { getAvailability, updateAvailability } = useAvailability();
  const [status, setStatus] = useState<'yes' | 'no' | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load initial state
  useEffect(() => {
    const existing = getAvailability(playerId, weekStartDate);
    if (existing) {
      setStatus(existing.isAvailable ? 'yes' : 'no');
      setSelectedDays(existing.daysAvailable || []);
      setNote(existing.note || '');
    }
  }, [playerId, weekStartDate, getAvailability]);

  const handleSetStatus = async (newStatus: 'yes' | 'no') => {
    setStatus(newStatus);
    if (newStatus === 'no') {
      setSelectedDays([]); // Clear days if no
    }
    // Auto-save status change immediately
    await save(newStatus, newStatus === 'no' ? [] : selectedDays, note);
  };

  const toggleDay = async (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    setSelectedDays(newDays);
    // Auto-save day change
    await save(status!, newDays, note);
  };

  const handleNoteBlur = async () => {
    await save(status!, selectedDays, note);
  };

  const save = async (s: 'yes' | 'no' | null, d: string[], n: string) => {
    if (!s) return;
    setIsSaving(true);
    await updateAvailability(playerId, weekStartDate, s === 'yes', d, n);
    setIsSaving(false);
  };

  if (!playerId) return null;

  const startDateObj = new Date(weekStartDate);
  const endDateObj = new Date(startDateObj);
  endDateObj.setDate(endDateObj.getDate() + 4); // Mon -> Fri

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <div>
            <h3 className="font-bold text-slate-800">Availability for Next Week</h3>
            <p className="text-xs text-slate-500">
                {formatDate(weekStartDate)} - {formatDate(endDateObj.toISOString())} • 8:00–9:00am
            </p>
        </div>
        {isSaving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Core Question */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Are you available to play?</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSetStatus('yes')}
              className={cn(
                "flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all",
                status === 'yes'
                  ? "bg-green-100 text-green-700 ring-2 ring-green-500 ring-offset-1"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Check className="w-5 h-5" /> YES
            </button>
            <button
              onClick={() => handleSetStatus('no')}
              className={cn(
                "flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all",
                status === 'no'
                  ? "bg-red-100 text-red-700 ring-2 ring-red-500 ring-offset-1"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <X className="w-5 h-5" /> NO
            </button>
          </div>
        </div>

        {/* Days Selection */}
        {status === 'yes' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-sm font-medium text-slate-700 mb-2">Which days?</p>
            <div className="flex justify-between gap-1">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-bold transition-colors",
                    selectedDays.includes(day)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDays.length === 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Please select at least one day
                </p>
            )}
          </div>
        )}

        {/* Notes */}
        {status && (
            <div className="border-t border-slate-100 pt-2">
                <button 
                    onClick={() => setIsNoteOpen(!isNoteOpen)}
                    className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-800"
                >
                    {isNoteOpen ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                    {note ? 'Edit Note' : 'Add Note (Optional)'}
                </button>
                
                {isNoteOpen && (
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onBlur={handleNoteBlur}
                        placeholder="e.g. Not Wednesday – school run"
                        className="w-full mt-2 p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-300"
                        rows={2}
                    />
                )}
                {!isNoteOpen && note && (
                    <p className="text-xs text-slate-600 mt-1 italic">"{note}"</p>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
