import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  DraftConflictError,
  getDraftFailure,
  pendingDraftValues,
  queueDraftWrite,
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from "@/lib/localDrafts";

export function useLocalDraft<T>(
  key: string,
  initial: T,
  options: { ready?: boolean; validate?: (value: unknown) => boolean } = {},
) {
  const [value, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const valueRef = useRef(value);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const validateRef = useRef(options.validate);
  validateRef.current = options.validate;
  const revision = useRef(0);
  const clientId = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  const hydratedRef = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (options.ready === false) return;
    let active = true;
    setHydrated(false);
    hydratedRef.current = false;
    void readLocalDraft<T>(key)
      .then((stored) => {
        if (!active) return;
        const next = pendingDraftValues.has(key)
          ? (pendingDraftValues.get(key) as T)
          : stored
            ? stored.value
            : initialRef.current;
        if (validateRef.current && !validateRef.current(next))
          throw new Error(
            "This saved draft cannot be opened. Export your data before removing it.",
          );
        revision.current = stored?.revision ?? 0;
        valueRef.current = next;
        setState(next);
        setHasDraft(!!stored || pendingDraftValues.has(key));
        const failure = getDraftFailure(key);
        setStatus(failure ? "error" : stored ? "saved" : "idle");
        setError(failure ?? null);
        setHydrated(true);
        hydratedRef.current = true;
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus("error");
        setHydrated(true);
        hydratedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [key, options.ready]);

  const persist = useCallback(
    (next: T) => {
      const writeGeneration = ++generation.current;
      pendingDraftValues.set(key, next);
      setHasDraft(true);
      setStatus("saving");
      setError(null);
      void queueDraftWrite(key, async () => {
        revision.current = await writeLocalDraft(
          key,
          next,
          revision.current,
          clientId.current,
        );
        if (pendingDraftValues.get(key) === next)
          pendingDraftValues.delete(key);
      })
        .then(() => {
          if (mounted.current && generation.current === writeGeneration)
            setStatus("saved");
        })
        .catch((cause) => {
          if (!mounted.current || generation.current !== writeGeneration)
            return;
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setStatus("error");
        });
    },
    [key],
  );

  const setValue = useCallback(
    (update: SetStateAction<T>) => {
      if (!hydratedRef.current) return;
      const next =
        typeof update === "function"
          ? (update as (previous: T) => T)(valueRef.current)
          : update;
      valueRef.current = next;
      setState(next);
      persist(next);
    },
    [persist],
  );
  const clearDraft = useCallback(
    async (nextValue?: T, options?: { keepInputOnFailure?: boolean }) => {
      if (nextValue !== undefined && !options?.keepInputOnFailure) {
        valueRef.current = nextValue;
        setState(nextValue);
      }
      const clearGeneration = ++generation.current;
      try {
        await queueDraftWrite(key, () =>
          removeLocalDraft(key, revision.current),
        );
        revision.current = 0;
        if (generation.current === clearGeneration) {
          if (nextValue !== undefined && options?.keepInputOnFailure) {
            valueRef.current = nextValue;
            setState(nextValue);
          }
          setHasDraft(false);
          setStatus("idle");
          setError(null);
        }
      } catch (cause) {
        if (generation.current === clearGeneration) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setStatus("error");
        }
        throw cause;
      }
    },
    [key],
  );
  const retry = useCallback(() => persist(valueRef.current), [persist]);
  const keepMine = useCallback(async () => {
    try {
      revision.current = (await readLocalDraft(key))?.revision ?? 0;
      persist(valueRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      setStatus("error");
    }
  }, [key, persist]);
  return {
    value,
    setValue,
    hydrated,
    hasDraft,
    error,
    status,
    clearDraft,
    retry,
    keepMine,
    conflict: error instanceof DraftConflictError,
  };
}
