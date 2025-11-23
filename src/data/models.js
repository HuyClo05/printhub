import { authors, getAuthorLogo } from './authors.js';

// Model names for variety
const modelNames = [
  "Articulated Dragon", "Phone Stand", "Keychain", "Cable Holder", "Mini Wrench",
  "Low-Poly Fox", "Headphone Stand", "Raspberry Pi Case", "Desk Organizer", "Plant Pot",
  "Cable Clip", "Game Controller Mount", "Custom Chess Set", "SD Card Holder", "Tablet Stand",
  "USB Holder", "Pencil Cup", "Desk Lamp Base", "Monitor Stand", "Mouse Pad",
  "Keyboard Tilt", "Desk Shelf", "Cable Management", "Cord Organizer", "Wire Clip",
  "Storage Box", "Jewelry Box", "Dice Tray", "Miniature Figure", "Puzzle Box",
  "Fidget Spinner", "Pop-It Toy", "Desk Pet", "Plant Hanger", "Wall Mount",
  "Door Hook", "Shelf Bracket", "Light Fixture", "Vase Holder", "Picture Frame",
  "Name Plate", "House Number", "Letter Box", "Book End", "Bookshelf Divider",
  "Magazine Holder", "Trash Bin", "Recycling Bin", "Laundry Basket", "Shoe Rack",
  "Coat Hanger", "Hat Rack", "Scarf Holder", "Belt Organizer", "Tie Rack",
  "Sunglass Holder", "Glasses Case", "Watch Stand", "Ring Holder", "Necklace Hanger",
  "Bracelet Stand", "Earring Display", "Perfume Bottle Holder", "Lip Balm Holder", "Makeup Brush Cup",
  "Hair Clip Organizer", "Hair Tie Holder", "Nail Polish Rack", "Bath Caddy", "Soap Holder",
  "Toothbrush Holder", "Toothpaste Stand", "Shampoo Bottle Holder", "Deodorant Stand", "Lotion Bottle Holder",
  "Medicine Cabinet Door", "Spice Rack", "Seasoning Jar Holder", "Oil Bottle Stand", "Vinegar Holder",
  "Fruit Basket", "Vegetable Crate", "Bread Box", "Cookie Jar", "Candy Dish",
  "Nut Bowl", "Cereal Container", "Sugar Dispenser", "Salt and Pepper Shaker", "Butter Dish",
  "Cheese Holder", "Wine Glass Rack", "Coffee Mug Holder", "Tea Bag Organizer", "Espresso Cup Holder",
  "Plate Rack", "Bowl Stand", "Utensil Holder", "Knife Block", "Cutting Board Holder",
  "Recipe Card Holder", "Menu Stand", "Place Card Holder", "Napkin Holder", "Table Coaster Set"
];

// Varied descriptions (short to long)
const descriptions = [
  "A simple but effective cable holder.",
  "Perfect for your workspace.",
  "Compact and minimalist design.",
  "Great for organizing small items.",
  "Functional and stylish addition to any desk.",
  "Highly customizable to fit your needs. Features adjustable height, multiple mounting options, and compatibility with most standard sizes. Designed with accessibility in mind.",
  "Durable and long-lasting construction using premium materials. This model features reinforced joints, scratch-resistant finish, and ergonomic design principles. Ideal for daily use in professional environments.",
  "A comprehensive solution for storage and organization. Features modular design, stackable components, and weather-resistant coating. Perfect for both indoor and outdoor applications. Includes detailed assembly instructions and hardware.",
  "Premium quality 3D model designed for professional use. This design incorporates advanced parametric features allowing for easy customization. Tested for structural integrity and manufacturing feasibility. Includes STL, STEP, and FBX file formats.",
  "Industrial-grade design with attention to detail. Features precision tolerances, optimized wall thickness for 3D printing, and aesthetic appeal. Compatible with most filament types. Includes assembly guide, post-processing recommendations, and finishing techniques.",
  "Beautifully crafted 3D model combining form and function. Utilizes organic curves and contemporary design patterns. Features drainage holes, rounded edges, and a stable base. Fully parametric for easy modifications and scaling. Tested on multiple 3D printers including FDM, SLA, and polyjet systems.",
  "An exquisite masterpiece of 3D design. This model showcases intricate details, smooth transitions, and professional-grade surface finish. Includes multiple file formats for maximum compatibility. Features detailed documentation covering design inspiration, material suggestions, and recommended print settings for optimal results.",
  "Revolutionary modular system for maximum flexibility. Each component can be individually customized through parametric design. Supports rapid iteration and on-the-fly modifications. Includes comprehensive API documentation, sample configurations, and integration guides. Perfect for developers and makers.",
  "Enterprise-grade 3D model with extensive customization options. Built on parametric architecture supporting unlimited variations. Includes version control, change history, and collaboration features. Comprehensive documentation covers design principles, manufacturing considerations, and best practices for production deployment."
];

// Generate 100 models with rating, downloads, and description
export const models = Array.from({ length: 100 }, (_, i) => {
  const id = i + 1;
  const authorObj = authors[i % authors.length];
  const authorName = authorObj.name;
  const name = modelNames[i % modelNames.length];
  const description = descriptions[i % descriptions.length];
  
  return {
    id,
    name: `${name} v${Math.floor(i / modelNames.length) + 1}`,
    author: authorName,
    authorLogo: getAuthorLogo(authorName),
    thumbnail: `https://placehold.co/400x300?text=${encodeURIComponent(name)}`,
    rating: (Math.random() * 2 + 3).toFixed(1), // Rating 3.0 - 5.0
    downloads: Math.floor(Math.random() * 3000) + 50,
    description: description
  };
});
