import "server-only";

export const RBL_LOMA_2026_HEADERS = {
  start: "start",
  end: "end",
  consent: "May I proceed?",
  city: "1. City of interview",
  residenceEligible: "2. Do you live or regularly commute in this city?",
  ageBand: "3. How old are you? (Age group)",
  gender: "4. Gender",
  occupation: "5a. Primary occupation",
  incomeBand: "SEC 5c.What is Your Approximate Monthly Personal Income?",
  weekdayMorning: "7b. Morning",
  weekdayAfternoon: "7b.Afternoon",
  weekdayEvening: "7b. Evening",
  weekdayNight: "7b. Night",
  weekendMorning: "8b. Morning",
  weekendAfternoon: "8b. Afternoon",
  weekendEvening: "8b. Evening",
  weekendNight: "8b. Night",
  transportMode: "9. What is your primary mode of transport on most days?",
  oohAttention: "10. During your usual journeys out of your home, how much attention do you pay to advertising around roads, stations, vehicles, etc?",
  weeklyNoticeFrequency: "16. In the past 7 days, how many times would you say you noticed an OOH advertisement while outside?",
  topFormatLargeBillboard: "top 3:/Large billboard",
  topFormatDigitalLed: "top 3:/Digital screen or LED",
  topFormatTransit: "top 3:/ Bus or vehicle wrap",
  topFormatMall: "top 3:/Mall screen",
  topFormatAirport: "top 3:/Airport ad",
  topFormatPoleBanner: "top 3:/Street sign/pole banner",
  topFormatBusShelter: "top 3):/Bus shelter ad",
  topFormatBuildingBranding: "top 3:/Building branding or painting",
  topFormatStreetFurniture: "top 3:/Street furniture or roundabout",
  topFormatThreeDimensional: "top 3:/3D or Life-size displays",
  primaryEnvironment: "18. In which environment do you see the most OOH advertising?",
  recallLastFourWeeks: "20. Do you recall any OOH Ad seen in the last 4 weeks?",
  recallAbout: "21a. If yes, what was it about?",
  recallBrand: "21b. If yes, What brand?",
  recallWhere: "21c. If yes, Where did you see it?",
  hardestToIgnoreFormat: "23. Which OOH Ad format do you find hardest to ignore?",
  memorabilityDriver: "24. What usually makes an OOH advertisement appealing and memorable to you?",
  commuteMood: "25.How would you describe your mood during your typical commute?",
  commuteAttentionBillboards: "26. (Top 2)/ Billboards/signs",
  commuteAttentionPhone: "26. (Top 2)/My phone",
  commuteAttentionPassengers: "26. (Top 2)/Other passengers",
  commuteAttentionTraffic: "26. (Top 2)/Traffic/road",
  commuteAttentionRadio: "26. (Top 2)/Music/radio",
  commuteAttentionNothing: "26. (Top 2)/Nothing in particular",
  trafficAttention: "27.How attentive are you to advertising around you when you are stuck in traffic?",
  ratingAttentionLargeBillboard: "OOH FORMAT PERFORMANCE/ATTENTION/Large billboard",
  ratingAttentionDigitalLed: "OOH FORMAT PERFORMANCE/ATTENTION/Digital LED screen",
  ratingAttentionTransit: "OOH FORMAT PERFORMANCE/ATTENTION/Transit/vehicle ad",
  ratingAttentionAirport: "OOH FORMAT PERFORMANCE/ATTENTION/Airport advertising",
  ratingAttentionStreetFurniture: "OOH FORMAT PERFORMANCE/ATTENTION/Street furniture/bus shelter",
  ratingRecallLargeBillboard: "OOH FORMAT PERFORMANCE/RECALL/Large billboard",
  ratingRecallDigitalLed: "OOH FORMAT PERFORMANCE/RECALL/Digital LED screen",
  ratingRecallTransit: "OOH FORMAT PERFORMANCE/RECALL/Transit/vehicle ad",
  ratingRecallAirport: "OOH FORMAT PERFORMANCE/RECALL/Airport advertising",
  ratingRecallStreetFurniture: "OOH FORMAT PERFORMANCE/RECALL/Street furniture/bus shelter",
  ratingTrustLargeBillboard: "OOH FORMAT PERFORMANCE/TRUST/Large billboard",
  ratingTrustDigitalLed: "OOH FORMAT PERFORMANCE/TRUST/Digital LED screen",
  ratingTrustTransit: "OOH FORMAT PERFORMANCE/TRUST/Transit/vehicle ad",
  ratingTrustAirport: "OOH FORMAT PERFORMANCE/TRUST/Airport advertising",
  ratingTrustStreetFurniture: "OOH FORMAT PERFORMANCE/TRUST/Street furniture/bus shelter",
  ratingEffectLargeBillboard: "OOH FORMAT PERFORMANCE/EFFECT/Large billboard",
  ratingEffectDigitalLed: "OOH FORMAT PERFORMANCE/EFFECT/Digital LED screen",
  ratingEffectTransit: "OOH FORMAT PERFORMANCE/EFFECT/Transit/vehicle ad",
  ratingEffectAirport: "OOH FORMAT PERFORMANCE/EFFECT/Airport advertising",
  ratingEffectStreetFurniture: "OOH FORMAT PERFORMANCE/EFFECT/Street furniture/bus shelter",
  ratingQualityLargeBillboard: "OOH FORMAT PERFORMANCE/QUALITY_FEEL/Large billboard",
  ratingQualityDigitalLed: "OOH FORMAT PERFORMANCE/QUALITY_FEEL/Digital LED screen",
  ratingQualityTransit: "OOH FORMAT PERFORMANCE/QUALITY_FEEL/Transit/vehicle ad",
  ratingQualityAirport: "OOH FORMAT PERFORMANCE/QUALITY_FEEL/Airport advertising",
  ratingQualityStreetFurniture: "OOH FORMAT PERFORMANCE/QUALITY_FEEL/Street furniture/bus shelter",
  bestRoad: "28a.Which specific road in your city do you think has the best, most visible advertising? Open: ________________________",
  bestArea: "28b.Which specific area or location in your city do you think has the best, most visible advertising? Open: ________________________",
  attentionDriverBright: "29. /Bigger/brighter screen",
  attentionDriverFunny: "29. /Funny or entertaining content",
  attentionDriverRelevant: "29. /Relevant to my life",
  attentionDriverCelebrity: "29. /Celebrity/influencer",
  attentionDriverAnimated: "29. /Moving/animated display",
  attentionDriverLocalLanguage: "29. / Local language",
  actionSearch: "/30./Searched online",
  actionVisit: "/30./Visited store/location",
  actionDiscuss: "/30./ Discussed with someone",
  actionFollow: "/30./Followed on social media",
  actionPurchase: "/30./Purchased product/service",
  actionNone: "/30./ Took no action",
  categoryTelecoms: "/31./Telecoms",
  categoryBanking: "/31./Banking",
  categoryBetting: "/31./Betting",
  categoryFmcg: "/31./FMCG",
  categoryPolitical: "/31./Political",
  categoryEntertainment: "/31./Entertainment",
  categoryRealEstate: "/31./Real estate",
  categoryFintech: "/31./Fintech",
  categoryHospitality: "/31./Hospitality",
  categoryHousehold: "/31./Household",
  latitude: "_GPS Location_latitude",
  longitude: "_GPS Location_longitude",
  gpsPrecision: "_GPS Location_precision",
  formVersion: "__version__",
} as const;

export type RblLoma2026HeaderKey = keyof typeof RBL_LOMA_2026_HEADERS;
export type RblLoma2026HeaderIndex = Record<RblLoma2026HeaderKey, number>;

function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildRblLoma2026HeaderIndex(
  headers: readonly string[],
): RblLoma2026HeaderIndex {
  const positions = new Map<string, number[]>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    positions.set(normalized, [...(positions.get(normalized) ?? []), index]);
  });
  return Object.fromEntries(
    (Object.entries(RBL_LOMA_2026_HEADERS) as Array<[RblLoma2026HeaderKey, string]>).map(
      ([key, expected]) => {
        const matches = positions.get(normalizeHeader(expected)) ?? [];
        if (matches.length === 0) throw new Error(`SURVEY_HEADER_MISSING:${key}`);
        if (matches.length > 1) throw new Error(`SURVEY_HEADER_AMBIGUOUS:${key}`);
        return [key, matches[0]];
      },
    ),
  ) as RblLoma2026HeaderIndex;
}
