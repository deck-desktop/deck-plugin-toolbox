// Which tool is showing and what each tool holds, kept at module scope so it survives
// navigating away (the tab unmounts) and is shared by the tab and every Toolbox pane.
//
// In memory only, on purpose: people paste tokens and secrets into a toolbox, and nothing here
// should end up in a config file or a backup.
import { useSyncExternalStore } from "react";
import type { ToolId } from "./tools/detect";

let current: ToolId | null = null;
const state = new Map<ToolId, Record<string, unknown>>();
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const getVersion = () => version;

export const getCurrent = () => current;
export function setCurrent(id: ToolId | null) { current = id; emit(); }

export function useCurrent(): ToolId | null {
  useSyncExternalStore(subscribe, getVersion);
  return current;
}

/** What sits in the home screen's paste box: kept here so a selection nothing recognised can land in it. */
let home = "";
export function setHome(text: string) { home = text; emit(); }
export function useHome(): string {
  useSyncExternalStore(subscribe, getVersion);
  return home;
}

/**
 * Open a tool with `input` already in its main field: what paste detection does. `patch` sets
 * whatever else the paste implies, such as a mode, over what the tool was last left on.
 */
export function openWith(id: ToolId, input: string, patch: Record<string, unknown> = {}) {
  state.set(id, { ...state.get(id), ...patch, input });
  setCurrent(id);
}

/** One tool's fields, starting from `init`, and a setter that merges a change into them. */
export function useTool<T extends Record<string, unknown>>(id: ToolId, init: T): [T, (patch: Partial<T>) => void] {
  useSyncExternalStore(subscribe, getVersion);
  const value = { ...init, ...state.get(id) } as T;
  const set = (patch: Partial<T>) => { state.set(id, { ...state.get(id), ...patch }); emit(); };
  return [value, set];
}
