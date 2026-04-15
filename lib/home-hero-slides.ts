export type HomeHeroSlide = {
  src: string;
  alt: string;
  mobileOverlayClassName?: string;
  desktopOverlayClassName?: string;
};

/** Four hero backgrounds — boutique local asset plus editorial Unsplash crops. */
export const HOME_HERO_SLIDES: HomeHeroSlide[] = [
  {
    src: "/home/hero.png",
    alt: "O & I Label — luxury boutique interior",
    mobileOverlayClassName: "bg-gradient-to-t from-black/74 via-black/40 to-black/10",
    desktopOverlayClassName: "bg-gradient-to-r from-black/66 via-black/48 to-black/28",
  },
  {
    src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=2400&h=1600&fit=crop&q=85",
    alt: "Editorial fashion — elevated dress",
    mobileOverlayClassName: "bg-gradient-to-t from-black/82 via-black/48 to-black/18",
    desktopOverlayClassName: "bg-gradient-to-r from-black/72 via-black/56 to-black/34",
  },
  {
    src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=2400&h=1600&fit=crop&q=85",
    alt: "Studio fashion photography",
    mobileOverlayClassName: "bg-gradient-to-t from-black/76 via-black/44 to-black/16",
    desktopOverlayClassName: "bg-gradient-to-r from-black/68 via-black/52 to-black/32",
  },
  {
    src: "https://images.unsplash.com/photo-1509631179647-b99d34983669?w=2400&h=1600&fit=crop&q=85",
    alt: "Contemporary womenswear styling",
    mobileOverlayClassName: "bg-gradient-to-t from-black/80 via-black/50 to-black/20",
    desktopOverlayClassName: "bg-gradient-to-r from-black/74 via-black/58 to-black/36",
  },
];
