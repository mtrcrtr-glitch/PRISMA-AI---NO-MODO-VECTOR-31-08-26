/**
 * Official broker OTC asset catalog
 * Dynamic & real-time sync with OPTGO broker API.
 * Total verified assets: 148
 */

export interface OtcAsset {
  id: number;
  symbol: string;
  label: string;
  category: "forex" | "stock" | "crypto" | "commodity" | "index";
  payout?: number;
  precision?: number;
}

export const OTC_ASSETS: OtcAsset[] = [
  {
    "id": 1931,
    "symbol": "UKOUSD OTC",
    "label": "Crude Oil Brent OTC",
    "category": "commodity",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 1859,
    "symbol": "USOUSD OTC",
    "label": "USOUSD OTC",
    "category": "commodity",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1858,
    "symbol": "XAGUSD OTC",
    "label": "XAGUSD OTC",
    "category": "commodity",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2086,
    "symbol": "XAU/XAG OTC",
    "label": "XAU/XAG OTC",
    "category": "commodity",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 1857,
    "symbol": "XAUUSD OTC",
    "label": "XAUUSD OTC",
    "category": "commodity",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1863,
    "symbol": "XNGUSD OTC",
    "label": "XNGUSD OTC",
    "category": "commodity",
    "payout": 88,
    "precision": 5
  },
  {
    "id": 2156,
    "symbol": "ARBUSD OTC",
    "label": "ARBUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2150,
    "symbol": "ATOMUSD OTC",
    "label": "ATOMUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2148,
    "symbol": "BCHUSD OTC",
    "label": "BCHUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2142,
    "symbol": "BONKUSD OTC",
    "label": "BONKUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2270,
    "symbol": "BTCUSD-op OTC",
    "label": "BTCUSD OTC",
    "category": "crypto",
    "payout": 89,
    "precision": 4
  },
  {
    "id": 1974,
    "symbol": "CARDANO OTC",
    "label": "ADAUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2155,
    "symbol": "DASHUSD OTC",
    "label": "DASHUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2149,
    "symbol": "DOTUSD OTC",
    "label": "DOTUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2277,
    "symbol": "DYDXUSD OTC",
    "label": "DYDXUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2127,
    "symbol": "EOSUSD OTC",
    "label": "EOSUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1941,
    "symbol": "ETHUSD OTC",
    "label": "ETH/USD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2279,
    "symbol": "FARTCOINUSD OTC",
    "label": "FARTCOINUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2289,
    "symbol": "FETUSD OTC",
    "label": "FETUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2146,
    "symbol": "FLOKIUSD OTC",
    "label": "FLOKIUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2165,
    "symbol": "GRTUSD OTC",
    "label": "GRTUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2288,
    "symbol": "HBARUSD OTC",
    "label": "HBARUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2139,
    "symbol": "ICPUSD OTC",
    "label": "ICPUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2140,
    "symbol": "IMXUSD OTC",
    "label": "IMXUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2151,
    "symbol": "INJUSD OTC",
    "label": "INJUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2153,
    "symbol": "IOTAUSD OTC",
    "label": "IOTAUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2141,
    "symbol": "JUPUSD OTC",
    "label": "JUPUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2143,
    "symbol": "LINKUSD OTC",
    "label": "LINKUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2126,
    "symbol": "LTCUSD OTC",
    "label": "LTCUSD Litecoin OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2163,
    "symbol": "MANAUSD OTC",
    "label": "MANAUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2167,
    "symbol": "MATICUSD OTC",
    "label": "MATICUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2267,
    "symbol": "MELANIAUSD OTC",
    "label": "MELANIAUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2168,
    "symbol": "NEARUSD OTC",
    "label": "NEARUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2276,
    "symbol": "ONDOUSD OTC",
    "label": "ONDOUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2278,
    "symbol": "ONYXCOINUSD OTC",
    "label": "ONYXCOINUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2158,
    "symbol": "ORDIUSD OTC",
    "label": "ORDIUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2280,
    "symbol": "PENGUUSD OTC",
    "label": "PENGUUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2145,
    "symbol": "PEPEUSD OTC",
    "label": "PEPEUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2160,
    "symbol": "PYTHUSD OTC",
    "label": "PYTHUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2286,
    "symbol": "RAYDIUMUSD OTC",
    "label": "RAYDIUMUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2290,
    "symbol": "RENDERUSD OTC",
    "label": "RENDERUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2161,
    "symbol": "RONINUSD OTC",
    "label": "RONINUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2164,
    "symbol": "SANDUSD OTC",
    "label": "SANDUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2159,
    "symbol": "SATSUSD OTC",
    "label": "SATSUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2152,
    "symbol": "SEIUSD OTC",
    "label": "SEIUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1975,
    "symbol": "SHIBUSD OTC",
    "label": "Shiba Inu OTC",
    "category": "crypto",
    "payout": 87,
    "precision": 6
  },
  {
    "id": 1978,
    "symbol": "SOLUSD OTC",
    "label": "SOLUSD OTC",
    "category": "crypto",
    "payout": 89,
    "precision": 6
  },
  {
    "id": 2166,
    "symbol": "STXUSD OTC",
    "label": "STXUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2287,
    "symbol": "SUIUSD OTC",
    "label": "SUIUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2291,
    "symbol": "TAOUSD OTC",
    "label": "TAOUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2162,
    "symbol": "TIAUSD OTC",
    "label": "TIAUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1976,
    "symbol": "TRON OTC",
    "label": "TRON OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2265,
    "symbol": "TRUMPUSD OTC",
    "label": "TRUMPUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2144,
    "symbol": "WIFUSD OTC",
    "label": "WIFUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2157,
    "symbol": "WLDUSD OTC",
    "label": "WLDUSD OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2107,
    "symbol": "XRPUSD OTC",
    "label": "XRPUSD Ripple OTC",
    "category": "crypto",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 86,
    "symbol": "AUDCAD OTC",
    "label": "AUD/CAD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2129,
    "symbol": "AUDCHF OTC",
    "label": "AUDCHF OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2113,
    "symbol": "AUDJPY OTC",
    "label": "AUDJPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2130,
    "symbol": "AUDNZD OTC",
    "label": "AUDNZD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2111,
    "symbol": "AUDUSD OTC",
    "label": "AUDUSD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2119,
    "symbol": "CADCHF OTC",
    "label": "CADCHF OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2136,
    "symbol": "CADJPY OTC",
    "label": "CADJPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2118,
    "symbol": "CHFJPY OTC",
    "label": "CHFJPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2200,
    "symbol": "CHFNOK OTC",
    "label": "CHFNOK OTC",
    "category": "forex",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2120,
    "symbol": "EURAUD OTC",
    "label": "EURAUD- OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2117,
    "symbol": "EURCAD OTC",
    "label": "EURCAD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2131,
    "symbol": "EURCHF OTC",
    "label": "EURCHF OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 77,
    "symbol": "EURGBP OTC",
    "label": "EUR/GBP OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 79,
    "symbol": "EURJPY OTC",
    "label": "EUR/JPY OTC",
    "category": "forex",
    "payout": 89,
    "precision": 6
  },
  {
    "id": 2122,
    "symbol": "EURNZD OTC",
    "label": "EURNZD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2181,
    "symbol": "EURTHB OTC",
    "label": "EURTHB OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 76,
    "symbol": "EURUSD OTC",
    "label": "EUR/USD OTC",
    "category": "forex",
    "payout": 89,
    "precision": 6
  },
  {
    "id": 2116,
    "symbol": "GBPAUD OTC",
    "label": "GBPAUD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2114,
    "symbol": "GBPCAD OTC",
    "label": "GBPCAD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2115,
    "symbol": "GBPCHF OTC",
    "label": "GBPCHF OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 84,
    "symbol": "GBPJPY OTC",
    "label": "GBP/JPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2132,
    "symbol": "GBPNZD OTC",
    "label": "GBPNZD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 81,
    "symbol": "GBPUSD OTC",
    "label": "GBP/USD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2183,
    "symbol": "JPYTHB OTC",
    "label": "JPYTHB OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2201,
    "symbol": "NOKJPY OTC",
    "label": "NOKJPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2137,
    "symbol": "NZDCAD OTC",
    "label": "NZDCAD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2202,
    "symbol": "NZDCHF OTC",
    "label": "NZDCHF OTC",
    "category": "forex",
    "payout": 85,
    "precision": 6
  },
  {
    "id": 2138,
    "symbol": "NZDJPY OTC",
    "label": "NZDJPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 80,
    "symbol": "NZDUSD OTC",
    "label": "NZD/USD OTC",
    "category": "forex",
    "payout": 87,
    "precision": 6
  },
  {
    "id": 2301,
    "symbol": "PENUSD OTC",
    "label": "PEN/USD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2298,
    "symbol": "USDBRL OTC",
    "label": "USD/BRL OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2112,
    "symbol": "USDCAD OTC",
    "label": "USDCAD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 78,
    "symbol": "USDCHF OTC",
    "label": "USD/CHF OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2299,
    "symbol": "USDCOP OTC",
    "label": "USD/COP OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1382,
    "symbol": "USDHKD OTC",
    "label": "USD/HKD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1383,
    "symbol": "USDINR OTC",
    "label": "USD/INR OTC",
    "category": "forex",
    "payout": 84,
    "precision": 4
  },
  {
    "id": 85,
    "symbol": "USDJPY OTC",
    "label": "USD/JPY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 5
  },
  {
    "id": 2300,
    "symbol": "USDMXN OTC",
    "label": "USD/MXN OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2121,
    "symbol": "USDNOK OTC",
    "label": "USDNOK OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2128,
    "symbol": "USDPLN OTC",
    "label": "USDPLN OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2123,
    "symbol": "USDSEK OTC",
    "label": "USDSEK OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1381,
    "symbol": "USDSGD OTC",
    "label": "USD/SGD OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2182,
    "symbol": "USDTHB OTC",
    "label": "USDTHB OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2124,
    "symbol": "USDTRY OTC",
    "label": "USDTRY OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1380,
    "symbol": "USDZAR OTC",
    "label": "USD/ZAR OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2063,
    "symbol": "Yen_Index OTC",
    "label": "Yen_Index OTC",
    "category": "forex",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2048,
    "symbol": "AUS200 OTC",
    "label": "Australia 200 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2050,
    "symbol": "EU50 OTC",
    "label": "Euro 50 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2045,
    "symbol": "FR40 OTC",
    "label": "France 40 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2046,
    "symbol": "GER30 OTC",
    "label": "Germany 30 (DAX) Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2093,
    "symbol": "GER30/UK100 OTC",
    "label": "GER30/UK100 OTC",
    "category": "index",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2049,
    "symbol": "HK33 OTC",
    "label": "HongKong 33 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2051,
    "symbol": "JP225 OTC",
    "label": "Japan 225 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2044,
    "symbol": "SP35 OTC",
    "label": "Spain 35 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1971,
    "symbol": "SP500 OTC",
    "label": "S&P 500 OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2047,
    "symbol": "UK100 OTC",
    "label": "UK 100 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2080,
    "symbol": "US100/JP225 OTC",
    "label": "US100/JP225 OTC",
    "category": "index",
    "payout": 84,
    "precision": 4
  },
  {
    "id": 2108,
    "symbol": "US2000 OTC",
    "label": "US2000 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 3
  },
  {
    "id": 1973,
    "symbol": "US30 OTC",
    "label": "US 30 Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2079,
    "symbol": "US30/JP225 OTC",
    "label": "US30/JP225 OTC",
    "category": "index",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2081,
    "symbol": "US500/JP225 OTC",
    "label": "US500/JP225 OTC",
    "category": "index",
    "payout": 84,
    "precision": 4
  },
  {
    "id": 1972,
    "symbol": "USNDAQ100 OTC",
    "label": "USNDAQ 100 (NDX) Spot Index OTC",
    "category": "index",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2109,
    "symbol": "AIG OTC",
    "label": "AIG OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2106,
    "symbol": "ALIBABA OTC",
    "label": "ALIBABA Alibaba Group Holding… OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 1935,
    "symbol": "AMAZON OTC",
    "label": "Amazon.com, Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2082,
    "symbol": "AMZN/ALIBABA OTC",
    "label": "AMZN/ALIBABA OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2083,
    "symbol": "AMZN/EBAY OTC",
    "label": "AMZN/EBAY OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2451,
    "symbol": "Anthropic OTC",
    "label": "Anthropic OTC",
    "category": "stock",
    "payout": 90,
    "precision": 6
  },
  {
    "id": 1938,
    "symbol": "APPLE OTC",
    "label": "Apple Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2097,
    "symbol": "BIDU OTC",
    "label": "BAIDU Baidu, Inc. ADR OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2100,
    "symbol": "CITI OTC",
    "label": "CITI Citigroup, Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2101,
    "symbol": "COKE OTC",
    "label": "COKE Coca-Cola Company OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 1937,
    "symbol": "FB OTC",
    "label": "Facebook, Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 1933,
    "symbol": "GOOGLE OTC",
    "label": "Alphabet Inc. Class A OTC",
    "category": "stock",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2085,
    "symbol": "GOOGLE/MSFT OTC",
    "label": "GOOGLE/MSFT OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2110,
    "symbol": "GS OTC",
    "label": "GS Goldman Sachs Group, Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2098,
    "symbol": "INTEL OTC",
    "label": "INTEL Intel Corporation OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2089,
    "symbol": "INTEL/IBM OTC",
    "label": "INTEL/IBM OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2102,
    "symbol": "JPM OTC",
    "label": "JPM JPMorgan Chase & Co. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2103,
    "symbol": "MCDON OTC",
    "label": "MCDON McDonald's Corporation OTC",
    "category": "stock",
    "payout": 88,
    "precision": 3
  },
  {
    "id": 2094,
    "symbol": "META/GOOGLE OTC",
    "label": "META/GOOGLE OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2104,
    "symbol": "MORSTAN OTC",
    "label": "MORSTAN Morgan Stanley OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2099,
    "symbol": "MSFT OTC",
    "label": "MSFT Microsoft Corporation OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2088,
    "symbol": "MSFT/AAPL OTC",
    "label": "MSFT/AAPL OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2090,
    "symbol": "NFLX/AMZN OTC",
    "label": "NFLX/AMZN OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2105,
    "symbol": "NIKE OTC",
    "label": "NIKE Nike, Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2084,
    "symbol": "NVDA/AMD OTC",
    "label": "NVDA/AMD OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 2452,
    "symbol": "OpenAI OTC",
    "label": "OpenAI OTC",
    "category": "stock",
    "payout": 87,
    "precision": 6
  },
  {
    "id": 2125,
    "symbol": "SNAP OTC",
    "label": "SNAP Snap Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 4
  },
  {
    "id": 2443,
    "symbol": "SpaceX OTC",
    "label": "SpaceX OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  },
  {
    "id": 1936,
    "symbol": "TESLA OTC",
    "label": "Tesla, Inc. OTC",
    "category": "stock",
    "payout": 88,
    "precision": 6
  },
  {
    "id": 2087,
    "symbol": "TESLA/FORD OTC",
    "label": "TESLA/FORD OTC",
    "category": "stock",
    "payout": 84,
    "precision": 6
  }
];

export function getAssetById(id: number, customList?: OtcAsset[]): OtcAsset | undefined {
  const list = customList && customList.length > 0 ? customList : OTC_ASSETS;
  return list.find((a) => a.id === id);
}

export function filterAssetsByCategory(
  assets: OtcAsset[],
  category: "all" | "forex" | "stock" | "crypto" | "commodity" | "index",
): OtcAsset[] {
  if (category === "all") return assets;
  return assets.filter((a) => a.category === category);
}
