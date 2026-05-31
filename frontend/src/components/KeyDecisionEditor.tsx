import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { api } from "@/lib/api";
import type { KeyDecision } from "@/lib/types";
import { Check, Trash2, Loader2 } from "lucide-react";

type Props = {
  item: KeyDecision;
  onChange: (k: KeyDecision) => void;
  onDelete: () => void;
};

export function KeyDecisionEditor({ item, onChange, onDelete }: Props) {
  const [text, setText] = useState(item.text);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    setText(item.text);
  }, [item.id, item.text]);

  useDebouncedEffect(
    async () => {
      const trimmed = text.trim();
      if (trimmed === item.text) return;

      setIsSaving(true);
      setSaveSuccess(false);

      try {
        const updated = await api.patchKeyDecision(item.id, { text: trimmed });
        onChange(updated);
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        console.error("Failed to auto-save key decision:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [text],
    500
  );

  return (
    <div className="group relative flex gap-3 items-center p-3 rounded-xl border border-slate-100 hover:border-slate-200/80 bg-white hover:shadow-sm transition-all duration-200">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shrink-0 shadow-sm border border-emerald-100">
        <Check className="size-3.5 stroke-[3]" />
      </div>

      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter key decision..."
        aria-label="Decision text"
        className="flex-1 border-none shadow-none bg-transparent hover:bg-slate-50 focus:bg-white rounded-lg h-9 text-sm focus-visible:ring-2 focus-visible:ring-[#8CC0EB]/50 w-full text-slate-800 font-medium placeholder:text-slate-400 transition"
      />

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="size-5 relative flex items-center justify-center text-slate-400">
          {isSaving && <Loader2 className="size-3.5 animate-spin text-[#8CC0EB]" />}
          {!isSaving && saveSuccess && <Check className="size-3.5 text-emerald-500" />}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          className="size-7 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"
          aria-label="Delete key decision"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
