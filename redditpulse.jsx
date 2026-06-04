/**
 * RedditPulse — Real-time Reddit Keyword Network Visualizer
 *
 * Interactive force-directed graph that maps trending topics, sentiment flows,
 * and community dynamics across subreddits. Built with React 19, D3.js v7,
 * and Chart.js 4 in a single-file architecture.
 *
 * @author somi
 * @see https://github.com/somi/reddit-network-viz
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import * as Chart from "chart.js";

/* ─── Ontology / GraphRAG layer ───
   Additive modules that turn the keyword network into an ontology and add
   evidence, GraphRAG querying and briefing — all on mock data, no API key. */
import { nodeTypeMeta, nodeTypeColor } from "./src/ontology/schema.js";
import { getFinanceOntology, enrichLegacy } from "./src/ontology/mockOntologyData.js";
import OntologyQueryPanel from "./src/components/OntologyQueryPanel.jsx";
import EvidencePanel from "./src/components/EvidencePanel.jsx";
import DailyBriefing from "./src/components/DailyBriefing.jsx";

/* ─── Chart.js Controller Registration ───
   Manually register all required controllers and elements.
   This avoids the "is not a registered controller" error
   that occurs when using tree-shaken Chart.js imports. */
Chart.Chart.register(
  Chart.CategoryScale, Chart.LinearScale, Chart.PointElement,
  Chart.LineElement, Chart.BarElement, Chart.ArcElement,
  Chart.RadialLinearScale, Chart.Filler, Chart.Tooltip, Chart.Legend,
  Chart.LineController, Chart.BarController, Chart.DoughnutController
);

/* ─── Theme Palettes ───
   Two complete color systems for dark/light modes.
   Every component receives the active palette as `C` prop. */
const DARK = {
  bg: "#06080d",
  surface: "#0d1117",
  card: "#161b22",
  border: "#21262d",
  glow: "#f9731615",
  text: "#e6edf3",
  dim: "#7d8590",
  accent: "#f97316",
  accentSoft: "#f9731625",
  pos: "#3fb950",
  neg: "#f85149",
  neu: "#7d8590",
  purple: "#a371f7",
  blue: "#58a6ff",
  pink: "#f778ba",
  cyan: "#39d2c0",
  yellow: "#e3b341",
  nodeColors: ["#f97316","#58a6ff","#a371f7","#f778ba","#3fb950","#e3b341","#39d2c0","#f85149","#79c0ff","#d2a8ff"],
  nodeBg: "#1a1f2e",
};

const LIGHT = {
  bg: "#f8f9fb",
  surface: "#ffffff",
  card: "#f0f2f5",
  border: "#d1d5db",
  glow: "#f9731615",
  text: "#1f2328",
  dim: "#656d76",
  accent: "#ea580c",
  accentSoft: "#ea580c20",
  pos: "#1a7f37",
  neg: "#cf222e",
  neu: "#656d76",
  purple: "#8250df",
  blue: "#0969da",
  pink: "#bf3989",
  cyan: "#1b7c83",
  yellow: "#9a6700",
  nodeColors: ["#ea580c","#0969da","#8250df","#bf3989","#1a7f37","#9a6700","#1b7c83","#cf222e","#218bff","#a475f9"],
  nodeBg: "#e8ecf0",
};

/** Maps a sentiment score (-1…1) to a positive/neutral/negative color. */
const sentColor = (s, C) => s > 0.3 ? C.pos : s < -0.3 ? C.neg : C.neu;

/* ─── Logo URL Helper ───
   Uses Google Favicon API to fetch brand icons.
   Returns null for unrecognized keywords → node renders as colored circle. */
const favicon = d => `https://www.google.com/s2/favicons?domain=${d}&sz=128`;
function getLogoUrl(keyword) {
  const logoMap = {
    "ai": favicon("openai.com"),
    "openai": favicon("openai.com"),
    "gpt": favicon("openai.com"),
    "chatgpt": favicon("openai.com"),
    "google": favicon("google.com"),
    "apple": favicon("apple.com"),
    "microsoft": favicon("microsoft.com"),
    "tesla": favicon("tesla.com"),
    "meta": favicon("meta.com"),
    "amazon": favicon("amazon.com"),
    "nvidia": favicon("nvidia.com"),
    "amd": favicon("amd.com"),
    "intel": favicon("intel.com"),
    "samsung": favicon("samsung.com"),
    "netflix": favicon("netflix.com"),
    "spotify": favicon("spotify.com"),
    "steam": favicon("steampowered.com"),
    "nintendo": favicon("nintendo.com"),
    "playstation": favicon("playstation.com"),
    "sony": favicon("sony.com"),
    "xbox": favicon("xbox.com"),
    "linux": favicon("linux.org"),
    "nasa": favicon("nasa.gov"),
    "spacex": favicon("spacex.com"),
    "bitcoin": favicon("bitcoin.org"),
    "blockchain": favicon("blockchain.com"),
    "github": favicon("github.com"),
    "reddit": favicon("reddit.com"),
    "twitter": favicon("x.com"),
    "discord": favicon("discord.com"),
    "twitch": favicon("twitch.tv"),
    "anthropic": favicon("anthropic.com"),
    "claude": favicon("anthropic.com"),
    "deepmind": favicon("deepmind.com"),
    "nato": favicon("nato.int"),
    "un": favicon("un.org"),
    "china": favicon("china.org.cn"),
    "russia": favicon("rt.com"),
    "startup": favicon("ycombinator.com"),
    "cybersecurity": favicon("crowdstrike.com"),
    "vr": favicon("meta.com"),
    "quantum": favicon("ibm.com"),
  };
  return logoMap[keyword.toLowerCase()] || null;
}

/* ─── Mock Data Generator ───
   Generates realistic network graph data for 4 subreddit presets.
   Each node has: id, label, frequency, sentiment(-1…1), 7-day trend, and optional logo.
   Edges are randomly wired with 1-3 connections per node.
   Drama items highlight the most controversial (negative sentiment) keywords. */

/**
 * @param {string} sub - Subreddit name (technology | worldnews | science | gaming)
 * @returns {{ nodes: Object[], edges: Object[], drama: Object[] }}
 */
function genMockData(sub) {
  const topics = {
    technology: {
      kw: ["AI","OpenAI","GPT","Google","Apple","Microsoft","Startup","Blockchain","Quantum","Robotics","Tesla","NVIDIA","Cybersecurity","Linux","GitHub","Cloud","VR","AMD","Samsung","Anthropic"],
      sent: [.7,.5,.6,.3,.4,.2,.8,-.2,.9,.6,.1,.4,-.5,.5,.6,.4,.5,.3,.2,.7],
    },
    worldnews: {
      kw: ["Climate","War","Election","Economy","China","Russia","NATO","Trade","Sanctions","UN","Refugee","Nuclear","Diplomacy","Protest","Inflation","Summit","Treaty","Ceasefire","Energy","AI"],
      sent: [-.3,-.8,-.1,-.4,-.2,-.7,.1,.2,-.5,.3,-.6,-.9,.4,-.3,-.6,.2,.5,.3,.1,.6],
    },
    science: {
      kw: ["NASA","Mars","Genome","CRISPR","Vaccine","Fusion","Neuroscience","Evolution","Climate","Ocean","Telescope","SpaceX","Stem Cell","Bacteria","AI","Protein","Asteroid","Quantum","DeepMind","Species"],
      sent: [.8,.7,.6,.5,.4,.9,.6,.3,-.2,.2,.8,.7,.7,.3,.6,.7,.4,.9,.8,.3],
    },
    gaming: {
      kw: ["Nintendo","PlayStation","Xbox","Steam","Indie","RPG","FPS","Discord","Esports","Twitch","NVIDIA","VR","Retro","Speedrun","Patch","DLC","Beta","Sandbox","Co-op","Battle Royale"],
      sent: [.6,.5,.3,.7,.8,.4,.2,.6,.6,.7,.3,.5,.8,.9,-.3,-.5,.2,.6,.7,.1],
    },
  };

  const d = topics[sub] || topics.technology;
  const nodes = d.kw.map((k,i) => ({
    id: k.toLowerCase().replace(/\s/g,"_"),
    label: k,
    frequency: Math.floor(Math.random()*300)+30,
    sentiment: d.sent[i]+(Math.random()*.2-.1),
    trend: Array.from({length:7},()=>Math.floor(Math.random()*80)+5),
    logo: getLogoUrl(k),
  }));

  const edges = [];
  for(let i=0;i<nodes.length;i++){
    const n = Math.floor(Math.random()*3)+1;
    for(let e=0;e<n;e++){
      const j = Math.floor(Math.random()*nodes.length);
      if(i!==j && !edges.find(ed=>(ed.source===nodes[i].id&&ed.target===nodes[j].id)||(ed.source===nodes[j].id&&ed.target===nodes[i].id))){
        edges.push({source:nodes[i].id, target:nodes[j].id, weight:Math.random()*.8+.2});
      }
    }
  }

  const drama = nodes.filter(n=>n.sentiment<-.2).sort((a,b)=>a.sentiment-b.sentiment).slice(0,3)
    .map(n=>({keyword:n.label, spike:(Math.random()*3+1.5).toFixed(1), sentiment:n.sentiment.toFixed(2), comments:Math.floor(Math.random()*2000)+200}));

  return {nodes, edges, drama};
}

/* ─── Force-Directed Network Graph ───
   D3.js v7 force simulation rendered in raw SVG (no wrapper library).
   Features:
   - Zoom / pan / drag interactions
   - Node sizing by mention frequency (sqrt scale)
   - Sentiment-colored outer rings with glow filter
   - Brand logo fills via SVG pattern (falls back to colored circle)
   - Speech bubble puffing animation on top 5 trending keywords
   - Hover highlighting of connected edges and labels
   - Click-to-select node for sidebar detail view */
function ForceGraph({data, selectedNode, onNodeClick, width, height, C}){
  const svgRef = useRef(null);

  useEffect(()=>{
    if(!data||!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    const zoom = d3.zoom().scaleExtent([.25,5]).on("zoom",e=>g.attr("transform",e.transform));
    svg.call(zoom);

    const nodes = data.nodes.map(d=>({...d}));
    const edges = data.edges.map(d=>({
      source: typeof d.source==='string'?d.source:d.source.id,
      target: typeof d.target==='string'?d.target:d.target.id,
      weight: d.weight,
      type: d.type,
    }));

    /* Ontology helpers: resolve a node's accent color + shape from its type,
       falling back to the legacy index-based palette for untyped nodes. */
    const typeColorOf = (d,i)=> d.type ? nodeTypeColor(d.type,C) : C.nodeColors[i%C.nodeColors.length];
    const isDashedType = d => nodeTypeMeta(d.type).shape==="ring-dashed";

    const rScale = d3.scaleSqrt().domain([0,d3.max(nodes,d=>d.frequency)]).range([10,38]);

    const sim = d3.forceSimulation(nodes)
      .force("link",d3.forceLink(edges).id(d=>d.id).distance(d=>140/(d.weight+.1)))
      .force("charge",d3.forceManyBody().strength(-300))
      .force("center",d3.forceCenter(width/2,height/2))
      .force("collide",d3.forceCollide().radius(d=>rScale(d.frequency)+12));

    // SVG defs: glow filter, clip paths, logo patterns, edge gradient
    const defs = svg.append("defs");

    // Glow filter — adds soft luminous ring around each node
    const glow = defs.append("filter").attr("id","nodeGlow").attr("x","-50%").attr("y","-50%").attr("width","200%").attr("height","200%");
    glow.append("feGaussianBlur").attr("stdDeviation","6").attr("result","blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in","blur");
    merge.append("feMergeNode").attr("in","SourceGraphic");

    // Circular clip paths for logo images
    nodes.forEach(n=>{
      defs.append("clipPath").attr("id",`clip-${n.id}`)
        .append("circle").attr("r", rScale(n.frequency)*.7);
    });

    // SVG pattern fills: white bg + centered brand logo
    nodes.forEach(n=>{
      if(n.logo){
        const pat = defs.append("pattern")
          .attr("id",`logo-${n.id}`)
          .attr("width",1).attr("height",1)
          .attr("patternContentUnits","objectBoundingBox");
        pat.append("rect").attr("width",1).attr("height",1).attr("fill","#ffffff");
        pat.append("image")
          .attr("href",n.logo)
          .attr("x",.15).attr("y",.15)
          .attr("width",.7).attr("height",.7)
          .attr("preserveAspectRatio","xMidYMid meet");
      }
    });

    // Linear gradient for edge lines (dim → transparent)
    const edgeGrad = defs.append("linearGradient").attr("id","edgeGrad")
      .attr("gradientUnits","userSpaceOnUse");
    edgeGrad.append("stop").attr("offset","0%").attr("stop-color",C.dim).attr("stop-opacity",.3);
    edgeGrad.append("stop").attr("offset","100%").attr("stop-color",C.dim).attr("stop-opacity",.1);

    // Edge lines (weight → stroke-width)
    const link = g.append("g").selectAll("line").data(edges).join("line")
      .attr("stroke",C.border)
      .attr("stroke-width",d=>Math.max(.8,d.weight*2.5))
      .attr("stroke-opacity",.35);

    // Node groups — each <g> holds ring, circle/logo, label, badge, and speech bubble
    const node = g.append("g").selectAll("g").data(nodes).join("g")
      .style("cursor","pointer")
      .call(d3.drag()
        .on("start",(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y;})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y;})
        .on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;})
      );

    // Outer ring (sentiment color) — dashed for Event / Risk / Sentiment signals
    node.append("circle")
      .attr("r",d=>rScale(d.frequency)+3)
      .attr("fill","none")
      .attr("stroke",d=>sentColor(d.sentiment,C))
      .attr("stroke-width",2.5)
      .attr("stroke-opacity",.7)
      .attr("stroke-dasharray",d=>isDashedType(d)?"3 3":null)
      .attr("filter","url(#nodeGlow)");

    // Main circle — logo or colored
    node.each(function(d,i){
      const el = d3.select(this);
      const r = rScale(d.frequency);

      const tc = typeColorOf(d,i);

      if(d.logo){
        el.append("circle").attr("r",r).attr("fill",C.nodeBg).attr("stroke",C.border).attr("stroke-width",1);
        el.append("circle").attr("r",r).attr("fill",`url(#logo-${d.id})`).attr("opacity",.95);
      } else {
        el.append("circle").attr("r",r)
          .attr("fill",tc)
          .attr("fill-opacity",.2)
          .attr("stroke",tc)
          .attr("stroke-width",1.5);
        el.append("text")
          .text(d.label.slice(0,2).toUpperCase())
          .attr("text-anchor","middle")
          .attr("dy",".35em")
          .attr("fill",tc)
          .attr("font-size",Math.max(9,r*.55))
          .attr("font-family","'Space Grotesk',sans-serif")
          .attr("font-weight",700)
          .style("pointer-events","none");
      }

      // Ontology type accent rim — thin colored edge over the node (subtle).
      if(d.type){
        el.append("circle").attr("r",r-0.75)
          .attr("fill","none").attr("stroke",tc)
          .attr("stroke-width",1.5).attr("stroke-opacity",.6)
          .style("pointer-events","none");
      }
    });

    // Labels below nodes
    const label = node.append("text")
      .text(d=>d.label)
      .attr("text-anchor","middle")
      .attr("dy",d=>rScale(d.frequency)+16)
      .attr("fill",C.text)
      .attr("font-size",d=>Math.max(9,Math.min(12,rScale(d.frequency)*.5)))
      .attr("font-family","'JetBrains Mono',monospace")
      .attr("font-weight",500)
      .attr("opacity",d=>rScale(d.frequency)>14?1:.6)
      .style("pointer-events","none");

    // Frequency badge
    node.append("g").each(function(d){
      const r = rScale(d.frequency);
      if(r < 16) return;
      const badge = d3.select(this);
      const bx = r*.65, by = -r*.65;
      badge.append("circle").attr("cx",bx).attr("cy",by).attr("r",9).attr("fill",C.card).attr("stroke",C.border).attr("stroke-width",1);
      badge.append("text").attr("x",bx).attr("y",by).attr("dy",".35em").attr("text-anchor","middle")
        .attr("fill",C.accent).attr("font-size",7).attr("font-family","'JetBrains Mono',monospace").attr("font-weight",600)
        .text(d.frequency > 999 ? (d.frequency/1000).toFixed(1)+"k" : d.frequency)
        .style("pointer-events","none");
    });

    // Speech bubbles — top 5 keywords get animated "puffing" callouts
    const topIds = [...nodes].sort((a,b)=>b.frequency-a.frequency).slice(0,5).map(n=>n.id);
    node.each(function(d){
      const rank = topIds.indexOf(d.id);
      if(rank===-1) return;
      const el = d3.select(this);
      const r = rScale(d.frequency);
      const bbl = el.append("g")
        .attr("class","speech-bubble")
        .attr("transform",`translate(${r+6},${-r-10})`)
        .style("pointer-events","none");

      const pw = d.label.length*6.5+20, ph = 22;
      // Rounded rect body
      bbl.append("rect")
        .attr("x",0).attr("y",-ph/2)
        .attr("width",pw).attr("height",ph)
        .attr("rx",6).attr("ry",6)
        .attr("fill",C.card).attr("stroke",C.accent).attr("stroke-width",1.2)
        .attr("opacity",.92);
      // Triangle tail pointing to node
      bbl.append("polygon")
        .attr("points",`0,0 -6,-4 -6,4`)
        .attr("fill",C.card).attr("stroke",C.accent).attr("stroke-width",1.2)
        .attr("stroke-linejoin","round");
      // Patch rect to hide tail-body stroke overlap
      bbl.append("rect")
        .attr("x",0).attr("y",-3).attr("width",3).attr("height",6)
        .attr("fill",C.card);
      // Ranked emoji + keyword label
      const emojis = ["🔥","📈","💬","⚡","🏆"];
      bbl.append("text")
        .attr("x",pw/2).attr("y",0).attr("dy",".35em")
        .attr("text-anchor","middle")
        .attr("fill",C.accent).attr("font-size",9)
        .attr("font-family","'Space Grotesk',sans-serif").attr("font-weight",600)
        .text(`${emojis[rank]} ${d.label}`);

      // Recursive D3 transition: scale up → settle → fade → loop
      function puff(){
        bbl.transition()
          .delay(rank*600)
          .duration(800)
          .ease(d3.easeCubicInOut)
          .attr("opacity",1)
          .attr("transform",`translate(${r+6},${-r-12}) scale(1.08)`)
        .transition()
          .duration(800)
          .ease(d3.easeCubicInOut)
          .attr("transform",`translate(${r+6},${-r-10}) scale(1)`)
        .transition()
          .duration(600)
          .attr("opacity",.85)
        .transition()
          .duration(1200)
          .attr("opacity",.92)
          .on("end",puff);
      }
      bbl.attr("opacity",0)
        .transition().delay(1000+rank*400).duration(500)
        .attr("opacity",.92)
        .on("end",puff);
    });

    // Hover / click interactions — highlight connected subgraph
    node.on("mouseover",function(e,d){
      d3.select(this).select("circle:nth-child(1)").transition().duration(200).attr("stroke-opacity",1).attr("stroke-width",4);
      link.transition().duration(200)
        .attr("stroke-opacity",l=>(l.source.id===d.id||l.target.id===d.id)?.8:.06)
        .attr("stroke",l=>(l.source.id===d.id||l.target.id===d.id)?C.accent:C.border);
      label.transition().duration(200).attr("opacity",l=>{
        if(l.id===d.id)return 1;
        return edges.some(ed=>(ed.source.id===d.id&&ed.target.id===l.id)||(ed.target.id===d.id&&ed.source.id===l.id))?.9:.1;
      });
    })
    .on("mouseout",function(){
      d3.select(this).select("circle:nth-child(1)").transition().duration(200).attr("stroke-opacity",.7).attr("stroke-width",2.5);
      link.transition().duration(200).attr("stroke-opacity",.35).attr("stroke",C.border);
      label.transition().duration(200).attr("opacity",d=>rScale(d.frequency)>14?1:.6);
    })
    .on("click",(e,d)=>onNodeClick(d));

    sim.on("tick",()=>{
      link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      node.attr("transform",d=>`translate(${d.x},${d.y})`);
    });

    setTimeout(()=>{
      svg.transition().duration(800).call(zoom.transform,d3.zoomIdentity.scale(.82).translate(width*.1,height*.1));
    },400);

    return ()=>sim.stop();
  },[data,width,height,C]);

  return <svg ref={svgRef} width={width} height={height} style={{background:"transparent"}}/>;
}

/* ─── Chart.js Chart Components ───
   Three sidebar visualizations using Chart.js 4.
   Each component manages its own canvas lifecycle (create / destroy on re-render). */

/** Weekly trend line chart — shown when a node is selected. */
function TrendChart({node, C}){
  const ref=useRef(null), chart=useRef(null);
  useEffect(()=>{
    if(!ref.current||!node)return;
    if(chart.current)chart.current.destroy();
    chart.current=new Chart.Chart(ref.current,{
      type:"line",
      data:{labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],datasets:[{
        label:node.label,data:node.trend,
        borderColor:C.accent,backgroundColor:C.accentSoft,fill:true,tension:.4,
        pointRadius:4,pointBackgroundColor:C.accent,pointBorderColor:C.bg,pointBorderWidth:2,
      }]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{
        backgroundColor:C.card,borderColor:C.border,borderWidth:1,titleColor:C.text,bodyColor:C.dim,cornerRadius:8,
      }},scales:{
        x:{grid:{color:C.border+"30"},ticks:{color:C.dim,font:{family:"'JetBrains Mono'",size:10}}},
        y:{grid:{color:C.border+"30"},ticks:{color:C.dim,font:{family:"'JetBrains Mono'",size:10}}},
      }},
    });
    return ()=>{if(chart.current)chart.current.destroy()};
  },[node,C]);
  return <canvas ref={ref}/>;
}

/** Sentiment distribution doughnut — positive / neutral / negative breakdown. */
function SentDonut({data, C}){
  const ref=useRef(null),chart=useRef(null);
  useEffect(()=>{
    if(!ref.current||!data)return;
    if(chart.current)chart.current.destroy();
    const p=data.nodes.filter(n=>n.sentiment>.3).length;
    const n2=data.nodes.filter(n=>n.sentiment<-.3).length;
    const neu=data.nodes.length-p-n2;
    chart.current=new Chart.Chart(ref.current,{
      type:"doughnut",
      data:{labels:["Positive","Neutral","Negative"],datasets:[{
        data:[p,neu,n2],backgroundColor:[C.pos+"cc",C.neu+"99",C.neg+"cc"],
        borderColor:C.bg,borderWidth:3,hoverOffset:6,
      }]},
      options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{
        position:"bottom",labels:{color:C.dim,font:{family:"'JetBrains Mono'",size:10},padding:10,usePointStyle:true,pointStyleWidth:8},
      }}},
    });
    return ()=>{if(chart.current)chart.current.destroy()};
  },[data,C]);
  return <canvas ref={ref}/>;
}

/** Top keywords horizontal bar chart — sorted by mention frequency, top 8. */
function TopBar({data, C}){
  const ref=useRef(null),chart=useRef(null);
  useEffect(()=>{
    if(!ref.current||!data)return;
    if(chart.current)chart.current.destroy();
    const sorted=[...data.nodes].sort((a,b)=>b.frequency-a.frequency).slice(0,8);
    chart.current=new Chart.Chart(ref.current,{
      type:"bar",
      data:{labels:sorted.map(n=>n.label),datasets:[{
        data:sorted.map(n=>n.frequency),
        backgroundColor:sorted.map((_,i)=>C.nodeColors[i%C.nodeColors.length]+"99"),
        borderColor:sorted.map((_,i)=>C.nodeColors[i%C.nodeColors.length]),
        borderWidth:1,borderRadius:4,
      }]},
      options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{
        x:{grid:{color:C.border+"30"},ticks:{color:C.dim,font:{family:"'JetBrains Mono'",size:9}}},
        y:{grid:{display:false},ticks:{color:C.text,font:{family:"'JetBrains Mono'",size:10}}},
      }},
    });
    return ()=>{if(chart.current)chart.current.destroy()};
  },[data,C]);
  return <canvas ref={ref}/>;
}

/* ─── Claude API Integration ───
   Sends a structured prompt to Claude via the Anthropic Messages API
   with web_search tool enabled. Claude searches Reddit in real-time and
   returns a JSON network graph. Falls back to mock data on failure. */

/**
 * @param {string} sub - Subreddit to analyze
 * @returns {Promise<{nodes,edges,drama}|null>} Parsed graph data or null on error
 */
async function fetchFromClaude(sub){
  try{
    const res = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:1000,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{role:"user",content:`Search Reddit r/${sub} for the hottest topics right now. Then return ONLY a raw JSON object with NO markdown formatting:
{"nodes":[{"id":"keyword","label":"Keyword","frequency":100,"sentiment":0.5,"trend":[10,20,30,40,50,60,70],"logo":null}],"edges":[{"source":"id1","target":"id2","weight":0.7}],"drama":[{"keyword":"Topic","spike":"2.5","sentiment":"-0.8","comments":500}]}
Rules: 15-20 nodes. For tech companies, set logo to "https://logo.clearbit.com/DOMAIN". Sentiment: -1 to 1. Trend: 7 values. Only JSON, no text.`}],
      }),
    });
    const d=await res.json();
    const txt=d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
    return JSON.parse(txt.replace(/```json|```/g,"").trim());
  }catch(e){
    console.error("API fallback to mock:",e);
    return null;
  }
}

/* ─── Main Application ───
   Root component that orchestrates layout, state, and theme management.
   - Subreddit selector + data source toggle (Mock / Claude API)
   - Dark / Light theme toggle with smooth CSS transitions
   - Responsive graph area with ResizeObserver
   - Sidebar: TrendChart, SentDonut, TopBar, Drama Detector */
const SUBS=["technology","worldnews","science","gaming","finance"];

export default function App(){
  const [sub,setSub]=useState("technology");
  const [data,setData]=useState(null);
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(false);
  const [mode,setMode]=useState("mock"); // "mock" | "api"
  const [theme,setTheme]=useState("dark"); // "dark" | "light"
  const [showBrief,setShowBrief]=useState(false);
  const gRef=useRef(null);
  const [gSize,setGSize]=useState({w:600,h:500});

  /** Select a node by id (used by the GraphRAG panel's related-node chips). */
  const selectById=useCallback((id)=>{
    const n=data?.nodes.find(x=>x.id===id);
    if(n)setSel(n);
  },[data]);

  const C = theme==="dark" ? DARK : LIGHT;

  useEffect(()=>{
    if(!gRef.current)return;
    const ro=new ResizeObserver(e=>{for(const en of e)setGSize({w:en.contentRect.width,h:en.contentRect.height})});
    ro.observe(gRef.current);
    return ()=>ro.disconnect();
  },[]);

  /* Build an ontology-shaped graph for a subreddit:
     - finance → the hand-authored finance ontology
     - others  → legacy mock data lifted into the ontology contract */
  const buildGraph=useCallback((s)=>{
    return s==="finance" ? getFinanceOntology() : enrichLegacy(genMockData(s), s);
  },[]);

  const load=useCallback(async()=>{
    setLoading(true);setSel(null);
    if(mode==="api"){
      const d=await fetchFromClaude(sub);
      if(d){setData(enrichLegacy(d,sub));setLoading(false);return;}
    }
    await new Promise(r=>setTimeout(r,700));
    setData(buildGraph(sub));
    setLoading(false);
  },[sub,mode,buildGraph]);

  useEffect(()=>{load()},[sub,load]);

  const stats = data ? {
    total: data.nodes.length,
    avgSent: (data.nodes.reduce((a,n)=>a+n.sentiment,0)/data.nodes.length).toFixed(2),
    topKeyword: [...data.nodes].sort((a,b)=>b.frequency-a.frequency)[0]?.label,
    totalMentions: data.nodes.reduce((a,n)=>a+n.frequency,0),
  } : null;

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'JetBrains Mono','SF Mono',monospace",overflow:"hidden",transition:"background .3s,color .3s"}}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:${C.dim}}
      `}</style>

      {/* ─── Header ─── */}
      <header style={{
        padding:"12px 20px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,
        background:`linear-gradient(180deg,${C.surface},${C.bg})`,transition:"background .3s",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:34,height:34,borderRadius:10,
            background:`linear-gradient(135deg,${C.accent},${C.pink})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:16,fontWeight:800,color:"#fff",
          }}>R</div>
          <div>
            <h1 style={{margin:0,fontSize:17,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",
              background:`linear-gradient(90deg,${C.accent},${C.pink})`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              RedditPulse
            </h1>
            <p style={{margin:0,fontSize:9,color:C.dim,letterSpacing:2.5,textTransform:"uppercase"}}>keyword network explorer</p>
          </div>
        </div>

        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:3}}>
            {SUBS.map(s=>(
              <button key={s} onClick={()=>setSub(s)} style={{
                padding:"5px 10px",borderRadius:7,
                border:`1px solid ${sub===s?C.accent:C.border}`,
                background:sub===s?C.accentSoft:"transparent",
                color:sub===s?C.accent:C.dim,
                fontSize:10,fontFamily:"inherit",cursor:"pointer",transition:"all .2s",
              }}>r/{s}</button>
            ))}
          </div>

          <button onClick={()=>setMode(m=>m==="mock"?"api":"mock")} style={{
            padding:"5px 10px",borderRadius:7,
            border:`1px solid ${mode==="api"?C.pos:C.border}`,
            background:mode==="api"?C.pos+"18":"transparent",
            color:mode==="api"?C.pos:C.dim,
            fontSize:9,fontFamily:"inherit",cursor:"pointer",letterSpacing:.5,
          }}>
            {mode==="api"?"⚡ CLAUDE API":"◌ MOCK DATA"}
          </button>

          {/* ─── Theme Toggle ─── */}
          <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{
            padding:"5px 10px",borderRadius:7,
            border:`1px solid ${C.border}`,
            background:C.card,
            color:C.text,
            fontSize:9,fontFamily:"inherit",cursor:"pointer",
            display:"flex",alignItems:"center",gap:4,
            transition:"all .2s",
          }}>
            <span style={{fontSize:13,lineHeight:1}}>{theme==="dark"?"☀️":"🌙"}</span>
            {theme==="dark"?"LIGHT":"DARK"}
          </button>

          <button onClick={()=>setShowBrief(true)} disabled={!data} style={{
            padding:"5px 10px",borderRadius:7,
            border:`1px solid ${C.purple}`,
            background:C.purple+"18",color:C.purple,
            fontSize:9,fontFamily:"inherit",cursor:data?"pointer":"default",
            letterSpacing:.5,opacity:data?1:.5,
          }}>
            📋 BRIEF
          </button>

          <button onClick={load} style={{
            padding:"5px 14px",borderRadius:7,border:"none",
            background:`linear-gradient(135deg,${C.accent},${C.pink})`,
            color:"#fff",fontSize:10,fontWeight:600,fontFamily:"inherit",
            cursor:"pointer",opacity:loading?.5:1,
          }}>
            {loading?"⟳":"↻"} Refresh
          </button>
        </div>
      </header>

      {/* ─── Stats Bar ─── */}
      {stats && (
        <div style={{
          display:"flex",gap:1,background:C.border+"60",borderBottom:`1px solid ${C.border}`,
        }}>
          {[
            {label:"KEYWORDS",value:stats.total,color:C.blue},
            {label:"MENTIONS",value:stats.totalMentions.toLocaleString(),color:C.accent},
            {label:"AVG SENTIMENT",value:stats.avgSent,color:parseFloat(stats.avgSent)>0?C.pos:C.neg},
            {label:"TOP KEYWORD",value:stats.topKeyword,color:C.purple},
          ].map((s,i)=>(
            <div key={i} style={{flex:1,padding:"8px 16px",background:C.surface,textAlign:"center",transition:"background .3s"}}>
              <div style={{fontSize:8,color:C.dim,letterSpacing:1.5,marginBottom:2}}>{s.label}</div>
              <div style={{fontSize:14,fontWeight:600,color:s.color,fontFamily:"'Space Grotesk',sans-serif"}}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Main Layout ─── */}
      <div style={{
        display:"grid",gridTemplateColumns:"1fr 320px",
        gap:1,height:"calc(100vh - 105px)",background:C.border+"40",
      }}>

        {/* ─── Graph ─── */}
        <div ref={gRef} style={{background:C.bg,position:"relative",overflow:"hidden",transition:"background .3s"}}>
          {loading?(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:12}}>
              <div style={{width:36,height:36,border:`3px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
              <span style={{color:C.dim,fontSize:11}}>Analyzing r/{sub}...</span>
            </div>
          ):data?(
            <ForceGraph data={data} selectedNode={sel} onNodeClick={d=>setSel(p=>p?.id===d.id?null:d)} width={gSize.w} height={gSize.h} C={C}/>
          ):null}

          {/* Legend */}
          <div style={{
            position:"absolute",top:10,left:10,
            background:C.card+"dd",backdropFilter:"blur(8px)",
            borderRadius:8,padding:"7px 10px",fontSize:9,color:C.dim,
            border:`1px solid ${C.border}`,lineHeight:1.6,
          }}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span>Ring color → Sentiment:</span>
              <span style={{color:C.pos}}>● Pos</span>
              <span style={{color:C.neu}}>● Neu</span>
              <span style={{color:C.neg}}>● Neg</span>
            </div>
            <div style={{marginTop:2}}>🖼 Logo = company · Size = mentions · Click to explore</div>
          </div>

          {/* Selected node overlay */}
          {sel&&(
            <div style={{
              position:"absolute",bottom:14,left:14,right:14,
              background:C.card+"ee",backdropFilter:"blur(12px)",
              borderRadius:10,padding:"12px 16px",
              border:`1px solid ${C.border}`,
              display:"flex",gap:14,alignItems:"center",
              animation:"slideUp .3s ease",
            }}>
              <div style={{
                width:44,height:44,borderRadius:10,overflow:"hidden",
                background:sel.logo?"#fff":sentColor(sel.sentiment,C)+"25",
                border:`2px solid ${sentColor(sel.sentiment,C)}`,
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              }}>
                {sel.logo?
                  <img src={sel.logo} alt="" style={{width:30,height:30,objectFit:"contain"}}/>:
                  <span style={{fontSize:18,fontWeight:700,color:sentColor(sel.sentiment,C)}}>
                    {sel.sentiment>.3?"+":sel.sentiment<-.3?"−":"○"}
                  </span>
                }
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:14,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{sel.label}</span>
                  {sel.type&&(
                    <span style={{
                      fontSize:8,padding:"2px 6px",borderRadius:5,
                      background:nodeTypeColor(sel.type,C)+"1f",color:nodeTypeColor(sel.type,C),
                      border:`1px solid ${nodeTypeColor(sel.type,C)}55`,letterSpacing:.5,
                    }}>{nodeTypeMeta(sel.type).glyph} {nodeTypeMeta(sel.type).label}</span>
                  )}
                  {sel.ticker&&<span style={{fontSize:9,color:C.accent,fontWeight:600}}>${sel.ticker}</span>}
                </div>
                <div style={{fontSize:10,color:C.dim,marginTop:3}}>
                  Mentions: <span style={{color:C.accent}}>{sel.frequency}</span> ·
                  Sentiment: <span style={{color:sentColor(sel.sentiment,C)}}>{sel.sentiment.toFixed(2)}</span>
                  {sel.confidence!=null&&<> · Conf: <span style={{color:C.purple}}>{Math.round(sel.confidence*100)}%</span></>}
                  {sel.evidenceCount!=null&&<> · Evidence: <span style={{color:C.blue}}>{sel.evidenceCount}</span></>}
                </div>
                {sel.sourceSubreddits?.length>0&&(
                  <div style={{fontSize:9,color:C.dim,marginTop:3}}>
                    Sources: {sel.sourceSubreddits.map(s=>"r/"+s).join(" · ")}
                  </div>
                )}
              </div>
              <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:16,padding:4}}>✕</button>
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div style={{background:C.surface,display:"flex",flexDirection:"column",overflow:"auto",transition:"background .3s"}}>

          {/* GraphRAG Query */}
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
            <h3 style={{margin:"0 0 10px",fontSize:10,fontWeight:600,color:C.dim,letterSpacing:1.5,textTransform:"uppercase"}}>
              🧠 ask the ontology
            </h3>
            <OntologyQueryPanel data={data} C={C} onSelectNode={selectById}/>
          </div>

          {/* Trend */}
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
            <h3 style={{margin:"0 0 10px",fontSize:10,fontWeight:600,color:C.dim,letterSpacing:1.5,textTransform:"uppercase"}}>
              📈 {sel?`"${sel.label}" trend`:"Select a keyword"}
            </h3>
            <div style={{height:130}}>
              {sel?<TrendChart node={sel} C={C}/>:
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.dim,fontSize:10}}>
                  Click a node to view trend →
                </div>
              }
            </div>
          </div>

          {/* Evidence & Lineage */}
          {sel&&(
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
              <h3 style={{margin:"0 0 10px",fontSize:10,fontWeight:600,color:C.dim,letterSpacing:1.5,textTransform:"uppercase"}}>
                🔍 evidence & lineage
              </h3>
              <EvidencePanel data={data} node={sel} C={C}/>
            </div>
          )}

          {/* Sentiment */}
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
            <h3 style={{margin:"0 0 10px",fontSize:10,fontWeight:600,color:C.dim,letterSpacing:1.5,textTransform:"uppercase"}}>🎯 sentiment</h3>
            <div style={{height:150}}>{data&&<SentDonut data={data} C={C}/>}</div>
          </div>

          {/* Top Keywords */}
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
            <h3 style={{margin:"0 0 10px",fontSize:10,fontWeight:600,color:C.dim,letterSpacing:1.5,textTransform:"uppercase"}}>🏆 top keywords</h3>
            <div style={{height:180}}>{data&&<TopBar data={data} C={C}/>}</div>
          </div>

          {/* Drama */}
          <div style={{padding:"14px 16px",flex:1}}>
            <h3 style={{margin:"0 0 10px",fontSize:10,fontWeight:600,color:C.neg,letterSpacing:1.5,textTransform:"uppercase",animation:"pulse 2s ease infinite"}}>
              🔥 drama detector
            </h3>
            {data?.drama?.map((d,i)=>(
              <div key={i} style={{
                padding:"9px 11px",borderRadius:8,
                background:C.neg+"0c",border:`1px solid ${C.neg}20`,marginBottom:6,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{d.keyword}</span>
                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.neg+"22",color:C.neg}}>
                    ↑{d.spike}x
                  </span>
                </div>
                <div style={{fontSize:9,color:C.dim,marginTop:3}}>
                  Sentiment: <span style={{color:C.neg}}>{d.sentiment}</span> · 💬 {d.comments}
                </div>
              </div>
            ))}
            {(!data?.drama||data.drama.length===0)&&(
              <div style={{color:C.dim,fontSize:10,textAlign:"center",padding:16}}>No drama ✌️</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Daily Social Signal Brief (modal) ─── */}
      {showBrief && <DailyBriefing data={data} sub={sub} C={C} onClose={()=>setShowBrief(false)}/>}
    </div>
  );
}
