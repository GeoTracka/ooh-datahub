"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Database,
  FileText,
  LogOut,
  Map as MapIcon,
  MessageSquareText,
  PanelLeft,
  Plus,
  Send,
  Sparkles,
  Square,
} from "lucide-react";

import { AI_PLANNER_COPY } from "@/content/aiPlannerCopy";
import { parseNdjson } from "@/features/chat/ndjson";
import type {
  WorkspaceArtifact,
  WorkspaceMessage,
  PlanWorkspaceArtifact,
  WorkspaceThread,
} from "@/features/chat/contracts";
import { CampaignPlanView } from "@/features/chat/artifacts/CampaignPlanView";
import { CampaignMapView } from "@/features/chat/artifacts/CampaignMapView";
import { DownloadCard } from "@/features/chat/DownloadCard";
import type { CurrentUser } from "@/server/auth/currentUser";
import type { DownloadDescriptor } from "@/server/chat/contracts";

type View = "chat" | "plan" | "map" | "evidence";

export function ChatWorkspaceShell({
  currentUser,
  initialThreads,
  initialThread,
  initialMessages,
  initialArtifacts,
}: {
  currentUser: CurrentUser;
  initialThreads: WorkspaceThread[];
  initialThread: WorkspaceThread | null;
  initialMessages: WorkspaceMessage[];
  initialArtifacts: WorkspaceArtifact[];
}) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState(initialMessages);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [view, setView] = useState<View>(initialArtifacts.some((item) => item.payload.type === "plan") ? "plan" : "chat");
  const [draft, setDraft] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [liveDownloads, setLiveDownloads] = useState<DownloadDescriptor[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const latestPlan = useMemo<PlanWorkspaceArtifact | undefined>(
    () => [...artifacts].reverse().flatMap((item) =>
      item.payload.type === "plan" ? [{ ...item, payload: item.payload }] : [],
    )[0],
    [artifacts],
  );
  const evidence = artifacts.filter((item) => item.payload.type === "evidence");

  async function ensureThread(title: string) {
    if (thread) return thread;
    const response = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 60) || "New campaign" }),
    });
    if (!response.ok) throw new Error("Could not start a new plan");
    const data = await response.json() as { thread: WorkspaceThread };
    setThread(data.thread);
    setThreads((value) => [data.thread, ...value]);
    window.history.replaceState(null, "", `/chat/${data.thread.id}`);
    return data.thread;
  }

  async function submit(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError(null);
    setAssistantText("");
    setLiveDownloads([]);
    setProgress([]);
    setMessages((value) => [...value, { id: `local-${Date.now()}`, role: "user", content: [{ type: "text", text: prompt }] }]);
    setDraft("");
    const turnDownloads: DownloadDescriptor[] = [];
    try {
      const activeThread = await ensureThread(prompt);
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/chat/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeThread.id, message: prompt }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(response.status === 429 ? "Please wait a moment before trying again." : "The planning assistant could not start.");
      let completedText = "";
      for await (const event of parseNdjson(response.body)) {
        if (event.type === "text.delta") {
          completedText += event.delta;
          setAssistantText(completedText);
        } else if (event.type === "tool.started") {
          setProgress((value) => [...value, event.label]);
        } else if (event.type === "artifact.created") {
          const artifactResponse = await fetch(`/api/artifacts/${event.artifactId}`, { cache: "no-store" });
          if (artifactResponse.ok) {
            const data = await artifactResponse.json() as { artifact: WorkspaceArtifact };
            setArtifacts((value) => [...value.filter((item) => item.id !== data.artifact.id), data.artifact]);
            if (event.artifactType === "plan") setView("plan");
          }
        } else if (event.type === "download.ready") {
          turnDownloads.push(event.download);
          setLiveDownloads([...turnDownloads]);
        } else if (event.type === "response.failed") {
          setError(event.code === "STREAM_FAILED" ? "The response stopped early. Completed plan items are still available." : "Some planning work could not be completed. You can retry.");
        } else if (event.type === "response.completed") {
          const content = [
            ...(completedText ? [{ type: "text" as const, text: completedText }] : []),
            ...turnDownloads.map((download) => ({ type: "download_ref" as const, ...download })),
          ];
          if (content.length) {
            setMessages((value) => [...value, { id: event.messageId, role: "assistant", content }]);
          }
          setAssistantText("");
          setLiveDownloads([]);
        }
      }
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(caught instanceof Error ? caught.message : "The response stopped unexpectedly.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(draft);
  }

  const candidate = latestPlan?.payload.type === "plan"
    ? (latestPlan.payload.options.find((option) => option.id === latestPlan.payload.selectedOptionId) ?? latestPlan.payload.options[0])?.candidate
    : null;

  return (
    <main className={`ai-workspace ${railOpen ? "rail-open" : "rail-closed"}`} data-view={view}>
      <aside className="ai-rail" aria-label="Planning navigation">
        <div className="ai-brand-mark"><Sparkles size={18} /><span>Brainpad</span></div>
        <button className="ai-new-plan" onClick={() => router.push("/chat")}><Plus size={18} /><span>New plan</span></button>
        <nav aria-label="Recent conversations">
          <span className="ai-rail-label">Recent</span>
          {threads.slice(0, 12).map((item) => <a className={thread?.id === item.id ? "active" : ""} href={`/chat/${item.id}`} key={item.id}><MessageSquareText size={16} /><span>{item.title}</span></a>)}
        </nav>
        <div className="ai-rail-account"><div className="ai-avatar">{currentUser.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{currentUser.displayName}</strong><small>{currentUser.email}</small></div><button aria-label="Sign out" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"))}><LogOut size={16} /></button></div>
      </aside>

      <section className="ai-conversation" aria-label="Campaign conversation">
        <header className="ai-conversation-header"><button aria-label="Toggle navigation" onClick={() => setRailOpen((value) => !value)}><PanelLeft size={18} /></button><div><strong>{thread?.title ?? "New campaign"}</strong><small>AI planner · grounded in your data</small></div></header>
        <div className="ai-message-scroll">
          {!messages.length && !assistantText ? <div className="ai-greeting"><span className="ai-spark"><Sparkles size={20} /></span><h1>{AI_PLANNER_COPY.greeting}</h1><p>{AI_PLANNER_COPY.intro}</p><div className="ai-starters">{AI_PLANNER_COPY.starters.map((text) => <button key={text} onClick={() => void submit(text)}>{text}<Send size={14} /></button>)}</div></div> : null}
          {messages.map((message) => <article className={`ai-message ${message.role}`} key={message.id}>{message.content.map((block, index) => block.type === "text" ? <ReactMarkdown remarkPlugins={[remarkGfm]} key={index}>{block.text}</ReactMarkdown> : block.type === "artifact_ref" ? <button className="ai-artifact-link" key={index} onClick={() => setView("plan")}><FileText size={15} />Open plan revision {block.revision}</button> : block.type === "download_ref" ? <DownloadCard download={block} key={index} /> : null)}</article>)}
          {progress.length ? <div className="ai-tool-progress" aria-live="polite">{progress.map((label, index) => <span key={`${label}-${index}`}><i className={busy && index === progress.length - 1 ? "working" : "done"} />{label}</span>)}</div> : null}
          {assistantText ? <article className="ai-message assistant streaming"><ReactMarkdown remarkPlugins={[remarkGfm]}>{assistantText}</ReactMarkdown></article> : null}
          {liveDownloads.map((download) => <DownloadCard download={download} key={`${download.artifactId}-${download.revision}`} />)}
          {error ? <div className="ai-chat-error" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div> : null}
        </div>
        <form className="ai-composer" onSubmit={onSubmit}>
          <label htmlFor="campaign-message">{AI_PLANNER_COPY.composerLabel}</label>
          <textarea id="campaign-message" value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder="e.g. Launch a beverage in Lagos with a ₦20M budget…" disabled={busy} />
          {busy ? <button type="button" className="ai-send" aria-label="Stop response" onClick={() => abortRef.current?.abort()}><Square size={16} /></button> : <button type="submit" className="ai-send" aria-label="Send" disabled={!draft.trim()}><Send size={17} /></button>}
          <small>Plans are estimates. Availability and final rates need confirmation.</small>
        </form>
      </section>

      {latestPlan || evidence.length ? <section className="ai-artifact-canvas" aria-label="Campaign workspace">
        <header className="ai-artifact-tabs" role="tablist" aria-label="Campaign views">
          <button role="tab" aria-selected={view === "plan"} onClick={() => setView("plan")}><FileText size={16} />Plan</button>
          <button role="tab" aria-selected={view === "map"} onClick={() => setView("map")} disabled={!candidate}><MapIcon size={16} />Map</button>
          <button role="tab" aria-selected={view === "evidence"} onClick={() => setView("evidence")}><Database size={16} />Evidence</button>
        </header>
        <div className="ai-artifact-content">
          {view === "plan" && latestPlan ? <CampaignPlanView artifact={latestPlan} /> : null}
          {view === "map" && candidate ? <CampaignMapView siteIds={candidate.siteIds} /> : null}
          {view === "evidence" ? <section className="ai-evidence-view"><span className="ai-eyebrow">Supporting evidence</span><h2>What supports this work</h2>{evidence.length ? evidence.map((item) => item.payload.type === "evidence" ? <article key={item.id}><strong>{item.payload.factIds.length} approved study findings</strong><p>Each finding is stored with its respondent base, study period, source field and caveat.</p><a href={`/plans/${item.id}`}>View source details</a></article> : null) : <p>Evidence used in the conversation will appear here with its source and limits.</p>}</section> : null}
        </div>
      </section> : <aside className="ai-empty-canvas"><div><Sparkles size={22} /><strong>Plan visually, with the details close by</strong><p>{AI_PLANNER_COPY.emptyPlan}</p></div></aside>}

      <nav className="ai-mobile-switcher" aria-label="Workspace views">{(["chat", "plan", "map", "evidence"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)} disabled={item !== "chat" && !latestPlan}>{item === "chat" ? <MessageSquareText /> : item === "plan" ? <FileText /> : item === "map" ? <MapIcon /> : <Database />}<span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}</nav>
    </main>
  );
}
