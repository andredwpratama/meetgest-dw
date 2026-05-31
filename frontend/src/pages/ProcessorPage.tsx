import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TranscriptInput } from "@/components/TranscriptInput";
import { ResultsPanel } from "@/components/ResultsPanel";
import { HistoryDialog } from "@/components/HistoryDialog";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";

export type ProcessingPhase = "idle" | "loading" | "done";

export function ProcessorPage() {
  const [params, setParams] = useSearchParams();
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>("idle");
  const [loadingMeeting, setLoadingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Signal to the post-mount effect that the page was hard-reloaded (F5),
  // so the ?id= param should be cleared rather than triggering a re-fetch.
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("clearParams", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("clearParams") === "true") {
      sessionStorage.removeItem("clearParams");
      setParams({}, { replace: true });
    }
  }, [setParams]);

  useEffect(() => {
    const id = params.get("id");
    if (!id) {
      setMeeting(null);
      return;
    }

    if (meeting?.id === id) return;

    setLoadingMeeting(true);
    setError(null);

    api
      .getMeeting(id)
      .then((m) => {
        setMeeting(m);
        setTitle(m.title);
        setTranscript(m.raw_transcript);
      })
      .catch((err) => {
        console.error("Failed to load deep-linked meeting:", err);
        setError("We couldn't retrieve the requested meeting. It may have been deleted, or the API is offline.");
        params.delete("id");
        setParams(params, { replace: true });
      })
      .finally(() => {
        setLoadingMeeting(false);
      });
  }, [params, meeting?.id, setParams]);

  async function handleProcess() {
    setProcessingPhase("loading");
    setError(null);
    try {
      const m = await api.process(title, transcript);
      setProcessingPhase("done");
      setTimeout(() => {
        setMeeting(m);
        setParams({ id: m.id }, { replace: true });
        setProcessingPhase("idle");
      }, 800);
    } catch (e: unknown) {
      console.error("Processing failed:", e);
      const msg = (e as { apiError?: { error: string } })?.apiError?.error ?? "unknown_error";
      const human: Record<string, string> = {
        transcript_too_short: "The transcript is too short — please provide a transcript of at least 200 characters.",
        transcript_too_long: "The transcript is too long (maximum 100,000 characters). Please trim the transcript and try again.",
        llm_invalid_output: "The system model returned invalid structured output. Try shortening the transcript or resubmitting.",
      };
      setError(human[msg] ?? "An unexpected error occurred. Please check your network and try again.");
      setProcessingPhase("idle");
    }
  }

  function handleMeetingChange(updatedMeeting: Meeting) {
    setMeeting(updatedMeeting);
    setTitle(updatedMeeting.title);
  }

  function handleSelectMeeting(id: string) {
    setHistoryOpen(false);
    setParams({ id }, { replace: true });
  }

  function handleRefresh() {
    setTitle("");
    setTranscript("");
    setMeeting(null);
    setError(null);
    setParams({}, { replace: true });
  }

  if (loadingMeeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3 animate-in fade-in duration-300">
        <Loader2 className="size-10 text-[#8CC0EB] animate-spin" />
        <h3 className="text-sm font-semibold text-slate-800">Retrieving meeting details...</h3>
        <p className="text-xs text-slate-400">Loading your data from the server.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && !transcript && (
        <div className="max-w-4xl mx-auto rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm flex gap-3 items-start animate-in slide-in-from-top-4 duration-300">
          <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">Notice</h4>
            <p className="text-amber-800/90 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <TranscriptInput
        title={title}
        setTitle={setTitle}
        transcript={transcript}
        setTranscript={setTranscript}
        onProcess={handleProcess}
        processingPhase={processingPhase}
        error={transcript ? error : null}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {meeting && (
        <div className="border-t border-slate-200/50 pt-8 mt-2 animate-in fade-in duration-500">
          <ResultsPanel meeting={meeting} onChange={handleMeetingChange} onRefresh={handleRefresh} />
        </div>
      )}

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onSelect={handleSelectMeeting}
      />
    </div>
  );
}
