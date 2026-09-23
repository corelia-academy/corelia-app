import React, { type ReactElement } from "react";
import { EMAIL_BRAND } from "../lib/mail/brand.ts";
import type { OgCard } from "./types.ts";

const brand = EMAIL_BRAND;

function Monogram({ title, round = false }: { title: string; round?: boolean }) {
  const letters = Array.from(title.normalize("NFD").replace(/\p{M}/gu, ""))
    .filter(char => /[\p{L}\p{N}]/u.test(char)).slice(0, 2).join("").toUpperCase() || "CO";
  return <div style={{ display: "flex", width: 176, height: 176,
    backgroundColor: brand.surface, border: `1px solid ${brand.border}`, borderRadius: round ? 999 : 0,
    color: brand.link, fontSize: 64, fontWeight: 500,
    fontFamily: "Akt, Be Vietnam Pro", alignItems: "center", justifyContent: "center" }}>{letters}</div>;
}

function Frame({ card, imageDataUrl, backgroundUrl, logoUrl, kind, detail }: {
  card: OgCard; imageDataUrl: string | null; backgroundUrl: string; logoUrl: string;
  kind: string; detail: string | null;
}) {
  const titleSize = card.title.length > 80 ? 36 : card.title.length > 60 ? 42 : card.title.length > 44 ? 47 : 53;
  const descriptionSize = (card.description?.length ?? 0) > 120 ? 23 : (card.description?.length ?? 0) > 80 ? 25 : 27;
  return <div style={{ display: "flex", position: "relative", width: 1200, height: 630,
    backgroundColor: brand.background, color: brand.text, fontFamily: "TT Norms Pro Trial, Be Vietnam Pro" }}>
    <img src={backgroundUrl} width={1200} height={630} alt=""
      style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
    <div style={{ display: "flex", flexDirection: "column", position: "absolute",
      top: 38, left: 54, width: 1092, height: 554,
      backgroundColor: brand.background, border: `1px solid ${brand.border}` }}>
      <div style={{ display: "flex", alignItems: "center", width: "100%", height: 94,
        padding: "12px 32px", borderBottom: `1px solid ${brand.border}` }}>
        <img src={logoUrl} width={196} height={65} alt="Corelia Academy"
          style={{ width: 196, height: 65, objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", padding: "29px 32px 23px" }}>
        <div style={{ display: "flex", color: "#cbd1e2", fontSize: 20, letterSpacing: "0.05em",
          fontFamily: "PP Supply Sans, Be Vietnam Pro" }}>{kind}</div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 32, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div style={{ display: "flex", fontSize: titleSize, fontWeight: 500, lineHeight: 1.16,
              fontFamily: "Akt, Be Vietnam Pro", maxHeight: 145, overflow: "hidden" }}>{card.title}</div>
            {card.description ? <div style={{ display: "flex", marginTop: 17, fontSize: descriptionSize,
              lineHeight: 1.28, color: brand.muted, maxHeight: 100, overflow: "hidden" }}>{card.description}</div> : null}
          </div>
          {imageDataUrl ? <div style={{ display: "flex", width: 176, height: 176,
            backgroundColor: brand.surface, border: `1px solid ${brand.border}`,
            borderRadius: card.entity === "profile" ? 999 : 0, overflow: "hidden" }}>
            <img src={imageDataUrl} width={174} height={174} alt=""
              style={{ width: 174, height: 174, objectFit: card.entity === "profile" ? "cover" : "contain",
                borderRadius: card.entity === "profile" ? 999 : 0 }} />
          </div> : <Monogram title={card.title} round={card.entity === "profile"} />}
        </div>
        {card.tags.length ? <div style={{ display: "flex", gap: 11, width: "100%", overflow: "hidden" }}>
          {card.tags.map(tag => <div key={tag} style={{ display: "flex", padding: "7px 13px",
            backgroundColor: brand.surface, border: `1px solid ${brand.border}`,
            color: brand.muted, fontSize: 19 }}>{tag}</div>)}
        </div> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center",
        gap: 24, width: "100%", height: 91, padding: "16px 32px",
        borderTop: `1px solid ${brand.border}`, color: brand.muted, fontSize: 21 }}>
        <div style={{ display: "flex", maxWidth: "100%", overflow: "hidden" }}>{detail ?? card.subtitle ?? "Corelia Academy"}</div>
      </div>
    </div>
  </div>;
}

type CardProps = { card: OgCard; imageDataUrl: string | null; backgroundUrl: string; logoUrl: string };

export function ProjectOG(props: CardProps): ReactElement {
  return <Frame {...props} kind="PROJECT" detail={props.card.subtitle} />;
}

export function CourseOG(props: CardProps): ReactElement {
  return <Frame {...props} kind="COURSE" detail={props.card.subtitle} />;
}

export function EventOG(props: CardProps): ReactElement {
  return <Frame {...props} kind="HACKATHON"
    detail={[props.card.dateLabel, props.card.subtitle].filter(Boolean).join(" · ")} />;
}

export function ProfileOG(props: CardProps): ReactElement {
  return <Frame {...props} kind="PROFILE" detail={props.card.subtitle} />;
}
