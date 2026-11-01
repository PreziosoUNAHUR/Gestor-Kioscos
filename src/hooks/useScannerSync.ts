import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import {
  SCAN_COOLDOWN_MS,
  buildScannerTopic,
  createScanGate,
  isStaleScan,
  makeClientId,
  makeRequestId,
  normalizeBarcode,
  parseAckPayload,
  parseScanPayload,
  type ScanOutcome,
} from '@/lib/scanner';
import { supabase, syncRealtimeAuth } from '@/lib/supabase';

export type ScannerStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disabled';

export type ScanEvent = {
  code: string;
  at: number;
  outcome: ScanOutcome;
};

type PresenceMeta = {
  role?: 'host' | 'remote';
  clientId?: string;
  device?: string;
  joinedAt?: number;
};

type PendingAck = {
  resolve: (outcome: ScanOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type UseScannerSyncOptions = {
  /** host = PC que recibe y agrega al carrito; remote = celular que escanea. */
  role: 'host' | 'remote';
  kioscoId?: string | null;
  pairingCode?: string | null;
  enabled?: boolean;
  cooldownMs?: number;
  onScan?: (code: string, meta: { receivedAt: number; requestId: string }) => ScanOutcome | Promise<ScanOutcome>;
};

const ACK_TIMEOUT_MS = 6000;
const MAX_RETRIES = 5;

/**
 * Canal privado de Realtime para el escáner remoto.
 *
 * - Anti doble escaneo: `createScanGate` (1200 ms por código) tanto en el
 *   celular (no reenvía el mismo frame) como en la PC (no duplica el ítem).
 * - Ack: la PC responde con el resultado y el celular muestra "agregado" o
 *   "no encontrado" sin adivinar.
 * - Reconexión con backoff exponencial; el canal se recrea solo.
 */
export function useScannerSync({
  role,
  kioscoId,
  pairingCode,
  enabled = true,
  cooldownMs = SCAN_COOLDOWN_MS,
  onScan,
}: UseScannerSyncOptions) {
  const [status, setStatus] = useState<ScannerStatus>(enabled ? 'idle' : 'disabled');
  const [error, setError] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [hostOnline, setHostOnline] = useState(false);
  const [lastScan, setLastScan] = useState<ScanEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const clientIdRef = useRef(makeClientId());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<ScannerStatus>(status);
  const gateRef = useRef(createScanGate(cooldownMs));
  const sendGateRef = useRef(createScanGate(cooldownMs));
  const onScanRef = useRef(onScan);
  const pendingRef = useRef(new Map<string, PendingAck>());
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El callback vive en un ref para no resuscribir Realtime en cada render.
  // Se actualiza en un efecto (nunca durante el render).
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const topic = buildScannerTopic(kioscoId, pairingCode);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    gateRef.current = createScanGate(cooldownMs);
    sendGateRef.current = createScanGate(cooldownMs);
  }, [cooldownMs]);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      setPeerCount(0);
      setHostOnline(false);
      return;
    }
    if (!topic) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    // Copia estable para el cleanup: el ref nunca se reasigna, sólo muta su Map.
    const pendingAcks = pendingRef.current;

    setStatus('connecting');
    setError(null);

    const updatePresence = () => {
      if (cancelled || !channel) return;
      const state = channel.presenceState<PresenceMeta>();
      const peers = Object.values(state)
        .flat()
        .filter((entry) => entry.clientId !== clientIdRef.current);

      if (role === 'host') {
        setPeerCount(peers.filter((entry) => entry.role === 'remote').length);
        setHostOnline(true);
      } else {
        setPeerCount(peers.length);
        setHostOnline(peers.some((entry) => entry.role === 'host'));
      }
    };

    const sendAck = async (requestId: string, outcome: ScanOutcome) => {
      if (!channel) return;
      try {
        await channel.send({
          type: 'broadcast',
          event: 'scan-ack',
          payload: { ...outcome, requestId, clientId: clientIdRef.current },
        });
      } catch {
        // Si se cayó el canal, el celular resolverá por timeout.
      }
    };

    const processScan = async (raw: unknown) => {
      if (role !== 'host') return;

      const payload = parseScanPayload(raw);
      if (!payload || payload.clientId === clientIdRef.current) return;
      if (isStaleScan(payload.ts)) return;

      if (!gateRef.current.shouldAccept(payload.code)) {
        await sendAck(payload.requestId, { ok: false, code: payload.code, reason: 'duplicate' });
        return;
      }

      let outcome: ScanOutcome;
      try {
        outcome = (await onScanRef.current?.(payload.code, {
          receivedAt: Date.now(),
          requestId: payload.requestId,
        })) ?? {
          ok: false,
          code: payload.code,
          reason: 'error',
          message: 'No hay un manejador de escaneo activo en la PC.',
        };
      } catch (scanError) {
        outcome = { ok: false, code: payload.code, reason: 'error', message: getErrorMessage(scanError) };
      }

      if (cancelled) return;
      setLastScan({ code: payload.code, at: Date.now(), outcome });
      await sendAck(payload.requestId, outcome);
    };

    const processAck = (raw: unknown) => {
      if (role !== 'remote') return;

      const payload = parseAckPayload(raw);
      if (!payload || payload.clientId === clientIdRef.current) return;

      const entry = pendingRef.current.get(payload.requestId);
      if (!entry) return;

      clearTimeout(entry.timer);
      pendingRef.current.delete(payload.requestId);
      setPending(false);
      setLastScan({ code: payload.code, at: Date.now(), outcome: payload });
      entry.resolve(payload);
    };

    const scheduleRetry = () => {
      if (cancelled) return;

      const attempt = retryRef.current;
      retryRef.current = attempt + 1;

      if (attempt >= MAX_RETRIES) {
        setError('No se pudo conectar el canal del escáner. Revisá Realtime y las políticas.');
        return;
      }

      const delay = Math.min(1000 * 2 ** attempt, 15_000);
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) setRetryTick((tick) => tick + 1);
      }, delay);
    };

    const connect = async () => {
      await syncRealtimeAuth();
      if (cancelled) return;

      const created = supabase.channel(topic, {
        config: {
          private: true,
          broadcast: { self: false, ack: true },
          presence: { key: clientIdRef.current, enabled: true },
        },
      });

      channel = created;
      channelRef.current = created;

      created
        .on('broadcast', { event: 'barcode' }, ({ payload }) => {
          void processScan(payload);
        })
        .on('broadcast', { event: 'scan-ack' }, ({ payload }) => {
          processAck(payload);
        })
        .on('presence', { event: 'sync' }, () => updatePresence())
        .subscribe((subscribeStatus, subscribeError) => {
          if (cancelled) return;

          if (subscribeStatus === 'SUBSCRIBED') {
            retryRef.current = 0;
            gateRef.current.reset();
            sendGateRef.current.reset();
            setStatus('connected');
            setError(null);

            void created
              .track({ role, clientId: clientIdRef.current, device: Platform.OS, joinedAt: Date.now() })
              .then(updatePresence)
              .catch(() => {});
            return;
          }

          if (
            subscribeStatus === 'CHANNEL_ERROR' ||
            subscribeStatus === 'TIMED_OUT' ||
            subscribeStatus === 'CLOSED'
          ) {
            setStatus('error');
            setError(subscribeError?.message ?? 'Se cortó la conexión del escáner.');
            setPeerCount(0);
            setHostOnline(false);
            scheduleRetry();
          }
        });
    };

    void connect();

    return () => {
      cancelled = true;

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      for (const entry of pendingAcks.values()) {
        clearTimeout(entry.timer);
        entry.resolve({ ok: false, code: '', reason: 'offline' });
      }
      pendingAcks.clear();

      if (channel) {
        void channel.unsubscribe();
        void supabase.removeChannel(channel);
        if (channelRef.current === channel) channelRef.current = null;
      }

      setPending(false);
      setPeerCount(0);
      setHostOnline(false);
    };
  }, [enabled, topic, role, retryTick]);

  const retry = useCallback(() => {
    retryRef.current = 0;
    setError(null);
    setRetryTick((tick) => tick + 1);
  }, []);

  const sendBarcode = useCallback(async (rawCode: string): Promise<ScanOutcome> => {
    const code = normalizeBarcode(rawCode);
    if (!code) return { ok: false, code: '', reason: 'error', message: 'Código vacío.' };

    if (statusRef.current !== 'connected' || !channelRef.current) {
      return { ok: false, code, reason: 'offline', message: 'Sin conexión con la PC.' };
    }

    if (!sendGateRef.current.shouldAccept(code)) {
      return { ok: false, code, reason: 'duplicate' };
    }

    const requestId = makeRequestId();
    const channel = channelRef.current;

    const ackPromise = new Promise<ScanOutcome>((resolve) => {
      const timer = setTimeout(() => {
        pendingRef.current.delete(requestId);
        setPending(false);
        resolve({ ok: false, code, reason: 'timeout', message: 'La PC no respondió.' });
      }, ACK_TIMEOUT_MS);

      pendingRef.current.set(requestId, { resolve, timer });
    });

    setPending(true);

    try {
      const result = await channel.send({
        type: 'broadcast',
        event: 'barcode',
        payload: { code, ts: Date.now(), clientId: clientIdRef.current, requestId },
      });

      if (result !== 'ok') {
        const entry = pendingRef.current.get(requestId);
        if (entry) {
          clearTimeout(entry.timer);
          pendingRef.current.delete(requestId);
        }
        setPending(false);
        return { ok: false, code, reason: 'offline', message: `Envío fallido (${result}).` };
      }
    } catch (sendError) {
      const entry = pendingRef.current.get(requestId);
      if (entry) {
        clearTimeout(entry.timer);
        pendingRef.current.delete(requestId);
      }
      setPending(false);
      return { ok: false, code, reason: 'offline', message: getErrorMessage(sendError) };
    }

    return ackPromise;
  }, []);

  return {
    status,
    connected: status === 'connected',
    error,
    peerCount,
    hostOnline,
    lastScan,
    pending,
    topic,
    sendBarcode,
    retry,
  };
}
