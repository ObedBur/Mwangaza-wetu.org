'use client';

import { createContext, useContext } from "react";

export const CooperativeThemeContext = createContext(false);

export function useCooperativeDarkTheme() {
  return useContext(CooperativeThemeContext);
}
