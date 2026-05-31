import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { api } from "@/lib/api";
import type { ActionItem } from "@/lib/types";
import { getInitials, getAvatarBg } from "@/lib/utils";
import { Trash2, Loader2, Check } from "lucide-react";

type Props = {
  item: ActionItem;
  onChange: (a: ActionItem) => void;
  onDelete: () => void;
};

export function ActionItemEditor({ item, onChange, onDelete }: Props) {
  const [task, setTask] = useState(item.task);
  const [owner, setOwner] = useState(item.owner ?? "");
  const [deadline, setDeadline] = useState(item.deadline ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    setTask(item.task);
    setOwner(item.owner ?? "");
    setDeadline(item.deadline ?? "");
  }, [item.id, item.task, item.owner, item.deadline]);

  useDebouncedEffect(
    async () => {
      const trimmedTask = task.trim();
      const trimmedOwner = owner.trim() === "" ? null : owner.trim();
      const trimmedDeadline = deadline.trim() === "" ? null : deadline.trim();

      if (
        trimmedTask === item.task &&
        trimmedOwner === item.owner &&
        trimmedDeadline === item.deadline
      ) {
        return;
      }

      setIsSaving(true);
      setSaveSuccess(false);

      try {
        const updated = await api.patchActionItem(item.id, {
          task: trimmedTask,
          owner: trimmedOwner,
          deadline: trimmedDeadline,
        });
        onChange(updated);
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        console.error("Failed to auto-save action item:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [task, owner, deadline],
    500
  );

  const getStatusInfo = () => {
    if (!task.trim()) {
      return { text: "Draft", variant: "outline" as const, className: "text-slate-400 border-slate-200" };
    }
    if (owner.trim() && deadline.trim()) {
      return { text: "Active", variant: "default" as const, className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    }
    if (owner.trim()) {
      return { text: "In Progress", variant: "secondary" as const, className: "bg-[#BFDDF0]/40 text-[#1E293B] border-none" };
    }
    return { text: "Pending", variant: "outline" as const, className: "bg-[#FFEBCC]/30 text-amber-800 border-amber-200" };
  };

  const status = getStatusInfo();

  return (
    <TableRow className="hover:bg-slate-50/50 border-slate-100 transition duration-150">
      <TableCell className="pl-4 py-3 min-w-[280px]">
        <Input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the task..."
          className="border-none shadow-none bg-transparent hover:bg-slate-50 focus:bg-white rounded-lg h-9 text-sm focus-visible:ring-2 focus-visible:ring-[#8CC0EB]/50 w-full text-slate-800 font-medium placeholder:text-slate-400 transition"
        />
      </TableCell>

      <TableCell className="w-[180px] py-3">
        <div className="flex items-center gap-2">
          <Avatar size="sm" className={getAvatarBg(owner)}>
            <AvatarFallback className="font-bold text-xs uppercase bg-transparent text-inherit">
              {getInitials(owner)}
            </AvatarFallback>
          </Avatar>
          <Input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Assign owner..."
            className="border-none shadow-none bg-transparent hover:bg-slate-50 focus:bg-white rounded-lg h-9 text-xs focus-visible:ring-2 focus-visible:ring-[#8CC0EB]/50 w-full text-slate-700 font-medium placeholder:text-slate-400 transition"
          />
        </div>
      </TableCell>

      <TableCell className="w-[150px] py-3">
        <Input
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          placeholder="Due date..."
          className="border-none shadow-none bg-transparent hover:bg-slate-50 focus:bg-white rounded-lg h-9 text-xs focus-visible:ring-2 focus-visible:ring-[#8CC0EB]/50 w-full text-slate-700 font-medium placeholder:text-slate-400 transition"
        />
      </TableCell>

      <TableCell className="w-[110px] py-3">
        <Badge variant={status.variant} className={status.className}>
          {status.text}
        </Badge>
      </TableCell>

      <TableCell className="w-[80px] pr-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <div className="size-5 relative flex items-center justify-center text-slate-400 shrink-0">
            {isSaving && <Loader2 className="size-3.5 animate-spin text-[#8CC0EB]" />}
            {!isSaving && saveSuccess && <Check className="size-3.5 text-emerald-500" />}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            className="size-7 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"
            aria-label="Delete action item"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
