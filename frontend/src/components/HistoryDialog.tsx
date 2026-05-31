import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MeetingPreview } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Calendar, Loader2, FileText, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
};

export function HistoryDialog({ open, onOpenChange, onSelect }: Props) {
  const [meetings, setMeetings] = useState<MeetingPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMeetings();
      setMeetings(data);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to fetch meeting history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMeetings();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col p-6 rounded-2xl bg-white border border-border shadow-lg">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Meeting History
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Browse and open your previously processed meeting minutes and action items.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 space-y-2">
              <Loader2 className="h-8 w-8 text-[#8CC0EB] animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Retrieving past digests...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-xs text-slate-600 font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchMeetings} className="border-slate-200">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-2">
              <FileText className="h-8 w-8 text-slate-300" />
              <p className="text-xs text-slate-500 font-medium">No past meetings found.</p>
              <p className="text-[11px] text-slate-400">Your processed transcripts will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 rounded-xl px-2.5 transition duration-150 group"
                >
                  <div className="space-y-1 pr-4 min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-slate-900">
                      {meeting.title || "Untitled Meeting"}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDateTime(meeting.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onSelect(meeting.id)}
                    className="h-8 bg-[#8CC0EB] hover:bg-[#8CC0EB]/80 text-[#1E293B] font-semibold border-none shadow-sm flex items-center gap-1 transition"
                  >
                    <span>Open</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
