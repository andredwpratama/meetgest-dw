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

  const speakers = useMemo(() => {
    if (!meeting.raw_transcript) return [];
    const matches = meeting.raw_transcript.match(/^(?:\[)?([A-Z][a-zA-Z\s]{0,20})(?:\])?\s*:/gm);
    if (!matches) return [];
    const cleanNames = matches.map((m) => m.replace(/[\[\]:]/g, "").trim());
    return Array.from(new Set(cleanNames)).filter(
      (name) => name.length > 1 && !/^(Yes|No|Ok|Okay|But|And|So|Then)$/i.test(name)
    );
  }, [meeting.id]);

  const estimatedDuration = useMemo(() => {
    if (!meeting.raw_transcript) return 0;
    const words = meeting.raw_transcript.trim().split(/\s+/).length;
    return Math.max(5, Math.round(words / 130));
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
                  {estimatedDuration > 0 ? `${estimatedDuration} min` : "N/A"}
                </span>
                <span className="block text-[9px] text-slate-400 font-medium">
                  Estimated from word count
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFEBCC]/30 text-[#e69b35] shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Participants
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-800">
                    {speakers.length > 0 ? `${speakers.length} speakers` : "2 speakers"}
                  </span>
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {speakers.length > 0 ? (
                      speakers.slice(0, 3).map((speaker) => (
                        <Avatar
                          key={speaker}
                          size="sm"
                          className={`size-5 border border-white ${getAvatarBg(speaker)}`}
                          title={speaker}
                        >
                          <AvatarFallback className="font-bold text-[8px] bg-transparent text-inherit">
                            {getInitials(speaker)}
                          </AvatarFallback>
                        </Avatar>
                      ))
                    ) : (
                      <>
                        <Avatar size="sm" className="size-5 border border-white bg-slate-200">
                          <AvatarFallback className="font-bold text-[8px] text-slate-500 bg-transparent">
                            P1
                          </AvatarFallback>
                        </Avatar>
                        <Avatar size="sm" className="size-5 border border-white bg-slate-300">
                          <AvatarFallback className="font-bold text-[8px] text-slate-500 bg-transparent">
                            P2
                          </AvatarFallback>
                        </Avatar>
                      </>
                    )}
                    {speakers.length > 3 && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 border border-white text-[8px] font-bold text-slate-600">
                        +{speakers.length - 3}
                      </div>
                    )}
                  </div>
                </div>
                <span className="block text-[9px] text-slate-400 font-medium truncate">
                  {speakers.length > 0 ? speakers.join(", ") : "Estimated from dialog"}
                </span>
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
