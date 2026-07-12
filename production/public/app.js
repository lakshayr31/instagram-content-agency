const app = document.querySelector("#app");
let currentRun = null;
let currentUser = null;

const stageLabels = {
  awaiting_brief_confirmation: "Manager confirmation",
  ideas_review: "Ideas review",
  scripts_review: "Scripts review",
  final: "Final output",
};

const escape = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[char]);
const text = (value) => escape(value).replace(/\n/g, "<br>");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "The request failed.");
  }
  const type = response.headers.get("content-type") ?? "";
  return type.includes("application/json") ? response.json() : response;
}

function layout(inner) {
  app.innerHTML = `<header class="hero"><div><div class="eyebrow">Instagram content agency</div><h1>Your Manager runs the agency. You approve the work.</h1><p class="sub">A deliberate, human-in-the-loop flow: brief → ideas → scripts → downloadable post, carousel, and reel.</p></div>${currentUser ? `<div class="tag">${escape(currentUser.email)}</div>` : ""}</header>${currentRun ? stageBar() : ""}${inner}`;
}

function stageBar() {
  const stages = ["awaiting_brief_confirmation", "ideas_review", "scripts_review", "final"];
  return `<nav class="stage">${stages.map((stage) => `<span class="${currentRun.stage === stage ? "active" : ""}">${stageLabels[stage]}</span>`).join("")}</nav>`;
}

function showError(error) { app.insertAdjacentHTML("afterbegin", `<p class="error">${escape(error.message ?? error)}</p>`); }
function loading() { layout(`<div class="loading">The Manager is coordinating the next step…</div>`); }

function signup() {
  layout(`<section class="card"><div class="eyebrow">Start here</div><h2>Create your workspace</h2><p class="sub">Use your email to save briefs, approvals, and feedback memory. This demo uses a simple email session; it does not send a verification email.</p><form id="signup"><label>Email<input type="email" name="email" placeholder="you@company.com" required autocomplete="email"></label><div class="actions"><button>Continue to Manager</button></div></form></section>`);
  document.querySelector("#signup").addEventListener("submit", async (event) => {
    event.preventDefault();
    loading();
    try { const data = await api("/api/signup", { method:"POST", body:JSON.stringify({ email:new FormData(event.currentTarget).get("email") }) }); currentUser = data.user; briefForm(); }
    catch (error) { signup(); showError(error); }
  });
}

function briefForm() {
  currentRun = null;
  layout(`<section class="card"><div class="eyebrow">Talk to your Manager</div><h2>What should the agency build?</h2><p class="sub">Give the Manager the audience, objective, topic, source constraints, and brand voice. The Manager will restate the work and wait for your explicit “yes.”</p><form id="brief"><label>Brief<textarea name="brief" placeholder="Example: Create explainers for Indian F1 fans. Goal: saves and shares. Cover today’s 2026 regulation discussion; use a simple confident voice; do not make unsupported performance claims." required></textarea></label><div class="actions"><button>Ask Manager</button></div></form></section>`);
  document.querySelector("#brief").addEventListener("submit", async (event) => {
    event.preventDefault(); loading();
    try { const result = await api("/api/runs", { method:"POST", body:JSON.stringify({ brief:new FormData(event.currentTarget).get("brief") }) }); currentRun = { id:result.id, stage:result.stage, manager:result.manager }; renderRun(); }
    catch (error) { briefForm(); showError(error); }
  });
}

function memoryHtml() {
  const memory = currentRun.memory ?? [];
  if (!memory.length) return "";
  return `<section class="card"><h2>Page memory</h2><p class="sub">Feedback saved to this run and included in subsequent Manager/agent calls.</p>${memory.map((item) => `<div class="memory"><b>${escape(stageLabels[item.stage] ?? item.stage)}</b><br>${text(item.feedback)}</div>`).join("")}</section>`;
}

function renderRun() {
  if (currentRun.stage === "awaiting_brief_confirmation") return renderConfirmation();
  if (currentRun.stage === "ideas_review") return renderIdeas();
  if (currentRun.stage === "scripts_review") return renderScripts();
  return renderFinal();
}

function renderConfirmation() {
  const manager = currentRun.manager ?? {};
  layout(`<section class="card"><div class="eyebrow">Manager restatement</div><h2>${escape(manager.summary ?? "Here is what I understand.")}</h2><div class="two"><div><h3>Deliverables</h3><p>${text(Array.isArray(manager.deliverables) ? manager.deliverables.join("\n") : manager.deliverables)}</p></div><div><h3>Assumptions</h3><p>${text(Array.isArray(manager.assumptions) ? manager.assumptions.join("\n") : manager.assumptions)}</p></div></div><p class="sub">${escape(manager.question ?? "Is this correct? I will not begin agency work until you confirm.")}</p><div class="actions"><button id="confirm">Yes — start the agency</button><button class="secondary" id="change">Change brief</button></div></section>`);
  document.querySelector("#confirm").onclick = async () => { loading(); try { const data = await api(`/api/runs/${currentRun.id}/confirm`, { method:"POST" }); currentRun = { ...currentRun, ...data }; await refreshRun(); } catch (error) { renderConfirmation(); showError(error); } };
  document.querySelector("#change").onclick = briefForm;
}

function ideaCard(idea) { return `<article class="card idea"><span class="tag">${escape(idea.format)}</span><h3>${escape(idea.title)}</h3><p>${escape(idea.angle)}</p><p class="sub"><b>Why now:</b> ${escape(idea.why)}</p><p class="sub"><b>Source:</b> ${idea.sourceUrl ? `<a href="${escape(idea.sourceUrl)}" target="_blank" rel="noreferrer">${escape(idea.sourceUrl)}</a>` : "missing"}</p></article>`; }
function feedbackBox(stage) { return `<section class="card"><h2>Give feedback before the Manager continues</h2><p class="sub">This feedback is saved as memory for this run and used to revise the current page.</p><textarea id="feedback" placeholder="Example: Make the carousel more beginner-friendly; avoid mentioning a driver unless the source is explicit."></textarea><div class="actions"><button id="revise">Save feedback and revise</button>${stage === "ideas_review" ? `<button class="secondary" id="approveIdeas">Approve ideas → scripts</button>` : `<button class="secondary" id="approveScripts">Approve scripts → final output</button>`}</div></section>`; }
function wireFeedback(stage) {
  document.querySelector("#revise").onclick = () => submitFeedback();
  const approve = document.querySelector(stage === "ideas_review" ? "#approveIdeas" : "#approveScripts");
  approve.onclick = () => approveStage(stage);
}
async function submitFeedback() { const feedback = document.querySelector("#feedback").value; if (!feedback.trim()) return; loading(); try { await api(`/api/runs/${currentRun.id}/feedback`, { method:"POST", body:JSON.stringify({ feedback }) }); await refreshRun(); } catch (error) { renderRun(); showError(error); } }
async function approveStage(stage) { loading(); try { await api(`/api/runs/${currentRun.id}/${stage === "ideas_review" ? "approve-ideas" : "approve-scripts"}`, { method:"POST" }); await refreshRun(); } catch (error) { renderRun(); showError(error); } }

function renderIdeas() { const ideas = currentRun.ideas?.ideas ?? []; layout(`<section><div class="eyebrow">Stage 1 of 2</div><h2>Approve the agency’s three ideas</h2><p class="sub">The Manager will not create scripts until you explicitly approve the direction.</p><div class="grid">${ideas.map(ideaCard).join("")}</div></section>${feedbackBox("ideas_review")}${memoryHtml()}`); wireFeedback("ideas_review"); }

function renderScripts() {
  const scripts = currentRun.scripts ?? {};
  const carousel = (scripts.carousel?.slides ?? []).map((slide, index) => `${index + 1}. ${slide.headline}\n${slide.body}`).join("\n\n");
  const beats = (scripts.reel?.beats ?? []).map((beat) => `${beat.seconds}s — ${beat.text}\nVisual: ${beat.visual}`).join("\n\n");
  layout(`<section><div class="eyebrow">Stage 2 of 2</div><h2>Approve the production scripts</h2><p class="sub">Feedback here becomes durable memory before final assets are revealed.</p><div class="grid"><article class="card"><span class="tag">Post</span><h3>${escape(scripts.post?.headline)}</h3><div class="script">${text(scripts.post?.body)}\n\n${text(scripts.post?.caption)}</div></article><article class="card"><span class="tag">Carousel</span><h3>Slide sequence</h3><div class="script">${text(carousel)}</div></article><article class="card"><span class="tag">Reel</span><h3>${escape(scripts.reel?.title)}</h3><div class="script">${text(beats)}</div></article></div></section>${feedbackBox("scripts_review")}${memoryHtml()}`); wireFeedback("scripts_review");
}

function drawCard(canvas, title, body, label) { const ctx = canvas.getContext("2d"); canvas.width=1080; canvas.height=1350; const gradient=ctx.createLinearGradient(0,0,1080,1350); gradient.addColorStop(0,"#08213a"); gradient.addColorStop(1,"#155f85"); ctx.fillStyle=gradient; ctx.fillRect(0,0,1080,1350); ctx.fillStyle="#61e0b3"; ctx.fillRect(72,72,168,8); ctx.fillStyle="#d0efeb"; ctx.font="700 26px system-ui"; ctx.fillText(label.toUpperCase(),72,128); ctx.fillStyle="#f8fbff"; ctx.font="800 84px system-ui"; wrap(ctx,title,72,430,850,95); ctx.fillStyle="#cfe5f4"; ctx.font="500 38px system-ui"; wrap(ctx,body,72,830,900,54); ctx.strokeStyle="rgba(255,255,255,.45)"; ctx.beginPath(); ctx.moveTo(72,1170); ctx.lineTo(1008,1170); ctx.stroke(); ctx.fillStyle="#d0efeb"; ctx.font="600 22px system-ui"; ctx.fillText("Created in Agency Manager",72,1240); }
function wrap(ctx,value,x,y,width,lineHeight) { const words=String(value ?? "").split(/\s+/); let line=""; let offset=0; for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>width&&line){ctx.fillText(line,x,y+offset);offset+=lineHeight;line=word;}else line=test;} if(line)ctx.fillText(line,x,y+offset); }
function canvasDownload(canvas, filename) { canvas.toBlob((blob) => { const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); }, "image/png"); }
function canvasMarkup(id,title,body,label) { return `<article class="card asset"><div class="canvas-wrap"><canvas id="${id}" width="1080" height="1350"></canvas></div><div class="asset-copy"><h3>${escape(label)}</h3><button data-download="${id}" data-file="${label.toLowerCase().replace(/\s+/g,"-")}.png">Download PNG</button></div></article>`; }

function renderFinal() {
  const scripts = currentRun.scripts ?? {}; const carouselSlides = scripts.carousel?.slides ?? [];
  layout(`<section><div class="eyebrow">Final output</div><h2>${escape(currentRun.final?.managerSummary ?? "The Manager has approved the production package.")}</h2><p class="sub">Nothing has been posted. Download the assets when they are ready for your human publishing workflow.</p><div class="grid">${canvasMarkup("postAsset", scripts.post?.headline, scripts.post?.body, "Post")}${canvasMarkup("carouselAsset", carouselSlides[0]?.headline, carouselSlides[0]?.body, "Carousel cover")}<article class="card asset"><div class="reel-preview"><p>${escape(scripts.reel?.hook ?? scripts.reel?.title)}</p></div><div class="asset-copy"><h3>Reel preview</h3><p class="sub">Generate ElevenLabs narration, then download an animated WebM reel from this browser.</p><div class="actions"><button id="audio">Generate narration</button><button class="secondary" id="reelDownload">Render & download reel</button></div><audio id="narration" controls hidden></audio></div></article></div><section class="card"><h2>Carousel slides</h2><div class="grid">${carouselSlides.map((slide,index)=>canvasMarkup(`slide${index}`,slide.headline,slide.body,`Slide ${index+1}`)).join("")}</div></section>${memoryHtml()}`);
  drawCard(document.querySelector("#postAsset"), scripts.post?.headline, scripts.post?.body, "Post"); drawCard(document.querySelector("#carouselAsset"), carouselSlides[0]?.headline, carouselSlides[0]?.body, "Carousel"); carouselSlides.forEach((slide,index)=>drawCard(document.querySelector(`#slide${index}`),slide.headline,slide.body,`Slide ${index+1}`));
  document.querySelectorAll("[data-download]").forEach((button)=>button.onclick=()=>canvasDownload(document.querySelector(`#${button.dataset.download}`),button.dataset.file));
  document.querySelector("#audio").onclick = loadNarration; document.querySelector("#reelDownload").onclick = recordReel;
}

async function loadNarration() { try { const response=await api(`/api/runs/${currentRun.id}/narration`); const blob=await response.blob(); const audio=document.querySelector("#narration"); audio.src=URL.createObjectURL(blob); audio.hidden=false; await audio.play(); } catch(error) { showError(error); } }
async function recordReel() { const reel=currentRun.scripts?.reel; if (!reel?.beats?.length) return; const canvas=document.createElement("canvas"); canvas.width=1080; canvas.height=1920; const ctx=canvas.getContext("2d"); const videoStream=canvas.captureStream(30); let audioStream; try { const response=await api(`/api/runs/${currentRun.id}/narration`); const buffer=await (await response.blob()).arrayBuffer(); const audioContext=new AudioContext(); const decoded=await audioContext.decodeAudioData(buffer); const destination=audioContext.createMediaStreamDestination(); const source=audioContext.createBufferSource(); source.buffer=decoded; source.connect(destination); source.start(); audioStream=destination.stream; } catch { /* Video remains valid without narration if ElevenLabs is unavailable. */ }
  const stream=new MediaStream([...videoStream.getVideoTracks(), ...(audioStream?.getAudioTracks() ?? [])]); const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm"}); const chunks=[]; recorder.ondataavailable=(event)=>chunks.push(event.data); recorder.onstop=()=>{const link=document.createElement("a");link.href=URL.createObjectURL(new Blob(chunks,{type:"video/webm"}));link.download="agency-reel.webm";link.click();};
  const total=Math.max(8, reel.beats.reduce((sum,beat)=>sum+Number(beat.seconds||3),0)); const start=performance.now(); recorder.start(); function frame(time){const elapsed=(time-start)/1000; const index=Math.min(reel.beats.length-1,Math.floor((elapsed/total)*reel.beats.length)); const beat=reel.beats[index]; const g=ctx.createLinearGradient(0,0,1080,1920);g.addColorStop(0,"#071a31");g.addColorStop(1,index%2?"#126c86":"#17476f");ctx.fillStyle=g;ctx.fillRect(0,0,1080,1920);ctx.fillStyle="#62e0b3";ctx.fillRect(72,110,220,9);ctx.fillStyle="#cfe5f4";ctx.font="700 28px system-ui";ctx.fillText("AGENCY REEL",72,172);ctx.fillStyle="#f7fbff";ctx.font="800 82px system-ui";wrap(ctx,beat.text,72,1280,900,100);ctx.fillStyle="#cfe5f4";ctx.font="500 32px system-ui";wrap(ctx,beat.visual,72,1590,850,50);if(elapsed<total)requestAnimationFrame(frame);else recorder.stop();} requestAnimationFrame(frame); }

async function refreshRun() { currentRun = await api(`/api/runs/${currentRun.id}`); renderRun(); }
async function boot() { try { const data=await api("/api/me"); currentUser=data.user; briefForm(); } catch { signup(); } }
boot();
