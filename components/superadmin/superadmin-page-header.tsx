type Props = {
  title: string;
  description: string;
};

export function SuperadminPageHeader({ title, description }: Props) {
  return (
    <header className="mb-8 space-y-2">
      <h1 className="font-serif-display text-2xl text-white md:text-3xl">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-white/70">{description}</p>
    </header>
  );
}
