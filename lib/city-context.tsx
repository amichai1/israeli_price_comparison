import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CITY_STORAGE_KEY = '@selected_city';
const DEFAULT_CITY = 'Petah Tikva';

interface CityContextType {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  availableCities: string[];
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCityState] = useState<string>(DEFAULT_CITY);
  const availableCities = ['Petah Tikva', 'Jerusalem', 'Tel Aviv', 'Haifa', 'Ramat Gan'];

  // Load selected city from storage on mount
  useEffect(() => {
    loadSelectedCity();
  }, []);

  const loadSelectedCity = async () => {
    try {
      const stored = await AsyncStorage.getItem(CITY_STORAGE_KEY);
      if (stored) {
        setSelectedCityState(stored);
      }
    } catch (error) {
      console.error('Error loading selected city:', error);
    }
  };

  const setSelectedCity = async (city: string) => {
    try {
      await AsyncStorage.setItem(CITY_STORAGE_KEY, city);
      setSelectedCityState(city);
    } catch (error) {
      console.error('Error saving selected city:', error);
    }
  };

  return (
    <CityContext.Provider value={{ selectedCity, setSelectedCity, availableCities }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const context = useContext(CityContext);
  if (context === undefined) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
}
