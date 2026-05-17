export type DealType = "trade" | "rent";

export type RawAptTrade = {
  aptNm: string;
  aptDong?: string;
  umdNm: string;
  jibun: string;
  excluUseAr: number;
  floor: number;
  buildYear?: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealAmount: number;
  cdealType?: string;
  cdealDay?: string;
  estateAgentSggNm?: string;
};

export type RawAptRent = {
  aptNm: string;
  umdNm: string;
  jibun: string;
  excluUseAr: number;
  floor: number;
  buildYear?: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  deposit: number;
  monthlyRent: number;
  contractType?: string;
  contractTerm?: string;
};

export type AggregatedApt = {
  key: string;
  aptNm: string;
  umdNm: string;
  jibun: string;
  fullAddress: string;
  buildYear?: number;
  area: number;
  dealCount: number;
  avgPrice: number;
  maxPrice: number;
  minPrice: number;
  recentDealDate: string;
};

export type MonthlyPoint = {
  yyyymm: string;
  avgPrice: number;
  count: number;
};

export type AptTimeSeries = {
  key: string;
  aptNm: string;
  area: number;
  trade: MonthlyPoint[];
  rent: MonthlyPoint[];
};
