// Verbatim from clientsSeed / Phase 0 seed (4 clients).
export type MockClient = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  accountManagerId: string;
};

export const clientsSeed: MockClient[] = [
  {
    id: "k1",
    company: "RapidArc Technologies",
    contactName: "Devika Kulkarni",
    email: "devika.k@rapidarc.io",
    phone: "+91 98110 22334",
    industry: "IT Services",
    accountManagerId: "u3",
  },
  {
    id: "k2",
    company: "Bluepeak Retail",
    contactName: "Sameer Joshi",
    email: "sameer.joshi@bluepeak.in",
    phone: "+91 98220 33445",
    industry: "Retail",
    accountManagerId: "u4",
  },
  {
    id: "k3",
    company: "Meridian Foods",
    contactName: "Ritu Malhotra",
    email: "ritu.malhotra@meridianfoods.in",
    phone: "+91 98330 44556",
    industry: "FMCG",
    accountManagerId: "u5",
  },
  {
    id: "k4",
    company: "Solstice Media",
    contactName: "Farhan Ali",
    email: "farhan.ali@solsticemedia.in",
    phone: "+91 98440 55667",
    industry: "Media & Entertainment",
    accountManagerId: "u7",
  },
];
