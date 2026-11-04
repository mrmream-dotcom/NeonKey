// Made-up sample reviews for the review reply demo (/lab/review-reply/).
// The people and businesses are fictional.
export interface ReviewSample { id: string; label: string; stars: number; business: string; review: string }

export const reviewSamples: ReviewSample[] = [
  {
    id: 'happy',
    label: '5-star thank-you',
    stars: 5,
    business: 'Birch Street Auto',
    review:
      'Brought my truck in for a weird rattle and Jess at the front desk got me in the same day. They found a loose heat shield, showed me the part, and charged way less than I expected. Honest shop. Will be back for my winter tires.',
  },
  {
    id: 'mixed',
    label: '3-star mixed',
    stars: 3,
    business: 'Little Spruce Cafe',
    review:
      "The breakfast burrito is honestly the best in town and the coffee is great. But I waited almost 25 minutes on a Saturday morning and nobody told us there was a delay. Would come back on a weekday, maybe.",
  },
  {
    id: 'angry',
    label: '1-star complaint',
    stars: 1,
    business: 'Northline Cleaning Co.',
    review:
      "Booked a move-out clean and paid in full upfront. The oven and the bathroom were barely touched and my landlord kept part of my deposit because of it. I've called twice and nobody has called me back. Want my money back.",
  },
];
