export const ads = [
  {
    id: 1,
    image: new URL('@/assets/ads/ad1.jpg', import.meta.url).href,
    title: "Bambulab H2S",
    link: "https://forum.bambulab.com/t/introducing-h2s-your-ultimate-single-nozzle-printer/191661",
    description: "Access thousands of high-quality 3D models for your projects. Professional grade designs, optimized for any printer.",
    ctaText: "Explore Models",
    href: "/models"
  },
  {
    id: 2,
    image: new URL('@/assets/ads/ad2.jpg', import.meta.url).href,
    title: "Prusa Core 1",
    link: "https://blog.prusa3d.com/introducing-prusa-core-one-fully-enclosed-corexy-3d-printer-with-active-temperature-control_105477/",
    description: "Discover amazing 3D printing designs and share your own creations with the community.",
    ctaText: "Browse Models",
    href: "/models"
  },
];

// Helper function to get ad by ID
export const getAdById = (id) => {
  return ads.find(ad => ad.id === id);
};

// Helper function to get random ad
export const getRandomAd = () => {
  return ads[Math.floor(Math.random() * ads.length)];
};
