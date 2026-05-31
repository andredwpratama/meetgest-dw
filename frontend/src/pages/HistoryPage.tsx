import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { MeetingPreview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Calendar, FileText, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";

export function HistoryPage() {
  const [meetings, setMeetings] = useState<MeetingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMeetings();
      setMeetings(data);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to fetch meeting history. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCardClick = (id: string) => {
    navigate(`/?id=${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(id);
    }
  };

  const pageHeader = (
    <div className="space-y-2">
      <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
        Meeting History
      </h2>
      <p className="text-slate-400 text-sm">
        Browse and download past meeting transcripts and AI analysis reports.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-44 rounded-xl border border-slate-800 bg-slate-900/20 p-5 space-y-4 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="h-5 bg-slate-800 rounded w-2/3" />
                  <div className="h-4 bg-slate-800 rounded w-1/4" />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-3.5 bg-slate-800 rounded w-full" />
                  <div className="h-3.5 bg-slate-800 rounded w-11/12" />
                  <div className="h-3.5 bg-slate-800 rounded w-4/5" />
                </div>
              </div>
              <div className="h-3 bg-slate-800 rounded w-1/3 mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-red-950/30 bg-red-950/5 max-w-xl mx-auto space-y-4 pt-12 pb-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/20 border border-red-900/30">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-slate-200">Connection Error</h4>
            <p className="text-sm text-slate-400 max-w-md">{error}</p>
          </div>
          <Button
            onClick={fetchMeetings}
            variant="outline"
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Retry Fetch
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-slate-900 bg-slate-900/10 max-w-xl mx-auto space-y-4 pt-16 pb-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-slate-300">No Meetings Found</h4>
            <p className="text-sm text-slate-400 max-w-sm">
              You haven't processed any meeting transcripts yet. Paste or upload one to get started.
            </p>
          </div>
          <Button
            onClick={() => navigate("/")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
          >
            Process Your First Meeting
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => handleCardClick(meeting.id)}
              onKeyDown={(e) => handleKeyDown(e, meeting.id)}
              role="button"
              tabIndex={0}
              aria-label={`View summary and action items for ${meeting.title || "Untitled Meeting"}`}
              className="group cursor-pointer flex flex-col justify-between rounded-xl border border-slate-900 bg-slate-900/30 p-5 hover:border-slate-800 hover:bg-slate-900/50 transition-all duration-300 hover:shadow-lg hover:shadow-slate-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-base font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {meeting.title || "Untitled Meeting"}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(meeting.created_at)}</span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-400 line-clamp-3">
                  {meeting.summary || "No summary preview available."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-900 text-[10px] text-slate-500">
                <span>{formatDateTime(meeting.created_at)}</span>
                <span className="flex items-center gap-1 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
                  Open notes
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default HistoryPage;
