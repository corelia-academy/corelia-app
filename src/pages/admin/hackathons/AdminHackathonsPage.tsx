import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, Trophy, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import { useAuth } from "@/stores/authStore";

export default function AdminHackathonsPage() {
  const { t, i18n } = useTranslation("admin");
  const { user } = useAuth();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const query = useQuery(hackathonCatalogQueryOptions(user, locale));
  const items = query.data ?? [];
  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2"><Trophy className="size-6 text-primary" /><h1 className="text-2xl font-semibold">{t("hackathons.title")}</h1></div><p className="mt-1 text-sm text-foreground-muted">{t("hackathons.description")}</p></div>
        <Button render={<NavLink to="/admin/hackathons/new" />} nativeButton={false}><Plus className="size-4" />{t("hackathons.new")}</Button>
      </header>
      {query.isPending ? <p className="py-16 text-center text-sm text-foreground-muted">{t("hackathons.loading")}</p> : items.length === 0 ? <Card className="mt-6"><CardContent className="p-12 text-center text-sm text-foreground-muted">{t("hackathons.empty")}</CardContent></Card> : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((hackathon) => (
            <Card key={hackathon.id} className="overflow-hidden">
              <div className="aspect-video bg-surface-raised">{hackathon.cover_image_url ? <img src={hackathon.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Trophy className="size-10 text-foreground-subtle" /></div>}</div>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{hackathon.title}</h2><span className="rounded-full bg-surface-raised px-2 py-1 text-xs text-foreground-muted">{hackathon.status}</span></div>
                <p className="mt-2 line-clamp-2 text-sm text-foreground-muted">{hackathon.short_description || hackathon.tagline}</p>
                <div className="mt-4 flex gap-4 text-xs text-foreground-muted"><span className="inline-flex items-center gap-1"><Users className="size-4" />{hackathon.participants_count ?? 0}</span><span className="inline-flex items-center gap-1"><CalendarClock className="size-4" />{hackathon.mode ?? hackathon.location}</span></div>
                <div className="mt-5 flex gap-2"><Button className="flex-1" render={<NavLink to={`/admin/hackathons/${hackathon.id}/edit`} />} nativeButton={false}>{t("hackathons.edit")}</Button>{hackathon.slug ? <Button variant="outline" render={<NavLink to={`/hackathons/${hackathon.slug}/overview`} />} nativeButton={false}>{t("hackathons.view")}</Button> : null}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
