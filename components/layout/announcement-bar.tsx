import { Container } from "@/components/store/container";

export function AnnouncementBar() {
  return (
    <div className="bg-[#6f4e37] py-2 text-center text-xs text-background md:text-sm">
      <Container className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>Fast delivery</span>
        <span className="hidden text-white/40 sm:inline">·</span>
        <span>Authentic products</span>
        <span className="hidden text-white/40 sm:inline">·</span>
        <span>Easy returns</span>
      </Container>
    </div>
  );
}
