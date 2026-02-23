import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getBasket, addToBasket, removeFromBasket, clearBasket, updateBasketQuantity } from './basket-storage';
import { BasketItem } from '@/types';

interface BasketContextType {
  basket: BasketItem[];
  loading: boolean;
  addItem: (item: BasketItem) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  clearItems: () => Promise<void>;
  isInBasket: (itemId: number) => boolean;
  getQuantity: (itemId: number) => number;
  refreshBasket: () => Promise<void>;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export function BasketProvider({ children }: { children: ReactNode }) {
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load basket on mount
  useEffect(() => {
    loadBasket();
    
    // Set up interval to refresh basket every 2 seconds
    // This ensures we catch updates from other screens
    const interval = setInterval(() => {
      refreshBasketSilent();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const hasBasketChanged = (prev: BasketItem[], next: BasketItem[]) => {
    if (prev.length !== next.length) return true;
    return prev.some(
      (item, index) => item.id !== next[index]?.id || item.quantity !== next[index]?.quantity
    );
  };

  const loadBasket = async () => {
    setLoading(true);
    try {
      const items = await getBasket();
      setBasket((prevBasket) =>
        hasBasketChanged(prevBasket, items) ? items : prevBasket
      );
    } catch (error) {
      console.error('Error loading basket:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBasketSilent = async () => {
    try {
      const items = await getBasket();
      setBasket((prevBasket) =>
        hasBasketChanged(prevBasket, items) ? items : prevBasket
      );
    } catch (error) {
      console.error('Error refreshing basket:', error);
    }
  };

  const refreshBasket = useCallback(async () => {
    await loadBasket();
  }, []);

  const addItem = useCallback(async (item: BasketItem) => {
    try {
      await addToBasket(item);
      await loadBasket();
    } catch (error) {
      console.error('Error adding item to basket:', error);
      throw error;
    }
  }, []);

  const removeItem = useCallback(async (itemId: number) => {
    try {
      await removeFromBasket(itemId);
      await loadBasket();
    } catch (error) {
      console.error('Error removing item from basket:', error);
      throw error;
    }
  }, []);

  const updateQuantity = useCallback(async (itemId: number, quantity: number) => {
    try {
      await updateBasketQuantity(itemId, quantity);
      await loadBasket();
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  }, []);

  const clearItems = useCallback(async () => {
    try {
      await clearBasket();
      await loadBasket();
    } catch (error) {
      console.error('Error clearing basket:', error);
      throw error;
    }
  }, []);

  const isInBasket = useCallback((itemId: number) => {
    return basket.some((item) => item.id === itemId);
  }, [basket]);

  const getQuantity = useCallback((itemId: number) => {
    const item = basket.find((i) => i.id === itemId);
    return item?.quantity ?? 0;
  }, [basket]);

  return (
    <BasketContext.Provider
      value={{
        basket,
        loading,
        addItem,
        removeItem,
        updateQuantity,
        clearItems,
        isInBasket,
        getQuantity,
        refreshBasket,
      }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  const context = useContext(BasketContext);
  if (context === undefined) {
    throw new Error('useBasket must be used within a BasketProvider');
  }
  return context;
}
