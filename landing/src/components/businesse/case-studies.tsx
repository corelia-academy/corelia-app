export type BlogCard = {
    title: string;
    description: string;
    category: string;
    href: string;
    image: string | null;
};

type Props = {
    cards: BlogCard[];
};

export default function BusinessBlogCarousel({ cards }: Props) {
    if (cards.length === 0) {
        return (
            <div className="p-6 text-sm leading-[1.4] text-foreground-muted md:text-base">
                No blog posts available.
            </div>
        );
    }

    const visibleCards = cards.slice(0, 3);

    return (
        <div
            className="grid border-b border-border lg:grid-cols-3"
            aria-label="Business blog articles"
        >
            {visibleCards.map((card) => (
                <a
                    key={card.href}
                    href={card.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full flex-col border-b border-border p-5 transition-colors hover:bg-secondary md:border-r lg:border-b-0 last:border-b-0 lg:last:border-r-0"
                >
                    <div className="h-[250px] w-full overflow-hidden bg-muted">
                        {card.image ? (
                            <img
                                src={card.image}
                                alt={card.title}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div
                                className="h-full w-full bg-linear-to-br from-primary/15 via-card to-muted"
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <div className="flex flex-1 flex-col gap-3 py-5 md:gap-4">
                        <h3
                            className="line-clamp-2 text-2xl font-medium leading-[1.15] tracking-[-0.03em] text-foreground md:text-[28px] md:leading-[1.2]"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            {card.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="w-fit border border-border-strong p-1 text-sm font-medium leading-[1.2] text-border-strong md:text-lg">
                                {card.category}
                            </span>

                        </div>
                    </div>
                </a>
            ))}
        </div>
    );
}
