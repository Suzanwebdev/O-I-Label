export type HomeHeroSlide = {
  src: string;
  alt: string;
};

/** Four hero backgrounds — boutique local asset plus editorial Unsplash crops. */
export const HOME_HERO_SLIDES: HomeHeroSlide[] = [
  {
    src: "/home/hero.png",
    alt: "O & I Label — luxury boutique interior",
  },
  {
    src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=2400&h=1600&fit=crop&q=85",
    alt: "Editorial fashion — elevated dress",
  },
  {
    src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=2400&h=1600&fit=crop&q=85",
    alt: "Studio fashion photography",
  },
  {
    src: "https://images.unsplash.com/photo-1509631179647-b99d34983669?w=2400&h=1600&fit=crop&q=85",
    alt: "Contemporary womenswear styling",
  },
];
