// Helper function to generate placeholder initials
const getInitials = (name) => name.slice(0, 2).toUpperCase();

// Author data with details
export const authors = [
  {
    id: 1,
    name: "MakerMike",
    initials: getInitials("MakerMike"),
    bio: "Passionate 3D designer and printing enthusiast",
    followers: 4500,
    models: 28
  },
  {
    id: 2,
    name: "PrintyKat",
    initials: getInitials("PrintyKat"),
    bio: "Creative artist focused on decorative models",
    followers: 3200,
    models: 22
  },
  {
    id: 3,
    name: "HuyVo",
    initials: getInitials("HuyVo"),
    bio: "Functional design specialist",
    followers: 5600,
    models: 35
  },
  {
    id: 4,
    name: "3DMaster",
    initials: getInitials("3DMaster"),
    bio: "Expert in complex 3D modeling",
    followers: 6200,
    models: 42
  },
  {
    id: 5,
    name: "ToolGuy",
    initials: getInitials("ToolGuy"),
    bio: "Industrial and tool design creator",
    followers: 2800,
    models: 18
  },
  {
    id: 6,
    name: "PrintArt",
    initials: getInitials("PrintArt"),
    bio: "Artistic and sculptural 3D designs",
    followers: 7100,
    models: 50
  },
  {
    id: 7,
    name: "TechMaker",
    initials: getInitials("TechMaker"),
    bio: "Tech gadgets and accessories designer",
    followers: 4300,
    models: 31
  },
  {
    id: 8,
    name: "EcoPrints",
    initials: getInitials("EcoPrints"),
    bio: "Sustainable and eco-friendly designs",
    followers: 3900,
    models: 25
  },
  {
    id: 9,
    name: "DesignPro",
    initials: getInitials("DesignPro"),
    bio: "Professional design services",
    followers: 8200,
    models: 60
  },
  {
    id: 10,
    name: "CreativeBot",
    initials: getInitials("CreativeBot"),
    bio: "Algorithmic and generative designs",
    followers: 2600,
    models: 14
  },
  {
    id: 11,
    name: "VoxelWiz",
    initials: getInitials("VoxelWiz"),
    bio: "Voxel art and pixelated designs",
    followers: 5400,
    models: 38
  },
  {
    id: 12,
    name: "PrintNinja",
    initials: getInitials("PrintNinja"),
    bio: "Optimized prints for any printer",
    followers: 6800,
    models: 45
  },
  {
    id: 13,
    name: "ArtisticPrint",
    initials: getInitials("ArtisticPrint"),
    bio: "Fine art meets 3D printing",
    followers: 5100,
    models: 33
  },
  {
    id: 14,
    name: "TinkerTech",
    initials: getInitials("TinkerTech"),
    bio: "Educational and DIY projects",
    followers: 3500,
    models: 26
  },
  {
    id: 15,
    name: "ModelMaven",
    initials: getInitials("ModelMaven"),
    bio: "Expert model optimization and refinement",
    followers: 4900,
    models: 29
  },
  {
    id: 16,
    name: "PrintMaster",
    initials: getInitials("PrintMaster"),
    bio: "Master of all printing techniques",
    followers: 7600,
    models: 55
  },
  {
    id: 17,
    name: "BuilderBob",
    initials: getInitials("BuilderBob"),
    bio: "Construction and building designs",
    followers: 2900,
    models: 19
  },
  {
    id: 18,
    name: "SculptorSam",
    initials: getInitials("SculptorSam"),
    bio: "Sculptural masterpieces in 3D",
    followers: 6400,
    models: 48
  },
  {
    id: 19,
    name: "CreativeChris",
    initials: getInitials("CreativeChris"),
    bio: "Unlimited creative designs",
    followers: 3300,
    models: 21
  },
  {
    id: 20,
    name: "FastPrint",
    initials: getInitials("FastPrint"),
    bio: "Quick-print and rapid prototyping",
    followers: 2400,
    models: 15
  },
  {
    id: 21,
    name: "QualityQuinn",
    initials: getInitials("QualityQuinn"),
    bio: "High-quality and detailed models",
    followers: 5800,
    models: 40
  },
  {
    id: 22,
    name: "DetailDave",
    initials: getInitials("DetailDave"),
    bio: "Intricate details and precision",
    followers: 6100,
    models: 44
  },
  {
    id: 23,
    name: "PrecisionPete",
    initials: getInitials("PrecisionPete"),
    bio: "Engineering precision in designs",
    followers: 4200,
    models: 30
  },
  {
    id: 24,
    name: "SmoothSally",
    initials: getInitials("SmoothSally"),
    bio: "Smooth curves and elegant designs",
    followers: 3800,
    models: 24
  },
  {
    id: 25,
    name: "AccurateAlex",
    initials: getInitials("AccurateAlex"),
    bio: "Accurate reproductions and models",
    followers: 4700,
    models: 27
  }
];

// Helper function to get author by name
export const getAuthorByName = (name) => {
  return authors.find(author => author.name === name);
};

// Helper function to get author logo URL
export const getAuthorLogo = (name) => {
  const author = getAuthorByName(name);
  return author ? `https://placehold.co/50x50?text=${author.initials}` : "";
};
