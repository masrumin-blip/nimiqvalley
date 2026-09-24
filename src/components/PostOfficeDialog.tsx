import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Mail, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendLetter } from "@/lib/letters.functions";
import { LETTER_MAX, letterLink, shortAddr, type Letter, type LetterToken } from "@/lib/letters";
import { payNim, sendUsdtPolygon } from "@/lib/wallet";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inbox: Letter[];
  onRead: (letter: Letter) => void;
}

export default function PostOfficeDialog({ open, onOpenChange, inbox, onRead }: Props) {
  const qc = useQueryClient();
  const send = useServerFn(sendLetter);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<LetterToken>("none");
  const [amount, setAmount] = useState("");
  const [usdtTo, setUsdtTo] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [sent, setSent] = useState<Letter | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      const address = to.trim().toUpperCase();
      if (token !== "none" && !(amt > 0)) throw new Error("Enter an amount.");
      let txHash: string | undefined;
      if (token === "nim") {
        setStep("Approve the NIM payment in your wallet…");
        await payNim(address, amt, "Nimiq Village letter");
      } else if (token === "usdt") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(usdtTo.trim())) throw new Error("Enter the recipient's Polygon address.");
        setStep("Approve the USDT transfer in your wallet…");
        txHash = (await sendUsdtPolygon(usdtTo.trim(), amt)).hash;
      }
      setStep(token === "none" ? "Sending your letter…" : "Confirming payment…");
      return send({
        data: {
          to: address,
          message,
          token,
          amount: token === "none" ? 0 : amt,
          txHash,
          usdtTo: token === "usdt" ? usdtTo.trim() : undefined,
        },
      });
    },
    onSuccess: (letter) => {
      setSent(letter);
      setMessage("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["nim-balance"] });
    },
    onSettled: () => setStep(null),
  });

  const link = sent ? letterLink(sent.id) : "";
  const share = async () => {
    const text = "You've got a letter in Nimiq Village! 💌";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Nimiq Village Post", text, url: link });
        return;
      } catch {
        /* fall back to copy */
      }
    }
    await copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const unread = inbox.filter((l) => !l.openedAt).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" /> Post Office
          </DialogTitle>
          <DialogDescription>Send a letter to any Nimiq address, with an optional NIM or USDT gift.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={unread ? "inbox" : "write"}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="write" className="min-h-10">Write</TabsTrigger>
            <TabsTrigger value="inbox" className="min-h-10">Inbox{unread ? ` (${unread})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="space-y-3 pt-2">
            {sent ? (
              <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
                <p className="text-lg font-semibold">Letter sent! 💌</p>
                <p className="text-xs text-muted-foreground">
                  It's waiting at the post office for {shortAddr(sent.to)}. Share the link so they know.
                </p>
                <p className="break-all rounded-lg bg-background px-2 py-1 text-[11px]">{link}</p>
                <div className="flex gap-2">
                  <Button onClick={share} className="min-h-11 flex-1"><Share2 className="size-4" /> Share</Button>
                  <Button variant="outline" onClick={copy} className="min-h-11 flex-1">
                    <Copy className="size-4" /> {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => setSent(null)} className="min-h-11 w-full">Write another</Button>
              </div>
            ) : (
              <>
                <label className="block text-xs font-medium text-muted-foreground">
                  Recipient Nimiq address
                  <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="NQ00 0000 …" className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  Message ({message.length}/{LETTER_MAX})
                  <textarea value={message} maxLength={LETTER_MAX} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground" />
                </label>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Attach a gift</p>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {(["none", "nim", "usdt"] as const).map((t) => (
                      <Button key={t} type="button" variant={token === t ? "default" : "outline"} onClick={() => setToken(t)} className="min-h-11">
                        {t === "none" ? "No gift" : t.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
                {token !== "none" && (
                  <label className="block text-xs font-medium text-muted-foreground">
                    Amount ({token.toUpperCase()})
                    <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
                  </label>
                )}
                {token === "usdt" && (
                  <label className="block text-xs font-medium text-muted-foreground">
                    Recipient Polygon address (for USDT)
                    <input value={usdtTo} onChange={(e) => setUsdtTo(e.target.value)} placeholder="0x…" className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
                  </label>
                )}
                {mutation.error && <p className="text-xs text-destructive">{mutation.error.message}</p>}
                {step && <p className="text-xs text-muted-foreground">{step}</p>}
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !message.trim() || !to.trim()} className="min-h-11 w-full">
                  {mutation.isPending ? "Sending…" : "Send letter"}
                </Button>
                <p className="text-[11px] text-muted-foreground">Letters are free. Gifts go straight from your wallet to theirs.</p>
              </>
            )}
          </TabsContent>

          <TabsContent value="inbox" className="space-y-2 pt-2">
            {inbox.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No letters yet.</p>
            ) : (
              inbox.map((l) => (
                <button key={l.id} type="button" onClick={() => onRead(l)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-accent">
                  <Mail className={`size-5 ${l.openedAt ? "text-muted-foreground" : "text-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">From {shortAddr(l.from)}{!l.openedAt && " · new"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.token !== "none" ? `🎁 ${l.amount} ${l.token.toUpperCase()} · ` : ""}{new Date(l.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
