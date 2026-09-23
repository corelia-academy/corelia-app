import React, { type ReactElement } from "react";
import type { OgCard } from "./types.ts";

const colors = {
  background: "#0A0913", surface: "#131522", border: "#282E3F",
  text: "#EAE6E3", muted: "#CBD1E2", accent: "#91B5FF",
};

function Monogram({ title }: { title: string }) {
  const letters = Array.from(title).filter(char => /[\p{L}\p{N}]/u.test(char)).slice(0, 2).join("").toUpperCase() || "CO";
  return <div style={{ display: "flex", width: 144, height: 144, borderRadius: 28,
    backgroundColor: "#1A2B55", color: colors.accent, fontSize: 60, fontWeight: 500,
    fontFamily: "Akt, Be Vietnam Pro",
    alignItems: "center", justifyContent: "center" }}>{letters}</div>;
}

function Frame({ card, imageDataUrl, kind, detail }: {
  card: OgCard; imageDataUrl: string | null; kind: string; detail: string | null;
}) {
  return <div style={{ display: "flex", width: 1200, height: 630, backgroundColor: colors.background,
    padding: 48, color: colors.text, fontFamily: "TT Norms Pro Trial, Be Vietnam Pro" }}>
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%",
      padding: 42, border: `2px solid ${colors.border}`, borderRadius: 30,
      backgroundColor: colors.surface }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 23, fontWeight: 400, color: colors.accent,
          fontFamily: "PP Supply Sans, Be Vietnam Pro" }}>CORELIA / {kind}</div>
        <div style={{ display: "flex", fontSize: 19, color: colors.muted }}>corelia.academy</div>
      </div>
      <div style={{ display: "flex", flex: 1, gap: 42, alignItems: "center", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ display: "flex", fontSize: 53, fontWeight: 500, lineHeight: 1.22,
            fontFamily: "Akt, Be Vietnam Pro",
            maxHeight: 132, overflow: "hidden" }}>{card.title}</div>
          {card.description ? <div style={{ display: "flex", marginTop: 22, fontSize: 27,
            lineHeight: 1.38, color: colors.muted, maxHeight: 116, overflow: "hidden" }}>{card.description}</div> : null}
        </div>
        {imageDataUrl ? <img src={imageDataUrl} width={144} height={144}
          style={{ objectFit: "contain", borderRadius: 26 }} alt="" /> : <Monogram title={card.title} />}
      </div>
      {card.tags.length ? <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {card.tags.map(tag => <div key={tag} style={{ display: "flex", padding: "9px 17px",
          borderRadius: 28, backgroundColor: "#1A2B55", color: colors.accent,
          fontSize: 20 }}>{tag}</div>)}
      </div> : null}
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%",
        paddingTop: 21, borderTop: `2px solid ${colors.border}`, fontSize: 22, color: colors.muted }}>
        <div style={{ display: "flex" }}>{detail ?? card.subtitle ?? "Corelia Academy"}</div>
        <div style={{ display: "flex", color: colors.accent }}>{card.canonicalUrl.replace(/^https?:\/\//, "")}</div>
      </div>
    </div>
  </div>;
}

export function ProjectOG({ card, imageDataUrl }: { card: OgCard; imageDataUrl: string | null }): ReactElement {
  return <Frame card={card} imageDataUrl={imageDataUrl} kind="PROJECT" detail={card.subtitle} />;
}

export function CourseOG({ card, imageDataUrl }: { card: OgCard; imageDataUrl: string | null }): ReactElement {
  return <Frame card={card} imageDataUrl={imageDataUrl} kind="COURSE" detail={card.subtitle} />;
}

export function EventOG({ card, imageDataUrl }: { card: OgCard; imageDataUrl: string | null }): ReactElement {
  return <Frame card={card} imageDataUrl={imageDataUrl} kind="HACKATHON"
    detail={[card.dateLabel, card.subtitle].filter(Boolean).join(" · ")} />;
}

export function ProfileOG({ card, imageDataUrl }: { card: OgCard; imageDataUrl: string | null }): ReactElement {
  return <Frame card={card} imageDataUrl={imageDataUrl} kind="PROFILE" detail={card.subtitle} />;
}
