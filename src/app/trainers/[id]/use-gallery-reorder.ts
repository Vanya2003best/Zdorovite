"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setGalleryOrder } from "./gallery-actions";
import { pinScrollFor } from "./keep-scroll";

type Item = { id: string };

/**
 * HTML5 drag-and-drop reorder for gallery editors. Same persistence pattern
 * as Cozy/Premium services/packages, but writes to gallery_photos.position
 * directly via setGalleryOrder (gallery reorder is global, not per-page).
 *
 * Drop logic lives on the WRAPPER element, not on EditableGalleryItem itself,
 * so the inner upload/delete buttons + focal picker stay clickable. The
 * dragHandle props returned by getDragProps are intended for the OUTER
 * <div>, while the children (EditableGalleryItem) receive nothing — they
 * keep working unchanged.
 *
 * Usage:
 *   const reorder = useGalleryReorder(items);
 *   {reorder.orderedItems.map(it => (
 *     <div key={it.id} {...reorder.getDragProps(it.id)} className={reorder.dragClass(it.id)}>
 *       <EditableGalleryItem id={it.id} url={it.url} ... />
 *     </div>
 *   ))}
 */
export function useGalleryReorder<T extends Item>(items: T[]) {
  const router = useRouter();
  const [order, setOrder] = useState<T[]>(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Re-seed when the parent passes a new list (e.g. after add/remove).
  // Compare by id-list so optimistic moves survive until the server-refreshed
  // list arrives.
  const seedKey = items.map((i) => i.id).join("|");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(items);
  }, [seedKey, items]);

  const commitOrder = (next: T[]) => {
    pinScrollFor(1500);
    const prev = order;
    setOrder(next);
    setGalleryOrder(next.map((i) => i.id)).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setOrder(prev);
      } else {
        router.refresh();
      }
    });
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Firefox needs a payload to fire dragend reliably.
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (id: string) => (e: React.DragEvent) => {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  };

  const onDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOverId(null);
    if (!draggingId || draggingId === id) {
      setDraggingId(null);
      return;
    }
    const fromIdx = order.findIndex((i) => i.id === draggingId);
    const toIdx = order.findIndex((i) => i.id === id);
    setDraggingId(null);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...order];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    commitOrder(next);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  const getDragProps = (id: string) => ({
    draggable: true,
    onDragStart: onDragStart(id),
    onDragOver: onDragOver(id),
    onDrop: onDrop(id),
    onDragEnd,
  });

  const dragClass = (id: string) => {
    const base = "cursor-grab active:cursor-grabbing transition";
    const dragging = draggingId === id ? " opacity-40" : "";
    const target = overId === id ? " ring-2 ring-emerald-400 ring-offset-2 rounded-2xl" : "";
    return `${base}${dragging}${target}`;
  };

  return {
    orderedItems: order,
    getDragProps,
    dragClass,
  };
}
