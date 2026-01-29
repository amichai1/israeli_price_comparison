import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { searchProducts } from "@/lib/supabase-service";
import { useBasket } from "@/lib/basket-context";
import { useCity } from "@/lib/city-context";
import { getRTLTextStyle } from "@/lib/rtl-utils";
import { Item } from "@/types";

export default function SearchScreen() {
  const colors = useColors();
  const { selectedCity, setSelectedCity, availableCities } = useCity();
  const { basket, addItem, isInBasket } = useBasket();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  // Load basket count on mount
  useEffect(() => {
    loadAddedItems();
  }, []);

  const loadAddedItems = async () => {
    // This will use the basket from context, which auto-updates
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        performSearch(searchQuery);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setLoading(true);
    try {
      const items = await searchProducts(query);
      setResults(items);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBasket = async (item: Item) => {
    try {
      await addItem(item);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error adding to basket:", error);
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const itemInBasket = isInBasket(item.id);
    const nameStyle = getRTLTextStyle(item.name);
    
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text 
              className="text-base font-semibold text-foreground mb-1"
              style={nameStyle}
            >
              {item.name}
            </Text>
            <Text className="text-sm text-muted">
              Barcode: {item.barcode}
            </Text>
            {item.unit_measure && (
              <Text className="text-sm text-muted">
                Unit: {item.unit_measure}
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            onPress={() => !itemInBasket && handleAddToBasket(item)}
            disabled={itemInBasket}
            activeOpacity={0.7}
            className={`px-4 py-2 rounded-lg ${
              itemInBasket ? "bg-success/20" : "bg-primary"
            }`}
          >
            {itemInBasket ? (
              <Text className="text-success font-semibold text-sm">Added</Text>
            ) : (
              <Text className="text-white font-semibold text-sm">Add</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }
    
    if (searchQuery.trim().length === 0) {
      return (
        <View className="items-center justify-center py-12">
          <IconSymbol
            name="magnifyingglass"
            size={64}
            color={colors.muted}
          />
          <Text className="text-lg text-muted mt-4 text-center">
            Search for products by name or barcode
          </Text>
        </View>
      );
    }
    
    return (
      <View className="items-center justify-center py-12">
        <Text className="text-lg text-muted text-center">
          No products found for "{searchQuery}"
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      {/* Header */}
      <View className="mb-4 flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-foreground mb-2">
            Search Products
          </Text>
          <Text className="text-base text-muted">
            Find and compare prices across Israeli supermarkets
          </Text>
        </View>
        
        {basket.length > 0 && (
          <View className="bg-primary rounded-full px-3 py-2 ml-3">
            <Text className="text-white font-bold text-lg">
              {basket.length}
            </Text>
          </View>
        )}
      </View>

      {/* City Selector */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-foreground mb-2">City</Text>
        <TouchableOpacity
          onPress={() => setShowCityPicker(!showCityPicker)}
          activeOpacity={0.7}
          className="bg-surface border border-border rounded-xl px-4 py-3 flex-row justify-between items-center"
        >
          <Text className="text-foreground font-medium">{selectedCity}</Text>
          <IconSymbol
            name="chevron.down"
            size={20}
            color={colors.foreground}
          />
        </TouchableOpacity>
        
        {showCityPicker && (
          <View className="mt-2 bg-surface border border-border rounded-xl overflow-hidden">
            {availableCities.map((city) => (
              <TouchableOpacity
                key={city}
                onPress={() => {
                  setSelectedCity(city);
                  setShowCityPicker(false);
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                activeOpacity={0.7}
                className={`px-4 py-3 border-b border-border ${
                  city === selectedCity ? "bg-primary/10" : ""
                }`}
              >
                <Text
                  className={`font-medium ${
                    city === selectedCity ? "text-primary" : "text-foreground"
                  }`}
                >
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View className="relative mb-6">
        <View className="absolute left-3 top-3 z-10">
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={colors.muted}
          />
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or barcode..."
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl pl-10 pr-8 py-3.5 text-foreground"
          returnKeyType="search"
          style={getRTLTextStyle(searchQuery)}
        />
      </View>

      {/* Results List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </ScreenContainer>
  );
}
