import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import invitationsReducer from "./invitations";
import adminReducer from "./admin";
import { clearTokens } from "@/lib/api";

export type Role = "witness" | "adjudicator" | "organizer" | "admin";

export interface AuthUser {
  /** Backend user id (uuid). Optional for legacy/mock sessions. */
  id?: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  organization: string;
  avatarInitials: string;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "??";
}

const ROLE_LABELS: Record<Role, string> = {
  witness: "Independent Witness",
  adjudicator: "Senior Adjudicator",
  organizer: "Event Organizer",
  admin: "GWR Operations Admin",
};

const ROLE_ORGS: Record<Role, string> = {
  witness: "Independent Verifier",
  adjudicator: "Guinness World Records · London",
  organizer: "Event Organization",
  admin: "Guinness World Records · Global Operations",
};

/** Build a presentation-ready AuthUser from backend user data. */
export function authUserFromBackend(b: { id: string; email: string; role: string; full_name: string | null }): AuthUser {
  const role = (b.role as Role);
  const seed = MOCK_CREDENTIALS[b.email.toLowerCase()];
  const name = b.full_name || seed?.user.name || b.email.split("@")[0];
  return {
    id: b.id,
    name,
    email: b.email,
    role,
    roleLabel: seed?.user.roleLabel ?? ROLE_LABELS[role] ?? "Member",
    organization: seed?.user.organization ?? ROLE_ORGS[role] ?? "—",
    avatarInitials: initialsOf(name),
  };
}

const STORAGE_KEY = "gwr_witness_portal_auth";

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
}

const storedUser = loadStoredUser();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    isAuthenticated: !!storedUser,
    user: storedUser,
  } as AuthState,
  reducers: {
    login: (state, action: PayloadAction<AuthUser>) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload)); } catch { /* noop */ }
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      clearTokens();
    },
  },
});

interface UIState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  searchOpen: boolean;
  paletteOpen: boolean;
  notificationsOpen: boolean;
}
const uiSlice = createSlice({
  name: "ui",
  initialState: {
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
    searchOpen: false,
    paletteOpen: false,
    notificationsOpen: false,
  } as UIState,
  reducers: {
    toggleSidebar: (s) => { s.sidebarCollapsed = !s.sidebarCollapsed; },
    setMobileSidebarOpen: (s, a: PayloadAction<boolean>) => { s.mobileSidebarOpen = a.payload; },
    setSearchOpen: (s, a: PayloadAction<boolean>) => { s.searchOpen = a.payload; },
    setPaletteOpen: (s, a: PayloadAction<boolean>) => { s.paletteOpen = a.payload; },
    setNotificationsOpen: (s, a: PayloadAction<boolean>) => { s.notificationsOpen = a.payload; },
  },
});

export const { login, logout } = authSlice.actions;
export const {
  toggleSidebar,
  setMobileSidebarOpen,
  setSearchOpen,
  setPaletteOpen,
  setNotificationsOpen,
} = uiSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
    invitations: invitationsReducer,
    admin: adminReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const MOCK_CREDENTIALS: Record<string, { password: string; user: AuthUser }> = {
  "witness@gwr.com": {
    password: "Witness@123",
    user: {
      name: "Dr. Marcus Hollingsworth",
      email: "witness@gwr.com",
      role: "witness",
      roleLabel: "Independent Witness",
      organization: "Royal Society of Sports Science",
      avatarInitials: "MH",
    },
  },
  "adjudicator@gwr.com": {
    password: "Adjudicator@123",
    user: {
      name: "Eleanor Whitfield",
      email: "adjudicator@gwr.com",
      role: "adjudicator",
      roleLabel: "Senior Adjudicator",
      organization: "Guinness World Records · London",
      avatarInitials: "EW",
    },
  },
  "organizer@gwr.com": {
    password: "Organizer@123",
    user: {
      name: "Priya Sharma",
      email: "organizer@gwr.com",
      role: "organizer",
      roleLabel: "Event Organizer",
      organization: "Aurora Events International",
      avatarInitials: "PS",
    },
  },
  "admin@gwr.com": {
    password: "Admin@123",
    user: {
      name: "Vaigai Ramesh",
      email: "admin@gwr.com",
      role: "admin",
      roleLabel: "GWR Operations Admin",
      organization: "Guinness World Records · Global Operations",
      avatarInitials: "VR",
    },
  },
};
