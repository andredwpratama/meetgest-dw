import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { downloadMarkdown, downloadPdf, toMarkdown } from "@/lib/export";
import type { Meeting } from "@/lib/types";
import { FileText, Download, Check, Globe } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
};

export function ExportDialog({ open, onOpenChange, meeting }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyGoogleDocs = async () => {
    const markdown = toMarkdown(meeting);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onOpenChange(false); // Close dialog after copy success
      }, 1500);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleExportPdf = () => {
    downloadPdf(meeting);
    onOpenChange(false);
  };

  const handleExportMd = () => {
    downloadMarkdown(meeting);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 rounded-2xl bg-white border border-border shadow-lg">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Export Meeting Digest
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Choose a format below to export and share your structured meeting minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6">
          {/* PDF CARD */}
          <button
            onClick={handleExportPdf}
            className="flex flex-col items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-[#8CC0EB]/10 hover:border-[#8CC0EB] text-center transition duration-200 cursor-pointer group h-full"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500 group-hover:scale-105 transition duration-200">
              <FileText className="h-6 w-6" />
            </div>
            <div className="mt-3 flex-1 flex flex-col justify-center">
              <h4 className="text-xs font-bold text-slate-800">PDF Document</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Download a stylized PDF print-ready report.
              </p>
            </div>
          </button>

          {/* MARKDOWN CARD */}
          <button
            onClick={handleExportMd}
            className="flex flex-col items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-[#8CC0EB]/10 hover:border-[#8CC0EB] text-center transition duration-200 cursor-pointer group h-full"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 group-hover:scale-105 transition duration-200">
              <Download className="h-6 w-6" />
            </div>
            <div className="mt-3 flex-1 flex flex-col justify-center">
              <h4 className="text-xs font-bold text-slate-800">Markdown File</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Standard .md file for Obsidian, Notion, or Slack.
              </p>
            </div>
          </button>

          {/* GOOGLE DOCS CARD */}
          <button
            onClick={handleCopyGoogleDocs}
            disabled={copied}
            className="flex flex-col items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-[#FFEBCC]/30 hover:border-[#FFEBCC] text-center transition duration-200 cursor-pointer group h-full"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 group-hover:scale-105 transition duration-200">
              {copied ? (
                <Check className="h-6 w-6 text-emerald-500 animate-bounce" />
              ) : (
                <Globe className="h-6 w-6" />
              )}
            </div>
            <div className="mt-3 flex-1 flex flex-col justify-center">
              <h4 className="text-xs font-bold text-slate-800">
                {copied ? "Copied!" : "Google Docs"}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Copy formatted Markdown to paste directly into Google Docs.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
