import { fabricTypes, wearTypes } from "@/lib/fashion-intelligence";

export const knowledgeSummary={version:"LE-KB-2.0.0",garments:wearTypes.length,fabrics:fabricTypes.length,contexts:10,aesthetics:9};
export const garments=wearTypes.map((item)=>item.name);
export const fabrics=fabricTypes.map((item)=>item.name);
export const contexts=["Business Office","Boardroom / Business Formal","Daytime Beach Wedding","Luxury Hotel Evening Wedding","Resort Dinner","Urban Smart Casual","Indian Festive Daytime","Wedding Reception","Black Tie / Gala","Travel / Destination Event"];
export const aesthetics=["Quiet Luxury","Modern Classic","Italian-Inspired","British-Inspired","Resort Luxury","Contemporary Indian","Minimal","Heritage Tailoring","Modern Ceremony"];
