"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { labels } from "@/lib/i18n/labels";

import { saveAssignAction } from "./assign-actions";

import type { AssigneeRow, DealerOption, SelfStaffOption } from "../data";
import type { EventCandidateStatus } from "@solar/contracts";

type EventMode = "SELF" | "DEALER" | "JOINT";

interface AssignSectionProps {
  candidateId: string;
  eventId: string | null;
  eventMode: string | null;
  candidateStatus: EventCandidateStatus;
  assignees: AssigneeRow[];
  overallStatus: "confirmed" | "adjusting";
  selfStaff: SelfStaffOption[];
  dealers: DealerOption[];
  memo: string | null;
}

function StatusSelect({
  value,
  onChange,
}: {
  value: "confirmed" | "adjusting";
  onChange: (v: "confirmed" | "adjusting") => void;
}) {
  const tl = labels.eventList;
  const colors =
    value === "confirmed"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "confirmed" | "adjusting")}
      className={[
        "focus:ring-primary/30 cursor-pointer appearance-none rounded-full border px-3 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2",
        colors,
      ].join(" ")}
    >
      <option value="confirmed">{tl.assignStatusOptions.confirmed}</option>
      <option value="adjusting">{tl.assignStatusOptions.adjusting}</option>
    </select>
  );
}

function ModeButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-white"
          : "border-hairline-light text-ink hover:border-primary/40 hover:bg-primary/5 bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function AssignSection({
  candidateId,
  eventId,
  eventMode,
  candidateStatus,
  assignees,
  overallStatus,
  selfStaff,
  dealers,
  memo,
}: AssignSectionProps) {
  const te = labels.event;
  const tl = labels.eventList;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<EventMode>((eventMode as EventMode) ?? "SELF");
  const [selectedStaff, setSelectedStaff] = useState<string[]>(
    assignees.filter((a) => a.affiliation === "self").map((a) => a.id),
  );
  const [selectedDealers, setSelectedDealers] = useState<string[]>(
    assignees.filter((a) => a.affiliation === "dealer").map((a) => a.id),
  );
  const [assignMemo, setAssignMemo] = useState(memo ?? "");
  const [currentStatus, setCurrentStatus] = useState(overallStatus);

  const toggleStaff = useCallback((salespersonId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(salespersonId)
        ? prev.filter((id) => id !== salespersonId)
        : [...prev, salespersonId],
    );
  }, []);

  const toggleDealer = useCallback((relId: string) => {
    setSelectedDealers((prev) =>
      prev.includes(relId) ? prev.filter((id) => id !== relId) : [...prev, relId],
    );
  }, []);

  function handleSave() {
    startTransition(async () => {
      try {
        await saveAssignAction({
          eventCandidateId: candidateId,
          mode: selectedMode,
          staffSalespersonIds:
            selectedMode === "SELF" || selectedMode === "JOINT" ? selectedStaff : [],
          dealerRelationshipIds:
            selectedMode === "DEALER" || selectedMode === "JOINT" ? selectedDealers : [],
          memo: assignMemo,
        });
        toast.success(labels.common.saved);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : labels.common.unknownError);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="whitespace-nowrap text-base">{te.sections.assignInfo}</CardTitle>
            <StatusSelect value={currentStatus} onChange={setCurrentStatus} />
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {tl.addAssign}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{tl.assignDialogTitle}</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-5">
                <div>
                  <p className="text-mute-light mb-2 text-xs font-semibold">{tl.assignModeLabel}</p>
                  <div className="flex gap-2">
                    <ModeButton
                      label={tl.assignModeSelf}
                      selected={selectedMode === "SELF"}
                      onClick={() => setSelectedMode("SELF")}
                    />
                    <ModeButton
                      label={tl.assignModeDealer}
                      selected={selectedMode === "DEALER"}
                      onClick={() => setSelectedMode("DEALER")}
                    />
                    <ModeButton
                      label={tl.assignModeJoint}
                      selected={selectedMode === "JOINT"}
                      onClick={() => setSelectedMode("JOINT")}
                    />
                  </div>
                </div>

                {(selectedMode === "SELF" || selectedMode === "JOINT") && (
                  <div>
                    <p className="text-mute-light mb-2 text-xs font-semibold">
                      {tl.assignSelectStaff}
                    </p>
                    <div className="border-hairline-light max-h-48 overflow-y-auto rounded-md border">
                      {selfStaff.map((u) => (
                        <label
                          key={u.id}
                          className="hover:bg-surface-soft/50 border-hairline-light flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStaff.includes(u.id)}
                            onChange={() => toggleStaff(u.id)}
                            className="text-primary focus:ring-primary/30 h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-ink text-sm">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedMode === "DEALER" || selectedMode === "JOINT") && (
                  <div>
                    <p className="text-mute-light mb-2 text-xs font-semibold">
                      {tl.assignDealerName}
                    </p>
                    <div className="border-hairline-light max-h-48 overflow-y-auto rounded-md border">
                      {dealers.map((d) => (
                        <label
                          key={d.relationshipId}
                          className="hover:bg-surface-soft/50 border-hairline-light flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDealers.includes(d.relationshipId)}
                            onChange={() => toggleDealer(d.relationshipId)}
                            className="text-primary focus:ring-primary/30 h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-ink text-sm">{d.dealerName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-mute-light mb-2 text-xs font-semibold">{tl.assignMemo}</p>
                  <textarea
                    value={assignMemo}
                    onChange={(e) => setAssignMemo(e.target.value)}
                    placeholder={tl.assignMemoPlaceholder}
                    rows={3}
                    className="border-hairline-light focus:ring-primary/30 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <Button className="w-full" onClick={handleSave} disabled={isPending}>
                  {isPending ? "..." : tl.assignSave}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {assignees.length > 0 ? (
          <div className="flex gap-4">
            <div className="min-w-0 flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-hairline-light border-b">
                    <th className="text-mute-light px-3 py-2 text-left text-xs font-semibold">
                      {tl.assignColumns.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignees.map((a) => (
                    <tr key={a.id} className="border-hairline-light border-b last:border-b-0">
                      <td className="text-ink px-3 py-2.5 text-sm">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-mute-light ml-2 text-xs">
                          ({a.affiliation === "self" ? tl.affiliationSelf : tl.affiliationDealer})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-hairline-light w-1/3 shrink-0 border-l pl-4">
              <p className="text-mute-light mb-1 text-xs font-semibold">{tl.assignMemo}</p>
              <p className="text-ink whitespace-pre-wrap text-sm">{memo || "—"}</p>
            </div>
          </div>
        ) : (
          <p className="text-mute-light px-3 py-6 text-center text-sm">{tl.assignNotAvailable}</p>
        )}

        {!eventId && candidateStatus === "CLOSED" && (
          <div className="border-hairline-light mt-3 border-t pt-3">
            <Link
              href={`/event-detail/${candidateId}/decide`}
              className="text-link-light text-sm underline-offset-4 hover:underline"
            >
              {tl.decideLink}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
