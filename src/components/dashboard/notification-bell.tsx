"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, MonitorSmartphone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, string> | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const utils = trpc.useUtils();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifQuery = (trpc.notification as any).list.useQuery(undefined, {
    refetchInterval: open ? 30000 : false,
  });

  const notifications = (notifQuery.data?.notifications ?? []) as Notification[];
  const unreadCount = (notifQuery.data?.unreadCount ?? 0) as number;

  const markAllReadMutation = (trpc.notification as any).markAsRead.useMutation({
    onSuccess: () => { (utils.notification as any).list.invalidate(); },
  });

  const deleteMutation = (trpc.notification as any).delete.useMutation({
    onSuccess: () => {
      (utils.notification as any).list.invalidate();
      setSelected(new Set());
      setSelectMode(false);
    },
  });

  const markAllRead = () => markAllReadMutation.mutate({ markAllRead: true });

  const deleteSelected = () => {
    if (selected.size === 0) return;
    deleteMutation.mutate({ ids: Array.from(selected) });
  };

  const deleteAll = () => {
    deleteMutation.mutate({ deleteAll: true });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === notifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map((n) => n.id)));
    }
  };

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 p-0"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectMode(!selectMode);
                  setSelected(new Set());
                }}
              >
                {selectMode ? "Cancel" : "Select"}
              </Button>
            )}
            {!selectMode && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={markAllRead}
              >
                <CheckCheck className="size-3" />
                Read all
              </Button>
            )}
          </div>
        </div>

        {/* Select mode toolbar */}
        {selectMode && notifications.length > 0 && (
          <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/50">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === notifications.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                {selected.size === 0
                  ? "Select all"
                  : `${selected.size} selected`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {selected.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={deleteSelected}
                >
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={deleteAll}
              >
                <Trash2 className="size-3" />
                Delete all
              </Button>
            </div>
          </div>
        )}

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 border-b px-4 py-3 last:border-0",
                  !n.isRead && "bg-primary/5",
                  selectMode && selected.has(n.id) && "bg-primary/10"
                )}
              >
                {selectMode ? (
                  <div className="mt-0.5 shrink-0">
                    <Checkbox
                      checked={selected.has(n.id)}
                      onCheckedChange={() => toggleSelect(n.id)}
                    />
                  </div>
                ) : (
                  <div className="mt-0.5 shrink-0">
                    {n.type === "SESSION_CONFLICT" ? (
                      <MonitorSmartphone className="size-4 text-destructive" />
                    ) : (
                      <Bell className="size-4 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">
                      {n.title}
                    </p>
                    {!selectMode && !n.isRead && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {n.message}
                  </p>
                  {n.metadata && n.type === "SESSION_CONFLICT" && (
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      IP: {(n.metadata as Record<string, string>).ip}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
