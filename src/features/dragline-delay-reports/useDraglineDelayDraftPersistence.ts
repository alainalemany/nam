"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DraglineDelayReportAutosaveResult } from "./actions";
import {
  DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY,
  draglineDraftContentFingerprint,
  draglineDraftRecoveryKey,
  draglineDraftSubmission,
  parseDraglineDraftRecovery,
  serializeDraglineDraftRecovery,
  type DraglineDelayReportDraftRecovery,
  type DraglineDelayReportDraftSnapshot,
} from "./draft-recovery";
import { draglineDelayReportSubmissionSchema } from "./validation";

export type DraglineDraftSaveStatus =
  | "idle"
  | "unsaved"
  | "saving"
  | "saved"
  | "offline"
  | "error"
  | "stale";

type AutosaveAction = (
  reportId: string | undefined,
  payload: string,
) => Promise<DraglineDelayReportAutosaveResult>;

type Options = {
  enabled: boolean;
  reportId?: string;
  snapshot: DraglineDelayReportDraftSnapshot;
  autosaveAction?: AutosaveAction;
  onRestore: (snapshot: DraglineDelayReportDraftSnapshot) => void;
  onHydrateIdentities: (
    identities: Extract<
      DraglineDelayReportAutosaveResult,
      { status: "saved" }
    >["identities"],
    submittedSnapshot: DraglineDelayReportDraftSnapshot,
  ) => void;
};

const LOCAL_WRITE_DELAY_MS = 500;
export const DRAGLINE_AUTOSAVE_DELAY_MS = 2_000;

export function useDraglineDelayDraftPersistence({
  enabled,
  reportId,
  snapshot,
  autosaveAction,
  onRestore,
  onHydrateIdentities,
}: Options) {
  const [status, setStatus] = useState<DraglineDraftSaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [recovery, setRecovery] =
    useState<DraglineDelayReportDraftRecovery | null>(null);
  const [activeReportId, setActiveReportId] = useState(reportId);
  const [recordVersion, setRecordVersion] = useState(snapshot.recordVersion);

  const latestSnapshotRef = useRef(snapshot);
  const activeReportIdRef = useRef(reportId);
  const recordVersionRef = useRef(snapshot.recordVersion);
  const onRestoreRef = useRef(onRestore);
  const onHydrateIdentitiesRef = useRef(onHydrateIdentities);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const dirtyRef = useRef(false);
  const editGenerationRef = useRef(0);
  const observedSnapshotRef = useRef(snapshot);
  const suppressSnapshotChangeRef = useRef(false);
  const lastRecoveryKeyRef = useRef<string | undefined>(undefined);
  const staleRef = useRef(false);

  latestSnapshotRef.current = snapshot;
  onRestoreRef.current = onRestore;
  onHydrateIdentitiesRef.current = onHydrateIdentities;

  const clearTimers = useCallback(() => {
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
    localTimerRef.current = null;
    serverTimerRef.current = null;
  }, []);

  const removeRecovery = useCallback((key?: string) => {
    if (typeof window === "undefined") return;
    try {
      if (key) window.localStorage.removeItem(key);
      if (lastRecoveryKeyRef.current) {
        window.localStorage.removeItem(lastRecoveryKeyRef.current);
      }
      const latestNewKey = window.localStorage.getItem(
        DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY,
      );
      if (
        latestNewKey &&
        (latestNewKey === key || latestNewKey === lastRecoveryKeyRef.current)
      ) {
        window.localStorage.removeItem(DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY);
      }
    } catch {
      // Recovery storage is best-effort and must never break form entry.
    }
  }, []);

  const writeRecovery = useCallback(() => {
    if (!enabled || typeof window === "undefined" || !dirtyRef.current) return;
    const currentSnapshot = {
      ...latestSnapshotRef.current,
      recordVersion: recordVersionRef.current,
    };
    const key = draglineDraftRecoveryKey({
      reportId: activeReportIdRef.current,
      equipmentId: currentSnapshot.equipmentId,
      operationalWorkDate: currentSnapshot.operationalWorkDate,
      shift: currentSnapshot.shift,
    });
    try {
      if (lastRecoveryKeyRef.current && lastRecoveryKeyRef.current !== key) {
        window.localStorage.removeItem(lastRecoveryKeyRef.current);
      }
      window.localStorage.setItem(
        key,
        serializeDraglineDraftRecovery({
          reportId: activeReportIdRef.current,
          serverRecordVersion: recordVersionRef.current,
          snapshot: currentSnapshot,
        }),
      );
      lastRecoveryKeyRef.current = key;
      if (activeReportIdRef.current) {
        window.localStorage.removeItem(DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY);
      } else {
        window.localStorage.setItem(
          DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY,
          key,
        );
      }
    } catch {
      setStatus("error");
      setStatusMessage("Local recovery is unavailable on this device.");
    }
  }, [enabled]);

  const runAutosaveRef = useRef<() => Promise<void>>(async () => undefined);

  const schedulePersistence = useCallback(
    (serverDelay = DRAGLINE_AUTOSAVE_DELAY_MS) => {
      if (!enabled) return;
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
      localTimerRef.current = setTimeout(writeRecovery, LOCAL_WRITE_DELAY_MS);
      serverTimerRef.current = setTimeout(
        () => void runAutosaveRef.current(),
        serverDelay,
      );
    },
    [enabled, writeRecovery],
  );

  runAutosaveRef.current = async () => {
    if (!enabled || !autosaveAction || staleRef.current) return;
    if (inFlightRef.current) return inFlightRef.current;
    if (!dirtyRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      setStatusMessage("Offline — changes are stored on this device.");
      writeRecovery();
      return;
    }

    const submittedSnapshot = {
      ...latestSnapshotRef.current,
      recordVersion: recordVersionRef.current,
    };
    const submission = draglineDraftSubmission(
      submittedSnapshot,
      recordVersionRef.current,
    );
    if (!draglineDelayReportSubmissionSchema.safeParse(submission).success) {
      setStatus("unsaved");
      setStatusMessage(
        "Unsaved changes are stored on this device until required Draft fields are valid.",
      );
      writeRecovery();
      return;
    }

    const generation = editGenerationRef.current;
    setStatus("saving");
    setStatusMessage("Saving…");
    const promise = (async () => {
      try {
        const result = await autosaveAction(
          activeReportIdRef.current,
          JSON.stringify(submission),
        );
        if (result.status === "saved") {
          activeReportIdRef.current = result.reportId;
          recordVersionRef.current = result.recordVersion;
          setActiveReportId(result.reportId);
          setRecordVersion(result.recordVersion);
          setLastSavedAt(result.savedAt);
          suppressSnapshotChangeRef.current = true;
          onHydrateIdentitiesRef.current(result.identities, submittedSnapshot);

          if (editGenerationRef.current === generation) {
            dirtyRef.current = false;
            setStatus("saved");
            setStatusMessage("Saved");
            removeRecovery(
              draglineDraftRecoveryKey({
                reportId: result.reportId,
                equipmentId: submittedSnapshot.equipmentId,
                operationalWorkDate: submittedSnapshot.operationalWorkDate,
                shift: submittedSnapshot.shift,
              }),
            );
          } else {
            dirtyRef.current = true;
            setStatus("unsaved");
            setStatusMessage("Unsaved changes");
            schedulePersistence(250);
          }
          return;
        }

        dirtyRef.current = true;
        if (result.status === "stale") {
          staleRef.current = true;
          setStatus("stale");
        } else if (result.status === "invalid") {
          setStatus("unsaved");
        } else {
          setStatus("error");
        }
        setStatusMessage(result.message);
        writeRecovery();
      } catch {
        dirtyRef.current = true;
        setStatus("error");
        setStatusMessage(
          "Save failed — changes are stored on this device and will retry when possible.",
        );
        writeRecovery();
      }
    })().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let key: string | null = null;
    if (reportId) {
      key = draglineDraftRecoveryKey({
        reportId,
        equipmentId: snapshot.equipmentId,
        operationalWorkDate: snapshot.operationalWorkDate,
        shift: snapshot.shift,
      });
    } else {
      key = window.localStorage.getItem(
        DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY,
      );
    }
    if (!key) return;
    const candidate = parseDraglineDraftRecovery(
      window.localStorage.getItem(key),
    );
    if (!candidate) {
      removeRecovery(key);
      return;
    }
    lastRecoveryKeyRef.current = key;

    if (
      reportId &&
      snapshot.recordVersion != null &&
      candidate.serverRecordVersion != null &&
      snapshot.recordVersion > candidate.serverRecordVersion
    ) {
      removeRecovery(key);
      setStatus("saved");
      setStatusMessage("Loaded the newer server Draft.");
      return;
    }
    if (
      draglineDraftContentFingerprint(candidate.snapshot) !==
      draglineDraftContentFingerprint(snapshot)
    ) {
      setRecovery(candidate);
    } else {
      removeRecovery(key);
    }
    // Recovery is intentionally evaluated once against server-rendered state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reportId]);

  useEffect(() => {
    if (!enabled) return;
    if (observedSnapshotRef.current === snapshot) return;
    observedSnapshotRef.current = snapshot;
    if (suppressSnapshotChangeRef.current) {
      suppressSnapshotChangeRef.current = false;
      return;
    }
    editGenerationRef.current += 1;
    dirtyRef.current = true;
    setStatus(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "offline"
        : "unsaved",
    );
    setStatusMessage(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "Offline — changes are stored on this device."
        : "Unsaved changes",
    );
    schedulePersistence();
  }, [enabled, schedulePersistence, snapshot]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const handleOnline = () => {
      if (!dirtyRef.current || staleRef.current) return;
      setStatus("unsaved");
      setStatusMessage("Back online — saving changes…");
      schedulePersistence(100);
    };
    const handleOffline = () => {
      if (!dirtyRef.current) return;
      setStatus("offline");
      setStatusMessage("Offline — changes are stored on this device.");
      writeRecovery();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden" || !dirtyRef.current) return;
      writeRecovery();
      void runAutosaveRef.current();
    };
    const handlePageHide = () => writeRecovery();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      clearTimers();
    };
  }, [clearTimers, enabled, schedulePersistence, writeRecovery]);

  const restoreRecovery = useCallback(() => {
    if (!recovery) return;
    activeReportIdRef.current = recovery.reportId ?? reportId;
    recordVersionRef.current =
      recovery.serverRecordVersion ?? snapshot.recordVersion;
    setActiveReportId(activeReportIdRef.current);
    setRecordVersion(recordVersionRef.current);
    onRestoreRef.current(recovery.snapshot);
    setRecovery(null);
    dirtyRef.current = true;
    setStatus("unsaved");
    setStatusMessage("Recovered unsaved DDR changes from this device.");
  }, [recovery, reportId, snapshot.recordVersion]);

  const discardRecovery = useCallback(() => {
    removeRecovery(lastRecoveryKeyRef.current);
    setRecovery(null);
    setStatus("idle");
    setStatusMessage("");
  }, [removeRecovery]);

  const prepareManualSubmit = useCallback(async () => {
    clearTimers();
    writeRecovery();
    if (inFlightRef.current) await inFlightRef.current;
    const currentSnapshot = {
      ...latestSnapshotRef.current,
      recordVersion: recordVersionRef.current,
    };
    return {
      reportId: activeReportIdRef.current,
      payload: JSON.stringify(
        draglineDraftSubmission(currentSnapshot, recordVersionRef.current),
      ),
    };
  }, [clearTimers, writeRecovery]);

  const clearRecovery = useCallback(() => {
    dirtyRef.current = false;
    clearTimers();
    removeRecovery(lastRecoveryKeyRef.current);
  }, [clearTimers, removeRecovery]);

  const preserveRecovery = useCallback(() => {
    if (!enabled) return;
    dirtyRef.current = true;
    writeRecovery();
  }, [enabled, writeRecovery]);

  return {
    activeReportId,
    clearRecovery,
    discardRecovery,
    lastSavedAt,
    prepareManualSubmit,
    preserveRecovery,
    recordVersion,
    recovery,
    restoreRecovery,
    status,
    statusMessage,
  };
}
