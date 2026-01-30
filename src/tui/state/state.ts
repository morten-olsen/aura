import type { Screen, ScreenName, Toast, ModalConfig, ListFilters, StepProgress } from '../tui.types.ts';

import type { Ticket } from '#root/tickets/tickets.schemas.ts';

type AppState = {
  screen: Screen;
  history: Screen[];
  tickets: Ticket[];
  selectedTicketIndex: number;
  currentTicket: Ticket | null;
  stepProgress: StepProgress | null;
  isLoading: boolean;
  error: string | null;
  toasts: Toast[];
  modal: ModalConfig | null;
  filters: ListFilters;
  isConnected: boolean;
};

type AppAction =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'GO_BACK' }
  | { type: 'SET_TICKETS'; tickets: Ticket[] }
  | { type: 'SET_SELECTED_INDEX'; index: number }
  | { type: 'SET_CURRENT_TICKET'; ticket: Ticket | null }
  | { type: 'UPDATE_TICKET'; ticket: Ticket }
  | { type: 'SET_STEP_PROGRESS'; progress: StepProgress | null }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'SHOW_MODAL'; modal: ModalConfig }
  | { type: 'HIDE_MODAL' }
  | { type: 'SET_FILTERS'; filters: ListFilters }
  | { type: 'SET_CONNECTED'; isConnected: boolean };

const initialState: AppState = {
  screen: { name: 'dashboard', params: {} },
  history: [],
  tickets: [],
  selectedTicketIndex: 0,
  currentTicket: null,
  stepProgress: null,
  isLoading: false,
  error: null,
  toasts: [],
  modal: null,
  filters: {},
  isConnected: false,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'NAVIGATE':
      return {
        ...state,
        history: [...state.history, state.screen],
        screen: action.screen,
        error: null,
      };

    case 'GO_BACK': {
      const newHistory = [...state.history];
      const previousScreen = newHistory.pop();
      if (!previousScreen) {
        return state;
      }
      return {
        ...state,
        history: newHistory,
        screen: previousScreen,
        error: null,
      };
    }

    case 'SET_TICKETS':
      return {
        ...state,
        tickets: action.tickets,
        selectedTicketIndex: Math.min(state.selectedTicketIndex, Math.max(0, action.tickets.length - 1)),
      };

    case 'SET_SELECTED_INDEX':
      return {
        ...state,
        selectedTicketIndex: Math.max(0, Math.min(action.index, state.tickets.length - 1)),
      };

    case 'SET_CURRENT_TICKET':
      return {
        ...state,
        currentTicket: action.ticket,
      };

    case 'UPDATE_TICKET': {
      const updatedTickets = state.tickets.map((t) => (t.id === action.ticket.id ? action.ticket : t));
      const updatedCurrentTicket = state.currentTicket?.id === action.ticket.id ? action.ticket : state.currentTicket;
      return {
        ...state,
        tickets: updatedTickets,
        currentTicket: updatedCurrentTicket,
      };
    }

    case 'SET_STEP_PROGRESS':
      return {
        ...state,
        stepProgress: action.progress,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      };

    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.toast],
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };

    case 'SHOW_MODAL':
      return {
        ...state,
        modal: action.modal,
      };

    case 'HIDE_MODAL':
      return {
        ...state,
        modal: null,
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: action.filters,
      };

    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: action.isConnected,
      };

    default:
      return state;
  }
};

// Action creators
const navigate = (name: ScreenName, params: Record<string, unknown> = {}): AppAction => ({
  type: 'NAVIGATE',
  screen: { name, params } as Screen,
});

const goBack = (): AppAction => ({ type: 'GO_BACK' });

const setTickets = (tickets: Ticket[]): AppAction => ({
  type: 'SET_TICKETS',
  tickets,
});

const setSelectedIndex = (index: number): AppAction => ({
  type: 'SET_SELECTED_INDEX',
  index,
});

const setCurrentTicket = (ticket: Ticket | null): AppAction => ({
  type: 'SET_CURRENT_TICKET',
  ticket,
});

const updateTicket = (ticket: Ticket): AppAction => ({
  type: 'UPDATE_TICKET',
  ticket,
});

const setStepProgress = (progress: StepProgress | null): AppAction => ({
  type: 'SET_STEP_PROGRESS',
  progress,
});

const setLoading = (isLoading: boolean): AppAction => ({
  type: 'SET_LOADING',
  isLoading,
});

const setError = (error: string | null): AppAction => ({
  type: 'SET_ERROR',
  error,
});

const addToast = (toast: Toast): AppAction => ({
  type: 'ADD_TOAST',
  toast,
});

const removeToast = (id: string): AppAction => ({
  type: 'REMOVE_TOAST',
  id,
});

const showModal = (modal: ModalConfig): AppAction => ({
  type: 'SHOW_MODAL',
  modal,
});

const hideModal = (): AppAction => ({ type: 'HIDE_MODAL' });

const setFilters = (filters: ListFilters): AppAction => ({
  type: 'SET_FILTERS',
  filters,
});

const setConnected = (isConnected: boolean): AppAction => ({
  type: 'SET_CONNECTED',
  isConnected,
});

export type { AppState, AppAction };
export {
  initialState,
  appReducer,
  navigate,
  goBack,
  setTickets,
  setSelectedIndex,
  setCurrentTicket,
  updateTicket,
  setStepProgress,
  setLoading,
  setError,
  addToast,
  removeToast,
  showModal,
  hideModal,
  setFilters,
  setConnected,
};
