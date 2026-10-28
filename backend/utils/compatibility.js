
function calculateCompatibility(profileA, profileB) {
  function normalize(items) {
    return [
      ...new Set(
        (items || [])
          .map((item) => String(item).trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }

  function calculateOverlap(itemsA, itemsB) {
    const setA = new Set(itemsA);
    const setB = new Set(itemsB);

    if (setA.size === 0 || setB.size === 0) {
      return null;
    }

    const common = [...setA].filter((item) => setB.has(item));

    // Overlap relative to the smaller profile's list.
    return common.length / Math.min(setA.size, setB.size);
  }

  const interestsA = normalize(profileA.interests);
  const interestsB = normalize(profileB.interests);

  const hobbiesA = normalize(profileA.preferredHobbies);
  const hobbiesB = normalize(profileB.preferredHobbies);

  const interestScore = calculateOverlap(interestsA, interestsB);
  const hobbyScore = calculateOverlap(hobbiesA, hobbiesB);

  const scores = [];

  if (interestScore !== null) {
    scores.push({
      score: interestScore,
      weight: 0.6,
    });
  }

  if (hobbyScore !== null) {
    scores.push({
      score: hobbyScore,
      weight: 0.4,
    });
  }

  if (scores.length === 0) {
    return 0;
  }

  const totalWeight = scores.reduce(
    (total, item) => total + item.weight,
    0
  );

  const weightedScore = scores.reduce(
    (total, item) => total + item.score * item.weight,
    0
  );

  return Math.round((weightedScore / totalWeight) * 100);
}

module.exports = calculateCompatibility;
