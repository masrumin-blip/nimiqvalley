import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

export const playerId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export type RacerPresence = { id: string; name: string; color: string };

export type NetState = {
  id: string;
  x: number;
  z: number;
  ry: number;
  lap: number;
  prog: number;
  color: string;
  name: string;
};

type NetValue = {
  roster: RacerPresence[];
  statesRef: React.RefObject<Map<string, NetState>>;
  send: (event: string, payload: Record<string, unknown>) => void;
  connected: boolean;
  isHost: boolean;
};

const NetCtx = createContext<NetValue | null>(null);

export function useNet() {
  return useContext(NetCtx);
}

export function NetProvider({
  name,
  color,
  children,
}: {
  roomCode: string;
  name: string;
  color: string;
  children: ReactNode;
}) {
  const statesRef = useRef(new Map<string, NetState>());
  const roster = useMemo<RacerPresence[]>(() => [{ id: playerId, name, color }], [name, color]);

  const value = useMemo<NetValue>(
    () => ({
      roster,
      statesRef,
      connected: true,
      isHost: true,
      send: () => {},
    }),
    [roster],
  );

  return <NetCtx.Provider value={value}>{children}</NetCtx.Provider>;
}
