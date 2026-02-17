import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCities } from '@/lib/supabase-service';

const CITY_STORAGE_KEY = '@selected_city';

interface City {
  id: number;
  name: string;
}

interface CityContextType {
  selectedCityId: number | null;
  selectedCityName: string;
  setSelectedCity: (city: City) => void;
  availableCities: City[];
  loading: boolean;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCityState] = useState<City | null>(null);
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  // טעינת ערים מ-DB + עיר שמורה מ-AsyncStorage
  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const cities = await getCities();
      setAvailableCities(cities);

      // טעינת עיר שמורה
      const stored = await AsyncStorage.getItem(CITY_STORAGE_KEY);
      if (stored) {
        try {
          const parsed: City = JSON.parse(stored);
          // וידוא שהעיר עדיין קיימת ב-DB
          if (cities.some((c) => c.id === parsed.id)) {
            setSelectedCityState(parsed);
          } else if (cities.length > 0) {
            setSelectedCityState(cities[0]);
          }
        } catch {
          // אם ה-stored value ישן (string), נתעלם ממנו
          if (cities.length > 0) {
            setSelectedCityState(cities[0]);
          }
        }
      } else if (cities.length > 0) {
        // ברירת מחדל: העיר הראשונה ברשימה
        setSelectedCityState(cities[0]);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedCity = async (city: City) => {
    try {
      await AsyncStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city));
      setSelectedCityState(city);
    } catch (error) {
      console.error('Error saving selected city:', error);
    }
  };

  return (
    <CityContext.Provider
      value={{
        selectedCityId: selectedCity?.id ?? null,
        selectedCityName: selectedCity?.name ?? '',
        setSelectedCity,
        availableCities,
        loading,
      }}
    >
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
