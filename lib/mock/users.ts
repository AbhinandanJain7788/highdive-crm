// Matches the 9 users seeded in Phase 0 (recruitment-crm Supabase project) exactly —
// 8 from the HTML's usersSeed plus Meera Nair (synthetic, status 'inactive' coverage).
export type MockUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "Admin" | "User";
  orgRole: "Super Admin" | "Recruitment Manager" | "Recruiter";
  status: "active" | "invited" | "inactive";
  liveStatus: "on_call" | "idle" | "on_break" | "offline" | null;
  avatarColor: string;
  joinedOn: string;
  reportsTo: string | null;
  process: string;
};

export const usersSeed: MockUser[] = [
  {
    id: "u1",
    name: "Rakshit Verma",
    email: "rakshit.verma@highdive.com",
    phone: null,
    role: "Admin",
    orgRole: "Super Admin",
    status: "active",
    liveStatus: "offline",
    avatarColor: "#FF5C35",
    joinedOn: "05 Jan 2026",
    reportsTo: null,
    process: "Default process",
  },
  {
    id: "u2",
    name: "Devika Kulkarni",
    email: "devika.kulkarni@highdive.com",
    phone: null,
    role: "Admin",
    orgRole: "Recruitment Manager",
    status: "active",
    liveStatus: "idle",
    avatarColor: "#2563EB",
    joinedOn: "20 Jan 2026",
    reportsTo: "u1",
    process: "Default process",
  },
  {
    id: "u3",
    name: "Ayesha Khan",
    email: "ayesha.khan@highdive.com",
    phone: "+91 98450 11223",
    role: "User",
    orgRole: "Recruiter",
    status: "active",
    liveStatus: "on_call",
    avatarColor: "#B15C00",
    joinedOn: "10 Feb 2026",
    reportsTo: "u2",
    process: "Default process",
  },
  {
    id: "u4",
    name: "Rohan Deshmukh",
    email: "rohan.deshmukh@highdive.com",
    phone: "+91 98450 22334",
    role: "User",
    orgRole: "Recruiter",
    status: "active",
    liveStatus: "idle",
    avatarColor: "#0F7A6C",
    joinedOn: "10 Feb 2026",
    reportsTo: "u2",
    process: "Default process",
  },
  {
    id: "u5",
    name: "Kavya Menon",
    email: "kavya.menon@highdive.com",
    phone: "+91 98450 33445",
    role: "User",
    orgRole: "Recruiter",
    status: "active",
    liveStatus: "on_call",
    avatarColor: "#7C3AED",
    joinedOn: "01 Mar 2026",
    reportsTo: "u2",
    process: "Default process",
  },
  {
    id: "u6",
    name: "Suresh Pillai",
    email: "suresh.pillai@highdive.com",
    phone: "+91 98450 44556",
    role: "User",
    orgRole: "Recruiter",
    status: "active",
    liveStatus: "on_break",
    avatarColor: "#DB2777",
    joinedOn: "15 Apr 2026",
    reportsTo: "u2",
    process: "Default process",
  },
  {
    id: "u7",
    name: "Anjali Bhatt",
    email: "anjali.bhatt@highdive.com",
    phone: "+91 98450 55667",
    role: "User",
    orgRole: "Recruiter",
    status: "active",
    liveStatus: "idle",
    avatarColor: "#16A34A",
    joinedOn: "01 May 2026",
    reportsTo: "u2",
    process: "Default process",
  },
  {
    id: "u8",
    name: "Tanvi Shah",
    email: "tanvi.shah@highdive.com",
    phone: "+91 98450 66778",
    role: "User",
    orgRole: "Recruiter",
    status: "invited",
    liveStatus: "offline",
    avatarColor: "#FF5C35",
    joinedOn: "25 Aug 2026",
    reportsTo: "u2",
    process: "Default process",
  },
  {
    id: "u9",
    name: "Meera Nair",
    email: "meera.nair@highdive.com",
    phone: null,
    role: "User",
    orgRole: "Recruiter",
    status: "inactive",
    liveStatus: "offline",
    avatarColor: "#2563EB",
    joinedOn: "10 Jan 2026",
    reportsTo: "u2",
    process: "Default process",
  },
];

export const recruiters = usersSeed.filter((u) => u.orgRole === "Recruiter" && u.status === "active");

export const currentUser = usersSeed[0];
