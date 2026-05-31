import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Sparkles, History, XCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessingPhase } from "@/pages/ProcessorPage";

const PROCESSING_MESSAGES = [
  "Reading your transcript…",
  "Identifying participants…",
  "Extracting action items…",
  "Recognizing key decisions…",
  "Writing executive summary…",
  "Finalizing your digest…",
];

type Props = {
  title: string;
  setTitle: (v: string) => void;
  transcript: string;
  setTranscript: (v: string) => void;
  onProcess: () => void;
  processingPhase: ProcessingPhase;
  error: string | null;
  onOpenHistory: () => void;
};

export function TranscriptInput({
  title,
  setTitle,
  transcript,
  setTranscript,
  onProcess,
  processingPhase,
  error,
  onOpenHistory,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const progressRef = useRef(0);

  const isOverlay = processingPhase === "loading" || processingPhase === "done";

  // Progress bar simulation
  useEffect(() => {
    if (processingPhase === "loading") {
      progressRef.current = 0;
      setProgress(0);
      setMsgIndex(0);

      const tick = setInterval(() => {
        const current = progressRef.current;
        const delta = Math.max((85 - current) * 0.03, 0.2);
        const next = Math.min(current + delta, 85);
        progressRef.current = next;
        setProgress(next);
      }, 150);

      return () => clearInterval(tick);
    }

    if (processingPhase === "done") {
      progressRef.current = 100;
      setProgress(100);
    }

    if (processingPhase === "idle") {
      progressRef.current = 0;
      setProgress(0);
      setMsgIndex(0);
    }
  }, [processingPhase]);

  // Message cycling
  useEffect(() => {
    if (processingPhase !== "loading") return;
    const cycle = setInterval(() => {
      setMsgIndex((i) => (i + 1) % PROCESSING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(cycle);
  }, [processingPhase]);

  const charCount = transcript.length;
  const isTooShort = charCount < 200;
  const isTooLong = charCount > 100000;
  const isTitleEmpty = !title.trim();
  const canProcess = !isTitleEmpty && !isTooShort && !isTooLong && processingPhase === "idle";

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setFileError("Only plain text (.txt) files are supported.");
      return;
    }
    setFileError(null);
    try {
      const text = await file.text();
      setTranscript(text);
      if (isTitleEmpty && file.name) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        setTitle(cleanName);
      }
    } catch (err) {
      console.error("Failed to read file:", err);
      setFileError("Error reading file. Please try again.");
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-1.5 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
          AI Meeting Transcript Processor
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl mx-auto font-medium">
          Transform raw transcripts into high-quality summaries, key decisions, and action items in seconds.
        </p>
      </div>

      <Card className="rounded-2xl border-none shadow-md bg-white p-2 relative overflow-hidden">

        {/* Processing overlay */}
        {isOverlay && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4">

            {/* Progress bar pinned to top */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-t-2xl transition-all duration-300",
                  processingPhase === "done" ? "bg-emerald-500" : "bg-[#8CC0EB]"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Icon */}
            {processingPhase === "done" ? (
              <CheckCircle className="size-10 text-emerald-500 animate-in zoom-in duration-300" />
            ) : (
              <Sparkles className="size-10 text-[#8CC0EB] animate-pulse" />
            )}

            {/* Message */}
            {processingPhase === "done" ? (
              <p className="text-base font-bold text-emerald-600 animate-in fade-in duration-300">
                Digest ready!
              </p>
            ) : (
              <p
                key={msgIndex}
                className="text-sm font-semibold text-slate-700 animate-in fade-in duration-500"
              >
                {PROCESSING_MESSAGES[msgIndex]}
              </p>
            )}

            {/* Subtext */}
            {processingPhase === "loading" && (
              <p className="text-xs text-slate-400">This usually takes 5–15 seconds</p>
            )}
          </div>
        )}

        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Meeting Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Meeting Title <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q3 Marketing Roadmap Sync"
                className="w-full h-11 px-4 border-slate-200 bg-slate-50/50 hover:bg-slate-50/20 focus:bg-white rounded-xl transition duration-150 text-slate-900 placeholder:text-slate-400"
              />
              {!isTitleEmpty && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                  <CheckCircle2 className="size-5" />
                </div>
              )}
            </div>
          </div>

          {/* Transcript Area */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="transcript-content" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Meeting Transcript <span className="text-red-400">*</span>
              </Label>
              <span className="text-[10px] text-slate-400 font-semibold">
                Min 200 chars • Max 100k chars
              </span>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative rounded-xl border-2 border-dashed p-4 transition duration-200 ease-in-out bg-slate-50/40",
                dragActive
                  ? "border-[#8CC0EB] bg-[#8CC0EB]/5 scale-[1.01]"
                  : "border-slate-200/80 hover:border-slate-300"
              )}
            >
              <Textarea
                id="transcript-content"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here, or drag and drop a .txt file..."
                className="min-h-[220px] max-h-[450px] border-none bg-transparent resize-y py-2 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 placeholder:text-slate-400 text-sm leading-relaxed"
              />

              {dragActive && (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center space-y-2 rounded-xl pointer-events-none transition duration-200 animate-in fade-in">
                  <UploadCloud className="size-10 text-[#8CC0EB] animate-bounce" />
                  <p className="text-sm font-semibold text-slate-700">
                    Drop your text file here
                  </p>
                  <p className="text-xs text-slate-400"> plain text (.txt) only</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 pt-3 px-1 mt-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 shadow-sm active:bg-slate-100 transition duration-150 cursor-pointer"
                  >
                    <FileText className="size-3.5" />
                    <span>Upload .txt File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    hidden
                    onChange={handleFileChange}
                  />
                  {fileError && (
                    <span className="inline-flex items-center gap-1 text-red-500 text-[10px] font-medium">
                      <XCircle className="size-3 shrink-0" />
                      {fileError}
                    </span>
                  )}
                  {charCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setTranscript("")}
                      className="px-2.5 py-1.5 rounded-lg text-slate-400 font-bold hover:bg-slate-100 hover:text-slate-600 transition duration-150 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <span
                    className={cn(
                      "font-bold px-2.5 py-0.5 rounded-full text-[10px]",
                      isTooShort && charCount > 0
                        ? "bg-amber-50 text-amber-600"
                        : isTooLong
                        ? "bg-red-50 text-red-600"
                        : charCount >= 200
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {charCount.toLocaleString()} / 100,000 characters
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Character Warnings */}
          {transcript.length > 0 && (isTooShort || isTooLong) && (
            <div className="flex items-center gap-2 text-xs p-3.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100">
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
              <span className="font-medium">
                {isTooShort
                  ? `Transcript needs at least ${200 - charCount} more characters to meet the minimum length (200).`
                  : `Transcript exceeds maximum size by ${(charCount - 100000).toLocaleString()} characters.`}
              </span>
            </div>
          )}

          {/* Validation/API error message */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3.5 text-sm flex gap-3 items-start animate-in shake duration-300">
              <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-900">Processing Failed</h4>
                <p className="text-red-700/90 text-xs mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <Button
                onClick={onProcess}
                disabled={!canProcess}
                size="lg"
                className={cn(
                  "flex-1 sm:flex-initial h-11 px-5 font-bold rounded-xl transition-all duration-200 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer",
                  canProcess
                    ? "bg-[#8CC0EB] hover:bg-[#8CC0EB]/85 text-[#1E293B] hover:shadow-md border-none scale-100 active:scale-[0.98]"
                    : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed"
                )}
              >
                {processingPhase !== "idle" ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4.5" />
                    <span>Generate Digest</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={onOpenHistory}
                variant="outline"
                className="flex-1 sm:flex-initial h-11 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <History className="size-4.5" />
                <span>View History</span>
              </Button>
            </div>

            {!canProcess && processingPhase === "idle" && (
              <p className="text-[10px] text-slate-400 font-semibold text-center sm:text-left">
                {isTitleEmpty
                  ? "💡 Fill in a title & paste a transcript to begin."
                  : isTooShort
                  ? `💡 Add ${200 - charCount} more characters to enable.`
                  : isTooLong
                  ? "💡 Trim transcript below 100,000 characters."
                  : ""}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
