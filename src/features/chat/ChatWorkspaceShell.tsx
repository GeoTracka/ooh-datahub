"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  currentUser: CurrentUser | null;
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
  const [view, setView] = useState<View>("chat");
  const [draft, setDraft] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [liveDownloads, setLiveDownloads] = useState<DownloadDescriptor[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestPlan = useMemo<PlanWorkspaceArtifact | undefined>(
    () => [...artifacts].reverse().flatMap((item) =>
      item.payload.type === "plan" ? [{ ...item, payload: item.payload }] : [],
    )[0],
    [artifacts],
  );
  const evidence = artifacts.filter((item) => item.payload.type === "evidence");
  const hasResults = Boolean(latestPlan || evidence.length);
  const canvasView = view === "chat" ? (latestPlan ? "plan" : "evidence") : view;

  useEffect(() => {
    if (initialThread) return;
    try {
      const saved = sessionStorage.getItem("brainpad-chat-draft");
      if (saved) {
        // Restore a user-authored draft from external tab storage after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft(saved);
        sessionStorage.removeItem("brainpad-chat-draft");
      }
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [initialThread]);

  function newChat() {
    if (busy) return;
    setThread(null);
    setMessages([]);
    setArtifacts([]);
    setView("chat");
    setDraft("");
    setAssistantText("");
    setLiveDownloads([]);
    setProgress([]);
    setError(null);
    window.history.replaceState(null, "", "/chat");
    if (menuRef.current) menuRef.current.open = false;
    composerRef.current?.focus();
  }

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
    if (!currentUser) {
      try { sessionStorage.setItem("brainpad-chat-draft", prompt); } catch { /* Sign-in still works without storage. */ }
      router.push("/login?next=/chat");
      return;
    }
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

  function openPreview(artifactType = "plan") {
    const nextView = artifactType === "map" ? "map" : artifactType === "evidence" || artifactType === "audience" ? "evidence" : "plan";
    if (!hasResults || (nextView === "map" && !candidate) || (nextView === "plan" && !latestPlan)) {
      setError("This preview is not available. Ask the assistant to create it again.");
      setView("chat");
      return;
    }
    setView(nextView);
  }

  return (
    <main className="ai-workspace" data-view={view} data-has-results={hasResults}>
      <aside className="ai-rail" aria-label="Planning navigation">
        <div className="ai-brand-mark"><Sparkles size={18} /><span>Brainpad</span></div>
        <button className="ai-new-plan" onClick={newChat} disabled={busy}><Plus size={18} /><span>New chat</span></button>
        <nav className="ai-primary-nav" aria-label="Planning tools">
          <Link href="/chat" aria-current="page" onNavigate={(event) => { event.preventDefault(); newChat(); }}><MessageSquareText size={18} /><span>AI chat</span></Link>
          <Link href="/planner"><FileText size={18} /><span>Plan manually</span></Link>
        </nav>
        <nav aria-label="Recent conversations">
          <span className="ai-rail-label">Recent</span>
          {threads.slice(0, 12).map((item) => <a className={thread?.id === item.id ? "active" : ""} href={`/chat/${item.id}`} key={item.id}><MessageSquareText size={16} /><span>{item.title}</span></a>)}
        </nav>
        {currentUser ? <div className="ai-rail-account"><div className="ai-avatar">{currentUser.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{currentUser.displayName}</strong><small>{currentUser.email}</small></div><button aria-label="Sign out" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"))}><LogOut size={16} /></button></div> : <a className="ai-sign-in" href="/login?next=/chat">Sign in to save your work</a>}
      </aside>

      <section className="ai-conversation" aria-label="Campaign conversation">
        <header className="ai-conversation-header">
          <details className="ai-navigation-menu" ref={menuRef} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
            <summary><PanelLeft size={18} /><span>Menu</span></summary>
            <nav aria-label="Workspace menu">
              <button onClick={newChat} disabled={busy}><Plus size={18} />New chat</button>
              <Link href="/chat" aria-current="page" onNavigate={(event) => { event.preventDefault(); newChat(); }}>AI chat</Link>
              <Link href="/planner">Plan manually</Link>
              {threads.slice(0, 12).map((item) => <a href={`/chat/${item.id}`} key={item.id}>{item.title}</a>)}
              {currentUser ? <button onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"))}>Sign out</button> : <a href="/login?next=/chat">Sign in</a>}
            </nav>
          </details>
          <div><strong>{thread?.title ?? "Brainpad AI"}</strong><small>Campaign planning, backed by your data</small></div>
        </header>
        <div className="ai-message-scroll">
          {!messages.length && !assistantText ? <div className="ai-greeting"><span className="ai-spark"><Sparkles size={20} /></span><h1>{AI_PLANNER_COPY.greeting}</h1><p>{AI_PLANNER_COPY.intro}</p><div className="ai-starters">{AI_PLANNER_COPY.starters.map((text) => <button key={text} onClick={() => void submit(text)}>{text}<Send size={14} /></button>)}</div></div> : null}
          {messages.map((message) => <article className={`ai-message ${message.role}`} key={message.id}>{message.content.map((block, index) => block.type === "text" ? <ReactMarkdown remarkPlugins={[remarkGfm]} key={index}>{block.text}</ReactMarkdown> : block.type === "artifact_ref" ? <button className="ai-artifact-link" key={index} onClick={() => openPreview(block.artifactType)}><FileText size={15} />Open {block.artifactType ?? "plan"} revision {block.revision}</button> : block.type === "download_ref" ? <DownloadCard download={block} key={index} /> : null)}</article>)}
          {progress.length ? <div className="ai-tool-progress" aria-live="polite">{progress.map((label, index) => <span key={`${label}-${index}`}><i className={busy && index === progress.length - 1 ? "working" : "done"} />{label}</span>)}</div> : null}
          {assistantText ? <article className="ai-message assistant streaming"><ReactMarkdown remarkPlugins={[remarkGfm]}>{assistantText}</ReactMarkdown></article> : null}
          {liveDownloads.map((download) => <DownloadCard download={download} key={`${download.artifactId}-${download.revision}`} />)}
          {error ? <div className="ai-chat-error" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div> : null}
        </div>
        <form className="ai-composer" onSubmit={onSubmit}>
          <label htmlFor="campaign-message">{AI_PLANNER_COPY.composerLabel}</label>
          <textarea ref={composerRef} id="campaign-message" value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder="e.g. Launch a beverage in Lagos with a ₦20M budget…" disabled={busy} />
          {busy ? <button type="button" className="ai-send" aria-label="Stop response" onClick={() => abortRef.current?.abort()}><Square size={16} /></button> : <button type="submit" className="ai-send" aria-label="Send" disabled={!draft.trim()}><Send size={17} /></button>}
          <small>{currentUser ? "Plans are estimates. Confirm availability and final rates." : "Sign in to send your message and save your work."}</small>
        </form>
      </section>

      {latestPlan || evidence.length ? <section className="ai-artifact-canvas" aria-label="Campaign workspace">
        <header className="ai-artifact-tabs" role="tablist" aria-label="Campaign views">
          <button role="tab" aria-selected={canvasView === "plan"} onClick={() => setView("plan")} disabled={!latestPlan}><FileText size={16} />Plan</button>
          <button role="tab" aria-selected={canvasView === "map"} onClick={() => setView("map")} disabled={!candidate}><MapIcon size={16} />Map</button>
          <button role="tab" aria-selected={canvasView === "evidence"} onClick={() => setView("evidence")}><Database size={16} />Evidence</button>
        </header>
        <div className="ai-artifact-content">
          {canvasView === "plan" && latestPlan ? <CampaignPlanView artifact={latestPlan} /> : null}
          {canvasView === "map" && candidate ? <CampaignMapView siteIds={candidate.siteIds} /> : null}
          {canvasView === "evidence" ? <section className="ai-evidence-view"><span className="ai-eyebrow">Supporting evidence</span><h2>What supports this work</h2>{evidence.length ? evidence.map((item) => item.payload.type === "evidence" ? <article key={item.id}><strong>{item.payload.factIds.length} approved study findings</strong><p>Each finding is stored with its respondent base, study period, source field and caveat.</p><a href={`/plans/${item.id}`}>View source details</a></article> : null) : <p>Evidence used in the conversation will appear here with its source and limits.</p>}</section> : null}
        </div>
      </section> : null}

      {hasResults ? <nav className="ai-mobile-switcher" aria-label="Workspace views">{(["chat", "plan", "map", "evidence"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} aria-pressed={view === item} onClick={() => setView(item)} disabled={item === "plan" ? !latestPlan : item === "map" ? !candidate : false}>{item === "chat" ? <MessageSquareText /> : item === "plan" ? <FileText /> : item === "map" ? <MapIcon /> : <Database />}<span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}</nav> : null}
    </main>
  );
}
