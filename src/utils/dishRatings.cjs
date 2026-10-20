function aggregateDishRatings(reviews) {
  const totals = Object.create(null);
  for (const review of reviews) {
    for (const [id, stars] of Object.entries(review.ratings || {})) {
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) continue;
      const entry = totals[id] || (totals[id] = { sum: 0, count: 0 });
      entry.sum += stars;
      entry.count += 1;
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([id, entry]) => [id, {
    average: entry.sum / entry.count, count: entry.count
  }]));
}
module.exports = { aggregateDishRatings };
