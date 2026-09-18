import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Award, Check, Crown, Gamepad2, Globe, Lock, Medal, MessageSquare, Send, Shield, Trophy, User, UserPlus, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { PlayerBadge } from "@/components/PlayerBadge";
import { WalletGate } from "@/components/WalletGate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayer } from "@/hooks/usePlayer";
import { fetchAchievements } from "@/lib/achievements.functions";
import type { AchievementBadge, AchievementSummary } from "@/lib/achievements";
import {
  addFriend,
  fetchChat,
  fetchDm,
  fetchSocial,
  respondFriend,
  saveProfile,
  sendChat,
  sendDm,
  viewProfile,
} from "@/lib/chat.functions";
import { CHAT_LIMITS, POLL_INTERVAL_MS, type ProfileView, type Socials } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const title = "Arena Chat — NimiqValley";
const description =
  "Global player chat for NimiqValley: talk to everyone, add friends, and send private messages.";

export const Route = createFileRoute("/arena")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArenaPage,
});

type Tab = "global" | "dm" | "friends" | "me";

function ArenaPage() {
  return (
    <WalletGate name="Arena Chat">
      <Arena />
    </WalletGate>
  );
}

function Arena() {
  const [tab, setTab] = useState<Tab>("global");
  const [dmWith, setDmWith] = useState<{ wallet: string; name: string } | null>(null);
  const [profileWallet, setProfileWallet] = useState<string | null>(null);
  const social = useSocial();
  const pending = social.data?.incoming.length ?? 0;

  return (
    <main className="mx-auto flex h-[100svh] max-w-2xl flex-col gap-3 p-3 sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <Link
          to="/games"
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-3.5" /> Game Hub
        </Link>
        <PlayerBadge />
      </header>

      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1 text-xs font-bold">
        <TabButton active={tab === "global"} onClick={() => setTab("global")} icon={<Users className="size-3.5" />} label="Global" />
        <TabButton active={tab === "dm"} onClick={() => setTab("dm")} icon={<MessageSquare className="size-3.5" />} label="DM" />
        <TabButton
          active={tab === "friends"}
          onClick={() => setTab("friends")}
          icon={<UserPlus className="size-3.5" />}
          label={pending > 0 ? `Friends (${pending})` : "Friends"}
        />
        <TabButton active={tab === "me"} onClick={() => setTab("me")} icon={<User className="size-3.5" />} label="Profile" />
      </nav>

      {tab === "global" && <GlobalChat onProfile={setProfileWallet} />}
      {tab === "dm" &&
        (dmWith ? (
          <DmRoom peer={dmWith} onBack={() => setDmWith(null)} />
        ) : (
          <DmList onOpen={setDmWith} />
        ))}
      {tab === "friends" && (
        <Friends
          onProfile={setProfileWallet}
          onMessage={(p) => {
            setDmWith(p);
            setTab("dm");
          }}
        />
      )}
      {tab === "me" && <ProfileEditor />}
      <PlayerProfileDialog wallet={profileWallet} onOpenChange={(open) => !open && setProfileWallet(null)} />
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function useSocial() {
  const fn = useServerFn(fetchSocial);
  return useQuery({
    queryKey: ["arena-social"],
    queryFn: () => fn(),
    refetchInterval: POLL_INTERVAL_MS * 2,
  });
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {children}
    </section>
  );
}

function GlobalChat({ onProfile }: { onProfile: (wallet: string) => void }) {
  const { player } = usePlayer();
  const qc = useQueryClient();
  const listFn = useServerFn(fetchChat);
  const sendFn = useServerFn(sendChat);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const chat = useQuery({
    queryKey: ["arena-chat"],
    queryFn: () => listFn(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const send = useMutation({
    mutationFn: (value: string) => sendFn({ data: { text: value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arena-chat"] }),
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [chat.data?.messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || send.isPending) return;
    setText("");
    send.mutate(value);
  };

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="font-bold uppercase tracking-[0.2em] text-foreground">Global</span>
        <span>{chat.data?.onlineCount ?? 0} online</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {(chat.data?.messages ?? []).length === 0 && (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello to the valley.
          </p>
        )}
        {(chat.data?.messages ?? []).map((m) => {
          const mine = m.wallet === player?.wallet;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {!mine && (
                  <button type="button" onClick={() => onProfile(m.wallet)} className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide opacity-70 transition-opacity hover:opacity-100">
                    {m.name}
                  </button>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <Composer value={text} onChange={setText} onSubmit={submit} disabled={send.isPending} />
      {send.isError && (
        <p className="px-4 pb-2 text-xs text-destructive">{(send.error as Error).message}</p>
      )}
    </Panel>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-2">
      <input
        value={value}
        maxLength={CHAT_LIMITS.textMax}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a message…"
        aria-label="Message"
        className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <Button type="submit" size="icon" className="rounded-xl" disabled={disabled || !value.trim()} aria-label="Send message">
        <Send className="size-4" />
      </Button>
    </form>
  );
}

function DmList({ onOpen }: { onOpen: (p: { wallet: string; name: string }) => void }) {
  const social = useSocial();
  const threads = social.data?.threads ?? [];
  const friends = social.data?.friends ?? [];
  return (
    <Panel>
      <div className="flex-1 overflow-y-auto p-3">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Conversations
        </h2>
        {threads.length === 0 && (
          <p className="text-sm text-muted-foreground">No private messages yet.</p>
        )}
        <ul className="space-y-1">
          {threads.map((t) => (
            <li key={t.wallet}>
              <button
                type="button"
                onClick={() => onOpen({ wallet: t.wallet, name: t.name })}
                className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <p className="text-sm font-bold text-foreground">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">{t.lastText}</p>
              </button>
            </li>
          ))}
        </ul>

        {friends.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Friends
            </h2>
            <ul className="space-y-1">
              {friends.map((f) => (
                <li key={f.wallet}>
                  <button
                    type="button"
                    onClick={() => onOpen(f)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

function DmRoom({
  peer,
  onBack,
}: {
  peer: { wallet: string; name: string };
  onBack: () => void;
}) {
  const { player } = usePlayer();
  const qc = useQueryClient();
  const listFn = useServerFn(fetchDm);
  const sendFn = useServerFn(sendDm);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const thread = useQuery({
    queryKey: ["arena-dm", peer.wallet],
    queryFn: () => listFn({ data: { target: peer.wallet } }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const send = useMutation({
    mutationFn: (value: string) => sendFn({ data: { target: peer.wallet, text: value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arena-dm", peer.wallet] }),
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.data?.length]);

  return (
    <Panel>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="rounded-full p-1 hover:bg-accent">
          <ArrowLeft className="size-4" />
        </button>
        <span className="text-sm font-bold text-foreground">{peer.name}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {(thread.data ?? []).map((m) => {
          const mine = m.from === player?.wallet;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <Composer
        value={text}
        onChange={setText}
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value || send.isPending) return;
          setText("");
          send.mutate(value);
        }}
        disabled={send.isPending}
      />
      {send.isError && (
        <p className="px-4 pb-2 text-xs text-destructive">{(send.error as Error).message}</p>
      )}
    </Panel>
  );
}

function Friends({ onMessage, onProfile }: { onMessage: (p: { wallet: string; name: string }) => void; onProfile: (wallet: string) => void }) {
  const qc = useQueryClient();
  const social = useSocial();
  const addFn = useServerFn(addFriend);
  const respondFn = useServerFn(respondFriend);
  const [query, setQuery] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["arena-social"] });

  const add = useMutation({
    mutationFn: (value: string) => addFn({ data: { target: value } }),
    onSuccess: () => {
      setQuery("");
      refresh();
    },
  });

  const respond = useMutation({
    mutationFn: (input: { id: string; accept: boolean }) => respondFn({ data: input }),
    onSuccess: refresh,
  });

  return (
    <Panel>
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) add.mutate(query.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Player name or wallet"
            aria-label="Find a player"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" className="rounded-xl" disabled={add.isPending || !query.trim()}>
            <UserPlus className="size-4" /> Add
          </Button>
        </form>
        {add.isError && <p className="text-xs text-destructive">{(add.error as Error).message}</p>}
        {add.isSuccess && (
          <p className="text-xs text-muted-foreground">Friend request sent.</p>
        )}

        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Requests
          </h2>
          {(social.data?.incoming ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          )}
          <ul className="space-y-1">
            {(social.data?.incoming ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-accent">
                <span className="text-sm font-semibold text-foreground">{r.fromName}</span>
                <span className="flex gap-1">
                  <Button size="icon" variant="secondary" aria-label={`Accept ${r.fromName}`} onClick={() => respond.mutate({ id: r.id, accept: true })}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Decline ${r.fromName}`} onClick={() => respond.mutate({ id: r.id, accept: false })}>
                    <X className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Friends
          </h2>
          {(social.data?.friends ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No friends yet.</p>
          )}
          <ul className="space-y-1">
            {(social.data?.friends ?? []).map((f) => (
              <li key={f.wallet} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-accent">
                <button type="button" onClick={() => onProfile(f.wallet)} className="text-sm font-semibold text-foreground hover:text-primary">{f.name}</button>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => onMessage(f)}>
                  <MessageSquare className="size-3.5" /> Message
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {(social.data?.outgoing ?? []).length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Sent
            </h2>
            <ul className="space-y-1">
              {(social.data?.outgoing ?? []).map((r) => (
                <li key={r.id} className="px-3 py-1 text-sm text-muted-foreground">
                  {r.toName} — waiting
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ProfileEditor() {
  const qc = useQueryClient();
  const social = useSocial();
  const saveFn = useServerFn(saveProfile);
  const achievementFn = useServerFn(fetchAchievements);
  const profile = social.data?.profile;
  const achievements = useQuery({
    queryKey: ["arena-achievements", profile?.wallet],
    queryFn: () => achievementFn({ data: {} }),
    enabled: Boolean(profile?.wallet),
  });

  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<Socials>({ twitter: "", instagram: "", discord: "" });
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [dmPolicy, setDmPolicy] = useState<"everyone" | "friends">("everyone");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile || loaded) return;
    setBio(profile.bio);
    setSocials(profile.socials);
    setVisibility(profile.visibility);
    setDmPolicy(profile.dmPolicy);
    setLoaded(true);
  }, [profile, loaded]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { bio, ...socials, visibility, dmPolicy } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arena-social"] }),
  });

  return (
    <Panel>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">You</p>
          <p className="text-lg font-black text-foreground">{profile?.name ?? "…"}</p>
        </div>

        <AchievementCollection summary={achievements.data} loading={achievements.isLoading} />

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-foreground">Bio</span>
          <textarea
            value={bio}
            maxLength={CHAT_LIMITS.bioMax}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {(["twitter", "instagram", "discord"] as const).map((key) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block font-semibold capitalize text-foreground">{key}</span>
            <input
              value={socials[key]}
              maxLength={CHAT_LIMITS.socialMax}
              onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={visibility === "public" ? "default" : "secondary"}
            className="rounded-full"
            onClick={() => setVisibility(visibility === "public" ? "private" : "public")}
          >
            {visibility === "public" ? <Globe className="size-4" /> : <Lock className="size-4" />}
            {visibility === "public" ? "Public profile" : "Private profile"}
          </Button>
          <Button
            type="button"
            variant={dmPolicy === "everyone" ? "default" : "secondary"}
            className="rounded-full"
            onClick={() => setDmPolicy(dmPolicy === "everyone" ? "friends" : "everyone")}
          >
            <MessageSquare className="size-4" />
            {dmPolicy === "everyone" ? "DM from everyone" : "DM from friends only"}
          </Button>
        </div>

        <Button className="w-full rounded-xl font-bold" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
        {save.isError && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
        {save.isSuccess && <p className="text-xs text-muted-foreground">Profile saved.</p>}
      </div>
    </Panel>
  );
}

const badgeTone: Record<AchievementBadge["tier"], string> = {
  gold: "border-primary/40 bg-primary/10 text-primary",
  silver: "border-border bg-muted text-foreground",
  bronze: "border-accent bg-accent/50 text-accent-foreground",
  emerald: "border-success/40 bg-success/10 text-success",
};

function BadgeIcon({ badge }: { badge: AchievementBadge }) {
  if (badge.kind === "rank") return badge.tier === "gold" ? <Crown className="size-4" /> : <Medal className="size-4" />;
  if (badge.kind === "wins") return <Shield className="size-4" />;
  return <Gamepad2 className="size-4" />;
}

function AchievementCollection({ summary, loading = false }: { summary: AchievementSummary | undefined; loading?: boolean }) {
  return (
    <section aria-label="Achievements" className="space-y-3 border-y border-border py-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Achievements</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={summary?.badges.length ?? 0} label="Badges" />
        <Stat value={summary?.onlineWins ?? 0} label="Online wins" />
        <Stat value={`${summary?.gamesPlayed ?? 0}/${summary?.totalGames ?? 11}`} label="Games" />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading achievements…</p>
      ) : summary && summary.badges.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {summary.badges.map((badge) => (
            <div key={badge.id} className={cn("flex min-w-0 items-center gap-2 rounded-lg border p-2", badgeTone[badge.tier])}>
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background/60"><BadgeIcon badge={badge} /></span>
              <span className="min-w-0">
                <strong className="block truncate text-xs">{badge.title}</strong>
                <span className="block truncate text-[10px] opacity-75">{badge.detail}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          <Award className="size-4" /> Play a leaderboard game or win online to earn your first badge.
        </div>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div className="rounded-lg bg-muted px-2 py-2"><strong className="block text-lg leading-none text-foreground">{value}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{label}</span></div>;
}

function PlayerProfileDialog({ wallet, onOpenChange }: { wallet: string | null; onOpenChange: (open: boolean) => void }) {
  const profileFn = useServerFn(viewProfile);
  const achievementFn = useServerFn(fetchAchievements);
  const profile = useQuery<ProfileView>({
    queryKey: ["arena-profile", wallet],
    queryFn: () => profileFn({ data: { target: wallet ?? "" } }),
    enabled: Boolean(wallet),
  });
  const achievements = useQuery({
    queryKey: ["arena-achievements", wallet],
    queryFn: () => achievementFn({ data: { target: wallet ?? undefined } }),
    enabled: Boolean(wallet),
  });
  return (
    <Dialog open={Boolean(wallet)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] max-w-md overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>{profile.data?.name ?? "Player profile"}</DialogTitle>
          <DialogDescription>{profile.data?.hidden ? "Private profile · achievements are public" : profile.data?.bio || "NimiqValley player"}</DialogDescription>
        </DialogHeader>
        <AchievementCollection summary={achievements.data} loading={achievements.isLoading} />
        {!profile.data?.hidden && profile.data?.socials && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {profile.data.socials.twitter && <p>X: {profile.data.socials.twitter}</p>}
            {profile.data.socials.instagram && <p>Instagram: {profile.data.socials.instagram}</p>}
            {profile.data.socials.discord && <p>Discord: {profile.data.socials.discord}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
