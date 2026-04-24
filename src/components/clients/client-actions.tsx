"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

type Props = {
  clientId: string;
  initialName: string;
};

/**
 * Inline rename control + delete-with-confirm for a single client row.
 * Uses the server routes at /api/clients/[id].
 */
export function ClientActions({ clientId, initialName }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error("save_failed");
      setName(next);
      setEditing(false);
      toast({ title: "Client renamed" });
      router.refresh();
    } catch {
      toast({ variant: "destructive", title: "Couldn't rename", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      toast({ title: "Client deleted" });
      router.push("/dashboard/clients");
      router.refresh();
    } catch {
      toast({ variant: "destructive", title: "Couldn't delete", description: "Please try again." });
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              maxLength={80}
              className="h-10 min-w-0 rounded-full border border-border bg-white px-4 font-display text-2xl font-semibold outline-none focus:ring-2 focus:ring-ring md:text-3xl"
            />
            <Button type="submit" variant="gold" size="sm" disabled={saving} aria-label="Save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDraft(name);
              }}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold">{name}</h1>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              aria-label="Rename client"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this client and all its photos?</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(true)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" /> Delete client
          </Button>
        )}
      </div>
    </div>
  );
}
