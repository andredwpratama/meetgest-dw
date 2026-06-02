import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { ActionItemEditor } from "./ActionItemEditor";
import { KeyDecisionEditor } from "./KeyDecisionEditor";
import { ExportDialog } from "./ExportDialog";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";
import { getInitials, getAvatarBg } from "@/lib/utils";
import {
  CloudLightning,
  Check,
  Plus,
  X,
  Loader2,
  Clock,
  Users,
  Share2,
  FileCheck,
  TrendingUp,
  AlertCircle,
  RotateCcw
} from "lucide-react";

type Props = {
  meeting: Meeting;
  onChange: (m: Meeting) => void;
  onRefresh?: () => void;
};

export function ResultsPanel({ meeting, onChange, onRefresh }: Props) {
  const [title, setTitle] = useState(meeting.title);
  const [summary, setSummary] = useState(meeting.summary);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    setTitle(meeting.title);
    setSummary(meeting.summary);
  }, [meeting.id, meeting.title, meeting.summary]);

  useDebouncedEffect(
    async () => {
      const trimmedTitle = title.trim();
      const trimmedSummary = summary.trim();

      const patch: { title?: string; summary?: string } = {};
      if (trimmedTitle && trimmedTitle !== meeting.title) {
        patch.title = trimmedTitle;
      }
      if (trimmedSummary !== meeting.summary) {
        patch.summary = trimmedSummary;
      }

      if (!patch.title && !patch.summary) return;

      setIsSaving(true);
      setSaveSuccess(false);

      try {
        const updated = await api.patchMeeting(meeting.id, patch);
        onChange(updated);
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        console.error("Failed to auto-save meeting header:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [title, summary],
    500
  );

  async function addActionItem() {
    try {
      const created = await api.addActionItem(meeting.id, { task: "" });
      onChange({ ...meeting, action_items: [...meeting.action_items, created] });
    } catch (err) {
      console.error("Failed to add action item:", err);
    }
  }

  async function deleteAction(id: string) {
    try {
      await api.deleteActionItem(id);
      onChange({ ...meeting, action_items: meeting.action_items.filter((a) => a.id !== id) });
    } catch (err) {
      console.error("Failed to delete action item:", err);
    }
  }

  async function addDecision() {
    try {
      const created = await api.addKeyDecision(meeting.id, "");
      onChange({ ...meeting, key_decisions: [...meeting.key_decisions, created] });
    } catch (err) {
      console.error("Failed to add key decision:", err);
    }
  }

  async function deleteDecision(id: string) {
    try {
      await api.deleteKeyDecision(id);
      onChange({ ...meeting, key_decisions: meeting.key_decisions.filter((d) => d.id !== id) });
    } catch (err) {
      console.error("Failed to delete key decision:", err);
    }
  }

  const HEADER_LABELS = /^(Meeting|Date|Duration|Participants|Transcribed|Confidence|Agenda|Attendees|Yes|No|Ok|Okay|But|And|So|Then)$/i;

  const derivedSpeakers = useMemo(() => {
    const t = meeting.raw_transcript;
    if (!t) return [];
    // Prefer an explicit "Participants:" / "Attendees:" header line.
    const header = t.match(/^\s*(?:Participants|Attendees)\s*:\s*(.+)$/im);
    if (header) {
      const names = header[1]
        .split(/,|;/)
        .map((n) => n.trim())
        .filter((n) => n.length > 1);
      if (names.length) return Array.from(new Set(names));
    }
    // Fallback: speaker labels in dialogue, e.g. "[00:00:04] Sarah Mitchell:" or "John: ...".
    const matches = t.match(/(?:^|\])\s*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z.]+)*)\s*:/gm);
    if (!matches) return [];
    const names = matches
      .map((m) => m.replace(/^\]/, "").replace(/:$/, "").trim())
      .filter((n) => n.length > 1 && !HEADER_LABELS.test(n));
    return Array.from(new Set(names));
  }, [meeting.id]);

  // Stored participants override the derived list once the user edits them.
  const [participants, setParticipants] = useState<string[]>(
    () => meeting.participants ?? derivedSpeakers,
  );
  const participantsDirty = useRef(false);

  useEffect(() => {
    participantsDirty.current = false;
    setParticipants(meeting.participants ?? derivedSpeakers);
  }, [meeting.id]);

  useDebouncedEffect(
    async () => {
      if (!participantsDirty.current) return;
      const clean = participants.map((p) => p.trim()).filter(Boolean);
      setIsSaving(true);
      setSaveSuccess(false);
      try {
        const updated = await api.patchMeeting(meeting.id, { participants: clean });
        onChange(updated);
        participantsDirty.current = false;
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        console.error("Failed to auto-save participants:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [participants],
    600,
  );

  function editParticipant(i: number, value: string) {
    participantsDirty.current = true;
    setParticipants((prev) => prev.map((p, idx) => (idx === i ? value : p)));
  }
  function removeParticipant(i: number) {
    participantsDirty.current = true;
    setParticipants((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addParticipant() {
    participantsDirty.current = true;
    setParticipants((prev) => [...prev, ""]);
  }

  const duration = useMemo(() => {
    const t = meeting.raw_transcript;
    if (!t) return { minutes: 0, explicit: false };
    // Prefer an explicit "Duration: HH:MM:SS" or "Duration: MM:SS" header.
    const m = t.match(/Duration\s*:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (m) {
      const minutes =
        m[3] !== undefined
          ? Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(m[3]) / 60)
          : Number(m[1]) + Math.round(Number(m[2]) / 60);
      if (minutes > 0) return { minutes, explicit: true };
    }
    // Fallback: estimate from word count (~130 wpm).
    const words = t.trim().split(/\s+/).length;
    return { minutes: Math.max(1, Math.round(words / 130)), explicit: false };
  }, [meeting.id]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <Card className="rounded-2xl border-none shadow-md bg-white overflow-hidden p-2">
        <CardHeader className="p-6 md:p-8 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileCheck className="h-6 w-6 text-[#8CC0EB]" />
              <span>Meeting Digest Report</span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs font-medium">
              View summary, estimated metrics, decisions, and action items.
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              onClick={() => setExportOpen(true)}
              className="h-10 px-4 bg-[#8CC0EB] hover:bg-[#8CC0EB]/85 text-[#1E293B] font-bold rounded-xl border-none shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Share2 className="size-4" />
              <span>Export Digest</span>
            </Button>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                className="h-10 px-4 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="size-4" />
                <span>New Meeting</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8 space-y-8">
          <div className="space-y-2 pb-6 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Meeting Title
              </label>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold pr-1">
                {isSaving ? (
                  <>
                    <Loader2 className="size-3 animate-spin text-[#8CC0EB]" />
                    <span>Saving...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-600 font-bold">All changes saved!</span>
                  </>
                ) : (
                  <>
                    <CloudLightning className="size-3 text-slate-300" />
                    <span>Auto-saves instantly</span>
                  </>
                )}
              </div>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg md:text-xl font-bold border-none shadow-none bg-slate-50/50 hover:bg-slate-50/20 focus:bg-white rounded-xl h-11 px-4 text-slate-800 transition focus-visible:ring-2 focus-visible:ring-[#8CC0EB]/50 w-full"
              placeholder="Meeting Title"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8CC0EB]/15 text-[#8CC0EB] shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Duration
                </span>
                <span className="block text-sm font-bold text-slate-800 mt-0.5">
                  {duration.minutes > 0 ? `${duration.minutes} min` : "N/A"}
                </span>
                <span className="block text-[9px] text-slate-400 font-medium">
                  {duration.explicit ? "From transcript" : "Estimated from word count"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFEBCC]/30 text-[#e69b35] shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Participants
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{participants.length}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {participants.map((name, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-white border border-slate-200 shadow-sm"
                    >
                      <Avatar size="sm" className={`size-4 ${getAvatarBg(name || "?")}`} title={name}>
                        <AvatarFallback className="font-bold text-[7px] bg-transparent text-inherit">
                          {getInitials(name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <input
                        value={name}
                        onChange={(e) => editParticipant(i, e.target.value)}
                        placeholder="Name"
                        className="bg-transparent outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-300"
                        style={{ width: `${Math.max(3, (name.length || 4))}ch` }}
                      />
                      <button
                        type="button"
                        onClick={() => removeParticipant(i)}
                        className="text-slate-300 hover:text-red-500 transition cursor-pointer"
                        aria-label={`Remove ${name || "participant"}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={addParticipant}
                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="size-3" /> Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <TrendingUp className="h-4 w-4 text-[#8CC0EB]" />
              <span>Executive Summary</span>
            </div>
            <Textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full border-slate-200 bg-slate-50/20 hover:bg-slate-50/10 focus:bg-white text-sm leading-relaxed text-slate-700 rounded-xl transition duration-150 focus-visible:ring-2 focus-visible:ring-[#8CC0EB]/50 p-4"
              placeholder="Describe what happened in this meeting..."
            />
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="size-2 rounded-full bg-[#FFEBCC]" />
                <span>Key Decisions</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addDecision}
                className="h-8 px-3 text-xs border-[#FFEBCC] text-[#b3741a] hover:bg-[#FFEBCC]/20 rounded-xl font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                <span>Add Decision</span>
              </Button>
            </div>

            {meeting.key_decisions.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/20">
                <AlertCircle className="size-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-500">No decisions documented yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Click "Add Decision" to record one.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {meeting.key_decisions.map((d) => (
                  <KeyDecisionEditor
                    key={d.id}
                    item={d}
                    onChange={(updated) =>
                      onChange({
                        ...meeting,
                        key_decisions: meeting.key_decisions.map((x) =>
                          x.id === updated.id ? updated : x
                        ),
                      })
                    }
                    onDelete={() => deleteDecision(d.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="size-2 rounded-full bg-[#8CC0EB]" />
                <span>Action Items</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addActionItem}
                className="h-8 px-3 text-xs border-[#8CC0EB] text-[#2c5375] hover:bg-[#8CC0EB]/20 rounded-xl font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                <span>Add Task</span>
              </Button>
            </div>

            {meeting.action_items.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/20">
                <AlertCircle className="size-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-500">No action items defined yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Click "Add Task" to create one.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-white">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="pl-4 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Task Description
                      </TableHead>
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Owner
                      </TableHead>
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Due Date
                      </TableHead>
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </TableHead>
                      <TableHead className="pr-4 h-10 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 w-[80px]">
                        Save
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meeting.action_items.map((a) => (
                      <ActionItemEditor
                        key={a.id}
                        item={a}
                        onChange={(updated) =>
                          onChange({
                            ...meeting,
                            action_items: meeting.action_items.map((x) =>
                              x.id === updated.id ? updated : x
                            ),
                          })
                        }
                        onDelete={() => deleteAction(a.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        meeting={{ ...meeting, title, summary }}
      />
    </div>
  );
}
